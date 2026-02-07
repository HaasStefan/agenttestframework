# Regression Snapshots

Save recordings to disk and compare them across runs to catch behavioral regressions.

## Save a Recording

```typescript
import { RecordingStore } from 'agent-test-framework';

const recording = await testbed.runSkill({
  skill: './skills/migrate.md',
  prompt: 'Migrate the database schema',
});

await RecordingStore.save(recording, './recordings');
// writes ./recordings/<uuid>.json
```

## Load and Inspect

```typescript
const loaded = await RecordingStore.load(recording.id, './recordings');
console.log(loaded.interactions);
```

## Recording JSON Format

```json
{
  "id": "a1b2c3d4-...",
  "prompts": ["Migrate the database schema"],
  "interactions": [
    {
      "type": "tool_call",
      "name": "shell",
      "args": { "command": "npm run migrate" },
      "result": "Migration complete",
      "timestamp": 1707345600000
    }
  ],
  "tokenUsage": { "input": 1200, "output": 80, "total": 1280 }
}
```

## Snapshot Testing Pattern

Save a known-good recording as a baseline. On subsequent runs, compare the tool call sequence:

```typescript
import { RecordingStore } from 'agent-test-framework';
import { readFile } from 'node:fs/promises';

describe('migrate skill regression', () => {
  let recording: Recording;

  beforeAll(async () => {
    // ... run the skill, get recording
  });

  it('calls the same tools as baseline', async () => {
    const baseline = await RecordingStore.load(
      'known-good-id',
      './recordings'
    );

    const baselineTools = baseline.interactions
      .filter(i => i.type === 'tool_call')
      .map(i => i.name);

    const currentTools = recording.interactions
      .filter(i => i.type === 'tool_call')
      .map(i => i.name);

    expect(currentTools).toEqual(baselineTools);
  });
});
```

## What to Compare

LLM outputs are non-deterministic. Don't compare exact args or results. Compare:

- Tool names called (sequence)
- Number of tool calls (rough range)
- Token usage (within a threshold)
- That specific critical calls were made

Don't compare:

- Exact tool arguments (the agent may phrase commands differently)
- Exact tool results (depend on stubs, which you control anyway)
- Interaction timestamps
