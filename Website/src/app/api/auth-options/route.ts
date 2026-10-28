import { googleCredentials } from '@/server/google';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export function GET() {
  return Response.json({ google: !!googleCredentials() }, { headers: { 'Cache-Control': 'no-store' } });
}
