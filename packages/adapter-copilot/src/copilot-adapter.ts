import * as path from 'node:path';
import { CopilotClient } from '@github/copilot-sdk';
import type { AgentAdapter, Recording, Session } from '@agent-test/core';
import { RecorderImpl } from '@agent-test/recorder';

export interface CopilotAdapterOptions {
  model?: string;
  cwd?: string;
  availableTools?: string[];
  excludedTools?: string[];
  githubToken?: string;
}

export class CopilotAdapter implements AgentAdapter {
  private _client: InstanceType<typeof CopilotClient>;
  private _options: CopilotAdapterOptions;

  private constructor(client: InstanceType<typeof CopilotClient>, options: CopilotAdapterOptions) {
    this._client = client;
    this._options = options;
  }

  static async create(options: CopilotAdapterOptions): Promise<CopilotAdapter> {
    const client = new CopilotClient({
      cwd: options.cwd,
      githubToken: options.githubToken,
    });
    await client.start();
    return new CopilotAdapter(client, options);
  }

  async runPrompt(prompt: string, env: Record<string, string>): Promise<Recording> {
    const recorder = RecorderImpl.start();
    recorder.recordPrompt(prompt);

    const session = await this._client.createSession({
      model: this._options.model,
      env,
      hooks: this._createHooks(recorder),
    } as any);

    // Register token usage event listener
    session.on('assistant.usage', (event: any) => {
      recorder.recordTokenUsage({
        input: event.inputTokens ?? 0,
        output: event.outputTokens ?? 0,
      });
    });

    await session.sendAndWait({ prompt });
    const recording = recorder.end();
    await session.destroy();
    return recording;
  }

  async runSkill(
    options: { skill: string; prompt: string },
    env: Record<string, string>
  ): Promise<Recording> {
    const recorder = RecorderImpl.start();
    recorder.recordPrompt(options.prompt);

    const skillDir = path.dirname(options.skill);
    const skillFile = path.basename(options.skill);

    const session = await this._client.createSession({
      model: this._options.model,
      env,
      skillDirectories: [skillDir],
      disabledSkills: [`!${skillFile}`],
      availableTools: this._options.availableTools,
      excludedTools: this._options.excludedTools,
      hooks: this._createHooks(recorder),
    } as any);

    // Register token usage event listener
    session.on('assistant.usage', (event: any) => {
      recorder.recordTokenUsage({
        input: event.inputTokens ?? 0,
        output: event.outputTokens ?? 0,
      });
    });

    await session.sendAndWait({ prompt: options.prompt });
    const recording = recorder.end();
    await session.destroy();
    return recording;
  }

  async startSession(env: Record<string, string>): Promise<Session> {
    const recorder = RecorderImpl.start();

    const copilotSession = await this._client.createSession({
      model: this._options.model,
      env,
      hooks: this._createHooks(recorder),
    } as any);

    copilotSession.on('assistant.usage', (event: any) => {
      recorder.recordTokenUsage({
        input: event.inputTokens ?? 0,
        output: event.outputTokens ?? 0,
      });
    });

    let questionHandler: ((question: string) => string | Promise<string>) | null = null;

    return {
      async sendPrompt(prompt: string) {
        recorder.recordPrompt(prompt);
        await copilotSession.sendAndWait({ prompt });
      },
      onQuestion(handler: (question: string) => string | Promise<string>) {
        questionHandler = handler;
      },
      async end() {
        const recording = recorder.end();
        await copilotSession.destroy();
        return recording;
      },
    };
  }

  async destroy(): Promise<void> {
    await this._client.stop();
  }

  private _createHooks(recorder: RecorderImpl) {
    return {
      onPreToolUse: async (input: any) => {
        // Allow all tools by default
        return {};
      },
      onPostToolUse: async (input: any) => {
        recorder.recordInteraction({
          type: 'tool_call',
          name: input.toolName,
          args: input.toolArgs,
          result: input.toolResult,
          timestamp: input.timestamp ?? Date.now(),
        });
        return {};
      },
    };
  }
}
