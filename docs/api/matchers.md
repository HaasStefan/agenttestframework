# Matchers

Flexible argument matching for stubs and assertions.

```typescript
import { any, anyString, matching } from 'agent-test-framework';
```

## Built-in Matchers

### `any()`

Matches anything.

```typescript
spy.withArgs('log', any()).returns({ stdout: '...' });
expect(spy).toHaveBeenCalledWith('log', any());
```

### `anyString()`

Matches any string value.

```typescript
spy.withArgs('checkout', anyString()).returns({ stdout: '' });
```

### `matching(regex)`

Matches a string against a regular expression.

```typescript
spy.withArgs('checkout', matching(/^feature\//)).returns({ stdout: '' });
expect(spy).toHaveBeenCalledWith('push', matching(/origin/));
```

## Custom Matchers

Implement `ArgMatcher`:

```typescript
import type { ArgMatcher } from 'agent-test-framework';

function startsWith(prefix: string): ArgMatcher {
  return {
    matches: (value: string) => value.startsWith(prefix),
    description: `startsWith("${prefix}")`,
  };
}

spy.withArgs('branch', startsWith('feature/')).returns({ stdout: '' });
```

## `matchArgs(actual, expected)`

Low-level comparator. Used internally by spies and assertions.

```typescript
import { matchArgs, any } from 'agent-test-framework';

matchArgs(['status'], ['status']);           // true
matchArgs(['log', '-n5'], ['log', any()]);   // true
matchArgs(['push'], ['push', 'origin']);      // false (length mismatch)
```
