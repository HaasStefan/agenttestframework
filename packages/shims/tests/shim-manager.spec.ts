import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { ShimManager } from '../src/index.js';

describe('ShimManager', () => {
  const managers: ShimManager[] = [];

  afterEach(async () => {
    for (const m of managers) {
      await m.destroy();
    }
    managers.length = 0;
  });

  it('should create a temp directory that exists on disk', async () => {
    const manager = await ShimManager.create();
    managers.push(manager);
    expect(fs.existsSync(manager.binDir)).toBe(true);
  });

  it('should create an executable shim file', async () => {
    const manager = await ShimManager.create();
    managers.push(manager);
    await manager.createShim('git');

    const shimPath = `${manager.binDir}/git`;
    expect(fs.existsSync(shimPath)).toBe(true);
    fs.accessSync(shimPath, fs.constants.X_OK);
  });

  it('should remove the temp directory on destroy', async () => {
    const manager = await ShimManager.create();
    const dir = manager.binDir;
    await manager.destroy();
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('should create different directories for different managers', async () => {
    const m1 = await ShimManager.create();
    const m2 = await ShimManager.create();
    managers.push(m1, m2);
    expect(m1.binDir).not.toBe(m2.binDir);
  });
});
