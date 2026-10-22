import { Command } from '@nestjs/cqrs';
import { CreateProductInput } from '@shop/contracts';
import { ProductEntity } from '../entities/product.entity.js';

export class CreateProductCommand extends Command<ProductEntity> {
  constructor(public readonly input: CreateProductInput) {
    super();
  }
}
