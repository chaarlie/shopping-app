import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Order } from '@shop/contracts';
import { NotFoundError } from '../../../common/errors.js';
import { toOrder } from '../../order.mapper.js';
import { OrderRepository } from '../../repositories/order.repository.js';
import { GetOrderQuery } from '../get-order.query.js';

@QueryHandler(GetOrderQuery)
export class GetOrderQueryHandler implements IQueryHandler<GetOrderQuery> {
  constructor(private readonly orders: OrderRepository) {}

  async execute({ reference }: GetOrderQuery): Promise<Order> {
    const found = await this.orders.findByReference(reference);

    if (!found) {
      throw new NotFoundError(`Order ${reference} was not found`);
    }

    return toOrder(found);
  }
}
