# Spy

Intercepts calls to a CLI binary and returns stubbed responses.

## Stubbing

### Specific arguments

```typescript
const git = testbed.spy('git');
git.withArgs('status').returns({
  stdout: 'On branch main\nnothing to commit',
});
git.withArgs('diff', '--cached').returns({
  stdout: '--- a/file.ts\n+++ b/file.ts',
});
```

### Default fallback

```typescript
git.default().returns({ stdout: '', exitCode: 0 });
```

Without a default, unmatched calls throw with the unmatched args.

### With matchers

```typescript
import { any, anyString, matching } from 'agent-test-framework';

git.withArgs('log', any()).returns({ stdout: 'abc123 msg' });
git.withArgs('checkout', matching(/^feature\//)).returns({ stdout: '' });
```

### Resolution order

1. Specific stubs checked in registration order
2. Default fallback
3. Error if nothing matches

## Reading calls

```typescript
git.calls;         // SpyCall[]
git.calls.length;  // number of times called
git.calls[0].args; // ['status']
```

### Find a specific call

```typescript
git.findCall('push', any());         // SpyCall | undefined
git.findCall('log', '--oneline');    // exact match
```

## Reset

```typescript
git.reset(); // clears stubs + recorded calls
```

## Types

```typescript
interface StubResponse {
  stdout: string;
  stderr?: string;    // default: ''
  exitCode?: number;  // default: 0
}

interface SpyCall {
  args: string[];
  timestamp: number;
  exitCode: number;
}
```
