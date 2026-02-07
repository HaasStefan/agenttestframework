import type { ArgMatcher, SpyCall, StubResponse, StubConfig, Spy } from '@agent-test/core';
import { matchArgs, isArgMatcher } from '@agent-test/core';

interface StubEntry {
  pattern: (string | ArgMatcher)[];
  response: StubResponse;
}

export class SpyImpl implements Spy {
  readonly name: string;
  private _calls: SpyCall[] = [];
  private _stubs: StubEntry[] = [];
  private _defaultResponse: StubResponse | null = null;

  constructor(name: string) {
    this.name = name;
  }

  withArgs(...args: (string | ArgMatcher)[]): StubConfig {
    const entry: StubEntry = { pattern: args, response: { stdout: '', exitCode: 0 } };
    this._stubs.push(entry);
    return {
      returns(response: StubResponse) {
        entry.response = { exitCode: 0, ...response };
      },
    };
  }

  default(): StubConfig {
    return {
      returns: (response: StubResponse) => {
        this._defaultResponse = { exitCode: 0, ...response };
      },
    };
  }

  resolve(args: string[]): StubResponse {
    // Find a specific match first
    for (const stub of this._stubs) {
      if (matchArgs(args, stub.pattern)) {
        const response = stub.response;
        this._calls.push({
          args,
          timestamp: Date.now(),
          exitCode: response.exitCode ?? 0,
        });
        return response;
      }
    }

    // Fall back to default
    if (this._defaultResponse) {
      this._calls.push({
        args,
        timestamp: Date.now(),
        exitCode: this._defaultResponse.exitCode ?? 0,
      });
      return this._defaultResponse;
    }

    throw new Error(
      `No matching stub for ${this.name} with args: [${args.join(', ')}]. ` +
      `Configure a stub with .withArgs() or .default().returns()`
    );
  }

  get calls(): ReadonlyArray<SpyCall> {
    return this._calls;
  }

  findCall(...matchers: (string | ArgMatcher)[]): SpyCall | undefined {
    return this._calls.find(call => matchArgs(call.args, matchers));
  }

  reset(): void {
    this._calls = [];
    this._stubs = [];
    this._defaultResponse = null;
  }
}
