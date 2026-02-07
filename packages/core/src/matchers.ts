import type { ArgMatcher } from './types.js';

/**
 * Matches any value.
 */
export function any(): ArgMatcher {
  return {
    matches: () => true,
    description: 'any()',
  };
}

/**
 * Matches any string value.
 */
export function anyString(): ArgMatcher {
  return {
    matches: (value: string) => typeof value === 'string',
    description: 'anyString()',
  };
}

/**
 * Matches a string against a regex.
 */
export function matching(regex: RegExp): ArgMatcher {
  return {
    matches: (value: string) => regex.test(value),
    description: `matching(${regex})`,
  };
}

/**
 * Helper to check if a value is an ArgMatcher.
 */
export function isArgMatcher(value: unknown): value is ArgMatcher {
  return (
    typeof value === 'object' &&
    value !== null &&
    'matches' in value &&
    typeof (value as ArgMatcher).matches === 'function'
  );
}

/**
 * Compares an actual args array against a pattern of literals and matchers.
 * Returns true if every element matches.
 */
export function matchArgs(
  actual: string[],
  expected: (string | ArgMatcher)[]
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  return expected.every((pattern, i) => {
    if (isArgMatcher(pattern)) {
      return pattern.matches(actual[i]);
    }
    return actual[i] === pattern;
  });
}
