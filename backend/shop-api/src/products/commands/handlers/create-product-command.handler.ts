import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Transactional } from '@nestjs-cls/transactional';
import { ConflictError } from '../../../common/errors.js';
import { isUniqueViolation } from '../../../database/errors.js';
import { ProductEntity } from '../../entities/product.entity.js';
import { ProductRepository } from '../../repositories/product.repository.js';
import { CreateProductCommand } from '../create-product.command.js';

@CommandHandler(CreateProductCommand)
export class CreateProductCommandHandler implements ICommandHandler<CreateProductCommand> {
  constructor(private readonly products: ProductRepository) {}

  @Transactional()
  async execute({ input }: CreateProductCommand): Promise<ProductEntity> {
    try {
      return await this.products.create(input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          `A product with SKU ${input.sku} already exists`,
        );
      }

      throw error;
    }
  }
}
