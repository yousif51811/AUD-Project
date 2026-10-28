import { afterEach, expect, it, vi } from 'vitest';
import { cancelAIRequests, providerAnswer, testConnection } from '@/lib/model/engine';
import { PROVIDERS, providerIds, type ProviderId } from '@/lib/model/providers';
const result = JSON.stringify({ answer: 'Synthetic answer.', actions: [], sources: [] });
const draft = (provider: ProviderId) => ({ provider, apiKey: 'synthetic-private-key', model: PROVIDERS[provider].defaultModel });
const payload = (provider: ProviderId, content = result) => provider === 'gemini'
  ? { candidates: [{ content: { parts: [{ text: content }] }, finishReason: 'STOP' }] }
  : { choices: [{ message: { content }, finish_reason: 'stop' }] };
afterEach(() => { cancelAIRequests(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it.each(providerIds)('%s sends only approved content directly to its fixed endpoint, with credentials in headers', async provider => {
  const fake = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload(provider)))); vi.stubGlobal('fetch', fake);
  expect(await providerAnswer(draft(provider), 'approved synthetic context', 'synthetic question')).toBe(result);
  const [url, options] = fake.mock.calls[0];
  const expected = { groq: 'https://api.groq.com/openai/v1/chat/completions', gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', openrouter: 'https://openrouter.ai/api/v1/chat/completions' };
  expect(url).toBe(expected[provider]); expect(String(url)).not.toContain(draft(provider).apiKey);
  expect(options).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store' });
  expect(options?.headers).toHaveProperty(provider === 'gemini' ? 'x-goog-api-key' : 'Authorization', provider === 'gemini' ? draft(provider).apiKey : 'Bearer ' + draft(provider).apiKey);
  expect(options?.body).toContain('approved synthetic context'); expect(options?.body).toContain('synthetic question'); expect(options?.body).not.toContain(draft(provider).apiKey);
  const body = JSON.parse(String(options?.body));
  if (provider === 'gemini') { expect(body.generationConfig.responseMimeType).toBe('application/json'); expect(body.contents).toHaveLength(1); }
  else { expect(body.response_format.type).toBe('json_object'); expect(body.messages).toHaveLength(2); }
  expect(fake).toHaveBeenCalledTimes(1);
});
it.each([[401, 'key'], [403, 'denied'], [429, 'quota'], [402, 'credit'], [404, 'model'], [400, 'model'], [500, 'unavailable']] as const)('HTTP %s reports a useful error without leaking the response or falling back', async (status, expected) => {
  const fake = vi.fn(async () => new Response('SENSITIVE RESPONSE ECHO synthetic-private-key', { status })); vi.stubGlobal('fetch', fake);
  const error = await providerAnswer(draft('groq'), 'context', 'question').catch(e => e);
  expect(error.message).toContain(expected); expect(error.message).not.toContain('SENSITIVE'); expect(error.message).not.toContain(draft('groq').apiKey); expect(fake).toHaveBeenCalledTimes(1);
});
it('recognizes Gemini invalid-key responses without displaying provider-supplied error text', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'private echoed content', details: [{ reason: 'API_KEY_INVALID' }] } }), { status: 400 })));
  await expect(providerAnswer(draft('gemini'), 'context', 'question')).rejects.toThrow('did not accept this key');
});
it('reports browser/network restrictions without a backend proxy', async () => {
  const fake = vi.fn(async () => { throw new TypeError('Failed to fetch'); }); vi.stubGlobal('fetch', fake);
  await expect(providerAnswer(draft('openrouter'), 'context', 'question')).rejects.toThrow('No backend proxy or fallback'); expect(fake).toHaveBeenCalledTimes(1);
});
it.each(providerIds)('%s tests with a synthetic message and no family context', async provider => {
  const fake = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload(provider)))); vi.stubGlobal('fetch', fake);
  await testConnection(draft(provider)); expect(String(fake.mock.calls[0][1]?.body)).toContain('no family information');
});
it('rejects a model that responds but fails the JSON connection test', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload('groq', 'Hello!')))));
  await expect(testConnection(draft('groq'))).rejects.toThrow('JSON answer test');
});
it('rejects a truncated answer rather than partially applying it', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: result }, finish_reason: 'length' }] }))));
  await expect(providerAnswer(draft('groq'), 'context', 'question')).rejects.toThrow('incomplete');
});
it('refuses unsupported endpoints and invalid model paths before making requests', async () => {
  const fake = vi.fn(); vi.stubGlobal('fetch', fake);
  await expect(providerAnswer({ ...draft('groq'), provider: 'custom' as ProviderId }, 'context', 'question')).rejects.toThrow('Choose a provider');
  await expect(providerAnswer({ ...draft('gemini'), model: '../secret?key=hidden' }, 'context', 'question')).rejects.toThrow(); expect(fake).not.toHaveBeenCalled();
});
it('cancels active requests and never retries them', async () => {
  const fake = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError'))))); vi.stubGlobal('fetch', fake);
  const promise = providerAnswer(draft('groq'), 'context', 'question'); const check = expect(promise).rejects.toMatchObject({ name: 'AbortError' }); cancelAIRequests(); await check; expect(fake).toHaveBeenCalledTimes(1);
});
it('times out a provider request with a clear error', async () => {
  vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError'))))));
  const check = expect(providerAnswer(draft('groq'), 'context', 'question')).rejects.toThrow('took too long'); await vi.advanceTimersByTimeAsync(45000); await check;
});

it('uses a saved connection without sending local remember/test metadata', async () => {
  const fake = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload('groq')))); vi.stubGlobal('fetch', fake);
  const saved = { ...draft('groq'), remember: true, verifiedAt: '2026-10-28T00:00:00.000Z' };
  expect(await providerAnswer(saved, 'context', 'question')).toBe(result); expect(fake.mock.calls[0][1]?.body).not.toContain('verifiedAt'); expect(fake.mock.calls[0][1]?.body).not.toContain('remember');
});
it('rejects a null provider payload as an invalid response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('null')));
  await expect(providerAnswer(draft('groq'), 'context', 'question')).rejects.toThrow('unreadable answer');
});

it('accepts Gemini authorization keys using the current suggested model and native API-key header', async () => {
  const fake = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload('gemini')))); vi.stubGlobal('fetch', fake);
  const connection = { ...draft('gemini'), apiKey: 'AQ.synthetic-test-only-not-a-real-key' };
  await providerAnswer(connection, 'context', 'question');
  expect(fake.mock.calls[0][1]?.headers).toMatchObject({ 'x-goog-api-key': connection.apiKey });
  expect(fake.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  expect(fake.mock.calls[0][0]).toContain('gemini-3.5-flash-lite:generateContent');
  expect(JSON.parse(String(fake.mock.calls[0][1]?.body)).generationConfig).not.toHaveProperty('temperature');
});
it.each([
  [401, 'ACCESS_TOKEN_TYPE_UNSUPPORTED', 'complete Gemini API key'],
  [403, 'API_KEY_SERVICE_BLOCKED', 'API restrictions'],
  [403, 'API_KEY_HTTP_REFERRER_BLOCKED', 'website restrictions'],
  [403, 'API_KEY_IP_ADDRESS_BLOCKED', 'IP restriction'],
  [403, 'SERVICE_DISABLED', 'disabled'],
  [400, 'API_KEY_EXPIRED', 'expired'],
] as const)('Gemini HTTP %s / %s shows safe setup guidance', async (status, reason, expected) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'private-context synthetic-private-key', details: [null, { reason, metadata: { key: 'synthetic-private-key' } }] } }), { status })));
  const error = await providerAnswer(draft('gemini'), 'context', 'question').catch(e => e);
  expect(error.message).toContain(expected); expect(error.message).toContain('HTTP ' + status); expect(error.message).toContain(reason);
  expect(error.message).not.toContain('private-context'); expect(error.message).not.toContain('synthetic-private-key');
});
it.each([null, { error: { details: [{ reason: 'PRIVATE_ECHO_synthetic-private-key' }] } }, { error: { details: 'not-an-array' } }])('ignores unknown or malformed Gemini diagnostic reasons', async value => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(value), { status: 403 })));
  const error = await providerAnswer(draft('gemini'), 'context', 'question').catch(e => e);
  expect(error.message).toContain('HTTP 403'); expect(error.message).not.toContain('PRIVATE_ECHO'); expect(error.message).not.toContain('synthetic-private-key');
});
it('explains unavailable legacy Gemini models separately from key authentication', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
  await expect(providerAnswer({ ...draft('gemini'), model: 'gemini-2.5-flash-lite' }, 'context', 'question')).rejects.toThrow('Google limits Gemini 2.5 access to previous users');
});
