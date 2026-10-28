import {afterAll,beforeEach,expect,it,vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {consumeAIAllowance} from '../../src/server/ai';
// Guard cleanup as well as test execution, including direct Vitest invocations.
const fixtureUrl=new URL(process.env.DATABASE_URL??'');
if(!['localhost','127.0.0.1'].includes(fixtureUrl.hostname)||!fixtureUrl.pathname.endsWith('_test'))throw new Error('Shared AI fixture tests require an isolated local test database.');
const db=new PrismaClient();
beforeEach(()=>{vi.stubEnv('AI_CALLER_RPM','5');vi.stubEnv('AI_GLOBAL_RPM','10');vi.stubEnv('AI_GLOBAL_RPD','100');});
afterAll(async()=>{vi.unstubAllEnvs();await db.rateLimit.deleteMany({where:{key:{startsWith:'ai:'}}});await db.$disconnect();});
it('atomically rejects concurrent requests beyond the per-session allowance',async()=>{
 const now=Date.now();const outcomes=await Promise.allSettled(Array.from({length:8},()=>consumeAIAllowance('synthetic-same-caller',now)));
 expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(5);
 expect((await db.rateLimit.findUniqueOrThrow({where:{key:`ai:global:minute:${Math.floor(now/60000)}`}})).count).toBe(5);
});
it('enforces a persistent global cap across different anonymous sessions and accounts',async()=>{
 const now=Date.now();for(let i=0;i<10;i++)await consumeAIAllowance(`synthetic-caller-${i}`,now);
 await expect(consumeAIAllowance('synthetic-another-account',now)).rejects.toMatchObject({status:429});
 expect((await db.rateLimit.findUniqueOrThrow({where:{key:`ai:global:day:${Math.floor(now/86400000)}`}})).count).toBe(10);
});
it('supports lower daily allowance across minute windows and never raises the defaults',async()=>{
 vi.stubEnv('AI_GLOBAL_RPD','2');const now=Date.now();await consumeAIAllowance('synthetic-a',now);await consumeAIAllowance('synthetic-b',now+60000);
 await expect(consumeAIAllowance('synthetic-c',now+120000)).rejects.toMatchObject({status:429});
 vi.stubEnv('AI_GLOBAL_RPD','10000');vi.stubEnv('AI_CALLER_RPM','10000');
 for(let i=0;i<5;i++)await consumeAIAllowance('synthetic-capped',now+180000);
 await expect(consumeAIAllowance('synthetic-capped',now+180000)).rejects.toMatchObject({status:429});
});
