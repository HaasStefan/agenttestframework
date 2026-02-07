# Custom Adapters

Write an adapter to test any CLI agent — Claude Code, OpenAI Codex CLI, or your own.

## The Interface

```typescript
import type { AgentAdapter, Recording, Session } from 'agent-test-framework';

interface AgentAdapter {
  runPrompt(prompt: string, env: Record<string, string>): Promise<Recording>;
  runSkill(
    options: { skill: string; prompt: string },
    env: Record<string, string>,
  ): Promise<Recording>;
  startSession(env: Record<string, string>): Promise<Session>;
  destroy(): Promise<void>;
}
```

The `env` parameter contains the shimmed `PATH`. Pass it to your agent process so shims intercept CLI calls.

## Example: Spawn-based Adapter

For agents that run as a subprocess:

```typescript
import { spawn } from 'node:child_process';
import type { AgentAdapter, Recording, Session } from 'agent-test-framework';
import { RecorderImpl } from 'agent-test-framework';

class SpawnAdapter implements AgentAdapter {
  private _binPath: string;

  constructor(binPath: string) {
    this._binPath = binPath;
  }

  async runPrompt(prompt: string, env: Record<string, string>): Promise<Recording> {
    const recorder = RecorderImpl.start();
    recorder.recordPrompt(prompt);

    const child = spawn(this._binPath, ['--prompt', prompt], { env });

    // Collect output
    let stdout = '';
    child.stdout.on('data', (d) => stdout += d);

    await new Promise<void>((resolve) => child.on('close', resolve));

    // Record as a single interaction (adapt to your agent's output format)
    recorder.recordInteraction({
      type: 'tool_call',
      name: 'agent_run',
      args: { prompt },
      result: stdout,
      timestamp: Date.now(),
    });

    return recorder.end();
  }

  async runSkill(
    options: { skill: string; prompt: string },
    env: Record<string, string>,
  ): Promise<Recording> {
    // Pass skill file as a flag, or prepend to prompt — depends on your agent
    return this.runPrompt(`[skill: ${options.skill}] ${options.prompt}`, env);
  }

  async startSession(env: Record<string, string>): Promise<Session> {
    const recorder = RecorderImpl.start();
    const child = spawn(this._binPath, ['--interactive'], { env });

    return {
      async sendPrompt(prompt: string) {
        recorder.recordPrompt(prompt);
        child.stdin.write(prompt + '\n');
        // Wait for response... (implementation depends on your agent's protocol)
      },
      onQuestion(handler) {
        // Wire up if your agent asks questions
      },
      async end() {
        child.kill();
        return recorder.end();
      },
    };
  }

  async destroy() {}
}
```

## Using It

```typescript
const adapter = new SpawnAdapter('/usr/local/bin/my-agent');
const testbed = await TestBed.create({ adapter });

const git = testbed.spy('git');
git.default().returns({ stdout: '' });

const recording = await testbed.runPrompt('check git status');
```

## RecorderImpl API

Use `RecorderImpl` inside your adapter to build recordings:

```typescript
const recorder = RecorderImpl.start();

recorder.recordPrompt('the prompt');

recorder.recordInteraction({
  type: 'tool_call',
  name: 'shell',
  args: { command: 'ls' },
  result: 'file1.ts file2.ts',
  timestamp: Date.now(),
});

recorder.recordTokenUsage({ input: 500, output: 100 });

const recording = recorder.end(); // finalizes, returns Recording
```

After `end()`, the recorder is sealed — no more writes allowed.

## Key Points

- Always pass `env` to your agent process — it contains the shimmed `PATH`
- Call `recorder.recordPrompt()` for each prompt
- Call `recorder.recordInteraction()` for each tool call the agent makes
- Call `recorder.recordTokenUsage()` if your agent reports token counts
- Call `recorder.end()` once when the run is done
