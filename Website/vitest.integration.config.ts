import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},test:{setupFiles:['tests/setup-db.ts'],environment:'node',include:['tests/integration/**/*.test.ts'],fileParallelism:false}});
