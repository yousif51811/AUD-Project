/** Do not show raw gateway pages or malformed server responses to members. */
export async function responseJson(response: Response): Promise<unknown | undefined> {
    try { return await response.json(); } catch { return undefined; }
}
export async function accountError(response: Response, signup: boolean): Promise<string> {
    const result = await responseJson(response);
    const code = result && typeof result === 'object' && 'code' in result ? result.code : undefined;
    if (response.status === 429) return 'Too many attempts. Please wait a moment before trying again.';
    if (code === 'ACCOUNT_DATABASE_UPDATE_REQUIRED') return 'Account access is temporarily unavailable while the site is being updated. Please try again later.';
    if (response.status >= 500) return 'The account service is temporarily unavailable. Please try again later.';
    if (!signup) return 'We could not sign you in. Check your username or email and password.';
    if (code === 'USERNAME_IS_ALREADY_TAKEN') return 'That username is already taken. Choose another.';
    if (code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') return 'An account with this email already exists. Sign in instead.';
    if (code === 'INVALID_USERNAME' || code === 'USERNAME_TOO_SHORT' || code === 'USERNAME_TOO_LONG') return 'Choose a username with 3–30 letters, numbers or underscores.';
    if (response.status === 403) return 'Use a current adult invitation matching your email and age group.';
    return 'Account could not be created. Check your details and try again.';
}
