import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ShimManager, SpyImpl } from '../src/index.js';

const execFileAsync = promisify(execFile);

describe('Shim IPC — shim script ↔ test process', () => {
  const managers: ShimManager[] = [];

  afterEach(async () => {
    for (const m of managers) {
      await m.destroy();
    }
    managers.length = 0;
  });

  it('should produce stubbed stdout and exit code when spawned', async () => {
    const manager = await ShimManager.create();
    managers.push(manager);

    const spy = new SpyImpl('git');
    spy.withArgs('status').returns({ stdout: 'M  src/index.ts' });
    manager.registerSpy('git', spy);
    await manager.createShim('git');

    const { stdout } = await execFileAsync(`${manager.binDir}/git`, ['status'], {
      env: { ...process.env, AGENT_TEST_SHIM_DIR: manager.binDir },
    });
    expect(stdout.trim()).toBe('M  src/index.ts');
  });

  it('should handle two concurrent shim invocations', async () => {
    const manager = await ShimManager.create();
    managers.push(manager);

    const spy = new SpyImpl('git');
    spy.withArgs('status').returns({ stdout: 'status output' });
    spy.withArgs('diff').returns({ stdout: 'diff output' });
    manager.registerSpy('git', spy);
    await manager.createShim('git');

    const env = { ...process.env, AGENT_TEST_SHIM_DIR: manager.binDir };
    const [result1, result2] = await Promise.all([
      execFileAsync(`${manager.binDir}/git`, ['status'], { env }),
      execFileAsync(`${manager.binDir}/git`, ['diff'], { env }),
    ]);

    expect(result1.stdout.trim()).toBe('status output');
    expect(result2.stdout.trim()).toBe('diff output');
  });

  it('should exit with error code when no matching stub and no default', async () => {
    const manager = await ShimManager.create();
    managers.push(manager);

    const spy = new SpyImpl('git');
    manager.registerSpy('git', spy);
    await manager.createShim('git');

    try {
      await execFileAsync(`${manager.binDir}/git`, ['unknown'], {
        env: { ...process.env, AGENT_TEST_SHIM_DIR: manager.binDir },
      });
      expect.fail('Should have exited with non-zero');
    } catch (err: any) {
      expect(err.code).not.toBe(0);
    }
  });

  it('should record the shim invocation as a SpyCall', async () => {
    const manager = await ShimManager.create();
    managers.push(manager);

    const spy = new SpyImpl('git');
    spy.default().returns({ stdout: 'ok' });
    manager.registerSpy('git', spy);
    await manager.createShim('git');

    await execFileAsync(`${manager.binDir}/git`, ['log', '--oneline'], {
      env: { ...process.env, AGENT_TEST_SHIM_DIR: manager.binDir },
    });

    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0].args).toEqual(['log', '--oneline']);
  });
});
