import { ConfigService } from '@nestjs/config';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  startImportUploadSchema,
  uploadPartNumberSchema,
  type StartImportUpload,
} from '@shop/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { Request } from 'express';
import {
  StartUploadCommand,
  CompleteUploadCommand,
  CancelUploadCommand,
} from './upload.commands.js';
import { UploadPartQuery, UploadStatusQuery } from './upload-query.handlers.js';
@Controller('admin/import-uploads')
export class UploadsRestController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly config: ConfigService,
  ) {}
  @Get('settings')
  settings() {
    const enabled = Boolean(this.config.get('IMPORT_STORAGE_ENDPOINT'));
    return {
      enabled,
      maxFileBytes: enabled
        ? this.config.get<number>('IMPORT_MAX_FILE_BYTES', 5_000_000)
        : 1_000_000,
      maxRows: this.config.get<number>('IMPORT_MAX_ROWS', 5_000),
    };
  }
  @Post()
  start(
    @Req() req: Request & { admin: { id: number } },
    @Body(new ZodValidationPipe(startImportUploadSchema))
    input: StartImportUpload,
  ) {
    return this.commands.execute(new StartUploadCommand(req.admin.id, input));
  }
  @Get(':id')
  status(
    @Req() req: Request & { admin: { id: number } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queries.execute(new UploadStatusQuery(req.admin.id, id));
  }
  @Get(':id/parts/:number')
  part(
    @Req() req: Request & { admin: { id: number } },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('number', new ZodValidationPipe(uploadPartNumberSchema))
    number: number,
  ) {
    return this.queries.execute(new UploadPartQuery(req.admin.id, id, number));
  }
  @Post(':id/complete')
  complete(
    @Req() req: Request & { admin: { id: number } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commands.execute(new CompleteUploadCommand(req.admin.id, id));
  }
  @Post(':id/cancel')
  cancel(
    @Req() req: Request & { admin: { id: number } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commands.execute(new CancelUploadCommand(req.admin.id, id));
  }
}
