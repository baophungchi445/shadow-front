import { defineConfig } from 'vitest/config';

// Balance simulations only (`pnpm sim`); the normal test run ignores *.sim.ts files.
export default defineConfig({ test: { include: ['src/**/*.sim.ts'] } });
