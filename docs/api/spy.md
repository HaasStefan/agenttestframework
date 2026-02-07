# Spy

Intercepts calls to a CLI binary. Records every call. Passes through to the real binary by default — only returns stubbed responses for args you explicitly configure.

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

Only `git status` and `git diff --cached` are stubbed. Everything else (e.g. `git log`) passes through to the real `git` binary.

### Default fallback

Stubs **all** unmatched args. Disables passthrough:

```typescript
git.default().returns({ stdout: '', exitCode: 0 });
```

### With matchers

```typescript
import { any, anyString, matching } from 'agent-test-framework';

git.withArgs('log', any()).returns({ stdout: 'abc123 msg' });
git.withArgs('checkout', matching(/^feature\//)).returns({ stdout: '' });
```

### Resolution order

1. Specific stubs checked in registration order
2. Default fallback (if set)
3. Passthrough to real binary

## Passthrough

When no stub matches and no default is set, the shim:

1. Strips its own directory from `PATH`
2. Finds the real binary
3. Executes it with the original arguments
4. Returns the real stdout/stderr/exitCode

The call is still recorded in `spy.calls` — you get observability without faking behavior.

```typescript
const git = testbed.spy('git');
// No stubs — just observe
const recording = await testbed.prompt('check the repo').run();
// git.calls contains every git command the agent ran, with real output
```

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
