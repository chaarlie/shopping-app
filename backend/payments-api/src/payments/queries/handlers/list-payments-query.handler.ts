import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaymentList } from '@shop/contracts';
import { toPayment } from '../../payment.mapper.js';
import { PaymentRepository } from '../../repositories/payment.repository.js';
import { ListPaymentsQuery } from '../list-payments.query.js';

@QueryHandler(ListPaymentsQuery)
export class ListPaymentsQueryHandler implements IQueryHandler<ListPaymentsQuery> {
  constructor(private readonly payments: PaymentRepository) {}

  async execute({ orderReference }: ListPaymentsQuery): Promise<PaymentList> {
    const payments = await this.payments.findByOrderReference(orderReference);

    return { items: payments.map(toPayment) };
  }
}
