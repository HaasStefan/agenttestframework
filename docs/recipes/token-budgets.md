# Token Budgets

Recordings track how many tokens the agent consumed. Use this to guard against prompt bloat, assert on cost boundaries, or catch regressions.

## Asserting on Token Usage

```typescript
it('used tokens within budget', () => {
  expect(recording.tokenUsage.total).toBeLessThan(5000);
});

it('has valid token structure', () => {
  expect(recording.tokenUsage.total).toBe(
    recording.tokenUsage.input + recording.tokenUsage.output
  );
});
```

## Comparing Across Runs

Save recordings and compare token usage over time:

```typescript
import { RecordingStore } from 'agent-test-framework';

// After a run
await RecordingStore.save(recording, './recordings');

// Later, load and compare
const baseline = await RecordingStore.load('baseline-id', './recordings');
const current = recording;

it('did not regress on token usage', () => {
  const threshold = 1.2; // allow 20% increase
  expect(current.tokenUsage.total).toBeLessThan(
    baseline.tokenUsage.total * threshold
  );
});
```

## Limitations

Token tracking depends on the agent's CLI and SDK version. The Copilot adapter listens for `assistant.usage` events. Some CLI versions don't emit them — in that case `tokenUsage` will be `{ input: 0, output: 0, total: 0 }`.

If token usage matters to you, check that your CLI version supports it:

```typescript
it('reports token usage', () => {
  // Skip if CLI doesn't report usage
  if (recording.tokenUsage.total === 0) return;

  expect(recording.tokenUsage.total).toBeLessThan(5000);
});
```
