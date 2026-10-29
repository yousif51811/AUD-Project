import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdentity, protectIdentity, unlockIdentity } from '@/lib/vault/crypto';
import { prepareAccess, forgetPreparedAccess } from '@/workspace/access';
const mocks = vi.hoisted(() => ({ api: vi.fn(), read: vi.fn(), remember: vi.fn(), forget: vi.fn() }));
vi.mock('@/workspace/transport', () => ({ api: mocks.api }));
vi.mock('@/lib/vault/device', () => ({ rememberedIdentity: mocks.read, rememberIdentity: mocks.remember, forgetIdentity: mocks.forget }));
beforeEach(() => { vi.resetAllMocks(); mocks.read.mockResolvedValue(null); mocks.remember.mockResolvedValue(true); mocks.forget.mockResolvedValue(undefined); });
describe('automatic account access', () => {
 it('uses the existing account password and sends only an encrypted identity backup', async () => {
  mocks.api.mockResolvedValueOnce(null).mockResolvedValueOnce({});
  const result = await prepareAccess('new-email', 'Synthetic account password');
  const backup = mocks.api.mock.calls[1][1];
  expect(await unlockIdentity(backup.vault, 'Synthetic account password')).toEqual(result.identity);
  expect(JSON.stringify(backup)).not.toContain(result.identity!.privateKey);
  expect(JSON.stringify(backup)).not.toContain('Synthetic account password');
  expect(await unlockIdentity(backup.vault, result.recoveryCode, true)).toEqual(result.identity);
 });
 it('restores on a new device using the same account password', async () => {
  const identity = await createIdentity(), { vault } = await protectIdentity(identity, 'Synthetic account password');
  mocks.api.mockResolvedValue({ ...identity, vault });
  expect((await prepareAccess('new-device', 'Synthetic account password')).identity).toEqual(identity);
  expect(mocks.api).toHaveBeenCalledTimes(1);
 });
 it('preserves a legacy identity when its separate passphrase is needed', async () => {
  const identity = await createIdentity(), { vault } = await protectIdentity(identity, 'Legacy separate passphrase');
  mocks.api.mockResolvedValue({ publicKey: identity.publicKey, signingKey: identity.signingKey, vault });
  expect((await prepareAccess('legacy', 'Different account password')).identity).toBeNull();
  expect(mocks.api).toHaveBeenCalledTimes(1); expect(mocks.remember).not.toHaveBeenCalled();
 });
 it('opens remembered access without a password but rejects a different cached identity', async () => {
  const identity = await createIdentity(), other = await createIdentity(), { vault } = await protectIdentity(identity, 'Synthetic account password');
  mocks.api.mockResolvedValue({ publicKey: identity.publicKey, signingKey: identity.signingKey, vault });
  mocks.read.mockResolvedValue(identity); expect((await prepareAccess('remembered')).identity).toEqual(identity);
  mocks.read.mockResolvedValue(other); expect((await prepareAccess('wrong-cache')).identity).toBeNull();
 });
 it('prepares Google-style access with a generated secret and works without persistent storage', async () => {
  mocks.api.mockResolvedValueOnce(null).mockResolvedValueOnce({}); mocks.remember.mockResolvedValue(false);
  const result = await prepareAccess('no-password'); const backup = mocks.api.mock.calls[1][1];
  expect(result.identity).not.toBeNull(); expect(result.remembered).toBe(false);
  expect(await unlockIdentity(backup.vault, result.recoveryCode, true)).toEqual(result.identity);
 });
 it('deduplicates setup and removes device access after pending setup finishes', async () => {
  mocks.api.mockResolvedValueOnce(null).mockResolvedValueOnce({});
  const first = prepareAccess('concurrent', 'Synthetic account password');
  const second = prepareAccess('concurrent', 'Synthetic account password'); expect(second).toBe(first);
  await forgetPreparedAccess('concurrent'); expect(mocks.forget).toHaveBeenCalledWith('concurrent'); expect(mocks.api).toHaveBeenCalledTimes(2);
  expect(mocks.remember.mock.invocationCallOrder[0]).toBeLessThan(mocks.forget.mock.invocationCallOrder[0]);
 });
});
