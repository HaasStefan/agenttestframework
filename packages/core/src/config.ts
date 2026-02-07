import type { AgentTestConfig } from './types.js';

/**
 * Typed config factory. Returns the config object as-is with type checking.
 */
export function defineConfig(config: AgentTestConfig): AgentTestConfig {
  return config;
}
