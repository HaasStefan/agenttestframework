import { describe, it, expect } from 'vitest';
import { RecorderImpl } from '../src/index.js';

describe('RecorderImpl', () => {
  it('should produce a recording with a unique id', () => {
    const recorder = RecorderImpl.start();
    const recording = recorder.end();
    expect(recording.id).toBeDefined();
    expect(typeof recording.id).toBe('string');
    expect(recording.id.length).toBeGreaterThan(0);
  });

  it('should produce unique ids for different recordings', () => {
    const r1 = RecorderImpl.start();
    const r2 = RecorderImpl.start();
    expect(r1.end().id).not.toBe(r2.end().id);
  });

  it('should record interactions', () => {
    const recorder = RecorderImpl.start();
    recorder.recordInteraction({
      type: 'tool_call',
      name: 'git',
      args: { command: 'status' },
      timestamp: Date.now(),
    });
    recorder.recordInteraction({
      type: 'response',
      result: 'M  src/index.ts',
      timestamp: Date.now(),
    });
    recorder.recordInteraction({
      type: 'prompt',
      name: 'commit',
      timestamp: Date.now(),
    });

    const recording = recorder.end();
    expect(recording.interactions).toHaveLength(3);
  });

  it('should accumulate token usage', () => {
    const recorder = RecorderImpl.start();
    recorder.recordTokenUsage({ input: 100 });
    recorder.recordTokenUsage({ input: 200, output: 50 });

    const recording = recorder.end();
    expect(recording.tokenUsage.input).toBe(300);
    expect(recording.tokenUsage.output).toBe(50);
    expect(recording.tokenUsage.total).toBe(350);
  });

  it('should default token usage to zero', () => {
    const recorder = RecorderImpl.start();
    const recording = recorder.end();
    expect(recording.tokenUsage).toEqual({ input: 0, output: 0, total: 0 });
  });

  it('should throw when recording interaction after end', () => {
    const recorder = RecorderImpl.start();
    recorder.end();

    expect(() => {
      recorder.recordInteraction({
        type: 'tool_call',
        timestamp: Date.now(),
      });
    }).toThrow();
  });

  it('should record prompts', () => {
    const recorder = RecorderImpl.start();
    recorder.recordPrompt('commit the staged changes');
    recorder.recordPrompt('also run the tests');

    const recording = recorder.end();
    expect(recording.prompts).toEqual([
      'commit the staged changes',
      'also run the tests',
    ]);
  });
});
