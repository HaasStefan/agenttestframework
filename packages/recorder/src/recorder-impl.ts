import { randomUUID } from 'node:crypto';
import type { Recording, Interaction, TokenUsage } from '@agent-test/core';

export class RecorderImpl {
  private _id: string;
  private _interactions: Interaction[] = [];
  private _prompts: string[] = [];
  private _tokenUsage: { input: number; output: number } = { input: 0, output: 0 };
  private _ended = false;

  private constructor() {
    this._id = randomUUID();
  }

  static start(): RecorderImpl {
    return new RecorderImpl();
  }

  recordInteraction(interaction: Interaction): void {
    if (this._ended) {
      throw new Error('Cannot record interaction after recording has ended');
    }
    this._interactions.push(interaction);
  }

  recordPrompt(prompt: string): void {
    if (this._ended) {
      throw new Error('Cannot record prompt after recording has ended');
    }
    this._prompts.push(prompt);
  }

  recordTokenUsage(usage: Partial<TokenUsage>): void {
    if (this._ended) {
      throw new Error('Cannot record token usage after recording has ended');
    }
    if (usage.input) this._tokenUsage.input += usage.input;
    if (usage.output) this._tokenUsage.output += usage.output;
  }

  end(): Recording {
    this._ended = true;
    return {
      id: this._id,
      tokenUsage: {
        input: this._tokenUsage.input,
        output: this._tokenUsage.output,
        total: this._tokenUsage.input + this._tokenUsage.output,
      },
      prompts: [...this._prompts],
      interactions: [...this._interactions],
    };
  }
}
