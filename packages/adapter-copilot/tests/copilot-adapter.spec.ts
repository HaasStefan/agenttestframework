import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Recording } from '@agent-test/core';
import { CopilotAdapter } from '../src/index.js';

// Mock the @github/copilot-sdk module
vi.mock('@github/copilot-sdk', () => {
  const mockSession = {
    sendAndWait: vi.fn().mockResolvedValue({
      type: 'assistant.message',
      message: 'Done',
    }),
    on: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  const mockClient = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue(mockSession),
  };

  return {
    CopilotClient: vi.fn().mockImplementation(() => mockClient),
    __mockClient: mockClient,
    __mockSession: mockSession,
  };
});

// Import after mock is set up
const { CopilotClient, __mockClient: mockClient, __mockSession: mockSession } =
  await import('@github/copilot-sdk') as any;

describe('CopilotAdapter — client lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call client.start() on create', async () => {
    const adapter = await CopilotAdapter.create({});
    expect(mockClient.start).toHaveBeenCalled();
    await adapter.destroy();
  });

  it('should call client.stop() on destroy', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.destroy();
    expect(mockClient.stop).toHaveBeenCalled();
  });

  it('should pass cwd and env to the CopilotClient', async () => {
    const adapter = await CopilotAdapter.create({ cwd: '/test/dir' });
    expect(CopilotClient).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/test/dir' })
    );
    await adapter.destroy();
  });
});

describe('CopilotAdapter — runPrompt()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a session with correct workingDirectory', async () => {
    const adapter = await CopilotAdapter.create({});
    const env = { PATH: '/shims:/usr/bin', HOME: '/home/test' };

    await adapter.runPrompt('test prompt', env);

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        env,
      })
    );
    await adapter.destroy();
  });

  it('should call sendAndWait with the prompt', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.runPrompt('create a pull request', { PATH: '/usr/bin' });

    expect(mockSession.sendAndWait).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'create a pull request' })
    );
    await adapter.destroy();
  });

  it('should destroy the session after completion', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(mockSession.destroy).toHaveBeenCalled();
    await adapter.destroy();
  });

  it('should return a Recording with an id', async () => {
    const adapter = await CopilotAdapter.create({});
    const recording = await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(recording.id).toBeDefined();
    expect(typeof recording.id).toBe('string');
    await adapter.destroy();
  });

  it('should pass the model from adapter options to the session', async () => {
    const adapter = await CopilotAdapter.create({ model: 'claude-sonnet-4.5' });
    await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4.5' })
    );
    await adapter.destroy();
  });
});

describe('CopilotAdapter — runSkill()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a session with skillDirectories pointing at the skill directory', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.runSkill(
      { skill: 'skills/commit.md', prompt: 'commit changes' },
      { PATH: '/usr/bin' }
    );

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        skillDirectories: ['skills'],
      })
    );
    await adapter.destroy();
  });

  it('should disable all skills except the target', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.runSkill(
      { skill: 'skills/commit.md', prompt: 'commit' },
      { PATH: '/usr/bin' }
    );

    // disabledSkills should be set (adapter tracks which skill to keep)
    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig.disabledSkills).toBeDefined();
    await adapter.destroy();
  });

  it('should send the prompt via sendAndWait', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.runSkill(
      { skill: 'skills/commit.md', prompt: 'commit the changes' },
      { PATH: '/usr/bin' }
    );

    expect(mockSession.sendAndWait).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'commit the changes' })
    );
    await adapter.destroy();
  });

  it('should pass availableTools/excludedTools when provided', async () => {
    const adapter = await CopilotAdapter.create({
      availableTools: ['git', 'gh'],
      excludedTools: ['rm'],
    });
    await adapter.runSkill(
      { skill: 'skills/commit.md', prompt: 'commit' },
      { PATH: '/usr/bin' }
    );

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        availableTools: ['git', 'gh'],
        excludedTools: ['rm'],
      })
    );
    await adapter.destroy();
  });
});

describe('CopilotAdapter — tool recording via hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register hooks on session creation', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(mockClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        hooks: expect.objectContaining({
          onPreToolUse: expect.any(Function),
          onPostToolUse: expect.any(Function),
        }),
      })
    );
    await adapter.destroy();
  });

  it('should record tool invocations when onPostToolUse fires during sendAndWait', async () => {
    const adapter = await CopilotAdapter.create({});

    // Capture hooks and trigger them during sendAndWait (before recording ends)
    let hooks: any;
    mockClient.createSession.mockImplementation((config: any) => {
      hooks = config.hooks;
      return Promise.resolve({
        ...mockSession,
        sendAndWait: vi.fn().mockImplementation(async () => {
          // Simulate tool use during the agent run
          if (hooks?.onPostToolUse) {
            await hooks.onPostToolUse({
              timestamp: 1000,
              cwd: '/test',
              toolName: 'git',
              toolArgs: { command: 'status' },
              toolResult: 'M  src/index.ts',
            });
          }
          return { type: 'assistant.message', message: 'Done' };
        }),
      });
    });

    const recording = await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(recording.interactions).toHaveLength(1);
    expect(recording.interactions[0].name).toBe('git');
    expect(recording.interactions[0].type).toBe('tool_call');
    await adapter.destroy();
  });
});

describe('CopilotAdapter — onQuestion handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass onUserInputRequest to session config when onQuestion is provided', async () => {
    const adapter = await CopilotAdapter.create({});
    const handler = (q: string) => 'yes';

    await adapter.runPrompt('deploy', { PATH: '/usr/bin' }, { onQuestion: handler });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig.onUserInputRequest).toBeDefined();
    expect(typeof sessionConfig.onUserInputRequest).toBe('function');
    await adapter.destroy();
  });

  it('should not set onUserInputRequest when no onQuestion provided', async () => {
    const adapter = await CopilotAdapter.create({});

    await adapter.runPrompt('deploy', { PATH: '/usr/bin' });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig.onUserInputRequest).toBeUndefined();
    await adapter.destroy();
  });

  it('should delegate onUserInputRequest to the onQuestion handler', async () => {
    const adapter = await CopilotAdapter.create({});
    const handler = vi.fn().mockReturnValue('confirmed');

    await adapter.runPrompt('deploy', { PATH: '/usr/bin' }, { onQuestion: handler });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    const answer = await sessionConfig.onUserInputRequest({
      question: 'Are you sure?',
      choices: ['yes', 'no'],
    });

    expect(handler).toHaveBeenCalledWith('Are you sure?', ['yes', 'no']);
    expect(answer).toBe('confirmed');
    await adapter.destroy();
  });

  it('should wire onQuestion for runSkill too', async () => {
    const adapter = await CopilotAdapter.create({});
    const handler = vi.fn().mockReturnValue('go ahead');

    await adapter.runSkill(
      { skill: 'skills/deploy.md', prompt: 'deploy' },
      { PATH: '/usr/bin' },
      { onQuestion: handler },
    );

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig.onUserInputRequest).toBeDefined();

    const answer = await sessionConfig.onUserInputRequest({
      question: 'Continue?',
    });
    expect(handler).toHaveBeenCalledWith('Continue?', undefined);
    expect(answer).toBe('go ahead');
    await adapter.destroy();
  });
});

describe('CopilotAdapter — token usage from events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register event listener for assistant.usage', async () => {
    const adapter = await CopilotAdapter.create({});
    await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(mockSession.on).toHaveBeenCalledWith('assistant.usage', expect.any(Function));
    await adapter.destroy();
  });

  it('should capture token usage from usage events', async () => {
    // Create a fresh mock session that captures the on() handler
    // and triggers it during sendAndWait
    let usageHandler: any;
    const freshSession = {
      on: vi.fn().mockImplementation((event: string, handler: any) => {
        if (event === 'assistant.usage') {
          usageHandler = handler;
        }
      }),
      sendAndWait: vi.fn().mockImplementation(async () => {
        // Simulate usage events firing during the agent run
        if (usageHandler) {
          usageHandler({ inputTokens: 100, outputTokens: 50 });
          usageHandler({ inputTokens: 200, outputTokens: 75 });
        }
        return { type: 'assistant.message', message: 'Done' };
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    mockClient.createSession.mockResolvedValue(freshSession);

    const adapter = await CopilotAdapter.create({});
    const recording = await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(recording.tokenUsage.input).toBe(300);
    expect(recording.tokenUsage.output).toBe(125);
    expect(recording.tokenUsage.total).toBe(425);
    await adapter.destroy();
  });

  it('should default token usage to zero when no events', async () => {
    const silentSession = {
      on: vi.fn(),
      sendAndWait: vi.fn().mockResolvedValue({
        type: 'assistant.message',
        message: 'Done',
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    mockClient.createSession.mockResolvedValue(silentSession);

    const adapter = await CopilotAdapter.create({});
    const recording = await adapter.runPrompt('test', { PATH: '/usr/bin' });

    expect(recording.tokenUsage).toEqual({ input: 0, output: 0, total: 0 });
    await adapter.destroy();
  });
});
