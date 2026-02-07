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

### `adapter.runPrompt(prompt, env)`

Sends a free-form prompt to a new session. Returns a [Recording](/api/recording).

### `adapter.runSkill(options, env)`

Sends a prompt locked to a skill file:

```typescript
await adapter.runSkill({
  skill: './skills/deploy.md',
  prompt: 'Deploy to production',
}, env);
```

### `adapter.startSession(env)`

Returns a [Session](/api/recording#session) for multi-turn interaction.

### `adapter.destroy()`

Stops the Copilot client. Call in `afterAll`.

## Token Tracking

Listens for `assistant.usage` events from the SDK. Some Copilot CLI versions don't emit these — `tokenUsage` will be zeroes. See [Token Budgets](/recipes/token-budgets#limitations).
