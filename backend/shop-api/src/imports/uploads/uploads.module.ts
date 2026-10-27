import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImportObjectStore } from '../storage/import-object-store.js';
import { S3ImportObjectStore } from '../storage/s3-import-object-store.js';
import { ConflictError } from '../../common/errors.js';
import {
  UploadRepository,
  TypeOrmUploadRepository,
} from './upload.repository.js';
import {
  StartUploadCommandHandler,
  CompleteUploadCommandHandler,
  CancelUploadCommandHandler,
} from './upload-command.handlers.js';
import {
  UploadStatusQueryHandler,
  UploadPartQueryHandler,
} from './upload-query.handlers.js';
import { UploadsRestController } from './uploads-rest.controller.js';
import type { Readable } from 'node:stream';
import type { ObjectPart } from '../storage/import-object-store.js';
class DisabledObjectStore extends ImportObjectStore {
  private unavailable(): never {
    throw new ConflictError(
      'Large uploads are not enabled. Start the imports Compose configuration.',
    );
  }
  start(): Promise<string> {
    return this.unavailable();
  }
  signPart(): Promise<string> {
    return this.unavailable();
  }
  parts(): Promise<ObjectPart[]> {
    return this.unavailable();
  }
  complete(): Promise<void> {
    return this.unavailable();
  }
  size(): Promise<number | null> {
    return this.unavailable();
  }
  read(): Promise<Readable> {
    return this.unavailable();
  }
  download(): Promise<string> {
    return this.unavailable();
  }
  abort(): Promise<void> {
    return this.unavailable();
  }
  remove(): Promise<void> {
    return this.unavailable();
  }
}
@Module({
  controllers: [UploadsRestController],
  providers: [
    {
      provide: ImportObjectStore,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('IMPORT_STORAGE_ENDPOINT')
          ? new S3ImportObjectStore(config)
          : new DisabledObjectStore(),
    },
    { provide: UploadRepository, useClass: TypeOrmUploadRepository },
    StartUploadCommandHandler,
    CompleteUploadCommandHandler,
    CancelUploadCommandHandler,
    UploadStatusQueryHandler,
    UploadPartQueryHandler,
  ],
  exports: [ImportObjectStore, UploadRepository],
})
export class UploadsModule {}
