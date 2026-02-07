# Architecture

## PNPM Workspace Structure

```
agenttestframework/
├── pnpm-workspace.yaml
├── package.json                  # Root: scripts, devDependencies (vitest, typescript)
├── tsconfig.base.json            # Shared TS config
├── vitest.workspace.ts           # Vitest workspace config
├── specs/
│   ├── product.md
│   └── architecture.md
└── packages/
    ├── core/                     # @agent-test/core
    ├── shims/                    # @agent-test/shims
    ├── assert/                   # @agent-test/assert
    ├── recorder/                 # @agent-test/recorder
    ├── testbed/                  # @agent-test/testbed
    ├── runner/                   # @agent-test/runner
    ├── adapter-copilot/          # @agent-test/adapter-copilot
    ├── adapter-claude/           # @agent-test/adapter-claude
    ├── adapter-codex/            # @agent-test/adapter-codex
    └── agent-test-framework/     # agent-test-framework (umbrella)
```

Each package follows the same internal layout:

```
packages/<name>/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts
└── tests/
    └── *.spec.ts
```

## Packages

### @agent-test/core

Types, interfaces, and argument matchers. Zero runtime dependencies. Everything else depends on this.

Exports:
- `defineConfig()` — typed config factory
- `AgentTestConfig` — config interface (agent, model, parallel, maxWorkers, fixturesDir)
- `any()`, `anyString()`, `matching(regex)` — argument matchers
- `ArgMatcher` — matcher interface for custom matchers
- `SpyCall`, `Spy`, `Mock` — type interfaces
- `Recording`, `TokenUsage` — recording types
- `TestBedOptions` — options type for TestBed.create()

Depends on: nothing

### @agent-test/shims

PATH shim creation and management. Creates executable scripts in a temp directory that intercept CLI calls. Handles the argument matching engine for `.withArgs()`, `.default()`, `.returns()`.

Responsibilities:
- Create executable shim scripts for a given binary name
- Route invocations through the argument matching engine
- Record all calls (args, timestamps, exit codes) for spy functionality
- Communicate between the shim process and the test process (via IPC, temp files, or unix sockets)

Exports:
- `ShimManager` — creates/destroys shim directories, manages PATH
- `SpyImpl` — implements `Spy` interface: `.withArgs()`, `.default()`, `.returns()`, `.findCall()`
- `MockImpl` — implements `Mock` (spy without call recording)

Depends on: `@agent-test/core`

### @agent-test/assert

Fluent assertion API for spies. Designed to integrate with vitest's `expect.extend()`.

Exports:
- `toHaveBeenCalledWith(...matchers)` — custom matcher
- `toHaveBeenCalled()` — custom matcher
- `findCall(...matchers)` — utility to retrieve a specific recorded call
- `setupMatchers()` — vitest `expect.extend()` registration

Depends on: `@agent-test/core`, `@agent-test/shims`

### @agent-test/recorder

Captures interactions and token usage during a test run.

Responsibilities:
- Track all agent ↔ tool interactions chronologically
- Aggregate token usage (input, output, total) from the agent CLI's output
- Serialize recordings to disk for replay/analysis
- Provide `Recording` instances with `.id`, `.tokenUsage`, `.prompts`, `.interactions`

Exports:
- `RecorderImpl` — creates and manages a recording session
- `RecordingStore` — persists/loads recordings from disk

Depends on: `@agent-test/core`

### @agent-test/testbed

The main orchestrator. Creates isolated environments, wires up shims, runs the agent, and returns recordings.

Responsibilities:
- `TestBed.create(options?)` — merges global config with per-test overrides
- Create an isolated temp working directory
- Copy fixtures into the working directory
- Set up PATH shims via `ShimManager`
- Delegate to the correct agent adapter for `runSkill()`, `runPrompt()`, `startSession()`
- Return `Recording` from each run
- `destroy()` — tear down the temp directory and shims

Exports:
- `TestBed`

Depends on: `@agent-test/core`, `@agent-test/shims`, `@agent-test/recorder`, `@agent-test/adapter-*` (via dynamic resolution)

### @agent-test/runner

Parallel test execution engine.

Responsibilities:
- Discover and schedule test suites
- Worker pool management (`maxWorkers`)
- Respect `describe.serial()` annotations
- Aggregate results across workers

Exports:
- `TestRunner`
- `WorkerPool`

Depends on: `@agent-test/core`

### Agent Adapters

Each adapter translates the framework's generic API into CLI-specific invocations.

**@agent-test/adapter-copilot**
- Knows how to invoke `github-copilot-cli` with the right flags
- Parses copilot-specific output for token usage
- Handles copilot's interactive question format

**@agent-test/adapter-claude**
- Invokes `claude` CLI in non-interactive mode
- Parses Claude's output for token usage
- Handles Claude's permission prompts and question flow

**@agent-test/adapter-codex**
- Invokes `codex` CLI
- Parses Codex output for token usage

Each adapter exports:
- `Agent` implementation conforming to a shared `AgentAdapter` interface from core

Depends on: `@agent-test/core`

### agent-test-framework (umbrella)

The public-facing package that consumers install. Re-exports the public API from all internal packages.

```typescript
// What users import
import { TestBed, any, anyString, matching, defineConfig } from 'agent-test-framework';
```

Depends on: all `@agent-test/*` packages

## Dependency Graph

```
agent-test-framework (umbrella)
│
├─► @agent-test/testbed
│     ├─► @agent-test/core
│     ├─► @agent-test/shims ──► @agent-test/core
│     ├─► @agent-test/recorder ──► @agent-test/core
│     └─► @agent-test/adapter-* ──► @agent-test/core
│
├─► @agent-test/assert
│     ├─► @agent-test/core
│     └─► @agent-test/shims
│
└─► @agent-test/runner ──► @agent-test/core
```

No circular dependencies. `@agent-test/core` is the leaf that everything depends on.

## Framework Testing Strategy

The framework itself is tested with vitest using TDD.

### Principles

- **Test first**: Write the failing test, then implement the code to make it pass.
- **Each package is tested in isolation**: Unit tests per package mock cross-package dependencies.
- **Integration tests live at the root level**: Test cross-package wiring (e.g. TestBed creating shims and recording).
- **No agent CLI required for unit tests**: All adapter calls are mocked in unit/integration tests.

### Per-Package Test Scope

| Package | What to test |
|---------|-------------|
| `core` | Matcher logic (`any()` matches anything, `matching(/foo/)` matches/rejects correctly), config merging, type contracts |
| `shims` | Shim script generation, argument matching engine routing, call recording, IPC communication, default fallback behavior |
| `assert` | Custom vitest matchers produce correct pass/fail, `findCall` returns the right call or throws |
| `recorder` | Interaction tracking, token aggregation, serialization round-trip |
| `testbed` | Config merging with global defaults, fixture copying, shim wiring, adapter delegation, cleanup on destroy |
| `runner` | Worker pool scheduling, parallelism limits, serial suite handling |
| `adapter-*` | CLI invocation args are correct, output parsing extracts tokens, interactive flow handling |

### Test Commands

```bash
# Run all tests across the workspace
pnpm test

# Run tests for a single package
pnpm --filter @agent-test/core test

# Run in watch mode during TDD
pnpm --filter @agent-test/core test:watch
```
