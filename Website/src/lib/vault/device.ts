import type { Identity } from './crypto';

// This convenience cache stays on this browser. It is never sent to the server.
// Same-origin code and someone using an unlocked browser can access it.
async function database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('familymind-device-access-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('accounts');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Device storage is busy.'));
    });
}
async function entry(userId: string, value?: unknown, remove = false): Promise<unknown> {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction('accounts', value !== undefined || remove ? 'readwrite' : 'readonly');
            const store = transaction.objectStore('accounts');
            const request = remove ? store.delete(userId) : value !== undefined ? store.put(value, userId) : store.get(userId);
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally { db.close(); }
}
export async function rememberIdentity(userId: string, identity: Identity): Promise<boolean> {
    try {
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(userId) }, key, new TextEncoder().encode(JSON.stringify(identity)));
        await entry(userId, { key, nonce, ciphertext });
        return true;
    } catch { return false; }
}
export async function rememberedIdentity(userId: string): Promise<Identity | null> {
    try {
        const saved = await entry(userId) as { key: CryptoKey; nonce: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer } | undefined;
        if (!saved) return null;
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: saved.nonce, additionalData: new TextEncoder().encode(userId) }, saved.key, saved.ciphertext);
        return JSON.parse(new TextDecoder().decode(plaintext));
    } catch { return null; }
}
export async function forgetIdentity(userId: string): Promise<void> {
    await entry(userId, undefined, true).catch(() => {});
}
