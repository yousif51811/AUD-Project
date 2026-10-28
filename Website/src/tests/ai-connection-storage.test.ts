import { expect, it } from 'vitest';
import { createIdentity } from '@/lib/vault/crypto';
import { openConnections, sealConnections } from '@/lib/model/connection-storage';
import type { AIConnection } from '@/lib/model/providers';
const connection: AIConnection = { provider: 'groq', apiKey: 'synthetic-private-provider-key', model: 'openai/gpt-oss-20b', verifiedAt: '2026-10-28T00:00:00.000Z', remember: true };
it('remembers keys only as locally decryptable ciphertext with an account and family binding', async () => {
  const identity = await createIdentity(), raw = await sealConnections('account:family', 'groq', [connection], identity);
  expect(raw).not.toContain(connection.apiKey); expect(raw).not.toContain(connection.model); expect(raw).not.toContain('account:family');
  expect(await openConnections(raw, 'account:family', identity)).toEqual({ selected: 'groq', connections: [connection] });
  await expect(openConnections(raw, 'account:other-family', identity)).rejects.toThrow('another family');
  await expect(openConnections(raw, 'account:family', await createIdentity())).rejects.toThrow();
});
it('never includes visit-only keys in the remembered bundle', async () => {
  const identity = await createIdentity(); const raw = await sealConnections('account:family', 'groq', [{ ...connection, remember: false }], identity);
  expect((await openConnections(raw, 'account:family', identity)).connections).toEqual([]);
});
it('rejects tampered browser storage', async () => {
  const identity = await createIdentity(), wrapper = JSON.parse(await sealConnections('account:family', 'groq', [connection], identity));
  wrapper.ciphertext = (wrapper.ciphertext[0] === 'A' ? 'B' : 'A') + wrapper.ciphertext.slice(1);
  await expect(openConnections(JSON.stringify(wrapper), 'account:family', identity)).rejects.toThrow();
});
