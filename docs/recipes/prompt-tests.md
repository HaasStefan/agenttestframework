# Prompt Tests

Test free-form prompts with `runPrompt()`. Unlike `runSkill()`, the agent is not locked to a skill file — it can use any tool.

## Basic Prompt Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, CopilotAdapter, setupMatchers, any } from 'agent-test-framework';
import type { Recording } from 'agent-test-framework';

setupMatchers();

describe('git status prompt', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({});
    testbed = await TestBed.create({ adapter });

    const git = testbed.spy('git');
    git.withArgs('status').returns({
      stdout: 'On branch main\nChanges not staged for commit:\n  modified: src/index.ts',
    });
    git.withArgs('diff').returns({
      stdout: '- old line\n+ new line',
    });
    git.default().returns({ stdout: '' });

    recording = await testbed.runPrompt(
      'What files have changed? Show me the diff.'
    );
  }, 120_000);

  afterAll(async () => {
    await testbed?.destroy();
    await adapter?.destroy();
  });

  it('checked git status', () => {
    expect(testbed.spy('git')).toHaveBeenCalledWith('status');
  });

  it('ran git diff', () => {
    expect(testbed.spy('git')).toHaveBeenCalledWith('diff');
  });

  it('recorded interactions', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(1);
  });
});
```

## Asserting on Interaction Content

Recordings include the raw tool call data from the agent. You can assert on what the agent did:

```typescript
it('used the shell tool', () => {
  const shellCalls = recording.interactions.filter(
    i => i.type === 'tool_call' && i.name === 'shell'
  );
  expect(shellCalls.length).toBeGreaterThanOrEqual(1);
});

it('passed the right command', () => {
  const call = recording.interactions.find(
    i => i.name === 'shell' && JSON.stringify(i.args).includes('git status')
  );
  expect(call).toBeDefined();
});
```

## Stubbing Multiple Binaries

```typescript
const git = testbed.spy('git');
const npm = testbed.spy('npm');
const curl = testbed.spy('curl');

git.default().returns({ stdout: '' });
npm.withArgs('list').returns({ stdout: 'express@4.18.0' });
curl.default().returns({ stdout: '{"ok": true}', exitCode: 0 });
```

## Flexible Argument Matching

When you don't know the exact args the agent will pass:

```typescript
import { any, matching } from 'agent-test-framework';

git.withArgs('log', any()).returns({ stdout: 'abc123 Initial commit' });
git.withArgs('checkout', matching(/^feature\//)).returns({ stdout: '' });
```

| Matcher | Matches |
|---------|---------|
| `any()` | anything |
| `anyString()` | any string |
| `matching(/regex/)` | string matching the regex |

## Default Fallback

Always set a `.default()` on your spies. Agents can call commands with unexpected arguments. Without a default, unmatched calls throw an error and the test fails with a confusing stack trace.

```typescript
git.default().returns({ stdout: '', exitCode: 0 });
```
