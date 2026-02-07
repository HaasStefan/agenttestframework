/**
 * Smoke test: mimics the product spec's unit test example.
 * Imports only from 'agent-test-framework', uses stub adapter.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestBed, any, anyString, matching, setupMatchers } from '../src/index.js';
import type { Spy, Recording } from '../src/index.js';

setupMatchers();

describe('commit skill (smoke test from product spec)', () => {
  let testbed: TestBed;
  let gitSpy: Spy;
  let rmSpy: Spy;
  let recording: Recording;

  beforeAll(async () => {
    // Arrange
    testbed = await TestBed.create();
    gitSpy = testbed.spy('git');
    rmSpy = testbed.spy('rm');

    // Specific arg matchers for known commands
    gitSpy.withArgs('status').returns({ stdout: 'M  src/index.ts' });
    gitSpy.withArgs('diff', '--staged').returns({ stdout: '+console.log("hello")' });

    // Catch-all default
    gitSpy.default().returns({ stdout: '', exitCode: 0 });

    // Act — stub adapter doesn't actually invoke the CLI, but the
    // spy infrastructure and recording are fully wired up.
    recording = await testbed.runSkill({
      skill: 'skills/commit.md',
      prompt: 'commit the staged changes',
    });
  });

  afterAll(async () => {
    await testbed.destroy();
  });

  it('should produce a recording with an id', () => {
    expect(recording.id).toBeDefined();
    expect(typeof recording.id).toBe('string');
  });

  it('should record the prompt', () => {
    expect(recording.prompts).toContain('commit the staged changes');
  });

  it('should have token usage (zeroed from stub adapter)', () => {
    expect(recording.tokenUsage).toBeDefined();
    expect(recording.tokenUsage.total).toBeGreaterThanOrEqual(0);
  });

  // With the stub adapter, no actual CLI runs — so spies won't have calls.
  // These tests verify the assertion matchers compile and execute correctly.
  it('should not have called rm', () => {
    expect(rmSpy).not.toHaveBeenCalled();
  });

  it('assertions with matchers compile and run', () => {
    // Verify that the matching/any/anyString matchers work at the type level
    expect(rmSpy).not.toHaveBeenCalledWith('rm', '-rf', any());
  });

  it('setupMatchers registers toHaveBeenCalled', () => {
    // This assertion should not throw — rmSpy was never called
    expect(rmSpy).not.toHaveBeenCalled();
  });
});
