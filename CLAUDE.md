# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Agent Test Framework — a testing framework for CLI AI agents (GitHub Copilot CLI, Claude Code, OpenAI Codex CLI). It provides isolated test environments with PATH shims for mocking/spying on CLI binaries, fluent assertions, and token usage tracking.

## Tech Stack

TypeScript, Node, PNPM workspace, vitest

## Build & Test Commands

```bash
pnpm install                              # Install all dependencies
pnpm build                                # Build all packages
pnpm test                                 # Run all tests (unit + integration)
pnpm --filter @agent-test/core test       # Run tests for a single package
pnpm --filter @agent-test/core test:watch # Watch mode for TDD
pnpm test:e2e                             # E2E tests (requires real agent CLIs)
```

## Monorepo Package Layout

All packages live in `packages/` and follow `packages/<name>/src/index.ts` + `packages/<name>/tests/*.spec.ts`.

### Dependency Graph (bottom-up)

```
@agent-test/core          ← Zero deps. Types, matchers (any/anyString/matching), defineConfig, AgentAdapter interface
@agent-test/shims         ← core. ShimManager, SpyImpl, MockImpl. Executable PATH shims with IPC
@agent-test/recorder      ← core. RecorderImpl, RecordingStore. Token tracking + disk persistence
@agent-test/assert        ← core, shims. Custom vitest matchers (toHaveBeenCalledWith, findCall)
@agent-test/adapter-*     ← core + respective SDK. Copilot uses @github/copilot-sdk (not CLI spawn)
@agent-test/testbed       ← core, shims, recorder, adapters. TestBed orchestrator
@agent-test/runner        ← core. Parallel worker pool
agent-test-framework      ← All packages. Umbrella re-exporting the public API
```

## Key Architecture Decisions

- **PATH shims**: The core mechanism. Executable scripts placed in a temp dir prepended to PATH. When an agent invokes `git`, `npm`, etc., the shim intercepts it, communicates with the test process via IPC, and returns stubbed responses.
- **Argument matchers**: `any()`, `anyString()`, `matching(regex)` work in both stub setup (`.withArgs()`) and assertions (`toHaveBeenCalledWith()`). `matchArgs()` in core is the shared engine.
- **Spy `.default().returns(...)`**: Catch-all fallback so agent runs don't fail on unexpected/dynamic args.
- **Copilot adapter uses `@github/copilot-sdk`** programmatically (CopilotClient/CopilotSession via JSON-RPC), not CLI spawning. Skill isolation via `skillDirectories`/`disabledSkills` session config. Tool recording via `onPreToolUse`/`onPostToolUse` hooks.
- **Test pattern**: Arrange + act in `beforeAll`, assert across multiple `it()` blocks. One `runSkill()`/`runPrompt()` call per describe block.
- **`runSkill()`** takes `{ skill: 'path/to/skill.md', prompt: '...' }` — locks the agent to that single skill file.

## Development Approach

TDD: write the failing test first, then implement. Each package is tested in isolation. No real agent CLI needed for unit tests — adapters are mocked.

## Specs

- `specs/product.md` — Product requirements, concepts, example test files
- `specs/architecture.md` — Package breakdown, dependency graph, testing strategy
- `specs/implementation.md` — 10-milestone implementation plan with verification steps
