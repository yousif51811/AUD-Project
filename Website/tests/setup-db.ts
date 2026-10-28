import {beforeEach,afterAll} from 'vitest';
import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
beforeEach(async()=>{const url=new URL(process.env.DATABASE_URL??'');if(!url.pathname.endsWith('_test')||!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Refusing to reset limits outside a local test database.');await db.rateLimit.deleteMany();});
afterAll(()=>db.$disconnect());
