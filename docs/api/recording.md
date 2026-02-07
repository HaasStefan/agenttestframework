# Recording

Returned by `runPrompt()`, `runSkill()`, and `session.end()`. Contains everything that happened during the agent run.

## Structure

```typescript
interface Recording {
  id: string;                       // UUID
  prompts: string[];                // prompts sent to the agent
  interactions: Interaction[];      // tool calls
  tokenUsage: TokenUsage;
}

interface Interaction {
  type: 'tool_call' | 'prompt' | 'response';
  name?: string;                    // tool name
  args?: Record<string, unknown>;   // tool arguments
  result?: unknown;                 // tool output
  timestamp: number;
}

interface TokenUsage {
  input: number;
  output: number;
  total: number;                    // input + output
}
```

## Persistence

```typescript
import { RecordingStore } from 'agent-test-framework';

// Save
await RecordingStore.save(recording, './recordings');

// Load
const loaded = await RecordingStore.load(recording.id, './recordings');
```

Writes/reads `<dir>/<id>.json`.

## Session

```typescript
interface Session {
  sendPrompt(prompt: string): Promise<void>;
  onQuestion(handler: (question: string) => string | Promise<string>): void;
  end(): Promise<Recording>;
}
```

`end()` seals the session and returns a recording with all prompts and interactions.
