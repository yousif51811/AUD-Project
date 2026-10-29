// Adapted from the team-source authentication configuration. Household content is never sent here.
import { username } from 'better-auth/plugins';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { addOAuthServerContext, createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { APIError } from 'better-auth/api';
import { hash, compare } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { db } from './db';
import { googleCredentials, googleEnrollmentSchema, googleSignupSchema, validGoogleInvitation } from './google';
const google = googleCredentials();
const origin = process.env.APP_URL ?? 'http://localhost:3000';
export const auth = betterAuth({
    plugins: [username({ displayUsername: false, usernameValidator: value => /^[a-zA-Z0-9_]{3,30}$/.test(value) })],
    appName: 'FamilyMind AI', baseURL: origin, secret: process.env.AUTH_SECRET,
    database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
    trustedOrigins: [origin, ...(origin.includes('localhost') ? [origin.replace('localhost', '127.0.0.1')] : [])],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: true, requireEmailVerification: false, password: { hash: p => hash(p, 12), verify: ({ password, hash: h }) => compare(password, h) } },
    socialProviders: google ? { google: { ...google, prompt: 'select_account', accessType: 'online', includeGrantedScopes: false, disableImplicitSignUp: true, disableIdTokenSignIn: true } } : {},
    // Existing email accounts must explicitly link Google while signed in. Never silently merge them.
    account: { encryptOAuthTokens: true, accountLinking: { enabled: true, disableImplicitLinking: true, allowDifferentEmails: false } },
    databaseHooks: { user: { create: { before: async (user, context) => {
        if (context?.path !== '/callback/google' && !(context?.path === '/callback/:id' && context.params?.id === 'google')) return;
        const state = await getOAuthState();
        const enrollment = googleEnrollmentSchema.safeParse(state?.serverContext?.familymindEnrollment);
        if (!enrollment.success || !user.emailVerified)
            throw new APIError('FORBIDDEN', { code: 'GOOGLE_ENROLLMENT_REQUIRED', message: 'Start Google account creation again from this website.' });
        const { invitationId, ageGroup, relationship } = enrollment.data;
        if (invitationId) {
            const invite = await db.familyInvitation.findUnique({ where: { id: invitationId } });
            if (!validGoogleInvitation(invite, enrollment.data, user.email))
                throw new APIError('FORBIDDEN', { code: 'GOOGLE_INVITATION_MISMATCH', message: 'Use the invited Google email with a current invitation.' });
        } else if (ageGroup === 'teen' || ageGroup === 'child') {
            throw new APIError('FORBIDDEN', { code: 'GOOGLE_INVITATION_REQUIRED', message: 'An adult invitation is required.' });
        }
        return { data: { ...user, ageGroup, relationship } };
    } } } },
    verification: { modelName: 'VerificationToken' },
    session: { expiresIn: 7 * 24 * 3600, updateAge: 24 * 3600, cookieCache: { enabled: false } },
    user: { additionalFields: { ageGroup: { type: 'string', defaultValue: 'adult', input: true }, relationship: { type: 'string', defaultValue: '', input: true } } },
    hooks: { before: createAuthMiddleware(async (ctx) => {
            if (ctx.path === '/sign-in/social' && ctx.body?.provider === 'google' && ctx.body?.requestSignUp === true) {
                const signup = googleSignupSchema.safeParse(ctx.body.additionalData);
                if (!signup.success) throw new APIError('BAD_REQUEST', { code: 'GOOGLE_ENROLLMENT_REQUIRED', message: 'Choose an age group and start again.' });
                const { invitationToken, ageGroup, relationship } = signup.data;
                let invitationId: string | undefined;
                if (invitationToken) {
                    const invite = await db.familyInvitation.findUnique({ where: { tokenHash: createHash('sha256').update(invitationToken).digest('hex') } });
                    if (!validGoogleInvitation(invite, signup.data))
                        throw new APIError('FORBIDDEN', { code: 'GOOGLE_INVITATION_REQUIRED', message: 'Use a current adult invitation matching your age group.' });
                    invitationId = invite!.id;
                } else if (ageGroup === 'teen' || ageGroup === 'child') {
                    throw new APIError('FORBIDDEN', { code: 'GOOGLE_INVITATION_REQUIRED', message: 'Ask an adult for an invitation.' });
                }
                // Server-controlled state survives the redirect. Ignore client-supplied serverContext.
                await addOAuthServerContext({ familymindEnrollment: { ageGroup, relationship, invitationId } });
            }
            if ((ctx.path === '/sign-in/social' || ctx.path === '/link-social') && ctx.body?.provider === 'google') {
                // Keep the invitation secret and arbitrary client data out of persisted OAuth state.
                ctx.body.additionalData = undefined;
                ctx.body.scopes = undefined;
                ctx.body.additionalParams = undefined;
            }
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
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 50, customRules: { '/sign-in/username': { window: 60, max: 5 }, '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 3600, max: 5 }, '/sign-in/social': { window: 60, max: 10 }, '/link-social': { window: 60, max: 5 } } },
    advanced: { useSecureCookies: process.env.NODE_ENV === 'production' }, telemetry: { enabled: false }, logger: { disabled: true },
});
