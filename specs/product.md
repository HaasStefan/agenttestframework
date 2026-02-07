# Product

Name: Agent Test Framework
Purpose: To provide a comprehensive framework for testing CLI AI agents like Claude, Copilot CLI in various abstraction layers
Tech Stack: TypeScript, Node, PNPM

## Questions it should help answer

-	How effective is an agent skill?
-	How many tokens does an agent skill use?
-	How well does an agent perform a specific type of prompt?
-	How effective is the agent at discovering and selecting the correct skill?
-	Is the agent correctly following the skill instructions? (does it call the right tools?)
-	How many tokens are used for a prompt?
-	Which tasks can an agent perform good/bad in our repo?

## Concepts

### TestBed

Isolated environment with PATH shims that are mockable and spiable.

### Mocks

PATH shims which mock the functionality of a binary (like `git`, `node`, `python`), allowing for controlled testing scenarios. Mocks can be fine grained and mock entire shims or specific commands or specific command argument combinations.

### Spies

Spies are Mocks, but they also record information about how they were called, allowing for assertions on interactions.

### Asserts

Assertions are used to verify that the expected interactions with Mocks and Spies occurred, ensuring the correctness of the test scenarios. They are fluent apis inspired by vitest, jest, etc.

Special asserts for token usage and other specific scenarios.


### Global Configuration

A project-level config file (`agent-test.config.ts`) that defines defaults for all TestBed instances. Individual tests can override any global setting. This avoids repetition and makes it easy to re-run the same suite against a different agent or model.

```typescript
// agent-test.config.ts
import { defineConfig } from 'agent-test-framework';

export default defineConfig({
  agent: 'copilot-cli',
  model: 'opus-4.5',

  // All test suites run in parallel by default.
  // Each TestBed gets its own isolated working directory, so there is no
  // shared state between suites.
  parallel: true,
  maxWorkers: 4,

  // Global fixtures root
  fixturesDir: 'fixtures',
});
```

TestBed.create() inherits from the global config. Per-test overrides win:

```typescript
// Uses global agent + model
testbed = await TestBed.create();

// Overrides model for this specific test
testbed = await TestBed.create({ model: 'gpt-5.2' });
```

### Parallel Execution

Test suites run in parallel by default. Each TestBed creates its own isolated working directory with independent PATH shims, so suites cannot interfere with each other. Parallelism is configured globally via `maxWorkers` and can be disabled per-suite when needed (e.g. tests that bind to a fixed port).

```typescript
// Disable parallelism for a specific suite
describe.serial('e2e: dev server workflow', () => {
  // ...
});
```

### Recordings

Each test should be recorded to capture the interactions and outcomes, allowing for replay and analysis of test scenarios.

## Agent Testing Pyramid

Three layers: Unit, Integration, E2E.

### Unit Test Layer

For testing [Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [Custom Instructions](https://developers.openai.com/codex/guides/agents-md/) in isolation. 

Typical agent unit tests have the goal to make sure an agent skill calls the correct tools, with correct data and to make sure certain tools/commands are NOT invoked. E.g.: to make sure a skill does not call `rm -rf /` or other destructive commands.

`runSkill()` takes a path to a skill file and a prompt. It configures the agent CLI to only load that single skill — no other skills or custom instructions are active. This ensures the test is exercising the skill in isolation.

### Integration Test Layer

For testing Tool Discovery and effectiveness. For testing if the right Agent Skills and MCP tools are called, and to make sure other tools are not called. Also for testing the interaction between multiple components and ensuring they work together as expected. Also to make sure these prompts act in a token budget and don't regress on the budget.

### E2E Test Layer

For testing specific prompts which mock user prompts and simulate real-world scenarios, ensuring the entire system works as expected from end to end. Asserting how well an agent performs on a task, without mocking anything.

beforeEach, afterEach is very important here.

Example E2E tests: prompts that test specifc workflows like: create pull request, or migrate NgModules to Standalone, ...

## Special Handling

Prompts can be single prompts or multiple prompts (follow up prompts). The agent might ask the user for feedback, so the test framework needs to handle these interactions appropriately.

## Supported Agent CLIs:

- GitHub Copilot CLI
- Claude Code
- OpenAI Codex CLI

## Example Spec Files:

### Unit Test Example

```typescript
import { TestBed, any, anyString, matching } from 'agent-test-framework';

describe('commit skill', () => {
  let testbed: TestBed;
  let gitSpy: Spy;
  let rmSpy: Spy;
  let recording: Recording;

  beforeAll(async () => {
    // Arrange
    testbed = await TestBed.create();
    gitSpy = testbed.spy('git');
    rmSpy = testbed.spy('rm');

    // Specific arg matchers for known commands
    gitSpy.withArgs('status').returns({ stdout: 'M  src/index.ts' });
    gitSpy.withArgs('diff', '--staged').returns({ stdout: '+console.log("hello")' });

    // Catch-all: any other git subcommand with any args succeeds silently.
    // This prevents the run from failing when the agent calls git with
    // dynamic or unexpected arguments (e.g. `git log --oneline -5`).
    gitSpy.default().returns({ stdout: '', exitCode: 0 });

    // Act — run once, assert many times below.
    // runSkill() points the agent at a single skill file and locks the agent
    // to only that skill (no other skills or custom instructions are loaded).
    recording = await testbed.runSkill({
      skill: 'skills/commit.md',
      prompt: 'commit the staged changes',
    });
  });

  afterAll(async () => {
    await testbed.destroy();
  });

  it('should stage the changed file', () => {
    expect(gitSpy).toHaveBeenCalledWith('add', 'src/index.ts');
  });

  it('should call git commit with a non-empty message', () => {
    // matching() handles the dynamic commit message the agent generates
    expect(gitSpy).toHaveBeenCalledWith('commit', '-m', matching(/.+/));
  });

  it('should NOT run force push', () => {
    expect(gitSpy).not.toHaveBeenCalledWith('push', '--force');
  });

  it('should NOT run hard reset', () => {
    expect(gitSpy).not.toHaveBeenCalledWith('reset', '--hard');
  });

  it('should not call rm', () => {
    expect(rmSpy).not.toHaveBeenCalled();
  });

  it('should stay within token budget for a simple commit', () => {
    expect(recording.tokenUsage.total).toBeLessThan(5_000);
  });
});
```

### Integration Test Example

```typescript
import { TestBed, any, anyString, matching } from 'agent-test-framework';

describe('tool discovery for pull request workflow', () => {
  let testbed: TestBed;
  let gitSpy: Spy;
  let ghSpy: Spy;
  let npmSpy: Spy;
  let nodeSpy: Spy;
  let recording: Recording;

  beforeAll(async () => {
    // Arrange
    // agent and model inherited from agent-test.config.ts
    testbed = await TestBed.create({
      tools: ['git', 'gh'],
    });

    gitSpy = testbed.spy('git');
    ghSpy = testbed.spy('gh');
    npmSpy = testbed.spy('npm');
    nodeSpy = testbed.spy('node');

    // Specific return values for commands the agent is expected to call
    gitSpy.withArgs('branch', '--show-current').returns({ stdout: 'feat/login' });
    gitSpy.withArgs('log', matching(/main\.\.HEAD/), any()).returns({
      stdout: 'abc123 add login page\ndef456 add auth service',
    });
    // The agent may call git with any other flags/subcommands — let it succeed
    gitSpy.default().returns({ stdout: '', exitCode: 0 });

    // gh pr create can receive any dynamic title/body — match flexibly
    ghSpy.withArgs('pr', 'create', any()).returns({
      stdout: 'https://github.com/org/repo/pull/42',
    });
    ghSpy.default().returns({ stdout: '', exitCode: 0 });

    // Act
    recording = await testbed.runPrompt('create a pull request for the current branch');
  });

  afterAll(async () => {
    await testbed.destroy();
  });

  it('should use gh CLI to create the PR', () => {
    expect(ghSpy).toHaveBeenCalledWith('pr', 'create', any());
  });

  it('should include a title and body in the PR', () => {
    const createCall = ghSpy.findCall('pr', 'create', any());
    expect(createCall.args).toContain(matching(/--title/));
    expect(createCall.args).toContain(matching(/--body/));
  });

  it('should stay within token budget', () => {
    expect(recording.tokenUsage.total).toBeLessThan(15_000);
    expect(recording.tokenUsage.input).toBeLessThan(10_000);
  });

  it('should not invoke npm', () => {
    expect(npmSpy).not.toHaveBeenCalled();
  });

  it('should not invoke node', () => {
    expect(nodeSpy).not.toHaveBeenCalled();
  });
});
```

### E2E Test Example

```typescript
import { TestBed } from 'agent-test-framework';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('e2e: migrate NgModules to standalone', () => {
  let testbed: TestBed;
  let recording: Recording;

  beforeAll(async () => {
    // Arrange
    // agent, model, fixturesDir inherited from agent-test.config.ts
    testbed = await TestBed.create({
      fixtures: 'angular-ngmodule-project',
    });

    // Act — no mocks, real execution
    recording = await testbed.runPrompt(
      'migrate this Angular project from NgModules to standalone components'
    );
  });

  afterAll(async () => {
    await testbed.destroy();
  });

  it('should remove the AppModule file', () => {
    const moduleExists = fs.existsSync(
      path.join(testbed.workDir, 'src/app/app.module.ts')
    );
    expect(moduleExists).toBe(false);
  });

  it('should mark components as standalone', () => {
    const appComponent = fs.readFileSync(
      path.join(testbed.workDir, 'src/app/app.component.ts'),
      'utf-8'
    );
    expect(appComponent).toContain('standalone: true');
  });

  it('should still build successfully', async () => {
    const buildResult = await testbed.exec('npx', ['ng', 'build']);
    expect(buildResult.exitCode).toBe(0);
  });

  it('should produce a recording', () => {
    expect(recording.id).toBeDefined();
  });

  it('should complete within a reasonable token budget', () => {
    expect(recording.tokenUsage.total).toBeLessThan(50_000);
  });
});

describe('e2e: multi-prompt interaction', () => {
  let testbed: TestBed;
  let session: Session;
  let recording: Recording;

  beforeAll(async () => {
    // Arrange
    testbed = await TestBed.create({
      fixtures: 'express-api-project',
    });

    // Act — multi-turn conversation
    session = await testbed.startSession();
    await session.sendPrompt('add JWT authentication middleware to the Express app');
    // The agent may ask a clarifying question — answer it
    await session.onQuestion((q) => {
      return 'protect all /api/* routes except /api/health';
    });
    recording = await session.end();
  });

  afterAll(async () => {
    await testbed.destroy();
  });

  it('should create an auth middleware file', () => {
    const middlewareFile = fs.readFileSync(
      path.join(testbed.workDir, 'src/middleware/auth.ts'),
      'utf-8'
    );
    expect(middlewareFile).toContain('jwt');
  });

  it('should exclude the health route from auth', () => {
    const routesFile = fs.readFileSync(
      path.join(testbed.workDir, 'src/routes/index.ts'),
      'utf-8'
    );
    expect(routesFile).toContain('/api/health');
  });

  it('should record the full interaction', () => {
    expect(recording.prompts.length).toBeGreaterThanOrEqual(1);
    expect(recording.interactions.length).toBeGreaterThanOrEqual(2);
  });

  it('should stay within token budget for a multi-turn task', () => {
    expect(recording.tokenUsage.total).toBeLessThan(80_000);
  });
});
```
