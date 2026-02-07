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

    this._registerTokenTracking(session, recorder);

    await session.sendAndWait({ prompt });
    this._extractUsageFromMessages(session, recorder);
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

    this._registerTokenTracking(session, recorder);

    await session.sendAndWait({ prompt: options.prompt });
    this._extractUsageFromMessages(session, recorder);
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

    this._registerTokenTracking(copilotSession, recorder);

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

  private _registerTokenTracking(session: any, recorder: RecorderImpl): void {
    // Listen to assistant.usage events (per-request token metrics)
    session.on('assistant.usage', (event: any) => {
      recorder.recordTokenUsage({
        input: event.inputTokens ?? 0,
        output: event.outputTokens ?? 0,
      });
    });

    // Catch-all: listen to all events and extract usage from any event type
    session.on((event: any) => {
      if (!event || !event.type) return;

      // assistant.usage — already handled above via typed listener
      if (event.type === 'assistant.usage') return;

      // session.usage_info — has currentTokens (total context size)
      if (event.type === 'session.usage_info' && event.currentTokens) {
        // We use this as a fallback below
        return;
      }

      // Look for any event with token-like properties
      if (event.inputTokens !== undefined || event.outputTokens !== undefined) {
        recorder.recordTokenUsage({
          input: event.inputTokens ?? 0,
          output: event.outputTokens ?? 0,
        });
      }
    });
  }

  /**
   * After sendAndWait completes, scan all session messages/events
   * for usage data. This catches token info that might be delivered
   * via event types other than 'assistant.usage'.
   */
  private _extractUsageFromMessages(session: any, recorder: RecorderImpl): void {
    try {
      const messages = session.getMessages?.();
      if (!Array.isArray(messages)) return;

      for (const msg of messages) {
        // assistant.usage events
        if (msg.type === 'assistant.usage') {
          // Already handled by the event listener, but in case we missed some
          // we skip to avoid double counting — the event listener already got these
          continue;
        }
        // session.usage_info has currentTokens
        if (msg.type === 'session.usage_info' && msg.currentTokens) {
          // This is the current session token count, not per-request delta
          // Skip — we'll use this only if no usage events were captured
        }
      }

      // If no usage was recorded from events, try to extract from usage_info
      // which gives us at least the total tokens in the context
      if (recorder.totalInput === 0 && recorder.totalOutput === 0) {
        for (const msg of messages) {
          if (msg.type === 'session.usage_info' && msg.currentTokens) {
            recorder.recordTokenUsage({
              input: msg.currentTokens,
              output: 0,
            });
            break; // Take only the last/first usage info
          }
        }
      }
    } catch {
      // getMessages may not be available in all SDK versions
    }
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
