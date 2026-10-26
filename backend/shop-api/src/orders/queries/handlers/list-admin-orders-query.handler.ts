import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { AdminOrders } from '@shop/contracts';
import { OrderRepository } from '../../repositories/order.repository.js';
import { ListAdminOrdersQuery } from '../list-admin-orders.query.js';
@QueryHandler(ListAdminOrdersQuery)
export class ListAdminOrdersQueryHandler implements IQueryHandler<ListAdminOrdersQuery> {
  constructor(private readonly orders: OrderRepository) {}
  execute({ input }: ListAdminOrdersQuery): Promise<AdminOrders> {
    return this.orders.listForAdmin(input);
  }
}
