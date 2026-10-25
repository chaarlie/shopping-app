import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  editImportRowSchema,
  importActionSchema,
  importPreviewQuerySchema,
  pageQuerySchema,
} from '@shop/contracts';
import type { z } from 'zod';
import type { Response } from 'express';
import type { AdminRequest } from '../../admin/access.js';
import { ValidationError } from '../../common/errors.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ImportCommand } from '../commands/import.command.js';
import {
  ImportDownloadQuery,
  ImportHistoryQuery,
  ImportPreviewQuery,
} from '../queries/import.query.js';
@Controller('admin/imports')
export class ImportsRestController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}
  @Get()
  history(
    @Query(new ZodValidationPipe(pageQuerySchema))
    query: z.infer<typeof pageQuerySchema>,
  ) {
    return this.queries.execute(
      new ImportHistoryQuery(query.page, query.pageSize),
    );
  }
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1000000 } }))
  upload(
    @Req() req: AdminRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new ValidationError('Attach a CSV file');
    }
    return this.commands.execute(
      new ImportCommand(req.admin.id, {
        kind: 'upload',
        filename: file.originalname.slice(0, 255),
        file: file.buffer,
      }),
    );
  }
  @Get(':id')
  preview(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ZodValidationPipe(importPreviewQuerySchema))
    query: z.infer<typeof importPreviewQuerySchema>,
  ) {
    return this.queries.execute(
      new ImportPreviewQuery(
        id,
        query.page,
        query.pageSize,
        query.status,
        query.sku,
      ),
    );
  }
  @Get(':id/file')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.queries.execute(new ImportDownloadQuery(id));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="import-${id}.csv"; filename*=UTF-8''${encodeURIComponent(result.filename).replace(/'/g, '%27')}`,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(result.file);
  }
  @Patch(':id/rows/:row')
  edit(
    @Req() req: AdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('row', ParseIntPipe) row: number,
    @Body(new ZodValidationPipe(editImportRowSchema))
    input: z.infer<typeof editImportRowSchema>,
  ) {
    return this.commands.execute(
      new ImportCommand(req.admin.id, { kind: 'edit', id, row, ...input }),
    );
  }
  @Post(':id/refresh')
  refresh(
    @Req() req: AdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(importActionSchema))
    input: z.infer<typeof importActionSchema>,
  ) {
    return this.commands.execute(
      new ImportCommand(req.admin.id, { kind: 'refresh', id, ...input }),
    );
  }
  @Post(':id/apply')
  apply(
    @Req() req: AdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(importActionSchema))
    input: z.infer<typeof importActionSchema>,
  ) {
    return this.commands.execute(
      new ImportCommand(req.admin.id, { kind: 'apply', id, ...input }),
    );
  }
}
