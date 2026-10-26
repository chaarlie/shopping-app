import { describe, expect, it } from 'vitest';
import { SerialTasks } from './serial-tasks';
describe('serial editing tasks', () => {
  it('waits for the previous acknowledgement before reading the next version', async () => {
    const queue = new SerialTasks();
    let version = 1;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen: number[] = [];
    const first = queue.run(async () => {
      seen.push(version);
      await gate;
      version = 2;
    });
    const second = queue.run(async () => {
      seen.push(version);
    });
    await Promise.resolve();
    expect(seen).toEqual([1]);
    release();
    await Promise.all([first, second]);
    expect(seen).toEqual([1, 2]);
  });
  it('reports a failed save and still permits an explicit later retry', async () => {
    const queue = new SerialTasks();
    await expect(
      queue.run(async () => {
        throw new Error('Save failed');
      }),
    ).rejects.toThrow('Save failed');
    await expect(queue.run(async () => 'saved')).resolves.toBe('saved');
  });
});
