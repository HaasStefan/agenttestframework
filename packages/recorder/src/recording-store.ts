import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Recording } from '@agent-test/core';

export class RecordingStore {
  static async save(recording: Recording, dir: string): Promise<void> {
    const filePath = path.join(dir, `${recording.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(recording, null, 2), 'utf-8');
  }

  static async load(id: string, dir: string): Promise<Recording> {
    const filePath = path.join(dir, `${id}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as Recording;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new Error(`Recording "${id}" not found in ${dir}`);
      }
      throw err;
    }
  }
}
