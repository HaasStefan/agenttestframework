# E2E Tests

End-to-end tests run the real agent with real (or partially stubbed) commands. Use these sparingly — they're slow, cost tokens, and depend on external services.

## When to Use E2E

- Smoke tests: "does the agent start up and respond at all?"
- Validation that the full stack works: adapter, shims, recording
- Testing behaviors that are hard to stub (file system operations, complex tool chains)

## Basic E2E

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, CopilotAdapter, setupMatchers } from 'agent-test-framework';
import type { Recording } from 'agent-test-framework';

setupMatchers();

describe('e2e: agent responds to a prompt', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({});
    testbed = await TestBed.create({
      fixtures: 'simple-project',
      fixturesDir: './fixtures',
      adapter,
    });

    // No spies — let the agent use real commands
    recording = await testbed
      .prompt('What files are in this project?')
      .run();
  }, 120_000);

  afterAll(async () => {
    await testbed?.destroy();
    await adapter?.destroy();
  });

  it('produced a recording', () => {
    expect(recording.id).toBeDefined();
  });

  it('recorded the prompt', () => {
    expect(recording.prompts).toContain('What files are in this project?');
  });

  it('made at least one tool call', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(1);
  });
});
```

## Mixed: Real Agent, Stubbed Side Effects

Stub only the dangerous commands. Let the agent read files for real, but intercept writes:

```typescript
const git = testbed.spy('git');
git.withArgs('push').returns({ stdout: 'Everything up-to-date' });
git.withArgs('commit', any()).returns({ stdout: '[main abc1234] commit msg' });
// Don't stub 'status' or 'diff' — let those hit real git
```

Note: unstubbed commands are **not intercepted**. The real binary on PATH runs. Only commands you `spy()` on get shims.

## Separate Config for E2E

Keep e2e tests in their own directory with a dedicated vitest config:

```typescript
// tests/e2e/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.e2e.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
```

```json
{
  "scripts": {
    "test:e2e": "vitest run --config tests/e2e/vitest.config.ts"
  }
}
```

## CI Considerations

- E2E tests need `copilot auth login` (or a `GITHUB_TOKEN` env var)
- They cost tokens — run on a schedule, not on every push
- They're flaky by nature (LLM responses vary) — assert on structure, not content
- Use generous timeouts (120s+)
