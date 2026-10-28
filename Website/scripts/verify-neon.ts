import { PrismaClient } from '@prisma/client';
import { createIdentity, protectIdentity, unlockIdentity, encryptRecord, decryptRecord } from '../src/lib/vault/crypto';
import type { EncryptedEnvelope } from '../src/shared/contracts';

// Deliberately separate from the local-only fixture suite. This explicitly opted-in
// smoke check creates two disposable accounts on Neon, then removes only their rows.
try { process.loadEnvFile('.env'); } catch { /* allow injected environments */ }
const base = process.env.NEON_VERIFY_BASE_URL ?? 'http://127.0.0.1:3004';
const target = new URL(base), database = new URL(process.env.DATABASE_URL ?? '');
if (!process.argv.includes('--allow-synthetic-writes') || !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    !database.hostname.endsWith('.neon.tech') || !process.env.NEON_BRANCH) {
  throw new Error('Requires --allow-synthetic-writes, a local running app, and a linked Neon database.');
}
const db = new PrismaClient(), userIds: string[] = [];
const passphrase = 'Separate synthetic Neon verification vault';
function check(value: unknown, label: string): asserts value { if (!value) throw new Error(label); }
async function request(path: string, body?: unknown, cookie = '') {
  return fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
}
async function account() {
  const email = `fm-neon-${crypto.randomUUID()}@example.test`, password = crypto.randomUUID() + '-synthetic';
  const signup = await request('/api/auth/sign-up/email', { name: 'Synthetic Neon check', email, password, ageGroup: 'adult' });
  check(signup.ok, `Signup failed (HTTP ${signup.status}).`);
  const value = await signup.json(); check(typeof value.user?.id === 'string', 'Signup returned no account.'); userIds.push(value.user.id);
  const login = await request('/api/auth/sign-in/email', { email, password }); check(login.ok, `Sign-in failed (HTTP ${login.status}).`);
  const cookie = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; '); check(cookie, 'Sign-in returned no session.');
  const identity = await createIdentity(), { vault } = await protectIdentity(identity, passphrase);
  const api = (path: string, body?: unknown) => request('/api/familymind/' + path, body, cookie);
  check((await api('identity', { publicKey: identity.publicKey, signingKey: identity.signingKey, vault })).ok, 'Vault save failed.');
  const saved = await (await api('identity')).json();
  check((await unlockIdentity(saved.vault, passphrase)).publicKey === identity.publicKey, 'Vault round-trip failed.');
  return { id: value.user.id as string, email, identity, api };
}
try {
  check((await fetch(base + '/demo')).ok, 'The local app did not serve the sample page.');
  const owner = await account(), member = await account();
  console.log('PASS: HTTP signup, sign-in and encrypted vault round-trip against Neon');
  const created = await owner.api('families', { timezone: 'Asia/Dubai' }); check(created.ok, 'Household creation failed.');
  const family = await created.json();
  check((await member.api('records?familyId=' + family.id)).status === 403, 'Non-member unexpectedly received access.');
  const invite = await owner.api(`families/${family.id}/invite`, { email: member.email, ageGroup: 'adult' }); check(invite.ok, 'Invitation creation failed.');
  check((await member.api('join', { token: (await invite.json()).token })).ok, 'Invitation acceptance failed.');
  check((await owner.api(`families/${family.id}/members`, { userId: member.id, operation: 'approve' })).ok, 'Membership approval failed.');
  const marker = 'SYNTHETIC-NEON-PRIVATE-' + crypto.randomUUID();
  const make = (recipients: typeof owner[]) => encryptRecord({ id: crypto.randomUUID(), familyId: family.id, kind: 'checkin', version: 1, authorId: owner.id, senderId: owner.id, editorIds: [owner.id], recipients: recipients.map(p => ({ userId: p.id, publicKey: p.identity.publicKey, signingKey: p.identity.signingKey })), payload: { data: { mood: 3, energy: 3, note: marker, createdAt: new Date().toISOString() }, cloudAllowed: false } }, owner.identity);
  const shared = await make([owner, member]), privateRecord = await make([owner]);
  check((await owner.api('records', shared)).ok && (await owner.api('records', privateRecord)).ok, 'Encrypted writes failed.');
  const response = await member.api('records?familyId=' + family.id); check(response.ok, 'Member sync failed.');
  const records: { envelope: EncryptedEnvelope }[] = await response.json();
  check(records.length === 1 && records[0].envelope.id === shared.id, 'Recipient filtering failed.');
  const decoded = await decryptRecord(records[0].envelope, member.id, member.identity, { userId: owner.id, publicKey: owner.identity.publicKey, signingKey: owner.identity.signingKey });
  check(decoded.data.note === marker, 'Shared record decryption failed.');
  console.log('PASS: invitation, approval and encrypted sharing between two independent sessions');
  const stored = await db.encryptedRecord.findMany({ where: { familyId: family.id } });
  check(stored.length === 2 && !JSON.stringify(stored).includes(marker), 'Readable content appeared in database records.');
  check((await owner.api('records', shared)).status === 409, 'Stale write was not rejected.');
  check((await owner.api(`families/${family.id}/members`, { userId: member.id, operation: 'remove' })).ok, 'Member removal failed.');
  check((await member.api('records?familyId=' + family.id)).status === 403, 'Removed member retained synchronization access.');
  console.log('PASS: database ciphertext inspection, stale-write rejection and membership revocation');
} catch (error) {
  // Our assertion messages contain fixed labels/statuses, never provider/database payloads.
  console.error('Neon verification failed:', error instanceof Error && error.constructor === Error ? error.message : 'database/network check failed; credentials withheld');
  process.exitCode = 1;
} finally {
  try {
    await db.family.deleteMany({ where: { ownerId: { in: userIds } } });
    await db.encryptionIdentity.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    console.log('PASS: disposable verification accounts and household removed');
  } catch { console.error('Fixture cleanup failed; inspect only the synthetic fm-neon accounts.'); process.exitCode = 1; }
  await db.$disconnect();
}
