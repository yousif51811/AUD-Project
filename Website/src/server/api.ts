import { createHash, randomBytes } from 'node:crypto';
import sodium from 'libsodium-wrappers-sumo';
import { z } from 'zod';
import { auth } from './auth';
import { db } from './db';
import { Prisma } from '@prisma/client';
import type { EncryptedEnvelope } from '@/shared/contracts';
import { envelopeSchema, vaultSchema } from '@/shared/contracts';
import { canonical } from '@/lib/canonical';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const json = (x: unknown, status = 200) => Response.json(x, { status });
class Fault extends Error {
    constructor(public status: number, message: string) { super(message); }
}
async function member(userId: string, familyId: string, owner = false, client: Prisma.TransactionClient = db) {
    const m = await client.familyMembership.findUnique({ where: { familyId_userId: { familyId, userId } } });
    if (!m || m.status !== 'ACTIVE' || (owner && m.role !== 'OWNER'))
        throw new Fault(403, 'An active, authorized family membership is required.');
    return m;
}
export async function handle(request: Request, path: string[]) {
    try {
        if (!['GET', 'HEAD'].includes(request.method)) {
            const origin = request.headers.get('origin');
            const allowed = new URL(process.env.APP_URL ?? request.url).origin;
            if (origin !== allowed && origin !== allowed.replace('localhost', '127.0.0.1'))
                throw new Fault(403, 'This request must come from the application.');
        }
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session)
            throw new Fault(401, 'Sign in to continue.');
        const userId = session.user.id;
        if (request.method !== 'GET') {
            const bucket = `workspace:${userId}:${Math.floor(Date.now() / 60000)}`;
            const limit = await db.rateLimit.upsert({ where: { key: bucket }, create: { key: bucket, count: 1, lastRequest: Date.now() }, update: { count: { increment: 1 } } });
            if (limit.count > 120)
                throw new Fault(429, 'Please wait a minute before trying again.');
        }
        const body = async () => { const text = await request.text(); if (text.length > 1000000)
            throw new Fault(413, 'This record is too large.'); return JSON.parse(text); };
        const [resource, id, action] = path;
        if (resource === 'username' && request.method === 'POST') {
            const { username } = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/) }).parse(await body());
            await db.user.update({ where: { id: userId }, data: { username } });
            return json({ username });
        }
        if (resource === 'invitations' && request.method === 'GET') {
            const invitations = await db.familyInvitation.findMany({ where: { email: session.user.email.toLowerCase(), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, include: { family: true } });
            const owners = await db.user.findMany({ where: { id: { in: invitations.map(i => i.family.ownerId) } }, select: { id: true, name: true } });
            return json(invitations.map(i => ({ id: i.id, email: i.email, ageGroup: i.ageGroup, role: i.role, expiresAt: i.expiresAt, inviter: owners.find(o => o.id === i.family.ownerId)?.name })));
        }
        if (resource === 'identity') {
            if (request.method === 'GET')
                return json(await db.encryptionIdentity.findUnique({ where: { userId } }));
            const input = z.object({ publicKey: z.string().max(100), signingKey: z.string().max(100), vault: vaultSchema }).parse(await body());
            await sodium.ready;
            try {
                if (sodium.from_base64(input.publicKey).length !== 32 || sodium.from_base64(input.signingKey).length !== 32 || sodium.from_base64(input.vault.salt).length !== 16 || sodium.from_base64(input.vault.nonce).length !== 24 || sodium.from_base64(input.vault.recoveryNonce).length !== 24)
                    throw new Error();
            }
            catch {
                throw new Fault(400, 'Invalid encryption identity.');
            }
            const original = await db.encryptionIdentity.findUnique({ where: { userId } });
            if (original && (original.publicKey !== input.publicKey || original.signingKey !== input.signingKey))
                throw new Fault(409, 'Encryption identity replacement is not supported. Restore the existing vault.');
            return json(await db.encryptionIdentity.upsert({ where: { userId }, create: { userId, ...input }, update: { vault: input.vault } }));
        }
        if (resource === 'families' && !id) {
            if (request.method === 'GET') {
                const rows = await db.familyMembership.findMany({ where: { userId, status: { in: ['ACTIVE', 'PENDING'] } }, orderBy: { joinedAt: 'asc' }, include: { family: true } });
                return json(rows.map(m => ({ id: m.familyId, role: m.role, status: m.status, timezone: m.family.timezone, ownerId: m.family.ownerId })));
            }
            const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
            if (!['adult', 'older'].includes(u.ageGroup))
                throw new Fault(403, 'Ask an adult to create or invite you to a family.');
            if (!await db.encryptionIdentity.findUnique({ where: { userId } }))
                throw new Fault(400, 'Set up your encrypted vault first.');
            const { timezone } = z.object({ timezone: z.string().max(80).default('Asia/Dubai') }).parse(await body());
            try {
                new Intl.DateTimeFormat('en', { timeZone: timezone });
            }
            catch {
                throw new Fault(400, 'Choose a valid timezone.');
            }
            return json(await db.$transaction(async tx => {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))::text`;
                if (await tx.familyMembership.count({ where: { userId, status: { in: ['ACTIVE', 'PENDING'] } } }))
                    throw new Fault(409, 'You already have a family. Open your family to continue.');
                return tx.family.create({ data: { ownerId: userId, timezone, memberships: { create: { userId, role: 'OWNER', status: 'ACTIVE' } } } });
            }));
        }
        if (resource === 'join' && request.method === 'POST') {
            const input = z.object({ token: z.string().min(20).max(200).optional(), invitationId: z.string().max(100).optional() }).refine(x => !!x.token !== !!x.invitationId).parse(await body());
            const row = await db.familyInvitation.findUnique({ where: input.token ? { tokenHash: digest(input.token) } : { id: input.invitationId! } });
            if (!row || row.revokedAt || row.acceptedAt || row.expiresAt < new Date() || row.email.toLowerCase() !== session.user.email.toLowerCase())
                throw new Fault(400, 'This invitation is expired, used, or belongs to another email.');
            const targetUser = await db.user.findUniqueOrThrow({ where: { id: userId } });
            if (targetUser.ageGroup !== row.ageGroup)
                throw new Fault(400, 'Ask for an invitation matching your account age group.');
            if (!await db.encryptionIdentity.findUnique({ where: { userId } }))
                throw new Fault(400, 'Set up your vault before joining.');
            await db.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))::text`;
                if (await tx.familyMembership.count({ where: { userId, status: { in: ['ACTIVE', 'PENDING'] } } }))
                    throw new Fault(409, 'You already have a family. Open your family to continue.');
                const accepted = await tx.familyInvitation.updateMany({ where: { id: row.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
                if (!accepted.count) throw new Fault(409, 'This invitation has already been accepted.');
                const membership = { role: row.ageGroup === 'child' ? 'CHILD' : row.role, status: 'PENDING' };
                await tx.familyMembership.upsert({ where: { familyId_userId: { familyId: row.familyId, userId } }, create: { familyId: row.familyId, userId, ...membership }, update: membership });
            });
            return json({ familyId: row.familyId, status: 'PENDING' });
        }
        if (resource === 'families' && id) {
            await member(userId, id, request.method !== 'GET');
            if (action === 'members') {
                if (request.method === 'GET') {
                    const rows = await db.familyMembership.findMany({ where: { familyId: id }, include: { user: true } });
                    const historic = await db.encryptedRecord.findMany({ where: { familyId: id, recipients: { has: userId } }, select: { envelope: true } });
                    const historicSenders = historic.map(r => envelopeSchema.parse(r.envelope).senderId);
                    const keys = await db.encryptionIdentity.findMany({ where: { userId: { in: [...rows.map(m => m.userId), ...historicSenders] } } });
                    return json([...rows.map(m => ({ ...keys.find(k => k.userId === m.userId), vault: undefined, userId: m.userId, role: m.role, status: m.status, ageGroup: m.user.ageGroup, displayName: m.user.name })), ...keys.filter(k => !rows.some(m => m.userId === k.userId)).map(k => ({ userId: k.userId, publicKey: k.publicKey, signingKey: k.signingKey, role: 'MEMBER', status: 'LEFT', ageGroup: 'adult' }))]);
                }
                const input = z.object({ userId: z.string(), operation: z.enum(['approve', 'remove', 'transfer', 'role']), role: z.enum(['MEMBER','VIEWER']).optional() }).parse(await body());
                if (input.userId === userId)
                    throw new Fault(400, 'Select another family member.');
                const target = await db.familyMembership.findUnique({ where: { familyId_userId: { familyId: id, userId: input.userId } } });
                if (!target || !['ACTIVE', 'PENDING'].includes(target.status))
                    throw new Fault(404, 'Member not found.');
                if (input.operation === 'transfer' && target.status !== 'ACTIVE')
                    throw new Fault(400, 'Approve this member first.');
                const targetUser = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
                if (input.operation === 'transfer' && !['adult', 'older'].includes(targetUser.ageGroup))
                    throw new Fault(403, 'Transfer ownership to an adult.');
                if(input.operation === 'role' && (!input.role || target.role === 'OWNER' || targetUser.ageGroup === 'child' || target.status !== 'ACTIVE')) throw new Fault(400, 'Choose an active non-owner adult or teen membership.');
                await db.$transaction(async (tx) => {
                    if(input.operation === 'role') await tx.familyMembership.update({where:{id:target.id},data:{role:input.role!}});
                    else if (input.operation === 'transfer') {
                        await tx.family.update({ where: { id }, data: { ownerId: input.userId } });
                        await tx.familyMembership.update({ where: { id: target.id }, data: { role: 'OWNER' } });
                        await tx.familyMembership.update({ where: { familyId_userId: { familyId: id, userId } }, data: { role: 'MEMBER' } });
                    }
                    else
                        await tx.familyMembership.update({ where: { id: target.id }, data: { status: input.operation === 'approve' ? 'ACTIVE' : 'REVOKED' } });
                });
                return json({ ok: true });
            }
            if (action === 'invite') {
                await member(userId, id, true);
                if (request.method === 'GET') return json(await db.familyInvitation.findMany({ where: { familyId: id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, email: true, ageGroup: true, role: true, expiresAt: true } }));
                if (request.method === 'DELETE') {
                    const { invitationId } = z.object({ invitationId: z.string() }).parse(await body());
                    await db.familyInvitation.updateMany({ where: { id: invitationId, familyId: id, acceptedAt: null }, data: { revokedAt: new Date() } });
                    return json({ ok: true });
                }
                const data = z.object({ email: z.email().optional(), target: z.string().trim().min(3).max(254).optional(), ageGroup: z.enum(['adult', 'teen', 'child', 'older']), role: z.enum(['MEMBER', 'VIEWER']).default('MEMBER') }).refine(x => !!x.email || !!x.target).parse(await body());
                const target = (data.target ?? data.email!).toLowerCase().replace(/^@/, '');
                const recipient = await db.user.findFirst({ where: target.includes('@') ? { email: target } : { username: target } });
                if (!recipient && !target.includes('@')) throw new Fault(404, 'Username not found. Invite them using their email instead.');
                const email = recipient?.email.toLowerCase() ?? z.email().parse(target);
                if (email === session.user.email.toLowerCase()) throw new Fault(400, 'Invite another person to your family.');
                if (recipient && await db.familyMembership.count({ where: { userId: recipient.id, status: { in: ['ACTIVE', 'PENDING'] } } })) throw new Fault(409, 'This person already has a family.');
                const token = randomBytes(32).toString('base64url');
                await db.familyInvitation.create({ data: { familyId: id, email, ageGroup: recipient?.ageGroup ?? data.ageGroup, role: (recipient?.ageGroup ?? data.ageGroup) === 'child' ? 'CHILD' : data.role, tokenHash: digest(token), expiresAt: new Date(Date.now() + 48 * 3600000) } });
                return json({ token });
            }
            if (action === 'timezone') {
                const { timezone } = z.object({ timezone: z.string().max(80) }).parse(await body());
                try {
                    new Intl.DateTimeFormat('en', { timeZone: timezone });
                }
                catch {
                    throw new Fault(400, 'Choose a valid IANA timezone.');
                }
                await db.family.update({ where: { id }, data: { timezone } });
                return json({ ok: true });
            }
            if (action === 'delete') {
                const data = z.object({ confirmation: z.literal('DELETE_FAMILY') }).parse(await body());
                void data;
                await db.family.delete({ where: { id } });
                return json({ ok: true });
            }
        }
        if (resource === 'records') {
            if (request.method === 'GET') {
                const familyId = new URL(request.url).searchParams.get('familyId') ?? '';
                await member(userId, familyId);
                return json(await db.encryptedRecord.findMany({ where: { familyId, recipients: { has: userId } }, orderBy: { updatedAt: 'asc' }, select: { envelope: true, updatedAt: true } }));
            }
            const input = await body();
            const envelopes = id === 'batch' ? z.object({ records: z.array(envelopeSchema).min(1).max(60) }).parse(input).records : [envelopeSchema.parse(input)];
            await db.$transaction(async (client) => { for (const envelope of envelopes)
                await writeEnvelope(envelope, userId, client); });
            return json({ ok: true });
        }
        if (resource === 'account' && request.method === 'DELETE') {
            const { confirmation } = z.object({ confirmation: z.literal('DELETE') }).parse(await body());
            void confirmation;
            if (await db.family.count({ where: { ownerId: userId } }))
                throw new Fault(409, 'Transfer ownership or delete your family first.');
            await db.$transaction([db.encryptedRecord.deleteMany({ where: { authorId: userId, recipients: { equals: [userId] } } }), db.encryptionIdentity.updateMany({ where: { userId }, data: { vault: Prisma.JsonNull } }), db.user.delete({ where: { id: userId } })]);
            return json({ ok: true });
        }
        throw new Fault(404, 'Not found.');
    }
    catch (error) {
        if (error instanceof Fault)
            return json({ error: error.message }, error.status);
        if (error instanceof z.ZodError || error instanceof SyntaxError)
            return json({ error: 'Check the information and try again.' }, 400);
        if ((error as {
            code?: string;
        })?.code === 'P2002')
            return json({ error: 'This record already exists. Reload before trying again.' }, 409);
        return json({ error: 'The service is unavailable. Check your connection and database setup.' }, 503);
    }
}
async function writeEnvelope(e: EncryptedEnvelope, userId: string, client: Prisma.TransactionClient) {
    const actor = await member(userId, e.familyId, false, client);
    if (e.kind === 'profile' && actor.role !== 'OWNER')
        throw new Fault(403, 'Only the family owner can edit household settings.');
    if (e.kind === 'cloud' && actor.role !== 'OWNER')
        throw new Fault(403, 'Only the family owner can configure cloud credentials.');
    if (actor.role === 'VIEWER')
        throw new Fault(403, 'This membership is read-only.');
    if (e.senderId !== userId)
        throw new Fault(403, 'Invalid sender.');
    if (!e.recipientIds.includes(userId) || e.editorIds.some(x => !e.recipientIds.includes(x)) || e.recipientIds.some(x => !e.wraps[x]) || Object.keys(e.wraps).some(x => !e.recipientIds.includes(x)))
        throw new Fault(400, 'Invalid record audience.');
    const active = await client.familyMembership.findMany({ where: { familyId: e.familyId, status: 'ACTIVE' } });
    if (e.recipientIds.some(x => !active.some(m => m.userId === x)))
        throw new Fault(400, 'Recipients must be active members.');
    const identity = await client.encryptionIdentity.findUniqueOrThrow({ where: { userId } });
    await sodium.ready;
    const { signature, ...unsigned } = e;
    if (!sodium.crypto_sign_verify_detached(sodium.from_base64(signature), canonical(unsigned), sodium.from_base64(identity.signingKey)))
        throw new Fault(400, 'Record signature is invalid.');
    const old = await client.encryptedRecord.findUnique({ where: { id: e.id } });
    if (old) {
        const prior = envelopeSchema.parse(old.envelope);
        if (old.familyId !== e.familyId || old.authorId !== e.authorId || old.kind !== e.kind || (!prior.editorIds.includes(userId) && !(e.kind === 'profile' && actor.role === 'OWNER')))
            throw new Fault(403, 'You cannot change this record.');
        if (e.authorId !== userId && !(e.kind === 'profile' && actor.role === 'OWNER') && (canonical(prior.recipientIds.filter(x => active.some(m => m.userId === x)).sort()) !== canonical([...e.recipientIds].sort()) || canonical(prior.editorIds.filter(x => active.some(m => m.userId === x)).sort()) !== canonical([...e.editorIds].sort())))
            throw new Fault(403, 'Only the author may change sharing.');
        const result = await client.encryptedRecord.updateMany({ where: { id: e.id, version: e.version - 1 }, data: { version: e.version, recipients: e.recipientIds, envelope: e, deleted: e.deleted } });
        if (!result.count)
            throw new Fault(409, 'This record changed elsewhere. Reload before applying your change.');
    }
    else {
        if (e.authorId !== userId || e.version !== 1)
            throw new Fault(403, 'Invalid new record.');
        await client.encryptedRecord.create({ data: { id: e.id, familyId: e.familyId, kind: e.kind, authorId: userId, version: 1, recipients: e.recipientIds, envelope: e, deleted: e.deleted } });
    }
}
