import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { adminOrdersQuerySchema } from '@shop/contracts';
import type { AdminOrders, AdminOrdersQuery } from '@shop/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ListAdminOrdersQuery } from '../queries/list-admin-orders.query.js';
@Controller('admin/orders')
export class AdminOrdersRestController {
  constructor(private readonly queries: QueryBus) {}
  @Get()
  list(
    @Query(new ZodValidationPipe(adminOrdersQuerySchema))
    input: AdminOrdersQuery,
  ): Promise<AdminOrders> {
    return this.queries.execute(new ListAdminOrdersQuery(input));
  }
}
