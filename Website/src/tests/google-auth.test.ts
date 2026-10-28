import { describe, expect, it, vi } from 'vitest';
import { googleCredentials, googleEnrollmentSchema, googleSignupSchema, validGoogleInvitation } from '@/server/google';
import { GET as authOptions } from '@/app/api/auth-options/route';
import { googleAuthError } from '@/lib/google-auth';

describe('Google authentication configuration and enrollment', () => {
  it('only enables Google when both trimmed server credentials are present', () => {
    for(const env of [{},{GOOGLE_CLIENT_ID:'id'},{GOOGLE_CLIENT_SECRET:'secret'},{GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'   '}]) expect(googleCredentials(env)).toBeUndefined();
    expect(googleCredentials({GOOGLE_CLIENT_ID:' id ',GOOGLE_CLIENT_SECRET:' secret '})).toEqual({clientId:'id',clientSecret:'secret'});
  });
  it('publishes only a non-cached availability flag, never OAuth credentials', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID','synthetic-client-id');vi.stubEnv('GOOGLE_CLIENT_SECRET','synthetic-client-secret');
    try { const response=authOptions();expect(await response.json()).toEqual({google:true});expect(response.headers.get('Cache-Control')).toBe('no-store'); } finally {vi.unstubAllEnvs();}
  });
  it('requires an explicit age group and never accepts a client enrollment as trusted state', () => {
    expect(googleSignupSchema.safeParse({}).success).toBe(false);
    expect(googleSignupSchema.safeParse({ageGroup:'owner'}).success).toBe(false);
    expect(googleSignupSchema.safeParse({ageGroup:'adult',relationship:'x'.repeat(81)}).success).toBe(false);
    const input=googleSignupSchema.parse({ageGroup:'child',relationship:' Sibling ',serverContext:{ageGroup:'adult'}});
    expect(input).toEqual({ageGroup:'child',relationship:'Sibling'});
    expect(googleEnrollmentSchema.parse({...input,invitationId:'verified-invitation'}).ageGroup).toBe('child');
  });
  it('revalidates invitation age, email, expiry, revocation and reuse at callback', () => {
    const now=new Date('2026-10-28T12:00:00Z');
    const invite={id:'invite',email:'Child@example.test',ageGroup:'child',expiresAt:new Date(now.getTime()+60000),acceptedAt:null,revokedAt:null};
    expect(validGoogleInvitation(invite,{ageGroup:'child'},'child@example.test',now)).toBe(true);
    for(const invalid of [null,{...invite,ageGroup:'adult'},{...invite,expiresAt:now},{...invite,acceptedAt:now},{...invite,revokedAt:now}]) expect(validGoogleInvitation(invalid,{ageGroup:'child'},'child@example.test',now)).toBe(false);
    expect(validGoogleInvitation(invite,{ageGroup:'child'},'other@example.test',now)).toBe(false);
  });
  it('maps only known OAuth errors without echoing provider-supplied text', () => {
    expect(googleAuthError('access_denied')).toContain('cancelled');
    expect(googleAuthError('account_not_linked')).toContain('Sign in with email');
    expect(googleAuthError('GOOGLE_INVITATION_MISMATCH')).toContain('invitation');
    expect(googleAuthError('GOOGLE_INVITATION_REQUIRED')).toContain('adult invitation');
    expect(googleAuthError('state_mismatch')).toContain('verified');
    expect(googleAuthError('sensitive-provider-description-secret')).not.toContain('sensitive-provider');
  });
});
