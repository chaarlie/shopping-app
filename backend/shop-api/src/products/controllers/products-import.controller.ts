import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { productImportOptionsSchema } from '@shop/contracts';
import type {
  ProductImportOptions,
  ProductImportReport,
} from '@shop/contracts';
import { ValidationError } from '../../common/errors.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ImportProductsCommand } from '../commands/import-products.command.js';

const MAX_FILE_BYTES = 1_000_000;

@Controller('products/import')
export class ProductsImportController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query(new ZodValidationPipe(productImportOptionsSchema))
    options: ProductImportOptions,
  ): Promise<ProductImportReport> {
    if (!file) {
      throw new ValidationError('Attach the CSV file in a field named "file"');
    }

    return this.commandBus.execute(
      new ImportProductsCommand(file.buffer.toString('utf8'), options),
    );
  }
}
