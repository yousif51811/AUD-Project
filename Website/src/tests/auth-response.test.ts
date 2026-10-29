import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountError } from '@/lib/http-response';
import { safeAuthHandler } from '@/server/auth-response';
import { api } from '@/workspace/transport';
afterEach(() => vi.unstubAllGlobals());
describe('account response failures', () => {
 it.each(['', '<html>private database details</html>', '{broken'])('handles a non-JSON signup failure safely: %s', async body => {
  const message = await accountError(new Response(body, {status:500}), true);
  expect(message).toBe('The account service is temporarily unavailable. Please try again later.');
  expect(message).not.toContain('JSON'); expect(message).not.toContain('private');
 });
 it('gives useful allowlisted signup guidance without echoing arbitrary server text', async () => {
  expect(await accountError(Response.json({code:'USERNAME_IS_ALREADY_TAKEN',message:'raw-secret'} ,{status:400}),true)).toBe('That username is already taken. Choose another.');
  expect(await accountError(Response.json({code:'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'},{status:422}),true)).toContain('Sign in instead');
  expect(await accountError(new Response('',{status:429}),true)).toContain('Too many attempts');
  expect(await accountError(Response.json({message:'raw-secret'},{status:400}),true)).not.toContain('raw-secret');
 });
 it('normalizes thrown database failures into safe non-cacheable JSON', async () => {
  const route = safeAuthHandler(async () => { throw {code:'P2022',message:'secret connection string'}; });
  const response = await route(new Request('http://localhost/api/auth/sign-up/email',{method:'POST'}));
  expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json(); expect(body.code).toBe('ACCOUNT_DATABASE_UPDATE_REQUIRED'); expect(JSON.stringify(body)).not.toContain('secret');
 });
 it('normalizes an empty internal-server response', async () => {
  const response = await safeAuthHandler(async () => new Response('',{status:500}))(new Request('http://localhost/api/auth/sign-up/email'));
  expect(response.status).toBe(503); expect((await response.json()).code).toBe('ACCOUNT_SERVICE_UNAVAILABLE');
 });
 it('preserves successful responses, validation failures, OAuth redirects and cookies', async () => {
  for (const response of [Response.json({user:{id:'synthetic'}}), Response.json({code:'USERNAME_IS_ALREADY_TAKEN'},{status:400}), new Response(null,{status:302,headers:{Location:'/account','Set-Cookie':'synthetic=only; HttpOnly'}})]) {
   expect(await safeAuthHandler(async () => response)(new Request('http://localhost/api/auth/callback/google'))).toBe(response);
  }
 });
 it('handles empty workspace errors and successful-but-truncated responses without a parser error', async () => {
  for (const status of [200,502]) {
   vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('',{status})));
   await expect(api('identity')).rejects.toThrow('The service returned an incomplete response. Reload before trying again.');
  }
 });
 it('retains a valid null identity and structured service error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(null)).mockResolvedValueOnce(Response.json({error:'Sign in to continue.'},{status:401})));
  expect(await api('identity')).toBeNull(); await expect(api('families')).rejects.toThrow('Sign in to continue.');
 });
});
