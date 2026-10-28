import { assistantSchema } from './assistant';
import { serverRequestSchema, type ServerAIRequest } from './server-contract';
export async function serverAnswer(input: ServerAIRequest, signal?: AbortSignal) {
  serverRequestSchema.parse(input);
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Cancelled.', 'AbortError');
  signal?.addEventListener('abort', abort, {once:true});
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
  try {
    const response = await fetch('/api/ai/answer', {method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal});
    if (!response.ok) {
      // Only fixed application guidance is shown, even if a proxy returns arbitrary text.
      const message = response.status===429 ? 'The shared assistant has reached its request allowance. Please try again later.'
        : response.status===503 ? 'The shared Gemini assistant is unavailable. Check AI settings or try again later.'
        : response.status===504 ? 'Gemini took too long. Cancelled without changing your plan.'
        : response.status===401 ? 'Reload the assistant to start a sample session, then review your request again.'
        : 'The shared assistant could not produce a valid answer. Nothing was changed. Try again later.';
      throw new Error(message);
    }
    const raw = await response.text();
    if (raw.length > 20000) throw new Error('The assistant returned an invalid suggestion. Nothing was changed.');
    try { return assistantSchema.parse(JSON.parse(raw)); }
    catch { throw new Error('The assistant returned an invalid suggestion. Nothing was changed.'); }
  } catch (error) {
    if (timedOut) throw new Error('Gemini took too long. Cancelled without changing your plan.');
    if (controller.signal.aborted) throw new DOMException('Cancelled.', 'AbortError');
    if (error instanceof TypeError) throw new Error('The server could not be reached. Your question is retained; please try again later.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
}
