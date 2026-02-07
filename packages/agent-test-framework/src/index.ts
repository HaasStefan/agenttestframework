// Core: config & matchers
export { defineConfig, any, anyString, matching, matchArgs } from '@agent-test/core';
export type {
  AgentTestConfig,
  TestBedOptions,
  TokenUsage,
  SpyCall,
  StubResponse,
  ArgMatcher,
  Spy,
  Mock,
  Interaction,
  Recording,
  Session,
  AgentAdapter,
  AgentRunOptions,
} from '@agent-test/core';

// TestBed
export { TestBed, PromptBuilder } from '@agent-test/testbed';

// Assertions
export { setupMatchers } from '@agent-test/assert';

// Recorder
export { RecorderImpl, RecordingStore } from '@agent-test/recorder';

// Runner
export { TestRunner, WorkerPool } from '@agent-test/runner';
export type { Suite, RunOptions, RunResult } from '@agent-test/runner';

// Adapters
export { CopilotAdapter } from '@agent-test/adapter-copilot';
