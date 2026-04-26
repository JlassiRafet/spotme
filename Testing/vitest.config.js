import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 20000,
    hookTimeout: 15000,
    include: ['unit/**/*.test.js', 'integration/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['../server/routes/**/*.js', '../server/_shared.js'],
      exclude: ['../server/server.js', '../server/db.js'],
    },
  },
});
