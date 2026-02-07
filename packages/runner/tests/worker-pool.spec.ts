import { describe, it, expect } from 'vitest';
import { WorkerPool } from '../src/index.js';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('WorkerPool', () => {
  it('should complete all submitted tasks', async () => {
    const pool = WorkerPool.create(2);
    const results: number[] = [];

    pool.submit(async () => { results.push(1); return 1; });
    pool.submit(async () => { results.push(2); return 2; });
    pool.submit(async () => { results.push(3); return 3; });
    pool.submit(async () => { results.push(4); return 4; });

    await pool.drain();

    expect(results).toHaveLength(4);
    expect(results.sort()).toEqual([1, 2, 3, 4]);
  });

  it('should respect maxWorkers concurrency limit', async () => {
    const pool = WorkerPool.create(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const createTask = () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(50);
      concurrent--;
    };

    pool.submit(createTask());
    pool.submit(createTask());
    pool.submit(createTask());
    pool.submit(createTask());

    await pool.drain();

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should return task results via drain', async () => {
    const pool = WorkerPool.create(2);

    pool.submit(async () => 'a');
    pool.submit(async () => 'b');
    pool.submit(async () => 'c');

    const results = await pool.drain();
    expect(results.sort()).toEqual(['a', 'b', 'c']);
  });

  it('should handle failing tasks without blocking others', async () => {
    const pool = WorkerPool.create(2);
    const completed: string[] = [];

    pool.submit(async () => { completed.push('ok1'); return 'ok1'; });
    pool.submit(async () => { throw new Error('fail'); });
    pool.submit(async () => { completed.push('ok2'); return 'ok2'; });

    const results = await pool.drain();

    // The two successful tasks complete
    expect(completed).toContain('ok1');
    expect(completed).toContain('ok2');
    // drain returns results for successful + errors for failed
    expect(results).toHaveLength(3);
  });

  it('should work with maxWorkers of 1 (sequential)', async () => {
    const pool = WorkerPool.create(1);
    let concurrent = 0;
    let maxConcurrent = 0;

    const createTask = () => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(10);
      concurrent--;
    };

    pool.submit(createTask());
    pool.submit(createTask());
    pool.submit(createTask());

    await pool.drain();

    expect(maxConcurrent).toBe(1);
  });
});
