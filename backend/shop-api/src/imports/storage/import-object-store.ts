import type { Readable } from 'node:stream';
export type ObjectPart = { number: number; etag: string; size: number };
export abstract class ImportObjectStore {
  abstract start(key: string): Promise<string>;
  abstract signPart(
    key: string,
    uploadId: string,
    number: number,
  ): Promise<string>;
  abstract parts(key: string, uploadId: string): Promise<ObjectPart[]>;
  abstract complete(
    key: string,
    uploadId: string,
    parts: ObjectPart[],
  ): Promise<void>;
  abstract size(key: string): Promise<number | null>;
  abstract read(key: string): Promise<Readable>;
  abstract download(key: string, filename: string): Promise<string>;
  abstract abort(key: string, uploadId: string): Promise<void>;
  abstract remove(key: string): Promise<void>;
}
