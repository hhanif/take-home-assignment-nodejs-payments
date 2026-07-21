import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 30_000,
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
