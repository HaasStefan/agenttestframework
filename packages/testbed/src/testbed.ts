import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentAdapter, Recording, Spy, TestBedOptions } from '@agent-test/core';
import { ShimManager, SpyImpl } from '@agent-test/shims';
import { StubAdapter } from './stub-adapter.js';
import { PromptBuilder } from './prompt-builder.js';

export interface TestBedCreateOptions extends TestBedOptions {
  fixturesDir?: string;
  adapter?: AgentAdapter;
}

export class TestBed {
  readonly workDir: string;
  readonly shimBinDir: string;
  private _shimManager: ShimManager;
  private _spies = new Map<string, SpyImpl>();
  private _adapter: AgentAdapter;

  private constructor(
    workDir: string,
    shimManager: ShimManager,
    adapter: AgentAdapter,
  ) {
    this.workDir = workDir;
    this._shimManager = shimManager;
    this.shimBinDir = shimManager.binDir;
    this._adapter = adapter;
  }

  static async create(options?: TestBedCreateOptions): Promise<TestBed> {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-workdir-'));
    const shimManager = await ShimManager.create();
    const adapter = options?.adapter ?? new StubAdapter();

    // Copy fixtures if specified
    if (options?.fixtures && options?.fixturesDir) {
      const fixtureSource = path.join(options.fixturesDir, options.fixtures);
      await copyDir(fixtureSource, workDir);
    }

    return new TestBed(workDir, shimManager, adapter);
  }

  /**
   * Creates or retrieves a spy for the given binary name.
   */
  spy(name: string): SpyImpl {
    let spyInstance = this._spies.get(name);
    if (!spyInstance) {
      spyInstance = new SpyImpl(name);
      this._spies.set(name, spyInstance);
      this._shimManager.registerSpy(name, spyInstance);
      // Create shim asynchronously — but we return the spy synchronously.
      // The shim will be ready before the agent runs.
      this._shimManager.createShim(name);
    }
    return spyInstance;
  }

  /**
   * Returns the environment variables for the test, with shimmed PATH.
   */
  getEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    env.PATH = `${this.shimBinDir}${path.delimiter}${env.PATH ?? ''}`;
    return env;
  }

  /**
   * Start building a prompt run. Chain .onQuestion() then .run().
   */
  prompt(text: string): PromptBuilder {
    return new PromptBuilder(this._adapter, () => this.getEnv(), text);
  }

  /**
   * Start building a skill run. Chain .onQuestion() then .run().
   */
  skill(skillPath: string, prompt: string): PromptBuilder {
    return new PromptBuilder(this._adapter, () => this.getEnv(), prompt, skillPath);
  }

  async runSkill(options: { skill: string; prompt: string }): Promise<Recording> {
    return this._adapter.runSkill(options, this.getEnv());
  }

  async runPrompt(prompt: string): Promise<Recording> {
    return this._adapter.runPrompt(prompt, this.getEnv());
  }

  async startSession() {
    return this._adapter.startSession(this.getEnv());
  }

  async destroy(): Promise<void> {
    await this._adapter.destroy();
    await this._shimManager.destroy();
    try {
      await fs.rm(this.workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
