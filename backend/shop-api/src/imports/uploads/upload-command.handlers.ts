import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional, Propagation } from '@nestjs-cls/transactional';
import { randomUUID } from 'node:crypto';
import { ConflictError, ValidationError } from '../../common/errors.js';
import { ImportObjectStore } from '../storage/import-object-store.js';
import { UploadRepository, uploadView } from './upload.repository.js';
import {
  StartUploadCommand,
  CompleteUploadCommand,
  CancelUploadCommand,
} from './upload.commands.js';
import { verifyUploadParts } from './upload-parts.js';
@CommandHandler(StartUploadCommand)
export class StartUploadCommandHandler implements ICommandHandler<StartUploadCommand> {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly store: ImportObjectStore,
    private readonly config: ConfigService,
  ) {}
  @Transactional(Propagation.NotSupported)
  async execute({ adminId, input }: StartUploadCommand) {
    const limit = this.config.get<number>('IMPORT_MAX_FILE_BYTES', 5_000_000);
    if (input.size > limit) {
      throw new ValidationError(
        `Choose a CSV file up to ${limit / 1_000_000} MB`,
      );
    }
    const id = randomUUID();
    await this.uploads.create(id, adminId, input);
    const row = await this.uploads.owned(id, adminId);
    let multipartId: string;
    try {
      multipartId = await this.store.start(row.object_key);
    } catch (error) {
      await this.uploads.cancel(id);
      throw error;
    }
    if (!(await this.uploads.attach(id, multipartId))) {
      await this.store.abort(row.object_key, multipartId);
      throw new ConflictError('Upload was cancelled');
    }
    return uploadView(await this.uploads.owned(id, adminId));
  }
}
@CommandHandler(CompleteUploadCommand)
export class CompleteUploadCommandHandler implements ICommandHandler<CompleteUploadCommand> {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly store: ImportObjectStore,
  ) {}
  @Transactional(Propagation.NotSupported)
  async execute({ adminId, id }: CompleteUploadCommand) {
    const row = await this.uploads.owned(id, adminId);
    if (['queued', 'processing', 'ready'].includes(row.state)) {
      return uploadView(row);
    }
    const token = randomUUID();
    if (!row.multipart_id || !(await this.uploads.claimCompletion(id, token))) {
      throw new ConflictError(
        'Upload is unavailable or completion is already running. Retry shortly.',
      );
    }
    try {
      const size = Number(row.size);
      if ((await this.store.size(row.object_key)) === null) {
        const parts = verifyUploadParts(
          await this.store.parts(row.object_key, row.multipart_id),
          size,
        );
        await this.store.complete(row.object_key, row.multipart_id, parts);
      }
      if ((await this.store.size(row.object_key)) !== size) {
        throw new ValidationError(
          'Uploaded file size does not match the declared size',
        );
      }
      if (!(await this.uploads.queue(id, token))) {
        throw new ConflictError(
          'Upload completion was superseded. Reload its status.',
        );
      }
      return uploadView(await this.uploads.owned(id, adminId));
    } catch (error) {
      await this.uploads.release(id, token);
      throw error;
    }
  }
}
@CommandHandler(CancelUploadCommand)
export class CancelUploadCommandHandler implements ICommandHandler<CancelUploadCommand> {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly store: ImportObjectStore,
  ) {}
  @Transactional(Propagation.NotSupported)
  async execute({ adminId, id }: CancelUploadCommand) {
    const row = await this.uploads.owned(id, adminId);
    if (!(await this.uploads.cancel(id))) {
      throw new ConflictError('This upload has already entered processing');
    }
    if (row.multipart_id) {
      await this.store.abort(row.object_key, row.multipart_id);
    }
    await this.store.remove(row.object_key);
    return uploadView(await this.uploads.owned(id, adminId));
  }
}
