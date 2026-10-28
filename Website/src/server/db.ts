import { PrismaClient } from '@prisma/client';
const shared = globalThis as unknown as {
    fmDb?: PrismaClient;
};
export const db = shared.fmDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production')
    shared.fmDb = db;
