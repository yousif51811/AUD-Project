import { auth } from '@/server/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { safeAuthHandler } from '@/server/auth-response';
const handlers = toNextJsHandler(auth);
export const GET = safeAuthHandler(handlers.GET);
export const POST = safeAuthHandler(handlers.POST);
