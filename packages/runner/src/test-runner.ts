import { glob } from 'node:fs/promises';
import { WorkerPool } from './worker-pool.js';

export interface Suite {
  name: string;
  serial?: boolean;
  run: () => Promise<unknown>;
}

export interface RunOptions {
  maxWorkers?: number;
}

export interface RunResult {
  total: number;
  passed: number;
  failed: number;
  errors: Array<{ suite: string; error: unknown }>;
}

export class TestRunner {
  /**
   * Discover test files matching a glob pattern.
   */
  static async discover(pattern: string): Promise<string[]> {
    const files: string[] = [];
    for await (const entry of glob(pattern)) {
      files.push(entry);
    }
    return files;
  }

  /**
   * Run suites with parallel/serial handling.
   */
  static async run(suites: Suite[], options: RunOptions = {}): Promise<RunResult> {
    const maxWorkers = options.maxWorkers ?? 4;
    const result: RunResult = { total: suites.length, passed: 0, failed: 0, errors: [] };

    // Separate serial and parallel suites
    const serialSuites = suites.filter(s => s.serial);
    const parallelSuites = suites.filter(s => !s.serial);

    // Run parallel suites via worker pool
    if (parallelSuites.length > 0) {
      const pool = WorkerPool.create(maxWorkers);
      for (const suite of parallelSuites) {
        pool.submit(async () => {
          try {
            await suite.run();
            result.passed++;
            return { suite: suite.name, ok: true };
          } catch (err) {
            result.failed++;
            result.errors.push({ suite: suite.name, error: err });
            return { suite: suite.name, ok: false };
          }
        });
      }
      await pool.drain();
    }

    // Run serial suites sequentially
    for (const suite of serialSuites) {
      try {
        await suite.run();
        result.passed++;
      } catch (err) {
        result.failed++;
        result.errors.push({ suite: suite.name, error: err });
      }
    }

    return result;
  }
}
