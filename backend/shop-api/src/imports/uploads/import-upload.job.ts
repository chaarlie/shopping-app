import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional, Propagation } from '@nestjs-cls/transactional';
import { randomUUID } from 'node:crypto';
import { IntervalJob } from '../../common/jobs/interval-job.js';
import { ImportObjectStore } from '../storage/import-object-store.js';
import { ImportUploadJobRepository } from './import-upload-job.repository.js';
import { StageUploadCommand } from './stage-upload-command.handler.js';
import {
  planProductImport,
  type ProductImportPlan,
} from '../../products/import/plan-product-import.js';
import { ValidationError } from '../../common/errors.js';
export class ProcessUploadCommand {}
@CommandHandler(ProcessUploadCommand)
export class ProcessUploadCommandHandler implements ICommandHandler<ProcessUploadCommand> {
  private readonly logger = new Logger(ProcessUploadCommandHandler.name);
  constructor(
    private readonly jobs: ImportUploadJobRepository,
    private readonly store: ImportObjectStore,
    private readonly commands: CommandBus,
    private readonly config: ConfigService,
  ) {}
  @Transactional(Propagation.NotSupported)
  async execute() {
    for (const row of await this.jobs.cleanupCandidates()) {
      if (row.multipart_id) {
        await this.store.abort(row.object_key, row.multipart_id);
      }
      await this.store.remove(row.object_key);
      await this.jobs.cleaned(row.id);
    }
    const token = randomUUID();
    const row = await this.jobs.claim(token);
    if (!row) {
      return;
    }
    try {
      const source = await this.store.read(row.object_key);
      const timer = setTimeout(
        () => source.destroy(new Error('Storage read timed out')),
        60_000,
      );
      const chunks: Buffer[] = [];
      let bytes = 0;
      try {
        for await (const chunk of source) {
          const buffer = Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > Number(row.size) || bytes > 10_000_000) {
            throw new ValidationError('Stored file exceeds the accepted size');
          }
          chunks.push(buffer);
        }
      } finally {
        clearTimeout(timer);
        source.destroy();
      }
      if (bytes !== Number(row.size)) {
        throw new ValidationError('Stored file size changed');
      }
      const file = Buffer.concat(chunks);
      let plan: ProductImportPlan = {
        totalRows: 0,
        blankRows: 0,
        ignoredColumns: [],
        rows: [],
      };
      let fileError: string | null = null;
      try {
        plan = planProductImport(
          file.toString('utf8'),
          this.config.get<number>('IMPORT_MAX_ROWS', 5000),
        );
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw error;
        }
        fileError = error.message;
      }
      await this.commands.execute(
        new StageUploadCommand(row.id, token, file, plan, fileError),
      );
    } catch (error) {
      this.logger.error(`Import upload ${row.id} could not be staged`);
      await this.jobs.fail(
        row.id,
        token,
        error instanceof ValidationError,
        error instanceof ValidationError
          ? error.message
          : 'Could not read or stage this file. Retrying up to three times.',
      );
    }
  }
}

@Injectable()
export class ImportUploadJob extends IntervalJob {
  constructor(
    private readonly commands: CommandBus,
    config: ConfigService,
  ) {
    super(
      Boolean(config.get('IMPORT_STORAGE_ENDPOINT')) &&
        config.get('BACKGROUND_JOBS') !== 'off',
      1000,
    );
  }
  async runOnce() {
    await this.commands.execute(new ProcessUploadCommand());
  }
}
