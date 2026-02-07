import { describe, it, expect } from 'vitest';
import { matching, any } from '@agent-test/core';
import { SpyImpl } from '../src/index.js';

describe('SpyImpl — stub configuration', () => {
  it('should resolve a specific stub', () => {
    const spy = new SpyImpl('git');
    spy.withArgs('status').returns({ stdout: 'M  src/index.ts' });
    const response = spy.resolve(['status']);
    expect(response.stdout).toBe('M  src/index.ts');
  });

  it('should resolve a stub with matchers', () => {
    const spy = new SpyImpl('git');
    spy.withArgs('commit', '-m', matching(/.+/)).returns({ stdout: 'committed' });
    const response = spy.resolve(['commit', '-m', 'fix bug']);
    expect(response.stdout).toBe('committed');
  });

  it('should throw when no matching stub and no default', () => {
    const spy = new SpyImpl('git');
    expect(() => spy.resolve(['unknown'])).toThrow();
  });

  it('should use the default stub when no specific match', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '', exitCode: 0 });
    const response = spy.resolve(['unknown']);
    expect(response.stdout).toBe('');
    expect(response.exitCode).toBe(0);
  });

  it('should prefer specific match over default', () => {
    const spy = new SpyImpl('git');
    spy.withArgs('status').returns({ stdout: 'specific' });
    spy.default().returns({ stdout: 'default' });
    const response = spy.resolve(['status']);
    expect(response.stdout).toBe('specific');
  });

  it('should support multiple specific stubs', () => {
    const spy = new SpyImpl('git');
    spy.withArgs('status').returns({ stdout: 'status output' });
    spy.withArgs('diff').returns({ stdout: 'diff output' });

    expect(spy.resolve(['status']).stdout).toBe('status output');
    expect(spy.resolve(['diff']).stdout).toBe('diff output');
  });
});

describe('SpyImpl — call recording', () => {
  it('should record calls from resolve', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);
    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0].args).toEqual(['status']);
  });

  it('should record multiple calls in order', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);
    spy.resolve(['diff']);
    spy.resolve(['log']);
    expect(spy.calls).toHaveLength(3);
    expect(spy.calls[0].args).toEqual(['status']);
    expect(spy.calls[1].args).toEqual(['diff']);
    expect(spy.calls[2].args).toEqual(['log']);
  });

  it('should find a call using matchers', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);
    spy.resolve(['commit', '-m', 'fix bug']);
    spy.resolve(['push']);

    const call = spy.findCall('commit', '-m', any());
    expect(call).toBeDefined();
    expect(call!.args).toEqual(['commit', '-m', 'fix bug']);
  });

  it('should return undefined for a non-existent call', () => {
    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: '' });
    spy.resolve(['status']);

    const call = spy.findCall('push');
    expect(call).toBeUndefined();
  });

  it('should record the exit code', () => {
    const spy = new SpyImpl('git');
    spy.withArgs('fail').returns({ stdout: '', exitCode: 1 });
    spy.resolve(['fail']);
    expect(spy.calls[0].exitCode).toBe(1);
  });

  it('should default exitCode to 0', () => {
    const spy = new SpyImpl('git');
    spy.withArgs('ok').returns({ stdout: 'done' });
    spy.resolve(['ok']);
    expect(spy.calls[0].exitCode).toBe(0);
  });

  it('should reset calls and stubs', () => {
    const spy = new SpyImpl('git');
    spy.withArgs('status').returns({ stdout: 'output' });
    spy.resolve(['status']);
    spy.reset();

    expect(spy.calls).toHaveLength(0);
    expect(() => spy.resolve(['status'])).toThrow();
  });
});
