// Never pass database errors, credentials or proxy HTML through to the browser.
export function accountUnavailable(error?: unknown): Response {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const needsMigration = code === 'P2021' || code === 'P2022';
    return Response.json({
        code: needsMigration ? 'ACCOUNT_DATABASE_UPDATE_REQUIRED' : 'ACCOUNT_SERVICE_UNAVAILABLE',
        message: needsMigration ? 'Account access is temporarily unavailable while the site is being updated. Please try again later.' : 'The account service is temporarily unavailable. Please try again later.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
export function safeAuthHandler(handler: (request: Request) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
        try {
            const response = await handler(request);
            // Preserve OAuth redirects/cookies and normal validation/rate-limit responses.
            if (response.status >= 500) return accountUnavailable();
            return response;
        } catch (error) { return accountUnavailable(error); }
    };
}
