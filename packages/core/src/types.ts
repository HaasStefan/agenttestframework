/**
 * Configuration for the agent test framework.
 */
export interface AgentTestConfig {
  agent?: string;
  model?: string;
  parallel?: boolean;
  maxWorkers?: number;
  fixturesDir?: string;
}

/**
 * Options for creating a TestBed instance.
 */
export interface TestBedOptions {
  agent?: string;
  model?: string;
  fixtures?: string;
  tools?: string[];
}

/**
 * Token usage tracking for a test run.
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * A single recorded call to a spy.
 */
export interface SpyCall {
  args: string[];
  timestamp: number;
  exitCode: number;
}

/**
 * Response returned by a stub.
 */
export interface StubResponse {
  stdout: string;
  stderr?: string;
  exitCode?: number;
}

/**
 * Argument matcher interface.
 */
export interface ArgMatcher {
  matches(value: string): boolean;
  readonly description: string;
}

/**
 * Stub configuration (returned by .withArgs() or .default()).
 */
export interface StubConfig {
  returns(response: StubResponse): void;
}

/**
 * Spy interface for intercepting and recording CLI calls.
 */
export interface Spy {
  withArgs(...args: (string | ArgMatcher)[]): StubConfig;
  default(): StubConfig;
  readonly calls: ReadonlyArray<SpyCall>;
  findCall(...matchers: (string | ArgMatcher)[]): SpyCall | undefined;
  reset(): void;
}

/**
 * Mock interface (spy without call recording).
 */
export interface Mock {
  withArgs(...args: (string | ArgMatcher)[]): StubConfig;
  default(): StubConfig;
  reset(): void;
}

/**
 * A recorded interaction during a test run.
 */
export interface Interaction {
  type: 'tool_call' | 'prompt' | 'response';
  name?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  timestamp: number;
}

/**
 * A complete recording of a test run.
 */
export interface Recording {
  id: string;
  tokenUsage: TokenUsage;
  prompts: string[];
  interactions: Interaction[];
}

/**
 * Session for multi-turn interactions.
 */
export interface Session {
  sendPrompt(prompt: string): Promise<void>;
  onQuestion(handler: (question: string) => string | Promise<string>): void;
  end(): Promise<Recording>;
}

/**
 * Options passed to adapter run methods (e.g. question handling).
 */
export interface AgentRunOptions {
  onQuestion?: (question: string, choices?: string[]) => string | Promise<string>;
}

/**
 * Agent adapter interface — implemented by each CLI adapter.
 */
export interface AgentAdapter {
  runSkill(options: { skill: string; prompt: string }, env: Record<string, string>, runOptions?: AgentRunOptions): Promise<Recording>;
  runPrompt(prompt: string, env: Record<string, string>, runOptions?: AgentRunOptions): Promise<Recording>;
  startSession(env: Record<string, string>): Promise<Session>;
  destroy(): Promise<void>;
}
