import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  createProductSchema,
  productSearchQuerySchema,
  updateProductSchema,
} from '@shop/contracts';
import type {
  CreateProductInput,
  Product,
  ProductPage,
  ProductSearchQuery,
  UpdateProductInput,
} from '@shop/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CreateProductCommand } from '../commands/create-product.command.js';
import { DeleteProductCommand } from '../commands/delete-product.command.js';
import { UpdateProductCommand } from '../commands/update-product.command.js';
import { toProduct } from '../product.mapper.js';
import { GetProductQuery } from '../queries/get-product.query.js';
import { ListProductsQuery } from '../queries/list-products.query.js';
import { SearchProductsQuery } from '../search/queries/search-products.query.js';

@Controller('products')
export class ProductsRestController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(productSearchQuerySchema))
    query: ProductSearchQuery,
  ): Promise<ProductPage> {
    return this.queryBus.execute(
      query.q ? new SearchProductsQuery(query) : new ListProductsQuery(query),
    );
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    return this.queryBus.execute(new GetProductQuery(id));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createProductSchema)) input: CreateProductInput,
  ): Promise<Product> {
    return toProduct(
      await this.commandBus.execute(new CreateProductCommand(input)),
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateProductSchema)) input: UpdateProductInput,
  ): Promise<Product> {
    return toProduct(
      await this.commandBus.execute(new UpdateProductCommand(id, input)),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.commandBus.execute(new DeleteProductCommand(id));
  }
}
