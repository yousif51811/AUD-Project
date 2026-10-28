import { PROVIDERS, validateDraft, type ConnectionDraft } from './providers';

const requests = new Set<AbortController>();
export function cancelAIRequests() { for (const request of requests) request.abort(); requests.clear(); }
if (typeof window !== 'undefined') window.addEventListener('familymind:clear-ai', cancelAIRequests);
export class ProviderError extends Error {
  constructor(public readonly code: 'auth' | 'quota' | 'model' | 'network' | 'timeout' | 'response' | 'unavailable', message: string) { super(message); this.name = 'ProviderError'; }
}

// Only fixed, recognized reason codes may leave a provider error response. Never echo
// its message or metadata: either can contain credentials or submitted context.
const geminiReasons = {
  API_KEY_INVALID: 'Gemini did not accept this key. Copy the complete key from Google AI Studio or create a replacement.',
  API_KEY_EXPIRED: 'This Gemini key has expired. Create a replacement in Google AI Studio.',
  ACCESS_TOKEN_TYPE_UNSUPPORTED: 'Gemini could not authenticate this key. Copy the complete Gemini API key from Google AI Studio; do not paste an OAuth token.',
  API_KEY_SERVICE_BLOCKED: 'This key is not permitted to call the Gemini API. Check its API restrictions and linked service-account permissions in Google AI Studio.',
  API_KEY_HTTP_REFERRER_BLOCKED: 'This key requires a website referrer that this privacy-preserving connection does not send. Review the key’s website restrictions; this app does not use a backend proxy.',
  API_KEY_IP_ADDRESS_BLOCKED: 'This key’s IP restriction does not allow this device’s connection. Review its restrictions in Google AI Studio.',
  SERVICE_DISABLED: 'The Gemini API is disabled for this key’s project. Check the project and API access in Google AI Studio.',
} as const;
async function httpError(response: Response, name: string, gemini: boolean, model: string): Promise<ProviderError> {
  let reason = '';
  if (gemini) {
    try {
      const raw = await response.text();
      if (raw.length <= 100000) {
        const value = JSON.parse(raw);
        const details: unknown = value?.error?.details;
        if (Array.isArray(details)) {
          for (const detail of details) {
            if (detail && typeof detail === 'object' && typeof detail.reason === 'string' && Object.hasOwn(geminiReasons, detail.reason)) { reason = detail.reason; break; }
          }
        }
      }
    } catch { /* use the HTTP status without showing provider text */ }
  }
  const diagnostic = ` (HTTP ${response.status}${reason ? ' · ' + reason : ''})`;
  if (reason) return new ProviderError('auth', geminiReasons[reason as keyof typeof geminiReasons] + diagnostic);
  if (response.status === 401) return new ProviderError('auth', `${name} did not accept this key. Check or replace it in AI settings.` + diagnostic);
  if (response.status === 429 || response.status === 402) return new ProviderError('quota', `${name} has reached a rate limit, quota or credit limit. Check your provider usage and project allowance or try again later. No other provider was contacted.` + diagnostic);
  if (response.status === 404) return new ProviderError('model', `${name} could not find this model for your project. Check the model ID in AI settings.${gemini && model.startsWith('gemini-2.5-') ? ' Google limits Gemini 2.5 access to previous users; choose Use the suggested model to try Gemini 3.5 Flash-Lite.' : ''}` + diagnostic);
  if (response.status === 400 || response.status === 422) return new ProviderError('model', `${name} rejected this model’s request parameters or JSON response mode. Choose Use the suggested model in AI settings and test again.` + diagnostic);
  if (response.status === 403) return new ProviderError('auth', `${name} denied access. Check the key’s restrictions, model permissions and project eligibility in the provider console. A blocked key or unavailable free tier can also cause this.` + diagnostic);
  return new ProviderError('unavailable', `${name} is unavailable right now. Nothing was changed. Try again later.` + diagnostic);
}

/** Fixed provider endpoints only. No proxy, URL credentials, fallback or automatic retries. */
export async function providerAnswer(draft: ConnectionDraft, system: string, question: string, signal?: AbortSignal): Promise<string> {
  const connection = validateDraft(draft), provider = PROVIDERS[connection.provider];
  if (system.length > 12000 || question.length > 1000) throw new Error('This request is too large. Shorten the question and try again.');
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
  requests.add(controller);
  const gemini = connection.provider === 'gemini';
  const url = gemini ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(connection.model)}:generateContent`
    : connection.provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (gemini) headers['x-goog-api-key'] = connection.apiKey;
  else headers.Authorization = `Bearer ${connection.apiKey}`;
  const body = gemini ? {
    systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { maxOutputTokens: 1200, responseMimeType: 'application/json' },
  } : {
    model: connection.model, messages: [{ role: 'system', content: system }, { role: 'user', content: question }],
    temperature: .2, max_tokens: 900, response_format: { type: 'json_object' },
    ...(connection.provider === 'openrouter' ? { provider: { require_parameters: true }, plugins: [] } : {}),
  };
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal,
      credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw await httpError(response, provider.name, gemini, connection.model);
    const raw = await response.text();
    if (raw.length > 100000) throw new ProviderError('response', 'The provider returned an oversized answer. Nothing was changed.');
    let value;
    try { value = JSON.parse(raw); } catch { throw new ProviderError('response', 'The provider returned an unreadable answer. Nothing was changed.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError('response', 'The provider returned an unreadable answer. Nothing was changed.');
    if (value.error) throw new ProviderError('response', `${provider.name} could not finish the answer. Nothing was changed.`);
    const finish = gemini ? value.candidates?.[0]?.finishReason : value.choices?.[0]?.finish_reason;
    if (['length', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'content_filter'].includes(finish)) throw new ProviderError('response', 'The answer was incomplete or blocked. Try a shorter question; nothing was changed.');
    const parts = value.candidates?.[0]?.content?.parts;
    const content = gemini ? Array.isArray(parts) ? parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? '').join('') : '' : value.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 18000) throw new ProviderError('response', 'The provider did not return a usable answer. Nothing was changed.');
    return content;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (timedOut) throw new ProviderError('timeout', `${provider.name} took too long. Cancelled without changing your plan.`);
    if (controller.signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
    throw new ProviderError('network', `Could not reach ${provider.name} directly from this browser. Check your connection or browser restrictions. No backend proxy or fallback was used.`);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); requests.delete(controller); }
}

export async function testConnection(connection: ConnectionDraft, signal?: AbortSignal) {
  const text = await providerAnswer(connection,
    'This is a connection test using no family information. Return only JSON: {"answer":"Connected.","sources":[],"actions":[]}.',
    'Return the connection test JSON.', signal);
  try {
    const value = JSON.parse(text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
    if (typeof value.answer !== 'string' || !value.answer.trim() || !Array.isArray(value.actions) || value.actions.length || !Array.isArray(value.sources) || value.sources.length) throw new Error();
  } catch { throw new ProviderError('response', 'The connection responded, but this model did not pass the JSON answer test. Try the suggested model or another provider.'); }
}
