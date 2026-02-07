# How It Works

## The Shim Mechanism

When an AI agent runs a CLI command like `git status`, it's just executing a binary on `PATH`. The framework exploits this:

```
Your test process
  │
  ├─ creates temp bin dir with shim scripts (e.g. /tmp/shims/git)
  ├─ prepends that dir to PATH
  ├─ starts the agent with that modified PATH
  │
  └─ Agent runs "git status"
       │
       ├─ OS finds /tmp/shims/git (before /usr/bin/git)
       ├─ Shim sends { name: "git", args: ["status"] } to test process via HTTP
       ├─ Test process checks for a matching stub
       │
       ├─ If stub found → return stubbed response
       └─ If no stub   → passthrough to real /usr/bin/git
```

The shim is a Node.js script that POSTs to a localhost HTTP server running inside your test process. The test process resolves the stub from your `spy.withArgs(...).returns(...)` configuration. If no stub matches and no `.default()` is set, the shim finds the real binary (by searching PATH with its own directory removed) and executes it.

Either way, the call is **recorded** in the spy.

## Passthrough by Default

Spies don't fake anything unless you tell them to:

```typescript
const git = testbed.spy('git');
// No stubs configured — all git calls pass through to real git
// But every call is still recorded in git.calls
```

Stub only what you need:

```typescript
git.withArgs('push').returns({ stdout: 'Everything up-to-date' });
// git push → stubbed
// git status, git diff, git log, ... → real binary
```

Set a default to stub everything:

```typescript
git.default().returns({ stdout: '' });
// All git calls → stubbed (passthrough disabled)
```

## TestBed Lifecycle

```
TestBed.create()
  ├─ Create temp working directory
  ├─ Copy fixture files (if configured)
  ├─ Start shim HTTP server
  └─ Initialize adapter (or StubAdapter by default)

testbed.spy('git')
  ├─ Create SpyImpl for "git"
  ├─ Write /tmp/shims/git executable
  └─ Register spy with the shim server

testbed.runPrompt('...')  or  testbed.runSkill({...})
  ├─ Build env with shimmed PATH
  ├─ Delegate to adapter (CopilotAdapter, etc.)
  ├─ Adapter starts agent session, sends prompt
  ├─ Agent makes tool calls → shims intercept
  │   ├─ Stub match → return stub
  │   └─ No match   → passthrough to real binary
  ├─ Adapter records tool calls via hooks
  └─ Returns Recording

testbed.destroy()
  ├─ Stop adapter
  ├─ Close shim server
  └─ Remove temp directory
```

## Recordings

Every `runPrompt()`, `runSkill()`, or `session.end()` returns a `Recording`:

```typescript
{
  id: "a1b2c3d4-...",           // UUID
  prompts: ["your prompt"],      // what you asked the agent
  interactions: [                // what the agent did
    {
      type: "tool_call",
      name: "shell",
      args: { command: "git status" },
      result: "On branch main...",
      timestamp: 1707345600000
    }
  ],
  tokenUsage: {
    input: 1500,
    output: 200,
    total: 1700
  }
}
```

## Parallel Safety

Each `TestBed.create()` is fully isolated:

- Own temp directory (unique `mkdtemp`)
- Own shim directory (unique `mkdtemp`)
- Own HTTP server (random port via `:0`)
- Own `PATH` (assembled in `getEnv()`, passed per-session)

Two testbeds running in parallel never interfere. Their shim scripts talk to different ports, which resolve stubs from different spy registries.

## Adapter Role

The adapter is the bridge to a specific agent. It:

- Starts the agent process/session
- Passes the shimmed environment
- Records tool calls (via SDK hooks for Copilot, or process output for others)
- Tracks token usage
- Returns the recording

The framework ships `CopilotAdapter` for GitHub Copilot CLI. You can write adapters for other agents by implementing the `AgentAdapter` interface.
