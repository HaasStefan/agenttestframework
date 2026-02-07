# TestBed

Creates an isolated environment for running an agent with stubbed CLI commands.

## `TestBed.create(options?)`

```typescript
const testbed = await TestBed.create({
  adapter,                           // AgentAdapter (default: StubAdapter)
  fixtures: 'my-project',           // folder to copy into working dir
  fixturesDir: './fixtures',        // parent dir of fixture folders
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `adapter` | `AgentAdapter` | `StubAdapter` | The agent to run |
| `fixtures` | `string` | — | Fixture folder name |
| `fixturesDir` | `string` | — | Where fixture folders live |
| `tools` | `string[]` | — | Tool allowlist |

## `testbed.spy(name)`

Returns a [Spy](/api/spy) for a binary. Creates the shim on first call.

```typescript
const git = testbed.spy('git');
const npm = testbed.spy('npm');
```

Same name returns the same spy.

## `testbed.prompt(text)`

Returns a `PromptBuilder` for fluent configuration before running. Call `.run()` to execute. Supports `.onQuestion()` for handling agent questions.

```typescript
const recording = await testbed.prompt('What files changed?').run();

// With question handling
const recording = await testbed
  .prompt('deploy to production')
  .onQuestion(q => 'yes')
  .run();
```

Returns a [Recording](/api/recording).

## `testbed.skill(skillPath, prompt)`

Returns a `PromptBuilder` for fluent skill configuration. Locks the agent to a single skill file. Same chaining API as `.prompt()`.

```typescript
const recording = await testbed
  .skill('./skills/deploy.md', 'Deploy to staging')
  .run();

// With question handling
const recording = await testbed
  .skill('./skills/deploy.md', 'deploy to production')
  .onQuestion(q => {
    if (q.includes('continue')) return 'yes';
    return 'no';
  })
  .run();
```

## `testbed.runPrompt(prompt)` / `testbed.runSkill(options)`

Shorthand methods that run immediately without builder chaining. Equivalent to `.prompt(text).run()` and `.skill(path, prompt).run()`. These don't support `.onQuestion()`.

```typescript
const recording = await testbed.runPrompt('What files changed?');

const recording = await testbed.runSkill({
  skill: './skills/deploy.md',
  prompt: 'Deploy to staging',
});
```

## `testbed.startSession()`

```typescript
const session = await testbed.startSession();
await session.sendPrompt('first turn');
await session.sendPrompt('second turn');
const recording = await session.end();
```

## `testbed.getEnv()`

Returns the environment with shimmed `PATH`. Useful if you're calling the adapter directly.

## `testbed.destroy()`

Cleans up: stops adapter, closes shim server, removes temp files. Call in `afterAll`.

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `workDir` | `string` | Temp working directory |
| `shimBinDir` | `string` | Shim directory (prepended to PATH) |
