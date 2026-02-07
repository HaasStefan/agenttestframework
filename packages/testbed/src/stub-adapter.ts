import type { AgentAdapter, AgentRunOptions, Recording, Session } from '@agent-test/core';
import { RecorderImpl } from '@agent-test/recorder';

/**
 * A stub adapter used when no real agent CLI is configured.
 * Records the prompts and returns a minimal recording.
 */
export class StubAdapter implements AgentAdapter {
  async runSkill(
    options: { skill: string; prompt: string },
    _env: Record<string, string>,
    _runOptions?: AgentRunOptions,
  ): Promise<Recording> {
    const recorder = RecorderImpl.start();
    recorder.recordPrompt(options.prompt);
    return recorder.end();
  }

  async runPrompt(
    prompt: string,
    _env: Record<string, string>,
    _runOptions?: AgentRunOptions,
  ): Promise<Recording> {
    const recorder = RecorderImpl.start();
    recorder.recordPrompt(prompt);
    return recorder.end();
  }

  async startSession(_env: Record<string, string>): Promise<Session> {
    throw new Error('StubAdapter does not support sessions');
  }

  async destroy(): Promise<void> {}
}
