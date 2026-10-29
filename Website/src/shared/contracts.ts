import { z } from 'zod';
const encoded = z.string().min(1).max(250000);
export const kinds = ['profile', 'assessment', 'draft', 'plan', 'event', 'memory', 'care', 'student', 'student-summary', 'checkin', 'availability', 'chat', 'proposal', 'notification', 'cloud', 'recurrence', 'import'] as const;
export type RecordKind = typeof kinds[number];
export const envelopeSchema = z.object({
    id: z.string().min(1).max(180), familyId: z.string().min(1), kind: z.enum(kinds), version: z.number().int().positive(),
    authorId: z.string(), senderId: z.string(), recipientIds: z.array(z.string()).min(1).max(40), editorIds: z.array(z.string()).min(1).max(40),
    nonce: encoded, ciphertext: encoded, wraps: z.record(z.string(), encoded), signature: encoded, deleted: z.boolean().default(false),
}).strict();
export type EncryptedEnvelope = z.infer<typeof envelopeSchema>;
export const vaultSchema = z.object({ salt: encoded, nonce: encoded, ciphertext: encoded, recoveryNonce: encoded, recoveryCiphertext: encoded, version: z.literal(1) }).strict();
export type VaultBackup = z.infer<typeof vaultSchema>;
export interface PublicIdentity {
    userId: string;
    publicKey: string;
    signingKey: string;
}
export interface Member extends PublicIdentity {
    role: string;
    status: string;
    ageGroup: string;
    displayName?: string;
}
export interface SessionUser {
    id: string;
    name: string;
    email: string;
    username?: string | null;
    ageGroup?: string;
    relationship?: string;
}
export interface FamilySummary {
    id: string;
    role: string;
    status: string;
    timezone: string;
    ownerId: string;
}
export interface WorkspaceRecord {
    id: string;
    kind: RecordKind;
    authorId: string;
    recipientIds: string[];
    editorIds: string[];
    version: number;
    data: Record<string, unknown>;
    cloudAllowed: boolean;
}
export interface RecordPayload {
    data: Record<string, unknown>;
    cloudAllowed: boolean;
}

export interface InvitationSummary {
    id: string;
    email: string;
    ageGroup: string;
    role: string;
    expiresAt: string;
    inviter?: string;
}
