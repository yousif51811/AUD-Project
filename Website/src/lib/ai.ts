import type { CoachResponse, CoachScenarioId } from '@/types';
import { buildCoachResponse, classifyScenario, type CoachContext } from './coach';
import { CRISIS_MESSAGE, BOUNDARY_NOTE, checkSafety } from './safety';
import { sanitizeText } from './sanitize';

/**
 * AI service abstraction. The website is fully functional with the deterministic provider.
 * An optional remote provider can be connected through a *server-side proxy* (never a client-side key):
 *   VITE_FAMILYMIND_AI_ENDPOINT=https://your-proxy.example/coach
 * Remote output is validated and sanitized, and any failure falls back to deterministic responses.
 */
export interface CoachProvider {
  readonly id: string;
  generate(input: string, scenario: CoachScenarioId, ctx: CoachContext, signal?: AbortSignal): Promise<CoachResponse>;
}

export const deterministicProvider: CoachProvider = {
  id: 'deterministic',
  async generate(_input, scenario, ctx) {
    return buildCoachResponse(scenario, ctx);
  },
};

const isStr = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;

/** Validates and sanitizes an untrusted response. Returns null when invalid. */
export function validateCoachResponse(x: unknown, scenario: CoachScenarioId): CoachResponse | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  const today = o.todayAction as Record<string, unknown> | undefined;
  if (!isStr(o.reflection) || !isStr(o.pattern) || !isStr(o.conversationStarter) || !isStr(o.why)) return null;
  if (!today || !isStr(today.title) || typeof today.minutes !== 'number') return null;
  if (!Array.isArray(o.weekSteps) || o.weekSteps.length !== 3 || !o.weekSteps.every(isStr)) return null;
  const minutes = Math.round(today.minutes);
  if (minutes < 1 || minutes > 15) return null;
  const check = checkSafety([o.reflection, o.pattern, o.why].join(' '));
  if (check.level === 'crisis') return null;
  return {
    scenario,
    kind: 'coaching',
    source: 'remote',
    reflection: sanitizeText(o.reflection, 400),
    pattern: sanitizeText(o.pattern, 300),
    todayAction: { title: sanitizeText(today.title, 200), minutes },
    weekSteps: (o.weekSteps as string[]).map((s) => sanitizeText(s, 240)),
    conversationStarter: sanitizeText(o.conversationStarter, 240),
    why: sanitizeText(o.why, 400),
    safetyNote: isStr(o.safetyNote) ? sanitizeText(o.safetyNote, 300) : undefined,
    plan: [], // Remote suggestions never write to the plan directly; plan items come from the vetted templates.
  };
}

function remoteProvider(endpoint: string): CoachProvider {
  return {
    id: 'remote',
    async generate(input, scenario, ctx, signal) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only the question and scenario are sent. No names, scores or private data leave the device.
        body: JSON.stringify({ scenario, question: sanitizeText(input, 300) }),
        signal,
      });
      if (!res.ok) throw new Error('provider unavailable');
      const valid = validateCoachResponse(await res.json(), scenario);
      if (!valid) throw new Error('invalid provider output');
      const fallback = buildCoachResponse(scenario, ctx);
      return { ...valid, plan: fallback.plan };
    },
  };
}

export function safetyResponse(): CoachResponse {
  return {
    scenario: 'general',
    kind: 'safety',
    source: 'deterministic',
    reflection: CRISIS_MESSAGE,
    pattern: '',
    todayAction: { title: '', minutes: 0 },
    weekSteps: [],
    conversationStarter: '',
    why: '',
    plan: [],
  };
}

export interface CoachResult {
  response: CoachResponse;
  fellBack: boolean;
}

export async function getCoachResponse(
  input: string,
  ctx: CoachContext,
  opts: { provider?: CoachProvider; timeoutMs?: number } = {},
): Promise<CoachResult> {
  const text = sanitizeText(input, 400);
  // Safety layer runs first and is never skipped; crisis text is never sent to a provider.
  const safety = checkSafety(text);
  if (safety.level === 'crisis') return { response: safetyResponse(), fellBack: false };
  const scenario = classifyScenario(text);
  const endpoint = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_FAMILYMIND_AI_ENDPOINT;
  const provider = opts.provider ?? (endpoint ? remoteProvider(endpoint) : deterministicProvider);
  let fellBack = false;
  let response: CoachResponse;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000) : undefined;
  try {
    if (provider.id === 'remote' && typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
    response = await provider.generate(text, scenario, ctx, ctrl?.signal);
  } catch {
    fellBack = provider.id !== 'deterministic';
    response = buildCoachResponse(scenario, ctx);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (safety.level === 'boundary' && !response.safetyNote) response = { ...response, safetyNote: BOUNDARY_NOTE };
  return { response, fellBack };
}
