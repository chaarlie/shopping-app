import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { S3ImportObjectStore } from '../src/imports/storage/s3-import-object-store.js';
const endpoint = process.env.IMPORT_STORAGE_ENDPOINT ?? 'http://localhost:9100';
const store = new S3ImportObjectStore(
  new ConfigService({
    IMPORT_STORAGE_ENDPOINT: endpoint,
    IMPORT_STORAGE_PUBLIC_ENDPOINT: endpoint,
    IMPORT_STORAGE_BUCKET: 'stockroom-imports',
    IMPORT_STORAGE_ACCESS_KEY:
      process.env.IMPORT_STORAGE_ACCESS_KEY ?? 'stockroom-local',
    IMPORT_STORAGE_SECRET_KEY:
      process.env.IMPORT_STORAGE_SECRET_KEY ?? 'local-only-storage-password',
  }),
);
afterAll(() => store.onModuleDestroy());
it('uploads parts directly, verifies sizes, completes, streams and downloads a private object', async () => {
  const key = `tests/${randomUUID()}`;
  const id = await store.start(key);
  try {
    const first = Buffer.alloc(5 * 1024 * 1024, 65);
    const second = Buffer.from('last part');
    const upload = async (number: number, body: Buffer) => {
      const response = await fetch(await store.signPart(key, id, number), {
        method: 'PUT',
        body: new Uint8Array(body),
      });
      expect(response.status).toBe(200);
    };
    await upload(1, first);
    await upload(1, first);
    await upload(2, second);
    const parts = await store.parts(key, id);
    expect(parts.map((p) => p.size)).toEqual([first.length, second.length]);
    expect(await store.size(key)).toBeNull();
    await store.complete(key, id, parts);
    expect(await store.size(key)).toBe(first.length + second.length);
    const bytes: Buffer[] = [];
    for await (const chunk of await store.read(key)) {
      bytes.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(bytes)).toEqual(Buffer.concat([first, second]));
    expect((await fetch(`${endpoint}/stockroom-imports/${key}`)).status).toBe(
      403,
    );
    const download = await fetch(await store.download(key, 'catalog.csv'));
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain(
      'catalog.csv',
    );
    await download.body?.cancel();
    const signed = new URL(await store.signPart(key, id, 1));
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('900');
  } finally {
    await store.abort(key, id);
    await store.remove(key);
  }
});
it('cancels an unfinished upload and safely repeats cancellation', async () => {
  const key = `tests/${randomUUID()}`;
  const id = await store.start(key);
  const url = await store.signPart(key, id, 1);
  await store.abort(key, id);
  await store.abort(key, id);
  expect(
    (await fetch(url, { method: 'PUT', body: 'abandoned' })).status,
  ).not.toBe(200);
  expect(await store.size(key)).toBeNull();
});
