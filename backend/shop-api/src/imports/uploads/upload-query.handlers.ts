import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConflictError } from '../../common/errors.js';
import {
  UploadRepository,
  uploadView,
  assertUploadActive,
} from './upload.repository.js';
import { ImportObjectStore } from '../storage/import-object-store.js';
import { IMPORT_PART_BYTES } from '@shop/contracts';
export class UploadStatusQuery {
  constructor(
    readonly adminId: number,
    readonly id: string,
  ) {}
}
export class UploadPartQuery {
  constructor(
    readonly adminId: number,
    readonly id: string,
    readonly number: number,
  ) {}
}
@QueryHandler(UploadStatusQuery)
export class UploadStatusQueryHandler implements IQueryHandler<UploadStatusQuery> {
  constructor(private readonly uploads: UploadRepository) {}
  async execute({ adminId, id }: UploadStatusQuery) {
    return uploadView(await this.uploads.owned(id, adminId));
  }
}
@QueryHandler(UploadPartQuery)
export class UploadPartQueryHandler implements IQueryHandler<UploadPartQuery> {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly store: ImportObjectStore,
  ) {}
  async execute({ adminId, id, number }: UploadPartQuery) {
    const row = await this.uploads.owned(id, adminId);
    assertUploadActive(row);
    if (number > Math.ceil(Number(row.size) / IMPORT_PART_BYTES)) {
      throw new ConflictError('Part number exceeds this file');
    }
    return {
      url: await this.store.signPart(row.object_key, row.multipart_id!, number),
      expiresIn: 900,
    };
  }
}
