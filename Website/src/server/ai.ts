import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { auth } from './auth';
import { serverRequestSchema } from '@/lib/model/server-contract';
import { parseAnswer, systemPrompt } from '@/lib/model/assistant';
import { providerAnswer, ProviderError } from '@/lib/model/engine';

const COOKIE = 'familymind-ai-demo';
const DAY = 86400000;
export class AIFault extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function aiConfiguration(env: {GEMINI_MODEL?:string;GEMINI_API_KEY?:string;AUTH_SECRET?:string} = {GEMINI_MODEL:process.env.GEMINI_MODEL,GEMINI_API_KEY:process.env.GEMINI_API_KEY,AUTH_SECRET:process.env.AUTH_SECRET}) {
  const model = env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const valid = /^gemini-[a-zA-Z0-9._-]{1,110}$/.test(model);
  return { available: !!env.GEMINI_API_KEY?.trim() && !!env.AUTH_SECRET && valid, model: valid ? model : 'gemini-3.5-flash-lite' };
}
function sign(value: string, secret: string) { return createHmac('sha256', secret).update('familymind-ai-demo:' + value).digest('hex'); }
export function demoToken(secret: string, now = Date.now()) { const value = `${randomUUID()}.${now + DAY}`; return value + '.' + sign(value, secret); }
export function demoSession(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || token.length > 180) return null;
  const [id, expiry, signature, extra] = token.split('.');
  if (extra || !/^[a-f0-9-]{36}$/.test(id ?? '') || !/^\d{13}$/.test(expiry ?? '') || Number(expiry) <= now || Number(expiry) > now + DAY || !/^[a-f0-9]{64}$/.test(signature ?? '')) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${id}.${expiry}`, secret))) ? id : null;
}
function cookieToken(request: Request) { return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1); }
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(value, {status, headers:{'Cache-Control':'private, no-store', ...headers}});
export function aiConfigResponse(request: Request) {
  const config = aiConfiguration(), secret = process.env.AUTH_SECRET;
  const headers: Record<string, string> = {};
  if (secret && !demoSession(cookieToken(request), secret)) headers['Set-Cookie'] = `${COOKIE}=${demoToken(secret)}; Path=/api/ai; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' && new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  return json(config, 200, headers);
}
function limitValue(value: string | undefined, maximum: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : maximum; }
export async function consumeAIAllowance(caller: string, now = Date.now()) {
  const buckets: [string, number][] = [
    [`ai:caller:${caller}:${Math.floor(now / 60000)}`, limitValue(process.env.AI_CALLER_RPM, 5)],
    [`ai:global:minute:${Math.floor(now / 60000)}`, limitValue(process.env.AI_GLOBAL_RPM, 10)],
    [`ai:global:day:${Math.floor(now / DAY)}`, limitValue(process.env.AI_GLOBAL_RPD, 100)],
  ];
  await db.$transaction(async tx => {
    for (const [key, max] of buckets) {
      const row = await tx.rateLimit.upsert({where:{key}, create:{key,count:1,lastRequest:now}, update:{count:{increment:1},lastRequest:now}});
      if (row.count > max) throw new AIFault(429, 'quota', 'The shared assistant has reached its request allowance. Please try again later.');
    }
    await tx.rateLimit.deleteMany({where:{key:{startsWith:'ai:'},lastRequest:{lt:now - 2 * DAY}}});
  });
}
async function boundedBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new AIFault(415, 'request', 'Send a JSON request.');
  const reader = request.body?.getReader();
  if (!reader) throw new AIFault(400, 'request', 'The assistant request is empty.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const {value,done} = await reader.read(); if (done) break; size += value.byteLength; if (size > 32768) { await reader.cancel(); throw new AIFault(413, 'request', 'This request is too large. Shorten the question and approved context.'); } chunks.push(value); }
    try { return serverRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { throw new AIFault(400, 'request', 'This assistant request is invalid. Review a new request preview.'); }
  } finally { reader.releaseLock(); }
}
export async function aiAnswerResponse(request: Request) {
  try {
    const expected = new URL(process.env.APP_URL ?? request.url).origin;
    if (request.headers.get('origin') !== expected) throw new AIFault(403, 'origin', 'This request must come from the application.');
    const config = aiConfiguration();
    if (!config.available) throw new AIFault(503, 'unavailable', 'The shared Gemini assistant is not configured on this site. Ask the presenter to configure it, or choose a personal provider in AI settings.');
    const input = await boundedBody(request);
    if (request.signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
    const session = await auth.api.getSession({headers:request.headers});
    const anonymous = demoSession(cookieToken(request), process.env.AUTH_SECRET!);
    if (!session && !anonymous) throw new AIFault(401, 'session', 'Reload the assistant to start a sample session, then review your request again.');
    await consumeAIAllowance(session ? `account:${session.user.id}` : `demo:${anonymous}`);
    if (request.signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
    const text = await providerAnswer({provider:'gemini',apiKey:process.env.GEMINI_API_KEY!.trim(),model:config.model}, systemPrompt(input.facts, input.language), input.question, request.signal);
    try { return json(parseAnswer(text, input.memberIds, input.facts.map(f => f.id))); }
    catch { throw new AIFault(502, 'response', 'The assistant returned an invalid suggestion. Nothing was changed. Try again or choose another model.'); }
  } catch (error) {
    if (error instanceof AIFault) return json({code:error.code,message:error.message},error.status,error.status===429?{'Retry-After':'60'}:{});
    if (error instanceof ProviderError) {
      const messages: Record<ProviderError['code'], string> = {
        auth:'The shared Gemini configuration was rejected. Ask the presenter to check its key and project permissions.',
        quota:'Gemini has reached its shared rate limit or quota. Please try again later. No other provider was contacted.',
        model:'The shared Gemini model is unavailable for this project. Ask the presenter to check its configuration.',
        network:'The server could not reach Gemini. Your question is retained; please try again later.',
        timeout:'Gemini took too long. Cancelled without changing your plan.',
        response:'Gemini returned an incomplete or unusable answer. Nothing was changed. Try a shorter question.',
        unavailable:'Gemini is unavailable right now. Nothing was changed. Try again later.',
      };
      return json({code:error.code,message:messages[error.code]},error.code==='quota'?429:error.code==='timeout'?504:502);
    }
    if (error instanceof Error && error.name === 'AbortError') return json({code:'cancelled',message:'Cancelled without changing your plan.'},499);
    // Never log request bodies, provider responses, credentials or database exceptions here.
    return json({code:'unavailable',message:'The shared assistant is temporarily unavailable. Your question is retained; please try again later.'},503);
  }
}
