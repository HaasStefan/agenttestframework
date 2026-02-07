# Project Setup

## vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120_000,  // agent calls are slow
    hookTimeout: 120_000,  // beforeAll runs the agent
  },
});
```

Agent interactions take 10-60 seconds per prompt. Set timeouts accordingly.

## Fixtures

If your tests need project files for the agent to work with, put them in a `fixtures/` directory:

```
fixtures/
  my-project/
    src/
      index.ts
    package.json
```

Then reference them in `TestBed.create()`:

```typescript
const testbed = await TestBed.create({
  fixtures: 'my-project',
  fixturesDir: path.resolve(__dirname, '../fixtures'),
  adapter,
});
```

The framework copies the fixture folder into a temp working directory. The agent sees those files when it runs.

## Test File Layout

```
tests/
  skills/
    summarize.spec.ts     # skill-specific tests
    refactor.spec.ts
  prompts/
    git-operations.spec.ts
    code-review.spec.ts
  e2e/
    full-workflow.e2e.ts   # end-to-end with real agent
```

## Shared Setup

If multiple tests use the same adapter, create a shared setup file:

```typescript
// tests/setup.ts
import { CopilotAdapter } from 'agent-test-framework';

let adapter: CopilotAdapter;

export async function getAdapter() {
  if (!adapter) {
    adapter = await CopilotAdapter.create({});
  }
  return adapter;
}

export async function teardown() {
  if (adapter) {
    await adapter.destroy();
    adapter = undefined!;
  }
}
```

## CI

Agent tests hit real APIs and cost tokens. Separate them from your unit tests:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:agent": "vitest run tests/skills/ tests/prompts/",
    "test:e2e": "vitest run tests/e2e/"
  }
}
```

In CI, gate agent tests behind a flag or run them on a schedule rather than on every push.
