import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.integration-spec.ts'],
    hookTimeout: 30000,
    testTimeout: 10000,
    fileParallelism: false,
  },
});
