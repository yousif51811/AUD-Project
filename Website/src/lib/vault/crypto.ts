import sodium from 'libsodium-wrappers-sumo';
import { canonical } from '../canonical';
import { envelopeSchema, type EncryptedEnvelope, type PublicIdentity, type RecordKind, type VaultBackup, type RecordPayload } from '@/shared/contracts';
export interface Identity {
    publicKey: string;
    privateKey: string;
    signingKey: string;
    signingSecret: string;
}
const b64 = (x: Uint8Array) => sodium.to_base64(x);
const bytes = (x: string) => sodium.from_base64(x);
export async function createIdentity(): Promise<Identity> { await sodium.ready; const enc = sodium.crypto_box_keypair(), sign = sodium.crypto_sign_keypair(); return { publicKey: b64(enc.publicKey), privateKey: b64(enc.privateKey), signingKey: b64(sign.publicKey), signingSecret: b64(sign.privateKey) }; }
function sealSecret(text: string, key: Uint8Array) { const nonce = sodium.randombytes_buf(24); return { nonce: b64(nonce), ciphertext: b64(sodium.crypto_secretbox_easy(text, nonce, key)) }; }
function openSecret(ciphertext: string, nonce: string, key: Uint8Array) { return sodium.to_string(sodium.crypto_secretbox_open_easy(bytes(ciphertext), bytes(nonce), key)); }
function derive(passphrase: string, salt: string) { return sodium.crypto_pwhash(32, passphrase, bytes(salt), sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, sodium.crypto_pwhash_ALG_ARGON2ID13); }
export async function protectIdentity(identity: Identity, passphrase: string): Promise<{
    vault: VaultBackup;
    recoveryCode: string;
}> {
    await sodium.ready;
    if (passphrase.length < 12)
        throw new Error('Use at least 12 characters for your vault passphrase.');
    const salt = b64(sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES));
    const key = derive(passphrase, salt);
    const recovery = sodium.randombytes_buf(32);
    const primary = sealSecret(JSON.stringify(identity), key), backup = sealSecret(JSON.stringify(identity), recovery);
    sodium.memzero(key);
    return { vault: { version: 1, salt, ...primary, recoveryNonce: backup.nonce, recoveryCiphertext: backup.ciphertext }, recoveryCode: b64(recovery) };
}
export async function unlockIdentity(vault: VaultBackup, secret: string, recovery = false): Promise<Identity> {
    await sodium.ready;
    let key: Uint8Array | undefined;
    try {
        key = recovery ? bytes(secret.trim()) : derive(secret, vault.salt);
        const value = JSON.parse(openSecret(recovery ? vault.recoveryCiphertext : vault.ciphertext, recovery ? vault.recoveryNonce : vault.nonce, key));
        if (!value.privateKey || !value.signingSecret || b64(sodium.crypto_scalarmult_base(bytes(value.privateKey))) !== value.publicKey || b64(sodium.crypto_sign_ed25519_sk_to_pk(bytes(value.signingSecret))) !== value.signingKey)
            throw new Error();
        return value;
    }
    catch {
        throw new Error('The vault could not be unlocked. Check your passphrase or recovery code.');
    }
    finally {
        if (key)
            sodium.memzero(key);
    }
}
export async function encryptRecord(input: {
    id: string;
    familyId: string;
    kind: RecordKind;
    version: number;
    authorId: string;
    senderId: string;
    editorIds: string[];
    recipients: PublicIdentity[];
    payload: RecordPayload;
    deleted?: boolean;
}, identity: Identity): Promise<EncryptedEnvelope> {
    await sodium.ready;
    const key = sodium.randombytes_buf(32), nonce = sodium.randombytes_buf(24);
    const recipientIds = [...new Set(input.recipients.map(r => r.userId))].sort();
    const wraps = Object.fromEntries(input.recipients.map(r => [r.userId, b64(sodium.crypto_box_seal(key, bytes(r.publicKey)))]));
    const header = { id: input.id, familyId: input.familyId, kind: input.kind, version: input.version, authorId: input.authorId, senderId: input.senderId, recipientIds, editorIds: [...input.editorIds].sort(), deleted: input.deleted ?? false };
    const ciphertext = b64(sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(JSON.stringify(input.payload), canonical(header), null, nonce, key));
    sodium.memzero(key);
    const unsigned = { ...header, nonce: b64(nonce), ciphertext, wraps };
    return { ...unsigned, signature: b64(sodium.crypto_sign_detached(canonical(unsigned), bytes(identity.signingSecret))) };
}
export async function decryptRecord(envelope: EncryptedEnvelope, userId: string, identity: Identity, sender: PublicIdentity): Promise<RecordPayload> {
    await sodium.ready;
    const e = envelopeSchema.parse(envelope);
    const { signature, ...unsigned } = e;
    if (sender.userId !== e.senderId || !sodium.crypto_sign_verify_detached(bytes(signature), canonical(unsigned), bytes(sender.signingKey)))
        throw new Error('Record authenticity could not be verified.');
    if (!e.recipientIds.includes(userId) || !e.wraps[userId])
        throw new Error('This record is not shared with you.');
    const key = sodium.crypto_box_seal_open(bytes(e.wraps[userId]), bytes(identity.publicKey), bytes(identity.privateKey));
    const { nonce, ciphertext, wraps, ...header } = unsigned;
    void wraps;
    try {
        const payload = JSON.parse(sodium.to_string(sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, bytes(ciphertext), canonical(header), bytes(nonce), key)));
        if (!payload || typeof payload.data !== 'object' || payload.data === null || Array.isArray(payload.data) || typeof payload.cloudAllowed !== 'boolean')
            throw new Error('Invalid encrypted record.');
        return payload;
    }
    finally {
        sodium.memzero(key);
    }
}
export async function fingerprint(identity: PublicIdentity) { await sodium.ready; return sodium.to_hex(sodium.crypto_generichash(16, identity.publicKey + identity.signingKey, null)).match(/.{4}/g)!.join(' '); }
