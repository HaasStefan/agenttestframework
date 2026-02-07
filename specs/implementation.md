# Implementation Plan

## Overview

Incremental, TDD-driven build-out of the Agent Test Framework. Each milestone produces a working, tested deliverable. Later milestones build on earlier ones. Every step starts with failing tests before writing implementation code.

---

## Milestone 1: Workspace Scaffolding & Core Types

**Goal**: A buildable, testable PNPM monorepo with the `@agent-test/core` package shipping all foundational types and matchers.

### 1.1 — Scaffold the monorepo

- Create `pnpm-workspace.yaml` with `packages/*`
- Root `package.json` with shared devDependencies: `typescript`, `vitest`
- Root `tsconfig.base.json` with strict mode, path aliases
- `vitest.workspace.ts` pointing at all packages
- Root scripts: `pnpm test`, `pnpm build`

**Verify**: `pnpm install` succeeds, `pnpm test` runs (no tests yet, exits clean), `pnpm build` compiles with zero errors.

### 1.2 — @agent-test/core: Config & types

- `AgentTestConfig` interface (agent, model, parallel, maxWorkers, fixturesDir)
- `defineConfig()` typed factory (identity function with type checking)
- `TestBedOptions` interface
- `TokenUsage` type (`{ input: number; output: number; total: number }`)
- `Recording` interface (`id`, `tokenUsage`, `prompts`, `interactions`)
- `SpyCall` interface (`args: string[]`, `timestamp: number`, `exitCode: number`)
- `Spy`, `Mock` interfaces (`.withArgs()`, `.default()`, `.returns()`, `.findCall()`)
- `AgentAdapter` interface (`runSkill()`, `runPrompt()`, `startSession()`)

**Tests**:
- `defineConfig()` returns the config object as-is
- `defineConfig()` accepts partial config
- Type-level: verify required fields, optional fields

**Verify**: `pnpm --filter @agent-test/core test` — all green.

### 1.3 — @agent-test/core: Argument matchers

- `any()` — matches any value
- `anyString()` — matches any string
- `matching(regex)` — matches a string against a regex
- `ArgMatcher` interface with `.matches(value): boolean`
- `matchArgs(actual: string[], expected: (string | ArgMatcher)[])` — engine function that compares an actual args array against a pattern of literals and matchers

**Tests**:
- `any()` matches strings, numbers, undefined, empty string
- `anyString()` matches strings, rejects numbers/undefined
- `matching(/foo/)` matches `"foobar"`, rejects `"baz"`
- `matchArgs` with exact strings: `['add', 'src/index.ts']` matches `['add', 'src/index.ts']`
- `matchArgs` with matchers: `['commit', '-m', matching(/.+/)]` matches `['commit', '-m', 'fix bug']`
- `matchArgs` with `any()`: `['log', any()]` matches `['log', '--oneline']` and `['log', 'main..HEAD']`
- `matchArgs` length mismatch: `['add']` does not match `['add', 'src/index.ts']`
- `matchArgs` with trailing `any()`: verify partial matching semantics

**Verify**: `pnpm --filter @agent-test/core test` — all green.

---

## Milestone 2: PATH Shims

**Goal**: Executable shim scripts that intercept CLI calls, route through the argument matching engine, and record calls. This is the core runtime mechanism of the framework.

### 2.1 — @agent-test/shims: ShimManager

- `ShimManager.create(dir?)` — creates a temp directory for shims
- `shimManager.binDir` — the path to prepend to `PATH`
- `shimManager.createShim(name)` — writes an executable script for the given binary name
- `shimManager.destroy()` — removes the temp directory
- Shim scripts are Node scripts that read a call log file, append the invocation args, and return a response based on configured stubs

**Tests**:
- `ShimManager.create()` creates a temp directory that exists on disk
- `createShim('git')` creates an executable file at `binDir/git`
- The shim file is executable (`fs.accessSync` with `X_OK`)
- `destroy()` removes the temp directory
- Creating two ShimManagers produces different directories (isolation)

**Verify**: `pnpm --filter @agent-test/shims test` — all green.

### 2.2 — @agent-test/shims: SpyImpl (stub configuration)

- `SpyImpl` constructor takes a shim name
- `.withArgs(...matchers).returns(response)` — registers a stub for a specific arg pattern
- `.default().returns(response)` — registers a fallback stub
- `.resolve(args: string[]): StubResponse` — given actual args, finds the best matching stub (specific match wins over default)
- `StubResponse`: `{ stdout: string; stderr?: string; exitCode: number }`

**Tests**:
- `withArgs('status').returns(...)` — `.resolve(['status'])` returns the configured response
- `withArgs('commit', '-m', matching(/.+/)).returns(...)` — `.resolve(['commit', '-m', 'fix bug'])` returns it
- `.resolve(['unknown'])` with no default — returns an error/throws
- `.resolve(['unknown'])` with `.default()` configured — returns the default response
- Specific match takes priority over default: configure both, resolve a specific match, verify specific wins
- Multiple specific stubs: first matching stub wins

**Verify**: `pnpm --filter @agent-test/shims test` — all green.

### 2.3 — @agent-test/shims: SpyImpl (call recording)

- Every call to `.resolve()` records a `SpyCall` (`{ args, timestamp, exitCode }`)
- `.calls` — returns all recorded calls
- `.findCall(...matchers)` — finds the first call matching the given pattern
- `.reset()` — clears recorded calls and stubs

**Tests**:
- After `.resolve(['status'])`, `.calls` has length 1 with correct args
- After multiple resolves, `.calls` has correct length and order
- `.findCall('commit', '-m', any())` returns the right call
- `.findCall(...)` for a non-existent call returns undefined (or throws)
- `.reset()` clears calls and stubs

**Verify**: `pnpm --filter @agent-test/shims test` — all green.

### 2.4 — @agent-test/shims: Shim ↔ test process IPC

- When the shim executable is invoked by an external process (the agent CLI), it needs to communicate with the test process to resolve stubs and record calls
- Mechanism: the shim writes its args to a request file and waits; the test process watches for requests, resolves the stub, writes the response; the shim reads the response and outputs it
- Alternative: Unix domain socket or localhost HTTP — choose the simplest reliable approach

**Tests**:
- Spawn the shim script as a child process with test args, verify it produces the stubbed stdout and exit code
- Spawn the shim twice concurrently, verify both resolve correctly (no race conditions)
- Shim with no matching stub and no default — exits with error code
- Shim invocation is recorded as a `SpyCall` in the parent process

**Verify**: `pnpm --filter @agent-test/shims test` — all green. These are the first tests that spawn real child processes.

---

## Milestone 3: Assertions

**Goal**: Custom vitest matchers for spies so that test files read like the product spec examples.

### 3.1 — @agent-test/assert: Custom matchers

- `setupMatchers()` — calls `expect.extend()` with custom matchers
- `toHaveBeenCalled()` — spy has at least one recorded call
- `toHaveBeenCalledWith(...matchers)` — spy has a call matching the given pattern
- `not.toHaveBeenCalled()` / `not.toHaveBeenCalledWith(...)` — negations
- Matchers work with `ArgMatcher` instances and plain strings

**Tests**:
- Spy with one call: `expect(spy).toHaveBeenCalled()` passes
- Spy with zero calls: `expect(spy).toHaveBeenCalled()` fails with clear message
- Spy with zero calls: `expect(spy).not.toHaveBeenCalled()` passes
- `expect(spy).toHaveBeenCalledWith('add', 'src/index.ts')` — passes when call exists
- `expect(spy).toHaveBeenCalledWith('add', 'src/index.ts')` — fails when call doesn't exist
- `expect(spy).toHaveBeenCalledWith('commit', '-m', matching(/.+/))` — passes with any message
- `expect(spy).not.toHaveBeenCalledWith('push', '--force')` — passes when no such call exists
- Failure messages include the actual calls for debugging

**Verify**: `pnpm --filter @agent-test/assert test` — all green.

---

## Milestone 4: Recorder

**Goal**: Capture and persist test recordings with token usage tracking.

### 4.1 — @agent-test/recorder: RecorderImpl

- `RecorderImpl.start()` — begins a recording session, generates a unique `id`
- `.recordInteraction(interaction)` — appends an interaction (prompt, tool call, response)
- `.recordTokenUsage(usage: Partial<TokenUsage>)` — accumulates token counts
- `.end(): Recording` — finalizes and returns the recording

**Tests**:
- `.start()` produces a recording with a unique `id`
- After recording 3 interactions, `.end().interactions` has length 3
- Token usage accumulates: record `{ input: 100 }` then `{ input: 200 }` → total input is 300
- `.end().tokenUsage.total` equals `input + output`
- Calling `.recordInteraction()` after `.end()` throws

**Verify**: `pnpm --filter @agent-test/recorder test` — all green.

### 4.2 — @agent-test/recorder: RecordingStore

- `RecordingStore.save(recording, dir)` — writes a recording as JSON to disk
- `RecordingStore.load(id, dir)` — reads a recording from disk
- File format: `<dir>/<id>.json`

**Tests**:
- Save then load round-trips the full recording (interactions, tokenUsage, prompts)
- Load a non-existent id — throws a clear error
- Save two recordings — both coexist on disk

**Verify**: `pnpm --filter @agent-test/recorder test` — all green.

---

## Milestone 5: TestBed (without real agents)

**Goal**: The TestBed orchestrator wires up shims, fixtures, config merging, and produces recordings. Uses a fake/stub adapter so no real agent CLI is needed.

### 5.1 — @agent-test/testbed: Config merging

- `loadConfig(projectRoot)` — loads `agent-test.config.ts` from the given directory, returns `AgentTestConfig`
- `mergeOptions(global, local)` — local overrides win, missing fields fall back to global

**Tests**:
- Global config `{ agent: 'copilot-cli', model: 'opus-4.5' }` + local `{ model: 'gpt-5.2' }` → merged `{ agent: 'copilot-cli', model: 'gpt-5.2' }`
- Local with no overrides → inherits everything from global
- Missing global config file → uses defaults

**Verify**: `pnpm --filter @agent-test/testbed test` — all green.

### 5.2 — @agent-test/testbed: Working directory & fixtures

- `TestBed.create()` creates a temp working directory (`testbed.workDir`)
- With `fixtures: 'my-project'` — copies the fixture directory into `workDir`
- `testbed.destroy()` — removes the temp directory

**Tests**:
- `TestBed.create()` produces a `workDir` that exists on disk
- With fixtures: `workDir` contains the fixture files
- `destroy()` removes the directory
- Two TestBeds have different `workDir` paths

**Verify**: `pnpm --filter @agent-test/testbed test` — all green.

### 5.3 — @agent-test/testbed: Shim wiring & spy()

- `TestBed.create()` initializes a `ShimManager`
- `testbed.spy('git')` creates a shim + `SpyImpl` and returns it
- The shim directory is prepended to `PATH` in the testbed's environment
- `destroy()` also destroys the `ShimManager`

**Tests**:
- `testbed.spy('git')` returns a `Spy` with `.withArgs()`, `.default()`, `.returns()`
- `testbed.spy('git')` called twice returns the same spy instance
- The testbed's environment `PATH` starts with the shim directory
- After `destroy()`, the shim directory no longer exists

**Verify**: `pnpm --filter @agent-test/testbed test` — all green.

### 5.4 — @agent-test/testbed: runSkill() & runPrompt() with stub adapter

- Create a `StubAdapter` that implements `AgentAdapter` for testing the TestBed wiring without a real CLI
- `testbed.runSkill({ skill, prompt })` → delegates to adapter, returns a `Recording`
- `testbed.runPrompt(prompt)` → delegates to adapter, returns a `Recording`
- `testbed.startSession()` → returns a `Session` with `.sendPrompt()`, `.onQuestion()`, `.end()`

**Tests**:
- `runSkill()` passes the skill path and prompt to the adapter
- `runSkill()` returns a `Recording` with an `id`
- `runPrompt()` passes the prompt to the adapter
- `startSession()` returns a session; `.end()` returns a recording
- The adapter receives the testbed's environment (with shimmed PATH)

**Verify**: `pnpm --filter @agent-test/testbed test` — all green.

---

## Milestone 6: First Agent Adapter (Copilot SDK)

**Goal**: A real adapter using [`@github/copilot-sdk`](https://github.com/github/copilot-sdk) that creates Copilot sessions programmatically, restricts skills/tools for `runSkill()`, tracks tool invocations via hooks, and captures token usage from session events.

### 6.1 — @agent-test/adapter-copilot: Client & session lifecycle

- Runtime dependency: `@github/copilot-sdk`
- Implements `AgentAdapter` interface
- `create(options)` — instantiates a `CopilotClient`, calls `client.start()`
- `destroy()` — calls `client.stop()`
- `runPrompt(prompt, env)` — creates a `CopilotSession` with `workingDirectory` set to the TestBed's `workDir` (shimmed PATH in env), sends via `session.sendAndWait()`, destroys the session, returns a `Recording`

**Tests** (mock `CopilotClient` and `CopilotSession` — no real CLI):
- `create()` calls `client.start()`
- `destroy()` calls `client.stop()`
- `runPrompt()` calls `client.createSession()` with correct `workingDirectory`
- `runPrompt()` calls `session.sendAndWait()` with the prompt
- `runPrompt()` destroys the session after completion
- Session config receives the model from adapter options

**Verify**: `pnpm --filter @agent-test/adapter-copilot test` — all green.

### 6.2 — @agent-test/adapter-copilot: runSkill() skill isolation

- `runSkill({ skill, prompt }, env)` → creates a session with:
  - `skillDirectories`: set to the directory containing the skill file
  - `disabledSkills`: all skills except the target skill file
  - `availableTools` / `excludedTools`: restrict to only tools relevant to the skill under test
- Sends the prompt via `session.sendAndWait()`

**Tests** (mocked SDK):
- `runSkill({ skill: 'skills/commit.md', prompt: '...' })` creates a session with `skillDirectories` pointing at `skills/`
- `disabledSkills` excludes all skills except `commit.md`
- `availableTools`/`excludedTools` are passed through when provided in options
- The prompt is sent correctly via `sendAndWait()`

**Verify**: `pnpm --filter @agent-test/adapter-copilot test` — all green.

### 6.3 — @agent-test/adapter-copilot: Tool recording via hooks

- Register `onPreToolUse` and `onPostToolUse` session hooks to capture every tool invocation
- Each tool call is recorded as an interaction in the `Recorder` (tool name, args, result, timing)
- Register `onUserInputRequest` to handle interactive questions (delegated to the framework's question handler)

**Tests** (mocked SDK):
- `onPreToolUse` hook is registered on session creation
- `onPostToolUse` hook records tool name, args, and result into the recorder
- When the SDK triggers `onUserInputRequest`, the adapter delegates to the provided question callback
- Tool invocations appear in `recording.interactions` in order

**Verify**: `pnpm --filter @agent-test/adapter-copilot test` — all green.

### 6.4 — @agent-test/adapter-copilot: Token usage from session events

- Subscribe to `session.compaction_complete` events for token counts
- Track token usage from the response's billing/usage metadata
- Aggregate into `TokenUsage` on the recording

**Tests** (mocked SDK):
- Session emitting a compaction event → `recording.tokenUsage` reflects the counts
- Response with billing metadata → token counts accumulated
- No token info → `TokenUsage` is zeroed (not undefined)

**Verify**: `pnpm --filter @agent-test/adapter-copilot test` — all green.

### 6.5 — Integration: TestBed + Copilot adapter (mocked SDK)

Root-level integration test that wires up a TestBed with the copilot adapter, mocking `@github/copilot-sdk` so no real CLI/auth is needed.

**Tests**:
- Create TestBed with `agent: 'copilot-cli'`, spy on `git`, configure stubs
- `runSkill()` → mocked session receives correct skill config, workDir has shimmed PATH
- Tool invocations recorded via hooks appear in the recording
- Recording has interactions and token usage
- `destroy()` stops the client and cleans up the TestBed

**Verify**: `pnpm test` (root) runs integration tests — all green.

---

## Milestone 7: Umbrella Package & Public API

**Goal**: The `agent-test-framework` package re-exports everything so consumers use a single import.

### 7.1 — agent-test-framework: Re-exports

- Re-exports from `@agent-test/core`: `defineConfig`, `any`, `anyString`, `matching`
- Re-exports from `@agent-test/testbed`: `TestBed`
- Re-exports from `@agent-test/assert`: `setupMatchers`
- Types: `Spy`, `Mock`, `Recording`, `TokenUsage`, `SpyCall`, `Session`, `AgentTestConfig`

**Tests**:
- Import `{ TestBed, any, anyString, matching, defineConfig }` from `agent-test-framework` — all are defined
- Import types — compile without errors
- `setupMatchers()` registers the custom vitest matchers

**Verify**: `pnpm --filter agent-test-framework test` — all green.

### 7.2 — Smoke test: Full flow with mocked CLI

A single test file that mimics the product spec's unit test example end-to-end, importing only from `agent-test-framework`, with a mocked agent CLI.

**Tests**:
- The unit test example from product.md compiles and runs against the stub adapter
- Spies record calls, assertions pass, recording has token usage

**Verify**: `pnpm --filter agent-test-framework test` — all green. This is the first time the product spec example can actually run.

---

## Milestone 8: Remaining Adapters

**Goal**: Claude Code and Codex adapters, following the same pattern as Copilot.

### 8.1 — @agent-test/adapter-claude

- `runSkill()` — invokes `claude` with `--skill` or equivalent, `--print` for non-interactive mode, `--allowedTools` to restrict
- `runPrompt()` — invokes `claude` with prompt via stdin
- `startSession()` — manages a long-running `claude` process for multi-turn
- Output parser: extract token usage from Claude's JSON output

**Tests** (mocked spawn):
- Correct binary and flags for `runSkill()` vs `runPrompt()`
- Token usage parsed from sample Claude output
- Session: multiple prompts sent, question detection works

**Verify**: `pnpm --filter @agent-test/adapter-claude test` — all green.

### 8.2 — @agent-test/adapter-codex

- Same pattern as above for `codex` CLI

**Tests** (mocked spawn):
- Correct binary and flags
- Token usage parsing
- Session handling

**Verify**: `pnpm --filter @agent-test/adapter-codex test` — all green.

---

## Milestone 9: Runner (Parallel Execution)

**Goal**: A test runner that executes suites in parallel with worker pooling.

### 9.1 — @agent-test/runner: WorkerPool

- `WorkerPool.create(maxWorkers)` — creates a pool
- `.submit(task)` — queues a task, returns a promise
- `.drain()` — waits for all tasks to complete
- Respects `maxWorkers` concurrency limit

**Tests**:
- Pool with `maxWorkers: 2`, submit 4 tasks — at most 2 run concurrently
- All tasks complete and return their results
- A failing task doesn't block other tasks

**Verify**: `pnpm --filter @agent-test/runner test` — all green.

### 9.2 — @agent-test/runner: TestRunner

- `TestRunner.discover(glob)` — finds test suite files
- `TestRunner.run(suites, config)` — distributes suites across the worker pool
- Serial suites (`describe.serial`) run on a single worker sequentially
- Aggregates results (pass/fail counts, recordings)

**Tests**:
- Discover finds `.spec.ts` files in the expected locations
- Parallel suites are distributed across workers
- Serial suites are not parallelized
- Results aggregate correctly

**Verify**: `pnpm --filter @agent-test/runner test` — all green.

---

## Milestone 10: Real Agent E2E Validation

**Goal**: Validate the entire framework against a real agent CLI. This is the only milestone that requires an actual agent CLI installed.

### 10.1 — E2E: Real Copilot SDK

- A test suite in `tests/e2e/` that connects to a real Copilot CLI server via `@github/copilot-sdk`
- Uses a minimal fixture project
- Asserts that shims intercept calls, hook-based tool recording works, recordings capture token usage, assertions work

**Verify**: `pnpm test:e2e` with Copilot CLI installed and authenticated — all green.

### 10.2 — E2E: Real Claude Code

- Same as above for Claude Code

**Verify**: `pnpm test:e2e` with Claude Code installed — all green.

---

## Milestone Summary

| # | Milestone | Packages | Deliverable | Verification |
|---|-----------|----------|-------------|--------------|
| 1 | Workspace & Core | `core` | Buildable monorepo, types, matchers | `pnpm --filter @agent-test/core test` |
| 2 | PATH Shims | `shims` | Executable shims with IPC, spy recording, arg matching | `pnpm --filter @agent-test/shims test` |
| 3 | Assertions | `assert` | vitest custom matchers for spies | `pnpm --filter @agent-test/assert test` |
| 4 | Recorder | `recorder` | Interaction + token tracking, disk persistence | `pnpm --filter @agent-test/recorder test` |
| 5 | TestBed | `testbed` | Orchestrator: config merge, fixtures, shim wiring, adapter delegation | `pnpm --filter @agent-test/testbed test` |
| 6 | Copilot Adapter | `adapter-copilot` | `@github/copilot-sdk` adapter: skill isolation, hook-based tool recording, token tracking | `pnpm --filter @agent-test/adapter-copilot test` |
| 7 | Umbrella | `agent-test-framework` | Public API, product spec example compiles and runs | `pnpm --filter agent-test-framework test` |
| 8 | Remaining Adapters | `adapter-claude`, `adapter-codex` | Claude + Codex adapters | Per-package tests |
| 9 | Runner | `runner` | Parallel execution, worker pool | `pnpm --filter @agent-test/runner test` |
| 10 | Real E2E | all | Framework validated against real agent CLIs | `pnpm test:e2e` |

## Implementation Order Rationale

The plan follows the dependency graph bottom-up:

1. **Core first** — everything depends on it, and it has zero dependencies.
2. **Shims second** — the most complex and novel piece; the runtime mechanism everything else relies on.
3. **Assertions third** — depends on shims. Once this is done, tests can be written in the fluent style from the product spec.
4. **Recorder fourth** — independent of shims/assertions, but needed before TestBed.
5. **TestBed fifth** — the orchestrator that wires shims + recorder + adapters. At this point the internal architecture is complete.
6. **First adapter sixth** — uses `@github/copilot-sdk` to prove the adapter interface works. SDK hooks provide tool recording and skill isolation. Integration tests validate the full stack.
7. **Umbrella seventh** — makes the public API usable. The product spec examples can now run.
8. **Remaining adapters eighth** — follow the proven pattern from milestone 6.
9. **Runner ninth** — parallel execution is an optimization, not a correctness requirement. Everything works without it.
10. **Real E2E last** — requires real CLI installations, validates the whole system end-to-end.
