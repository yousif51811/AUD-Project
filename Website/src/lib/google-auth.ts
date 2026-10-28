/** Use fixed UI messages; never echo OAuth query strings or provider error descriptions. */
export function googleAuthError(code?: string | null): string {
  const normalized = code?.toLowerCase();
  if (normalized === 'access_denied') return 'Google sign-in was cancelled. You can try again or use email.';
  if (['account_not_linked', 'oauth_account_not_linked', 'email_already_exists'].includes(normalized ?? '')) return 'This email already has an account. Sign in with email, then link Google from Your account.';
  if (['signup_disabled', 'sign_up_disabled', 'user_not_found'].includes(normalized ?? '')) return 'No Google account is connected yet. Choose Create account, or sign in with email and link Google.';
  if (normalized === 'google_invitation_required') return 'Children and teenagers need a current adult invitation matching their age group.';
  if (normalized === 'google_invitation_mismatch') return 'Use the Google email named in your invitation. Check that the invitation is still valid.';
  if (['state_mismatch', 'state_not_found', 'state_expired', 'invalid_state', 'google_enrollment_required'].includes(normalized ?? '')) return 'This Google sign-in attempt expired or could not be verified. Please start again.';
  return 'Google sign-in could not finish. Try again or use email. Existing email accounts can link Google from Your account.';
}
