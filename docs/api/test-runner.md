# TestRunner

Run test suites in parallel or serial.

## Discover

```typescript
import { TestRunner } from 'agent-test-framework';

const files = await TestRunner.discover('tests/**/*.spec.ts');
```

## Run

```typescript
const result = await TestRunner.run([
  { name: 'deploy', run: async () => { /* ... */ } },
  { name: 'rollback', run: async () => { /* ... */ } },
  { name: 'migration', serial: true, run: async () => { /* ... */ } },
], { maxWorkers: 4 });
```

Parallel suites run concurrently (up to `maxWorkers`). Serial suites run one at a time, after parallel ones finish.

### Suite

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | — | Suite identifier |
| `serial` | `boolean` | `false` | Run sequentially |
| `run` | `() => Promise<unknown>` | — | Test function |

### RunResult

```typescript
interface RunResult {
  total: number;
  passed: number;
  failed: number;
  errors: Array<{ suite: string; error: unknown }>;
}
```

## WorkerPool

Low-level concurrency pool used internally by `TestRunner`. Use directly if you need custom scheduling:

```typescript
import { WorkerPool } from 'agent-test-framework';

const pool = WorkerPool.create(4);
pool.submit(async () => runTest('a'));
pool.submit(async () => runTest('b'));
const results = await pool.drain(); // waits for all tasks
```
