# Integration Tests

Integration tests run a real agent with stubbed CLI commands. This is the most common test type — you get real agent behavior without real side effects.

## What Gets Tested

- The agent receives your prompt
- It decides which tools to call (real LLM reasoning)
- Tool calls are intercepted by shims (no real `git push`, `rm -rf`, etc.)
- You assert on what the agent did

## Full Example

A test for an agent that reviews code changes:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, CopilotAdapter, setupMatchers, any } from 'agent-test-framework';
import type { Recording, Spy } from 'agent-test-framework';

setupMatchers();

describe('code review prompt', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let gitSpy: Spy;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({});
    testbed = await TestBed.create({
      fixtures: 'ts-project',
      fixturesDir: './fixtures',
      adapter,
    });

    gitSpy = testbed.spy('git');
    gitSpy.withArgs('diff', '--cached').returns({
      stdout: [
        '--- a/src/auth.ts',
        '+++ b/src/auth.ts',
        '@@ -10,6 +10,8 @@',
        '+  if (!token) throw new Error("missing token");',
        '+  const decoded = jwt.verify(token, SECRET);',
      ].join('\n'),
    });
    gitSpy.withArgs('log', any()).returns({
      stdout: 'abc1234 add auth middleware\ndef5678 initial commit',
    });
    gitSpy.default().returns({ stdout: '' });

    const cat = testbed.spy('cat');
    cat.default().returns({
      stdout: 'import jwt from "jsonwebtoken";\n// ... rest of file',
    });

    recording = await testbed
      .prompt('Review the staged changes. Are there any security issues?')
      .run();
  }, 120_000);

  afterAll(async () => {
    await testbed?.destroy();
    await adapter?.destroy();
  });

  it('inspected the diff', () => {
    expect(gitSpy).toHaveBeenCalledWith('diff', '--cached');
  });

  it('made tool calls', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(1);
  });

  it('recorded the prompt', () => {
    expect(recording.prompts).toContain(
      'Review the staged changes. Are there any security issues?'
    );
  });
});
```

## Simulating Error Conditions

Stub a command to fail and verify the agent handles it:

```typescript
const npm = testbed.spy('npm');
npm.withArgs('install').returns({
  stdout: '',
  stderr: 'npm ERR! code E404\nnpm ERR! 404 Not Found',
  exitCode: 1,
});
```

## Verifying Call Order

Use timestamps to check the agent called things in the right sequence:

```typescript
it('ran tests before deploying', () => {
  const testCall = testbed.spy('npm').findCall('test');
  const deployCall = testbed.spy('npm').findCall('run', 'deploy');
  expect(testCall).toBeDefined();
  expect(deployCall).toBeDefined();
  expect(testCall!.timestamp).toBeLessThan(deployCall!.timestamp);
});
```

## Verifying Call Count

```typescript
it('only pushed once', () => {
  const pushCalls = testbed.spy('git').calls.filter(
    c => c.args[0] === 'push'
  );
  expect(pushCalls.length).toBe(1);
});
```
