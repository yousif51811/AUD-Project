import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
});
