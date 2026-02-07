# CopilotAdapter

Runs GitHub Copilot CLI via `@github/copilot-sdk`.

## Prerequisites

```bash
copilot auth login
```

## Create

```typescript
import { CopilotAdapter } from 'agent-test-framework';

const adapter = await CopilotAdapter.create({
  model: 'gpt-4o',             // optional
  githubToken: 'ghp_...',      // optional, defaults to copilot auth
  availableTools: ['shell'],    // optional, tool allowlist
  excludedTools: ['writeFile'], // optional, tool denylist
});
```

| Option | Type | Description |
|--------|------|-------------|
| `model` | `string` | Model name |
| `cwd` | `string` | Working directory |
| `githubToken` | `string` | GitHub token (defaults to `copilot auth login`) |
| `availableTools` | `string[]` | Tool allowlist for skill runs |
| `excludedTools` | `string[]` | Tool denylist for skill runs |

## Methods

### `adapter.runPrompt(prompt, env, runOptions?)`

Sends a free-form prompt to a new session. Returns a [Recording](/api/recording).

The optional `runOptions` parameter accepts an `AgentRunOptions` object. When `onQuestion` is provided, it's wired to the SDK's `onUserInputRequest` callback so the agent can ask the user questions during execution.

### `adapter.runSkill(options, env, runOptions?)`

Sends a prompt locked to a skill file:

```typescript
await adapter.runSkill({
  skill: './skills/deploy.md',
  prompt: 'Deploy to production',
}, env);

// With question handling
await adapter.runSkill(
  { skill: './skills/deploy.md', prompt: 'Deploy to production' },
  env,
  { onQuestion: (q) => 'yes' },
);
```

### `adapter.startSession(env)`

Returns a [Session](/api/recording#session) for multi-turn interaction.

### `adapter.destroy()`

Stops the Copilot client. Call in `afterAll`.

## Question Handling

When the agent asks a question via the `ask_user` tool, the SDK fires `onUserInputRequest`. The adapter maps this to the `onQuestion` handler from `AgentRunOptions`:

```typescript
// Via the builder API (preferred)
const recording = await testbed
  .prompt('deploy to production')
  .onQuestion((question, choices) => {
    if (question.includes('Are you sure')) return 'yes';
    return 'no';
  })
  .run();
```

The handler receives the question text and an optional `choices` array. Return a string answer.

## Token Tracking

Listens for `assistant.usage` events from the SDK. Some Copilot CLI versions don't emit these — `tokenUsage` will be zeroes. See [Token Budgets](/recipes/token-budgets#limitations).
