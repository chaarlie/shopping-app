import { Command } from '@nestjs/cqrs';
import { UpdateProductInput } from '@shop/contracts';
import { ProductEntity } from '../entities/product.entity.js';

export class UpdateProductCommand extends Command<ProductEntity> {
  constructor(
    public readonly id: number,
    public readonly input: UpdateProductInput,
  ) {
    super();
  }
}
