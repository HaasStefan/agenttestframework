import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TestBed } from '../src/index.js';

describe('TestBed — working directory & fixtures', () => {
  const testbeds: TestBed[] = [];

  afterEach(async () => {
    for (const tb of testbeds) {
      await tb.destroy();
    }
    testbeds.length = 0;
  });

  it('should create a workDir that exists on disk', async () => {
    const tb = await TestBed.create();
    testbeds.push(tb);
    expect(fs.existsSync(tb.workDir)).toBe(true);
  });

  it('should copy fixtures into workDir', async () => {
    // Create a temp fixture dir
    const fixturesRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-fixtures-'));
    const fixtureDir = path.join(fixturesRoot, 'my-project');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'index.ts'), 'export default 42;');

    const tb = await TestBed.create({
      fixtures: 'my-project',
      fixturesDir: fixturesRoot,
    });
    testbeds.push(tb);

    expect(fs.existsSync(path.join(tb.workDir, 'index.ts'))).toBe(true);
    const content = fs.readFileSync(path.join(tb.workDir, 'index.ts'), 'utf-8');
    expect(content).toBe('export default 42;');

    fs.rmSync(fixturesRoot, { recursive: true });
  });

  it('should remove workDir on destroy', async () => {
    const tb = await TestBed.create();
    const dir = tb.workDir;
    await tb.destroy();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('should create different workDirs for different TestBeds', async () => {
    const tb1 = await TestBed.create();
    const tb2 = await TestBed.create();
    testbeds.push(tb1, tb2);
    expect(tb1.workDir).not.toBe(tb2.workDir);
  });
});

describe('TestBed — shim wiring & spy()', () => {
  const testbeds: TestBed[] = [];

  afterEach(async () => {
    for (const tb of testbeds) {
      await tb.destroy();
    }
    testbeds.length = 0;
  });

  it('should return a Spy with withArgs/default/returns', async () => {
    const tb = await TestBed.create();
    testbeds.push(tb);

    const spy = tb.spy('git');
    expect(spy.withArgs).toBeDefined();
    expect(spy.default).toBeDefined();
  });

  it('should return the same spy instance for the same binary', async () => {
    const tb = await TestBed.create();
    testbeds.push(tb);

    const spy1 = tb.spy('git');
    const spy2 = tb.spy('git');
    expect(spy1).toBe(spy2);
  });

  it('should have shim directory in PATH', async () => {
    const tb = await TestBed.create();
    testbeds.push(tb);

    const env = tb.getEnv();
    expect(env.PATH).toBeDefined();
    expect(env.PATH!.startsWith(tb.shimBinDir)).toBe(true);
  });

  it('should clean up shim directory on destroy', async () => {
    const tb = await TestBed.create();
    const shimDir = tb.shimBinDir;
    await tb.destroy();
    expect(fs.existsSync(shimDir)).toBe(false);
  });
});

describe('TestBed — runSkill() & runPrompt() with stub adapter', () => {
  const testbeds: TestBed[] = [];

  afterEach(async () => {
    for (const tb of testbeds) {
      await tb.destroy();
    }
    testbeds.length = 0;
  });

  it('should run a skill and return a recording', async () => {
    const tb = await TestBed.create();
    testbeds.push(tb);

    const recording = await tb.runSkill({
      skill: 'skills/commit.md',
      prompt: 'commit the staged changes',
    });

    expect(recording.id).toBeDefined();
    expect(recording.prompts).toContain('commit the staged changes');
  });

  it('should run a prompt and return a recording', async () => {
    const tb = await TestBed.create();
    testbeds.push(tb);

    const recording = await tb.runPrompt('create a pull request');

    expect(recording.id).toBeDefined();
    expect(recording.prompts).toContain('create a pull request');
  });

  it('should pass the shimmed environment to the adapter', async () => {
    let capturedEnv: Record<string, string> | undefined;

    const tb = await TestBed.create({
      adapter: {
        async runSkill(_opts, env) {
          capturedEnv = env;
          return { id: 'test', tokenUsage: { input: 0, output: 0, total: 0 }, prompts: [], interactions: [] };
        },
        async runPrompt(_prompt, env) {
          capturedEnv = env;
          return { id: 'test', tokenUsage: { input: 0, output: 0, total: 0 }, prompts: [], interactions: [] };
        },
        async startSession() {
          throw new Error('not implemented');
        },
        async destroy() {},
      },
    });
    testbeds.push(tb);

    await tb.runPrompt('test');
    expect(capturedEnv).toBeDefined();
    expect(capturedEnv!.PATH).toContain(tb.shimBinDir);
  });
});
