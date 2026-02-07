interface TaskEntry<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason: unknown) => void;
}

export class WorkerPool<T = unknown> {
  private _maxWorkers: number;
  private _active = 0;
  private _queue: TaskEntry<T>[] = [];
  private _results: Promise<T>[] = [];

  private constructor(maxWorkers: number) {
    this._maxWorkers = maxWorkers;
  }

  static create<T = unknown>(maxWorkers: number): WorkerPool<T> {
    return new WorkerPool<T>(maxWorkers);
  }

  submit(fn: () => Promise<T>): void {
    const promise = new Promise<T>((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
    });
    this._results.push(promise);
    this._tryRunNext();
  }

  async drain(): Promise<T[]> {
    // Wait for all tasks, collecting results (including errors as values)
    const settled = await Promise.allSettled(this._results);
    return settled.map(r =>
      r.status === 'fulfilled' ? r.value : (r.reason as T)
    );
  }

  private _tryRunNext(): void {
    while (this._active < this._maxWorkers && this._queue.length > 0) {
      const task = this._queue.shift()!;
      this._active++;
      task.fn()
        .then(value => {
          task.resolve(value);
        })
        .catch(err => {
          task.reject(err);
        })
        .finally(() => {
          this._active--;
          this._tryRunNext();
        });
    }
  }
}
