// Adapted from the team-source authentication configuration. Household content is never sent here.
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware } from 'better-auth/api';
import { APIError } from 'better-auth/api';
import { hash, compare } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { db } from './db';
const origin = process.env.APP_URL ?? 'http://localhost:3000';
export const auth = betterAuth({
    appName: 'FamilyMind AI', baseURL: origin, secret: process.env.AUTH_SECRET,
    database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
    trustedOrigins: [origin, ...(origin.includes('localhost') ? [origin.replace('localhost', '127.0.0.1')] : [])],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: true, requireEmailVerification: false, password: { hash: p => hash(p, 12), verify: ({ password, hash: h }) => compare(password, h) } },
    verification: { modelName: 'VerificationToken' },
    session: { expiresIn: 7 * 24 * 3600, updateAge: 24 * 3600, cookieCache: { enabled: false } },
    user: { additionalFields: { ageGroup: { type: 'string', defaultValue: 'adult', input: true }, relationship: { type: 'string', defaultValue: '', input: true } } },
    hooks: { before: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== '/sign-up/email')
                return;
            const age = ctx.body?.ageGroup ?? 'adult';
            if (!['adult', 'teen', 'child', 'older'].includes(age))
                throw new APIError('BAD_REQUEST', { message: 'Choose an age group.' });
            if (age === 'teen' || age === 'child') {
                const token = String(ctx.body?.invitationToken ?? '');
                const invite = await db.familyInvitation.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
                if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date() || invite.email.toLowerCase() !== String(ctx.body?.email).toLowerCase() || invite.ageGroup !== age)
                    throw new APIError('FORBIDDEN', { message: 'Ask an adult for an invitation matching your email and age group.' });
            }
        }) },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 50, customRules: { '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 3600, max: 5 } } },
    advanced: { useSecureCookies: process.env.NODE_ENV === 'production' }, telemetry: { enabled: false }, logger: { disabled: true },
});
