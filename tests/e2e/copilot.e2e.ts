/**
 * E2E test: Real Copilot CLI via @github/copilot-sdk
 *
 * Validates the full framework stack against a real agent:
 * - TestBed creates isolated environment with shimmed PATH
 * - Shims intercept CLI calls the agent makes
 * - Tool recording via SDK hooks captures agent activity
 * - Token usage is tracked from real API responses (version-dependent)
 * - Assertions work against the spy data
 *
 * Requires: Copilot CLI installed and authenticated (`copilot auth login`)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import { TestBed } from '@agent-test/testbed';
import { CopilotAdapter } from '@agent-test/adapter-copilot';
import { setupMatchers } from '@agent-test/assert';
import { any } from '@agent-test/core';
import type { Spy, Recording } from '@agent-test/core';

setupMatchers();

const FIXTURES_DIR = path.resolve(import.meta.dirname, '../../fixtures');

describe('E2E: Copilot CLI — simple file inspection', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({
      cwd: undefined,
    });

    testbed = await TestBed.create({
      fixtures: 'simple-project',
      fixturesDir: FIXTURES_DIR,
      adapter,
    });

    // Spy on cat — the agent may use it to read files
    const catSpy = testbed.spy('cat');
    catSpy.default().returns({
      stdout: 'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n',
      exitCode: 0,
    });

    recording = await testbed.runPrompt(
      'What does the greet function in src/index.ts do? Answer in one sentence.'
    );
  }, 120_000);

  afterAll(async () => {
    if (testbed) await testbed.destroy();
    if (adapter) await adapter.destroy();
  });

  it('should produce a recording with a unique id', () => {
    expect(recording).toBeDefined();
    expect(recording.id).toBeDefined();
    expect(typeof recording.id).toBe('string');
  });

  it('should record the prompt', () => {
    expect(recording.prompts).toContain(
      'What does the greet function in src/index.ts do? Answer in one sentence.'
    );
  });

  it('should have recorded at least one interaction (tool call)', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(1);
  });

  it('should have a valid tokenUsage structure', () => {
    expect(recording.tokenUsage).toBeDefined();
    expect(recording.tokenUsage.total).toBe(
      recording.tokenUsage.input + recording.tokenUsage.output
    );
    // Token values are non-negative (may be 0 if CLI version doesn't emit usage events)
    expect(recording.tokenUsage.input).toBeGreaterThanOrEqual(0);
    expect(recording.tokenUsage.output).toBeGreaterThanOrEqual(0);
  });
});

describe('E2E: Copilot CLI — git operations with shims', () => {
  let testbed: TestBed;
  let adapter: CopilotAdapter;
  let gitSpy: Spy;
  let recording: Recording;

  beforeAll(async () => {
    adapter = await CopilotAdapter.create({});

    testbed = await TestBed.create({
      fixtures: 'simple-project',
      fixturesDir: FIXTURES_DIR,
      adapter,
    });

    gitSpy = testbed.spy('git');

    // Stub git responses so the agent thinks it's in a real repo
    gitSpy.withArgs('status').returns({
      stdout: 'On branch main\nChanges not staged for commit:\n  modified:   src/index.ts',
    });
    gitSpy.withArgs('diff').returns({
      stdout: '--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,3 @@\n-export function greet(name: string): string {\n+export function greet(name: string, greeting = "Hello"): string {\n   return `Hello, ${name}!`;\n }',
    });
    gitSpy.withArgs('log', any()).returns({
      stdout: 'abc1234 Initial commit',
    });
    gitSpy.default().returns({ stdout: '', exitCode: 0 });

    recording = await testbed.runPrompt(
      'Show me the git status and tell me what file changed.'
    );
  }, 120_000);

  afterAll(async () => {
    if (testbed) await testbed.destroy();
    if (adapter) await adapter.destroy();
  });

  it('should produce a recording', () => {
    expect(recording).toBeDefined();
    expect(recording.id).toBeDefined();
  });

  it('should have intercepted tool calls via hooks', () => {
    expect(recording.interactions.length).toBeGreaterThanOrEqual(1);
  });

  it('should have a valid tokenUsage structure', () => {
    expect(recording.tokenUsage).toBeDefined();
    expect(recording.tokenUsage.total).toBe(
      recording.tokenUsage.input + recording.tokenUsage.output
    );
  });

  it('should have recorded the prompt', () => {
    expect(recording.prompts).toContain(
      'Show me the git status and tell me what file changed.'
    );
  });
});
