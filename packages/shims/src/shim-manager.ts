import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';
import type { SpyImpl } from './spy-impl.js';

export class ShimManager {
  readonly binDir: string;
  private _spies = new Map<string, SpyImpl>();
  private _server: http.Server | null = null;
  private _port: number = 0;

  private constructor(binDir: string) {
    this.binDir = binDir;
  }

  static async create(dir?: string): Promise<ShimManager> {
    const binDir = dir ?? await fs.mkdtemp(path.join(os.tmpdir(), 'agent-test-shims-'));
    const manager = new ShimManager(binDir);
    await manager._startServer();
    return manager;
  }

  registerSpy(name: string, spy: SpyImpl): void {
    this._spies.set(name, spy);
  }

  getSpy(name: string): SpyImpl | undefined {
    return this._spies.get(name);
  }

  async createShim(name: string): Promise<void> {
    const shimPath = path.join(this.binDir, name);
    // The shim script makes an HTTP request to the test process server
    const script = `#!/usr/bin/env node
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';

const args = process.argv.slice(2);
const shimName = '${name}';
const shimDir = '${this.binDir}';
const port = ${this._port};

function passthrough() {
  // Find the real binary by searching PATH without our shim dir
  const dirs = (process.env.PATH || '').split(delimiter).filter(d => d !== shimDir);
  let realBin = null;
  for (const dir of dirs) {
    const candidate = join(dir, shimName);
    if (existsSync(candidate)) {
      realBin = candidate;
      break;
    }
  }
  if (!realBin) {
    process.stderr.write('Command not found: ' + shimName + '\\n');
    process.exit(127);
  }
  const result = spawnSync(realBin, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, PATH: dirs.join(delimiter) },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const payload = JSON.stringify({ name: shimName, args });

const req = http.request({
  hostname: '127.0.0.1',
  port,
  path: '/resolve',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      if (response.passthrough) {
        passthrough();
        return;
      }
      if (response.error) {
        process.stderr.write(response.error + '\\n');
        process.exit(1);
      }
      if (response.stdout) process.stdout.write(response.stdout);
      if (response.stderr) process.stderr.write(response.stderr);
      process.exit(response.exitCode ?? 0);
    } catch {
      process.stderr.write('Failed to parse shim response\\n');
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  // Server not reachable — passthrough to real binary
  passthrough();
});

req.write(payload);
req.end();
`;
    await fs.writeFile(shimPath, script, { mode: 0o755 });
  }

  private async _startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/resolve') {
          let body = '';
          req.on('data', (chunk) => body += chunk);
          req.on('end', () => {
            try {
              const { name, args } = JSON.parse(body);
              const spy = this._spies.get(name);
              if (!spy) {
                // No spy registered — passthrough to real binary
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ passthrough: true }));
                return;
              }
              const response = spy.resolve(args);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              if (response === null) {
                // No matching stub — passthrough to real binary
                res.end(JSON.stringify({ passthrough: true }));
              } else {
                res.end(JSON.stringify(response));
              }
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid request' }));
            }
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this._server.listen(0, '127.0.0.1', () => {
        const addr = this._server!.address();
        if (typeof addr === 'object' && addr) {
          this._port = addr.port;
        }
        resolve();
      });

      this._server.on('error', reject);
    });
  }

  async destroy(): Promise<void> {
    if (this._server) {
      await new Promise<void>((resolve) => this._server!.close(() => resolve()));
      this._server = null;
    }
    try {
      await fs.rm(this.binDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
