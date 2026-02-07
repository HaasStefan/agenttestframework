import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '../src/index.js';
import type { AgentAdapter, AgentRunOptions, Recording } from '@agent-test/core';

const dummyRecording: Recording = {
  id: 'test-123',
  tokenUsage: { input: 0, output: 0, total: 0 },
  prompts: [],
  interactions: [],
};

function createMockAdapter() {
  return {
    runPrompt: vi.fn<[string, Record<string, string>, AgentRunOptions?], Promise<Recording>>()
      .mockResolvedValue(dummyRecording),
    runSkill: vi.fn<[{ skill: string; prompt: string }, Record<string, string>, AgentRunOptions?], Promise<Recording>>()
      .mockResolvedValue(dummyRecording),
    startSession: vi.fn().mockRejectedValue(new Error('not implemented')),
    destroy: vi.fn().mockResolvedValue(undefined),
  } satisfies AgentAdapter;
}

describe('PromptBuilder — .prompt() builder', () => {
  const testbeds: TestBed[] = [];

  afterEach(async () => {
    for (const tb of testbeds) await tb.destroy();
    testbeds.length = 0;
  });

  it('should call adapter.runPrompt via .prompt().run()', async () => {
    const adapter = createMockAdapter();
    const tb = await TestBed.create({ adapter });
    testbeds.push(tb);

    const recording = await tb.prompt('deploy to prod').run();

    expect(adapter.runPrompt).toHaveBeenCalledWith(
      'deploy to prod',
      expect.objectContaining({ PATH: expect.any(String) }),
      {},
    );
    expect(recording).toBe(dummyRecording);
  });

  it('should pass onQuestion handler to adapter.runPrompt', async () => {
    const adapter = createMockAdapter();
    const tb = await TestBed.create({ adapter });
    testbeds.push(tb);

    const handler = (q: string) => 'yes';
    await tb.prompt('deploy').onQuestion(handler).run();

    expect(adapter.runPrompt).toHaveBeenCalledWith(
      'deploy',
      expect.any(Object),
      { onQuestion: handler },
    );
  });

  it('should support chaining — onQuestion returns this', async () => {
    const adapter = createMockAdapter();
    const tb = await TestBed.create({ adapter });
    testbeds.push(tb);

    const builder = tb.prompt('test');
    const result = builder.onQuestion(() => 'yes');
    expect(result).toBe(builder);
  });
});

describe('PromptBuilder — .skill() builder', () => {
  const testbeds: TestBed[] = [];

  afterEach(async () => {
    for (const tb of testbeds) await tb.destroy();
    testbeds.length = 0;
  });

  it('should call adapter.runSkill via .skill().run()', async () => {
    const adapter = createMockAdapter();
    const tb = await TestBed.create({ adapter });
    testbeds.push(tb);

    const recording = await tb.skill('./skills/deploy.md', 'deploy now').run();

    expect(adapter.runSkill).toHaveBeenCalledWith(
      { skill: './skills/deploy.md', prompt: 'deploy now' },
      expect.objectContaining({ PATH: expect.any(String) }),
      {},
    );
    expect(recording).toBe(dummyRecording);
  });

  it('should pass onQuestion handler to adapter.runSkill', async () => {
    const adapter = createMockAdapter();
    const tb = await TestBed.create({ adapter });
    testbeds.push(tb);

    const handler = (q: string) => {
      if (q.includes('continue')) return 'yes';
      return 'no';
    };
    await tb.skill('./skills/deploy.md', 'deploy').onQuestion(handler).run();

    expect(adapter.runSkill).toHaveBeenCalledWith(
      { skill: './skills/deploy.md', prompt: 'deploy' },
      expect.any(Object),
      { onQuestion: handler },
    );
  });
});

describe('PromptBuilder — backward compat', () => {
  const testbeds: TestBed[] = [];

  afterEach(async () => {
    for (const tb of testbeds) await tb.destroy();
    testbeds.length = 0;
  });

  it('runPrompt() still works without builder', async () => {
    const adapter = createMockAdapter();
    const tb = await TestBed.create({ adapter });
    testbeds.push(tb);

    const recording = await tb.runPrompt('simple thing');
    expect(adapter.runPrompt).toHaveBeenCalledWith(
      'simple thing',
      expect.objectContaining({ PATH: expect.any(String) }),
    );
    expect(recording).toBe(dummyRecording);
  });

  it('runSkill() still works without builder', async () => {
    const adapter = createMockAdapter();
    const tb = await TestBed.create({ adapter });
    testbeds.push(tb);

    const recording = await tb.runSkill({ skill: 'skills/commit.md', prompt: 'commit' });
    expect(adapter.runSkill).toHaveBeenCalledWith(
      { skill: 'skills/commit.md', prompt: 'commit' },
      expect.objectContaining({ PATH: expect.any(String) }),
    );
    expect(recording).toBe(dummyRecording);
  });
});
