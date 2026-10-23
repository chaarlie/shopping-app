import { Query } from '@nestjs/cqrs';
import { PaymentList } from '@shop/contracts';

export class ListPaymentsQuery extends Query<PaymentList> {
  constructor(public readonly orderReference: string) {
    super();
  }
}
