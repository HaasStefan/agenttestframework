import { describe, it, expect } from 'vitest';
import { mergeOptions } from '../src/index.js';

describe('mergeOptions', () => {
  it('should merge global and local config with local winning', () => {
    const merged = mergeOptions(
      { agent: 'copilot-cli', model: 'opus-4.5' },
      { model: 'gpt-5.2' }
    );
    expect(merged).toEqual({ agent: 'copilot-cli', model: 'gpt-5.2' });
  });

  it('should inherit everything from global when no local overrides', () => {
    const merged = mergeOptions(
      { agent: 'copilot-cli', model: 'opus-4.5', parallel: true },
      {}
    );
    expect(merged).toEqual({ agent: 'copilot-cli', model: 'opus-4.5', parallel: true });
  });

  it('should use defaults when no global config', () => {
    const merged = mergeOptions({}, { agent: 'claude-code' });
    expect(merged).toEqual({ agent: 'claude-code' });
  });
});
