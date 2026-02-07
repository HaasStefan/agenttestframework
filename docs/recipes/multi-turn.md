# Multi-turn Sessions

Use `startSession()` for conversations where the agent needs to remember context across multiple prompts.

## Basic Session

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, CopilotAdapter, setupMatchers } from 'agent-test-framework';
import type { Recording } from 'agent-test-framework';

setupMatchers();

describe('multi-turn: create and test a function', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({});
    testbed = await TestBed.create({ adapter });

    const cat = testbed.spy('cat');
    cat.default().returns({ stdout: 'export function add(a, b) { return a + b; }' });

    const npm = testbed.spy('npm');
    npm.withArgs('test').returns({ stdout: 'Tests passed: 3/3' });
    npm.default().returns({ stdout: '' });

    const session = await testbed.startSession();
    await session.sendPrompt('Create an add function in src/math.ts');
    await session.sendPrompt('Now write tests for it and run them');
    recording = await session.end();
  }, 180_000);

  afterAll(async () => {
    await testbed?.destroy();
    await adapter?.destroy();
  });

  it('captured both prompts', () => {
    expect(recording.prompts).toEqual([
      'Create an add function in src/math.ts',
      'Now write tests for it and run them',
    ]);
  });

  it('ran the tests', () => {
    expect(testbed.spy('npm')).toHaveBeenCalledWith('test');
  });

  it('recorded interactions from both turns', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(2);
  });
});
```

## Session Lifecycle

```typescript
const session = await testbed.startSession();

// First turn
await session.sendPrompt('do something');

// Second turn — agent has memory of first turn
await session.sendPrompt('now do the next thing');

// End session, get the combined recording
const recording = await session.end();
```

`recording.prompts` contains all prompts in order. `recording.interactions` contains all tool calls from all turns.

## When to Use Sessions vs Separate runPrompt Calls

| Use sessions when... | Use separate `runPrompt()` when... |
|---|---|
| Second prompt depends on first | Prompts are independent |
| Testing conversational flow | Testing isolated behaviors |
| Agent needs to remember context | You want a clean slate each time |
