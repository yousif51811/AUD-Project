import { z } from 'zod';

/** Only the server imports this module. Neither credential is exposed in public configuration. */
export function googleCredentials(env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string } = {GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET:process.env.GOOGLE_CLIENT_SECRET}) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim(), clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}
export const googleSignupSchema = z.object({
  ageGroup: z.enum(['adult', 'older', 'teen', 'child']),
  relationship: z.string().trim().max(80).default(''),
  invitationToken: z.string().min(20).max(200).optional(),
});
export const googleEnrollmentSchema = googleSignupSchema.omit({ invitationToken: true }).extend({ invitationId: z.string().optional() });
export type GoogleEnrollment = z.infer<typeof googleEnrollmentSchema>;
export interface GoogleInvitation {
  id: string; email: string; ageGroup: string; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null;
}
/** Recheck at callback: a valid invitation at the start may have expired or been revoked. */
export function validGoogleInvitation(invite: GoogleInvitation | null, enrollment: Pick<GoogleEnrollment, 'ageGroup'>, email?: string, now = new Date()) {
  return !!invite && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > now && invite.ageGroup === enrollment.ageGroup
    && (email === undefined || invite.email.toLowerCase() === email.toLowerCase());
}
