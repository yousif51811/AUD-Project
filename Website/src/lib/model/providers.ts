import { z } from 'zod';

export const providerIds = ['groq', 'gemini', 'openrouter'] as const;
export type ProviderId = typeof providerIds[number];
export const connectionSchema = z.object({
  provider: z.enum(providerIds), apiKey: z.string().trim().min(1).max(4096),
  model: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._:/-]+$/),
  verifiedAt: z.string().datetime(), remember: z.boolean(),
}).strict();
export type AIConnection = z.infer<typeof connectionSchema>;
export type ConnectionDraft = Pick<AIConnection, 'provider' | 'apiKey' | 'model'>;
export const PROVIDERS = {
  groq: {
    name: 'Groq', short: 'A simple place to start', defaultModel: 'openai/gpt-oss-20b', modelLabel: 'GPT-OSS 20B',
    keyUrl: 'https://console.groq.com/keys', usageUrl: 'https://console.groq.com/settings/organization/limits', docsUrl: 'https://console.groq.com/docs/rate-limits',
    steps: ['Sign in to the Groq console.', 'Create an API key and copy it.', 'Paste it below, then choose Test & connect.'],
    note: 'A free plan is available with request and token limits. Your provider account determines your allowance.',
  },
  gemini: {
    name: 'Gemini', short: 'Connect with Google AI Studio', defaultModel: 'gemini-3.5-flash-lite', modelLabel: 'Gemini 3.5 Flash-Lite',
    keyUrl: 'https://aistudio.google.com/api-keys', usageUrl: 'https://aistudio.google.com/usage', docsUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    steps: ['Sign in to Google AI Studio.', 'Create or select an API key and copy it.', 'Paste it below, then choose Test & connect.'],
    note: 'Eligible models have a limited free tier. Google lists free-tier content as usable for product improvement. Use fictional data for this demo.',
  },
  openrouter: {
    name: 'OpenRouter', short: 'Choose from multiple model hosts', defaultModel: 'openrouter/free', modelLabel: 'Free model router',
    keyUrl: 'https://openrouter.ai/settings/keys', usageUrl: 'https://openrouter.ai/activity', docsUrl: 'https://openrouter.ai/pricing',
    steps: ['Sign in to OpenRouter and open Keys.', 'Create an API key and copy it.', 'Paste it below, then choose Test & connect.'],
    note: 'The free router selects an available free model and its host. OpenRouter and that host receive approved requests. Free quotas and availability vary.',
  },
} satisfies Record<ProviderId, { name: string; short: string; defaultModel: string; modelLabel: string; keyUrl: string; usageUrl: string; docsUrl: string; steps: string[]; note: string }>;

export function validateDraft(draft: ConnectionDraft): ConnectionDraft {
  // Saved connections also carry local metadata; only these three fields belong in a request.
  const value = connectionSchema.omit({ verifiedAt: true, remember: true }).safeParse({ provider: draft.provider, apiKey: draft.apiKey, model: draft.model });
  if (!value.success) throw new Error('Choose a provider, paste its key and use a valid model ID.');
  if (value.data.provider === 'gemini' && !/^gemini-[a-zA-Z0-9._-]+$/.test(value.data.model)) throw new Error('Use a Gemini model ID, such as gemini-3.5-flash-lite.');
  return value.data;
}

/** Policies for the API services used by each connection, including shared Gemini. */
export const PROVIDER_POLICIES = {
  groq: { name: 'Groq', termsUrl: 'https://console.groq.com/docs/legal/services-agreement', privacyUrl: 'https://groq.com/privacy-policy' },
  gemini: { name: 'Google Gemini', termsUrl: 'https://ai.google.dev/gemini-api/terms', privacyUrl: 'https://policies.google.com/privacy' },
  openrouter: { name: 'OpenRouter', termsUrl: 'https://openrouter.ai/terms', privacyUrl: 'https://openrouter.ai/privacy' },
} satisfies Record<ProviderId, {name: string; termsUrl: string; privacyUrl: string}>;
