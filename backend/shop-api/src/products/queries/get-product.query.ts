import { Query } from '@nestjs/cqrs';
import { Product } from '@shop/contracts';

export class GetProductQuery extends Query<Product> {
  constructor(public readonly id: number) {
    super();
  }
}
