export class WorkspaceError extends Error {
    constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, data?: unknown, method?: string): Promise<T> {
    const response = await fetch('/api/familymind/' + path, { method: method ?? (data === undefined ? 'GET' : 'POST'), credentials: 'same-origin', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    const value = await response.json();
    if (!response.ok)
        throw new WorkspaceError(value.error ?? 'Request failed.', response.status);
    return value as T;
}
