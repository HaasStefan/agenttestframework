# Assertions

Custom vitest matchers for spies.

## Setup

Call once, before your tests:

```typescript
import { setupMatchers } from 'agent-test-framework';
setupMatchers();
```

## `toHaveBeenCalled()`

Passes if the spy was called at least once.

```typescript
expect(testbed.spy('git')).toHaveBeenCalled();
```

## `toHaveBeenCalledWith(...args)`

Passes if any recorded call matches all arguments. Supports [matchers](/api/matchers).

```typescript
expect(testbed.spy('git')).toHaveBeenCalledWith('status');
expect(testbed.spy('git')).toHaveBeenCalledWith('log', any());
expect(testbed.spy('git')).toHaveBeenCalledWith('checkout', matching(/^feature\//));
```

## Failure Output

```
Expected spy "git" to have been called with [push, origin], but no matching call was found.
Actual calls:
  [status]
  [diff, --cached]
```

## Direct Inspection

You don't have to use custom matchers. Standard vitest assertions work on the call data:

```typescript
const git = testbed.spy('git');

expect(git.calls.length).toBe(2);
expect(git.calls[0].args).toEqual(['status']);
expect(git.findCall('diff', any())).toBeDefined();
expect(git.findCall('push')).toBeUndefined(); // was NOT called
```
