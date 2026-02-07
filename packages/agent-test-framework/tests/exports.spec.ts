import { describe, it, expect } from 'vitest';
import {
  TestBed,
  any,
  anyString,
  matching,
  defineConfig,
  setupMatchers,
  RecorderImpl,
  RecordingStore,
  CopilotAdapter,
  matchArgs,
} from '../src/index.js';

describe('agent-test-framework re-exports', () => {
  it('should export TestBed', () => {
    expect(TestBed).toBeDefined();
    expect(typeof TestBed.create).toBe('function');
  });

  it('should export matchers', () => {
    expect(typeof any).toBe('function');
    expect(typeof anyString).toBe('function');
    expect(typeof matching).toBe('function');
    expect(typeof matchArgs).toBe('function');
  });

  it('should export defineConfig', () => {
    expect(typeof defineConfig).toBe('function');
    const config = defineConfig({ agent: 'copilot-cli' });
    expect(config.agent).toBe('copilot-cli');
  });

  it('should export setupMatchers', () => {
    expect(typeof setupMatchers).toBe('function');
  });

  it('should export RecorderImpl and RecordingStore', () => {
    expect(typeof RecorderImpl.start).toBe('function');
    expect(typeof RecordingStore.save).toBe('function');
    expect(typeof RecordingStore.load).toBe('function');
  });

  it('should export CopilotAdapter', () => {
    expect(CopilotAdapter).toBeDefined();
    expect(typeof CopilotAdapter.create).toBe('function');
  });
});
