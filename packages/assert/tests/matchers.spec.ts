import { describe, it, expect, beforeAll } from 'vitest';
import { matching } from '@agent-test/core';
import { SpyImpl } from '@agent-test/shims';
import { setupMatchers } from '../src/index.js';

// Register custom matchers
beforeAll(() => {
  setupMatchers();
});

describe('toHaveBeenCalled', () => {
  it('should pass when spy has been called', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);

    expect(spy).toHaveBeenCalled();
  });

  it('should fail when spy has not been called', () => {
    const spy = new SpyImpl('git');

    expect(() => {
      expect(spy).toHaveBeenCalled();
    }).toThrow();
  });

  it('should support not.toHaveBeenCalled()', () => {
    const spy = new SpyImpl('git');

    expect(spy).not.toHaveBeenCalled();
  });

  it('should fail not.toHaveBeenCalled() when spy was called', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);

    expect(() => {
      expect(spy).not.toHaveBeenCalled();
    }).toThrow();
  });
});

describe('toHaveBeenCalledWith', () => {
  it('should pass when matching call exists', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['add', 'src/index.ts']);

    expect(spy).toHaveBeenCalledWith('add', 'src/index.ts');
  });

  it('should fail when no matching call exists', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);

    expect(() => {
      expect(spy).toHaveBeenCalledWith('add', 'src/index.ts');
    }).toThrow();
  });

  it('should work with matching() matcher', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['commit', '-m', 'fix: resolve bug']);

    expect(spy).toHaveBeenCalledWith('commit', '-m', matching(/.+/));
  });

  it('should support not.toHaveBeenCalledWith()', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);

    expect(spy).not.toHaveBeenCalledWith('push', '--force');
  });

  it('should fail not.toHaveBeenCalledWith() when call exists', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['push', '--force']);

    expect(() => {
      expect(spy).not.toHaveBeenCalledWith('push', '--force');
    }).toThrow();
  });

  it('should include actual calls in failure message', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);
    spy.resolve(['diff']);

    try {
      expect(spy).toHaveBeenCalledWith('add', 'src/index.ts');
    } catch (err: any) {
      expect(err.message).toContain('status');
      expect(err.message).toContain('diff');
    }
  });
});
