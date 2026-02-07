import type { AgentAdapter, AgentRunOptions, Recording } from '@agent-test/core';

type EnvFn = () => Record<string, string>;

/**
 * Fluent builder for configuring and running a prompt or skill.
 *
 * Usage:
 *   testbed.prompt('deploy').onQuestion(q => 'yes').run()
 *   testbed.skill('./skills/deploy.md', 'deploy').run()
 */
export class PromptBuilder {
  private _adapter: AgentAdapter;
  private _getEnv: EnvFn;
  private _prompt: string;
  private _skill?: string;
  private _runOptions: AgentRunOptions = {};

  constructor(
    adapter: AgentAdapter,
    getEnv: EnvFn,
    prompt: string,
    skill?: string,
  ) {
    this._adapter = adapter;
    this._getEnv = getEnv;
    this._prompt = prompt;
    this._skill = skill;
  }

  /**
   * Register a handler for questions the agent asks during execution.
   */
  onQuestion(handler: NonNullable<AgentRunOptions['onQuestion']>): this {
    this._runOptions.onQuestion = handler;
    return this;
  }

  /**
   * Execute the prompt or skill and return the recording.
   */
  async run(): Promise<Recording> {
    const env = this._getEnv();
    if (this._skill) {
      return this._adapter.runSkill(
        { skill: this._skill, prompt: this._prompt },
        env,
        this._runOptions,
      );
    }
    return this._adapter.runPrompt(this._prompt, env, this._runOptions);
  }
}
