import { describe, it, expect } from 'vitest';
import { any, anyString, matching, matchArgs } from '../src/index.js';

describe('any()', () => {
  it('should match any string', () => {
    expect(any().matches('hello')).toBe(true);
  });

  it('should match empty string', () => {
    expect(any().matches('')).toBe(true);
  });

  it('should have a description', () => {
    expect(any().description).toBe('any()');
  });
});

describe('anyString()', () => {
  it('should match a string', () => {
    expect(anyString().matches('hello')).toBe(true);
  });

  it('should match empty string', () => {
    expect(anyString().matches('')).toBe(true);
  });

  it('should have a description', () => {
    expect(anyString().description).toBe('anyString()');
  });
});

describe('matching()', () => {
  it('should match a string against a regex', () => {
    expect(matching(/foo/).matches('foobar')).toBe(true);
  });

  it('should reject a non-matching string', () => {
    expect(matching(/foo/).matches('baz')).toBe(false);
  });

  it('should match with complex regex', () => {
    expect(matching(/.+/).matches('anything')).toBe(true);
  });

  it('should reject empty string with .+ regex', () => {
    expect(matching(/.+/).matches('')).toBe(false);
  });

  it('should have a description', () => {
    expect(matching(/foo/).description).toBe('matching(/foo/)');
  });
});

describe('matchArgs()', () => {
  it('should match exact strings', () => {
    expect(matchArgs(['add', 'src/index.ts'], ['add', 'src/index.ts'])).toBe(true);
  });

  it('should reject mismatched strings', () => {
    expect(matchArgs(['add', 'src/index.ts'], ['add', 'src/other.ts'])).toBe(false);
  });

  it('should reject length mismatch (actual longer)', () => {
    expect(matchArgs(['add', 'src/index.ts'], ['add'])).toBe(false);
  });

  it('should reject length mismatch (expected longer)', () => {
    expect(matchArgs(['add'], ['add', 'src/index.ts'])).toBe(false);
  });

  it('should work with matching() matcher', () => {
    expect(matchArgs(['commit', '-m', 'fix bug'], ['commit', '-m', matching(/.+/)])).toBe(true);
  });

  it('should work with any() matcher', () => {
    expect(matchArgs(['log', '--oneline'], ['log', any()])).toBe(true);
  });

  it('should work with any() matching different values', () => {
    expect(matchArgs(['log', 'main..HEAD'], ['log', any()])).toBe(true);
  });

  it('should work with anyString() matcher', () => {
    expect(matchArgs(['push', 'origin'], ['push', anyString()])).toBe(true);
  });

  it('should match with mixed matchers and literals', () => {
    expect(
      matchArgs(
        ['commit', '-m', 'fix: resolve login bug'],
        ['commit', '-m', matching(/^fix:/)]
      )
    ).toBe(true);
  });

  it('should reject when matcher does not match', () => {
    expect(
      matchArgs(
        ['commit', '-m', 'add feature'],
        ['commit', '-m', matching(/^fix:/)]
      )
    ).toBe(false);
  });

  it('should handle empty args arrays', () => {
    expect(matchArgs([], [])).toBe(true);
  });
});
