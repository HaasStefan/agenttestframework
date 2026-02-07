import { defineConfig } from 'vitest/config';
import path from 'node:path';

const pkgRoot = path.resolve(import.meta.dirname, '../../packages');

export default defineConfig({
  resolve: {
    alias: {
      '@agent-test/core': path.join(pkgRoot, 'core/src/index.ts'),
      '@agent-test/shims': path.join(pkgRoot, 'shims/src/index.ts'),
      '@agent-test/assert': path.join(pkgRoot, 'assert/src/index.ts'),
      '@agent-test/recorder': path.join(pkgRoot, 'recorder/src/index.ts'),
      '@agent-test/testbed': path.join(pkgRoot, 'testbed/src/index.ts'),
      '@agent-test/adapter-copilot': path.join(pkgRoot, 'adapter-copilot/src/index.ts'),
      '@agent-test/runner': path.join(pkgRoot, 'runner/src/index.ts'),
    },
  },
  test: {
    include: ['**/*.e2e.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
