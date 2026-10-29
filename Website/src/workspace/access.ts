import { createIdentity, protectIdentity, unlockIdentity, type Identity } from '@/lib/vault/crypto';
import { rememberIdentity, rememberedIdentity, forgetIdentity } from '@/lib/vault/device';
import type { VaultBackup } from '@/shared/contracts';
import { api } from './transport';
const pending = new Map<string, Promise<{ identity: Identity | null; recoveryCode: string; remembered: boolean }>>();
export function prepareAccess(userId: string, password?: string) {
    const previous = pending.get(userId);
    if (previous) return previous;
    const operation = (async () => {
        const saved = await api<{ publicKey: string; signingKey: string; vault: VaultBackup } | null>('identity');
        let identity = await rememberedIdentity(userId), recoveryCode = '';
        if (saved && (identity?.publicKey !== saved.publicKey || identity?.signingKey !== saved.signingKey)) identity = null;
        if (!saved) {
            identity = await createIdentity();
            const protection = await protectIdentity(identity, password ?? crypto.randomUUID() + crypto.randomUUID());
            await api('identity', { publicKey: identity.publicKey, signingKey: identity.signingKey, vault: protection.vault });
            recoveryCode = protection.recoveryCode;
        } else if (!identity && password) {
            try { identity = await unlockIdentity(saved.vault, password); } catch { /* Older accounts may have a separate passphrase. */ }
        }
        const remembered = identity ? await rememberIdentity(userId, identity) : false;
        return { identity, recoveryCode, remembered };
    })();
    pending.set(userId, operation);
    void operation.finally(() => pending.delete(userId)).catch(() => {});
    return operation;
}

export async function forgetPreparedAccess(userId: string) {
    await pending.get(userId)?.catch(() => {});
    await forgetIdentity(userId);
}
