import type { AgentTestConfig } from '@agent-test/core';

/**
 * Merge global config with per-test overrides. Local values win.
 */
export function mergeOptions(
  global: Partial<AgentTestConfig>,
  local: Partial<AgentTestConfig>
): Partial<AgentTestConfig> {
  return { ...global, ...stripUndefined(local) };
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
