import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module.js';
import { OrderAccess } from './access/order-access.js';
import { OrderAccessGuard } from './access/order-access.guard.js';
import { PaymentWebhookSignatureGuard } from './access/payment-webhook-signature.guard.js';
import { MarkOrderRefundedCommandHandler } from './commands/handlers/mark-order-refunded-command.handler.js';
import { PlaceOrderCommandHandler } from './commands/handlers/place-order-command.handler.js';
import { ReconcileOrderCommandHandler } from './commands/handlers/reconcile-order-command.handler.js';
import { RecordPaymentEventCommandHandler } from './commands/handlers/record-payment-event-command.handler.js';
import { RecordPaymentSubmissionCommandHandler } from './commands/handlers/record-payment-submission-command.handler.js';
import { StartPaymentAttemptCommandHandler } from './commands/handlers/start-payment-attempt-command.handler.js';
import { OrdersRestController } from './controllers/orders-rest.controller.js';
import { PaymentWebhooksController } from './controllers/payment-webhooks.controller.js';
import { OrderLineEntity } from './entities/order-line.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity.js';
import { ProcessedPaymentEventEntity } from './entities/processed-payment-event.entity.js';
import { OrderReconciliationJob } from './jobs/order-reconciliation.job.js';
import { OrderEventStream } from './live/order-event-stream.js';
import { OrderUpdatesListener } from './live/order-updates.listener.js';
import { OrderUpdatesPublisher } from './order-updates.publisher.js';
import { HttpPaymentsGateway } from './payments/http-payments-gateway.js';
import { PaymentAttemptSubmitter } from './payments/payment-attempt-submitter.js';
import { PaymentsGateway } from './payments/payments-gateway.js';
import { FindOrdersToReconcileQueryHandler } from './queries/handlers/find-orders-to-reconcile-query.handler.js';
import { GetOrderQueryHandler } from './queries/handlers/get-order-query.handler.js';
import { OrderRepository } from './repositories/order.repository.js';
import { ProcessedPaymentEventRepository } from './repositories/processed-payment-event.repository.js';
import { TypeOrmOrderRepository } from './repositories/typeorm-order.repository.js';
import { TypeOrmProcessedPaymentEventRepository } from './repositories/typeorm-processed-payment-event.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderLineEntity,
      PaymentAttemptEntity,
      ProcessedPaymentEventEntity,
    ]),
    ProductsModule,
  ],
  controllers: [OrdersRestController, PaymentWebhooksController],
  providers: [
    {
      provide: OrderRepository,
      useClass: TypeOrmOrderRepository,
    },
    {
      provide: ProcessedPaymentEventRepository,
      useClass: TypeOrmProcessedPaymentEventRepository,
    },
    {
      provide: PaymentsGateway,
      useClass: HttpPaymentsGateway,
    },
    OrderAccess,
    OrderAccessGuard,
    PaymentWebhookSignatureGuard,
    OrderUpdatesPublisher,
    OrderUpdatesListener,
    OrderEventStream,
    PaymentAttemptSubmitter,
    PlaceOrderCommandHandler,
    StartPaymentAttemptCommandHandler,
    RecordPaymentSubmissionCommandHandler,
    RecordPaymentEventCommandHandler,
    ReconcileOrderCommandHandler,
    MarkOrderRefundedCommandHandler,
    GetOrderQueryHandler,
    FindOrdersToReconcileQueryHandler,
    OrderReconciliationJob,
  ],
})
export class OrdersModule {}
