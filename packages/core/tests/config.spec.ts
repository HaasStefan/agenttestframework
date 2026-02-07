import { describe, it, expect } from 'vitest';
import { defineConfig } from '../src/index.js';

describe('defineConfig', () => {
  it('should return the config object as-is', () => {
    const config = defineConfig({
      agent: 'copilot-cli',
      model: 'opus-4.5',
      parallel: true,
      maxWorkers: 4,
      fixturesDir: 'fixtures',
    });

    expect(config).toEqual({
      agent: 'copilot-cli',
      model: 'opus-4.5',
      parallel: true,
      maxWorkers: 4,
      fixturesDir: 'fixtures',
    });
  });

  it('should accept partial config', () => {
    const config = defineConfig({
      agent: 'claude-code',
    });

    expect(config.agent).toBe('claude-code');
    expect(config.model).toBeUndefined();
  });

  it('should accept empty config', () => {
    const config = defineConfig({});
    expect(config).toEqual({});
  });
});
