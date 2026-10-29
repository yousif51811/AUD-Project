import { z } from 'zod';

export const serverRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  language: z.enum(['en', 'ar']),
  facts: z.array(z.object({ id: z.string().min(1).max(200), kind: z.string().min(1).max(40), data: z.record(z.string(), z.unknown()) }).strict()).max(50),
  management: z.object({actorId:z.string().max(200),role:z.enum(['OWNER','MEMBER','VIEWER','CHILD','DEMO']),today:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),timezone:z.string().max(80)}).strict().optional(),
  memberIds: z.array(z.string().min(1).max(200)).max(50),
}).strict().refine(value => JSON.stringify(value.facts).length <= 6500, 'Too much context.');
export type ServerAIRequest = z.infer<typeof serverRequestSchema>;
export interface ServerAIConfig { available: boolean; model: string; }
export type AISelection = 'server' | import('./providers').ProviderId;
export const SERVER_AI_NAME = 'Server-side · Gemini';
