import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TestRunner } from '../src/index.js';

describe('TestRunner', () => {
  it('should discover test files matching a glob pattern', async () => {
    // Create temp dir with some spec files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-runner-'));
    fs.writeFileSync(path.join(tmpDir, 'foo.spec.ts'), 'test("foo", () => {})');
    fs.writeFileSync(path.join(tmpDir, 'bar.spec.ts'), 'test("bar", () => {})');
    fs.writeFileSync(path.join(tmpDir, 'helper.ts'), 'export const x = 1;');

    const files = await TestRunner.discover(path.join(tmpDir, '**/*.spec.ts'));

    expect(files).toHaveLength(2);
    expect(files.some(f => f.endsWith('foo.spec.ts'))).toBe(true);
    expect(files.some(f => f.endsWith('bar.spec.ts'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should run tasks in parallel using worker pool', async () => {
    const results: string[] = [];
    const suites = [
      { name: 'suite-a', run: async () => { results.push('a'); return 'a'; } },
      { name: 'suite-b', run: async () => { results.push('b'); return 'b'; } },
      { name: 'suite-c', run: async () => { results.push('c'); return 'c'; } },
    ];

    const runResults = await TestRunner.run(suites, { maxWorkers: 2 });

    expect(results).toHaveLength(3);
    expect(runResults.total).toBe(3);
    expect(runResults.passed).toBe(3);
    expect(runResults.failed).toBe(0);
  });

  it('should track failed suites', async () => {
    const suites = [
      { name: 'ok', run: async () => 'ok' },
      { name: 'fail', run: async () => { throw new Error('boom'); } },
    ];

    const runResults = await TestRunner.run(suites, { maxWorkers: 2 });

    expect(runResults.total).toBe(2);
    expect(runResults.passed).toBe(1);
    expect(runResults.failed).toBe(1);
    expect(runResults.errors).toHaveLength(1);
    expect(runResults.errors[0].suite).toBe('fail');
  });

  it('should run serial suites sequentially', async () => {
    const order: string[] = [];

    const suites = [
      {
        name: 'serial-1',
        serial: true,
        run: async () => {
          order.push('start-1');
          await new Promise(r => setTimeout(r, 30));
          order.push('end-1');
          return '1';
        },
      },
      {
        name: 'serial-2',
        serial: true,
        run: async () => {
          order.push('start-2');
          await new Promise(r => setTimeout(r, 10));
          order.push('end-2');
          return '2';
        },
      },
    ];

    await TestRunner.run(suites, { maxWorkers: 4 });

    // Serial suites must run in order: start-1, end-1, start-2, end-2
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });
});
