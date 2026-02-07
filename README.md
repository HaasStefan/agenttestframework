<p align="center">
  <img src="assets/logo.png" alt="Agent Test Framework" width="200">
</p>

# Agent Test Framework

Test framework for CLI AI agents. Stub CLI commands, record tool calls, assert on agent behavior.

## Install

```bash
pnpm add -D agent-test-framework
```

## Quick Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, CopilotAdapter, setupMatchers } from 'agent-test-framework';
import type { Recording } from 'agent-test-framework';

setupMatchers();

describe('deploy skill', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({});
    testbed = await TestBed.create({ adapter });

    const git = testbed.spy('git');
    git.withArgs('push').returns({ stdout: 'Everything up-to-date' });
    // All other git calls pass through to real git

    recording = await testbed.runSkill({
      skill: './skills/deploy.md',
      prompt: 'Deploy to production',
    });
  }, 120_000);

  afterAll(async () => {
    await testbed?.destroy();
    await adapter?.destroy();
  });

  it('pushed to git', () => {
    expect(testbed.spy('git')).toHaveBeenCalledWith('push');
  });

  it('recorded interactions', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(1);
  });
});
```

## How It Works

1. `TestBed` creates a temp directory and starts a shim server
2. `spy('git')` places an executable shim on PATH that intercepts `git` calls
3. Stubbed args return your response. Unstubbed args pass through to the real binary.
4. Every call is recorded in the spy — assert on what the agent did

## Docs

```bash
pnpm docs:dev
```

## Test

```bash
pnpm test        # unit tests
pnpm test:e2e    # e2e tests (requires copilot auth login)
```

## Packages

| Package | Description |
|---------|-------------|
| `agent-test-framework` | Umbrella — re-exports everything |
| `@agent-test/core` | Types, matchers (`any`, `anyString`, `matching`) |
| `@agent-test/testbed` | TestBed orchestrator |
| `@agent-test/shims` | PATH shims, SpyImpl |
| `@agent-test/assert` | vitest matchers (`toHaveBeenCalledWith`) |
| `@agent-test/recorder` | Recording, RecordingStore |
| `@agent-test/adapter-copilot` | GitHub Copilot CLI adapter |
| `@agent-test/runner` | Parallel test runner |
