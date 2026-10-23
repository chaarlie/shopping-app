import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module.js';
import { OrderAccess } from './access/order-access.js';
import { OrderAccessGuard } from './access/order-access.guard.js';
import { PlaceOrderCommandHandler } from './commands/handlers/place-order-command.handler.js';
import { RecordPaymentSubmissionCommandHandler } from './commands/handlers/record-payment-submission-command.handler.js';
import { StartPaymentAttemptCommandHandler } from './commands/handlers/start-payment-attempt-command.handler.js';
import { OrdersRestController } from './controllers/orders-rest.controller.js';
import { OrderLineEntity } from './entities/order-line.entity.js';
import { OrderEntity } from './entities/order.entity.js';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity.js';
import { OrderUpdatesPublisher } from './order-updates.publisher.js';
import { HttpPaymentsGateway } from './payments/http-payments-gateway.js';
import { PaymentAttemptSubmitter } from './payments/payment-attempt-submitter.js';
import { PaymentsGateway } from './payments/payments-gateway.js';
import { GetOrderQueryHandler } from './queries/handlers/get-order-query.handler.js';
import { OrderRepository } from './repositories/order.repository.js';
import { TypeOrmOrderRepository } from './repositories/typeorm-order.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderLineEntity,
      PaymentAttemptEntity,
    ]),
    ProductsModule,
  ],
  controllers: [OrdersRestController],
  providers: [
    {
      provide: OrderRepository,
      useClass: TypeOrmOrderRepository,
    },
    {
      provide: PaymentsGateway,
      useClass: HttpPaymentsGateway,
    },
    OrderAccess,
    OrderAccessGuard,
    OrderUpdatesPublisher,
    PaymentAttemptSubmitter,
    PlaceOrderCommandHandler,
    StartPaymentAttemptCommandHandler,
    RecordPaymentSubmissionCommandHandler,
    GetOrderQueryHandler,
  ],
})
export class OrdersModule {}
