import sodium from 'libsodium-wrappers-sumo';
import { z } from 'zod';
import type { Identity } from '@/lib/vault/crypto';
import { connectionSchema, providerIds, type AIConnection, type ProviderId } from './providers';

const bundleSchema = z.object({ version: z.literal(1), scope: z.string(), selected: z.enum(providerIds), connections: z.array(connectionSchema).max(3) }).strict();
const wrapperSchema = z.object({ version: z.literal(1), ciphertext: z.string().min(1).max(50000) }).strict();
export const deviceStorageKey = (scope: string) => 'familymind:ai-device:v1:' + scope;
export async function sealConnections(scope: string, selected: ProviderId, connections: AIConnection[], identity: Identity) {
  await sodium.ready;
  const data = bundleSchema.parse({ version: 1, scope, selected, connections: connections.filter(c => c.remember) });
  return JSON.stringify({ version: 1, ciphertext: sodium.to_base64(sodium.crypto_box_seal(JSON.stringify(data), sodium.from_base64(identity.publicKey))) });
}
export async function openConnections(raw: string, scope: string, identity: Identity) {
  await sodium.ready;
  const wrapper = wrapperSchema.parse(JSON.parse(raw));
  const data = bundleSchema.parse(JSON.parse(sodium.to_string(sodium.crypto_box_seal_open(sodium.from_base64(wrapper.ciphertext), sodium.from_base64(identity.publicKey), sodium.from_base64(identity.privateKey)))));
  if (data.scope !== scope) throw new Error('This saved AI connection belongs to another family or account.');
  return { selected: data.selected, connections: data.connections.filter(c => c.remember) };
}
