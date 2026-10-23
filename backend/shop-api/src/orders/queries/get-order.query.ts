import { Query } from '@nestjs/cqrs';
import { Order } from '@shop/contracts';

export class GetOrderQuery extends Query<Order> {
  constructor(public readonly reference: string) {
    super();
  }
}
