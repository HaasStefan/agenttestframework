import { describe, it, expect, afterAll, vi } from 'vitest';
import { matching, any } from '@agent-test/core';
import { TestBed } from '@agent-test/testbed';
import { CopilotAdapter } from '../src/index.js';

// Mock the @github/copilot-sdk
vi.mock('@github/copilot-sdk', () => {
  let hooks: any;
  let usageHandler: any;

  const mockSession = {
    on: vi.fn().mockImplementation((event: string, handler: any) => {
      if (event === 'assistant.usage') {
        usageHandler = handler;
      }
    }),
    sendAndWait: vi.fn().mockImplementation(async () => {
      // Simulate tool use during the agent run
      if (hooks?.onPostToolUse) {
        await hooks.onPostToolUse({
          timestamp: Date.now(),
          cwd: '/test',
          toolName: 'git',
          toolArgs: { subcommand: 'add', file: 'src/index.ts' },
          toolResult: '',
        });
        await hooks.onPostToolUse({
          timestamp: Date.now(),
          cwd: '/test',
          toolName: 'git',
          toolArgs: { subcommand: 'commit', message: 'fix bug' },
          toolResult: '[main abc123] fix bug',
        });
      }
      // Simulate token usage
      if (usageHandler) {
        usageHandler({ inputTokens: 500, outputTokens: 200 });
      }
      return { type: 'assistant.message', message: 'Committed!' };
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  const mockClient = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockImplementation((config: any) => {
      hooks = config?.hooks;
      usageHandler = null;
      return Promise.resolve(mockSession);
    }),
  };

  return {
    CopilotClient: vi.fn().mockImplementation(() => mockClient),
    __mockClient: mockClient,
    __mockSession: mockSession,
  };
});

describe('Integration: TestBed + Copilot adapter (mocked SDK)', () => {
  let testbed: TestBed;

  afterAll(async () => {
    if (testbed) await testbed.destroy();
  });

  it('should wire up spies, run a skill, and capture recording', async () => {
    const adapter = await CopilotAdapter.create({});

    testbed = await TestBed.create({ adapter });

    const gitSpy = testbed.spy('git');
    gitSpy.withArgs('status').returns({ stdout: 'M  src/index.ts' });
    gitSpy.withArgs('diff', '--staged').returns({ stdout: '+console.log("hello")' });
    gitSpy.default().returns({ stdout: '', exitCode: 0 });

    const recording = await testbed.runSkill({
      skill: 'skills/commit.md',
      prompt: 'commit the staged changes',
    });

    // Recording has interactions from the mock hooks
    expect(recording.interactions.length).toBeGreaterThanOrEqual(2);
    expect(recording.interactions[0].name).toBe('git');
    expect(recording.interactions[1].name).toBe('git');

    // Recording has token usage
    expect(recording.tokenUsage.input).toBe(500);
    expect(recording.tokenUsage.output).toBe(200);
    expect(recording.tokenUsage.total).toBe(700);

    // Recording has the prompt
    expect(recording.prompts).toContain('commit the staged changes');

    // Recording has a unique id
    expect(recording.id).toBeDefined();

    await adapter.destroy();
  });
});
