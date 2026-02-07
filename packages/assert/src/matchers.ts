import { expect } from 'vitest';
import type { ArgMatcher } from '@agent-test/core';
import { matchArgs } from '@agent-test/core';
import type { SpyImpl } from '@agent-test/shims';

function isSpy(value: unknown): value is SpyImpl {
  return (
    typeof value === 'object' &&
    value !== null &&
    'calls' in value &&
    'resolve' in value
  );
}

function formatCalls(spy: SpyImpl): string {
  if (spy.calls.length === 0) {
    return '  (no calls)';
  }
  return spy.calls.map(c => `  [${c.args.join(', ')}]`).join('\n');
}

export function setupMatchers(): void {
  expect.extend({
    toHaveBeenCalled(received: unknown) {
      if (!isSpy(received)) {
        return {
          pass: false,
          message: () => 'Expected a Spy instance',
        };
      }

      const pass = received.calls.length > 0;
      return {
        pass,
        message: () =>
          pass
            ? `Expected spy "${received.name}" not to have been called, but it was called ${received.calls.length} time(s):\n${formatCalls(received)}`
            : `Expected spy "${received.name}" to have been called, but it was not called`,
      };
    },

    toHaveBeenCalledWith(received: unknown, ...args: (string | ArgMatcher)[]) {
      if (!isSpy(received)) {
        return {
          pass: false,
          message: () => 'Expected a Spy instance',
        };
      }

      const matchingCall = received.calls.find(call =>
        matchArgs(call.args, args)
      );

      const pass = matchingCall !== undefined;
      return {
        pass,
        message: () =>
          pass
            ? `Expected spy "${received.name}" not to have been called with [${args.map(a => typeof a === 'string' ? a : (a as ArgMatcher).description).join(', ')}], but a matching call was found`
            : `Expected spy "${received.name}" to have been called with [${args.map(a => typeof a === 'string' ? a : (a as ArgMatcher).description).join(', ')}], but no matching call was found.\nActual calls:\n${formatCalls(received)}`,
      };
    },
  });
}
