import type { PaymentEvent } from '@shop/contracts';

export abstract class OutboxEventRepository {
  abstract add(event: PaymentEvent): Promise<void>;
}
