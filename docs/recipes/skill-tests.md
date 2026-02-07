# Skill Tests

Test a single Copilot skill file in isolation using `runSkill()`. This locks the agent to that skill — it can't use other skills or deviate.

## Basic Skill Test

Given a skill at `skills/deploy.md` that runs `npm run build` and `git push`:

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

    const npm = testbed.spy('npm');
    npm.withArgs('run', 'build').returns({ stdout: 'Build complete' });
    npm.default().returns({ stdout: '' });

    const git = testbed.spy('git');
    git.withArgs('push').returns({ stdout: 'Everything up-to-date' });
    git.default().returns({ stdout: '' });

    recording = await testbed.runSkill({
      skill: './skills/deploy.md',
      prompt: 'Deploy the project',
    });
  }, 120_000);

  afterAll(async () => {
    await testbed?.destroy();
    await adapter?.destroy();
  });

  it('ran the build', () => {
    expect(testbed.spy('npm')).toHaveBeenCalledWith('run', 'build');
  });

  it('pushed to git', () => {
    expect(testbed.spy('git')).toHaveBeenCalledWith('push');
  });

  it('built before pushing', () => {
    const buildCall = testbed.spy('npm').findCall('run', 'build');
    const pushCall = testbed.spy('git').findCall('push');
    expect(buildCall!.timestamp).toBeLessThan(pushCall!.timestamp);
  });
});
```

## Skill with Fixtures

If your skill operates on project files, use fixtures:

```typescript
testbed = await TestBed.create({
  fixtures: 'react-app',
  fixturesDir: path.resolve(__dirname, '../fixtures'),
  adapter,
});
```

The agent sees the fixture files in its working directory.

## Restricting Tools

Limit which tools the adapter exposes to the skill:

```typescript
adapter = await CopilotAdapter.create({
  availableTools: ['shell', 'readFile'],
  excludedTools: ['writeFile'],
});
```

## Testing That a Skill Doesn't Do Something

```typescript
it('did not run git push', () => {
  expect(testbed.spy('git').findCall('push')).toBeUndefined();
});

it('did not call npm install', () => {
  expect(testbed.spy('npm').findCall('install')).toBeUndefined();
});
```

## Multiple Skills in One File

Use separate `describe` blocks. Each gets its own `beforeAll` + agent run:

```typescript
describe('deploy skill', () => {
  // ... setup, run deploy skill, assert
});

describe('rollback skill', () => {
  // ... setup, run rollback skill, assert
});
```

Each `runSkill()` call starts a fresh agent session, so there's no state leaking between blocks.
