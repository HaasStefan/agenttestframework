import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RecorderImpl, RecordingStore } from '../src/index.js';

describe('RecordingStore', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  function createTmpDir(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-store-'));
    return tmpDir;
  }

  it('should save and load a recording round-trip', async () => {
    const dir = createTmpDir();
    const recorder = RecorderImpl.start();
    recorder.recordPrompt('test prompt');
    recorder.recordInteraction({
      type: 'tool_call',
      name: 'git',
      args: { command: 'status' },
      timestamp: 1000,
    });
    recorder.recordTokenUsage({ input: 100, output: 50 });
    const recording = recorder.end();

    await RecordingStore.save(recording, dir);
    const loaded = await RecordingStore.load(recording.id, dir);

    expect(loaded.id).toBe(recording.id);
    expect(loaded.prompts).toEqual(['test prompt']);
    expect(loaded.interactions).toHaveLength(1);
    expect(loaded.tokenUsage).toEqual({ input: 100, output: 50, total: 150 });
  });

  it('should throw when loading a non-existent recording', async () => {
    const dir = createTmpDir();
    await expect(RecordingStore.load('non-existent', dir)).rejects.toThrow();
  });

  it('should save two recordings that coexist on disk', async () => {
    const dir = createTmpDir();

    const r1 = RecorderImpl.start();
    r1.recordPrompt('first');
    const rec1 = r1.end();

    const r2 = RecorderImpl.start();
    r2.recordPrompt('second');
    const rec2 = r2.end();

    await RecordingStore.save(rec1, dir);
    await RecordingStore.save(rec2, dir);

    const loaded1 = await RecordingStore.load(rec1.id, dir);
    const loaded2 = await RecordingStore.load(rec2.id, dir);

    expect(loaded1.prompts).toEqual(['first']);
    expect(loaded2.prompts).toEqual(['second']);
  });
});
