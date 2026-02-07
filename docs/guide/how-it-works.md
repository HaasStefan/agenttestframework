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
       ├─ Test process looks up matching stub, returns { stdout: "On branch main..." }
       └─ Agent sees the stubbed output, continues its work
```

The shim is a Node.js script that POSTs to a localhost HTTP server running inside your test process. The test process resolves the stub from your `spy.withArgs(...).returns(...)` configuration and sends it back.

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
  ├─ Agent makes tool calls → shims intercept → stubs respond
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

## Spy Resolution

When a shim fires, the spy resolves the response in this order:

1. Check stubs registered with `.withArgs(...)` — first match wins
2. Fall back to `.default().returns(...)`
3. If neither exists, throw an error (tells you exactly which args were unmatched)

## Adapter Role

The adapter is the bridge to a specific agent. It:

- Starts the agent process/session
- Passes the shimmed environment
- Records tool calls (via SDK hooks for Copilot, or process output for others)
- Tracks token usage
- Returns the recording

The framework ships `CopilotAdapter` for GitHub Copilot CLI. You can write adapters for other agents by implementing the `AgentAdapter` interface.
