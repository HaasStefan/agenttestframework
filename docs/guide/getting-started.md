# Getting Started

## Install

```bash
pnpm add -D agent-test-framework vitest
```

Authenticate with Copilot (one-time):

```bash
copilot auth login
```

## Your First Test

Say you have a Copilot skill at `skills/summarize.md` that reads a file and summarizes it. Here's how to test it:

```typescript
// tests/summarize.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, CopilotAdapter, setupMatchers, any } from 'agent-test-framework';
import type { Recording } from 'agent-test-framework';

setupMatchers();

describe('summarize skill', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({});
    testbed = await TestBed.create({ adapter });

    // Stub the file the skill will try to read
    const cat = testbed.spy('cat');
    cat.withArgs('README.md').returns({
      stdout: '# My Project\nA CLI tool for managing tasks.',
    });
    cat.default().returns({ stdout: '', exitCode: 0 });

    recording = await testbed.runSkill({
      skill: './skills/summarize.md',
      prompt: 'Summarize README.md',
    });
  }, 120_000);

  afterAll(async () => {
    await testbed?.destroy();
    await adapter?.destroy();
  });

  it('called cat to read the file', () => {
    expect(testbed.spy('cat')).toHaveBeenCalledWith('README.md');
  });

  it('recorded the prompt', () => {
    expect(recording.prompts).toContain('Summarize README.md');
  });

  it('made at least one tool call', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(1);
  });
});
```

Run it:

```bash
npx vitest run tests/summarize.spec.ts
```

## What Just Happened

1. `CopilotAdapter.create()` started the Copilot CLI process
2. `TestBed.create()` created a temp directory and a shim server
3. `testbed.spy('cat')` placed an executable `cat` shim in a temp bin dir
4. `testbed.runSkill()` ran the agent with the shim dir prepended to `PATH` — so when the agent called `cat README.md`, it hit your stub
5. The recording captured the prompt, tool calls, and token usage
6. You asserted on the recording

## Next Steps

- [How It Works](/guide/how-it-works) — understand the shim mechanism
- [Skill Tests](/recipes/skill-tests) — test individual skill files
- [Prompt Tests](/recipes/prompt-tests) — test free-form prompts
- [E2E Tests](/recipes/e2e-tests) — test against a real agent with real commands
