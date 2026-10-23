import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksModule } from '../webhooks/webhooks.module.js';
import { CreatePaymentCommandHandler } from './commands/handlers/create-payment-command.handler.js';
import { RefundPaymentCommandHandler } from './commands/handlers/refund-payment-command.handler.js';
import { SettleDuePaymentsCommandHandler } from './commands/handlers/settle-due-payments-command.handler.js';
import { PaymentsRestController } from './controllers/payments-rest.controller.js';
import { PaymentEntity } from './entities/payment.entity.js';
import { ListPaymentsQueryHandler } from './queries/handlers/list-payments-query.handler.js';
import { PaymentRepository } from './repositories/payment.repository.js';
import { TypeOrmPaymentRepository } from './repositories/typeorm-payment.repository.js';
import { PaymentSettlementWorker } from './workers/payment-settlement.worker.js';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity]), WebhooksModule],
  controllers: [PaymentsRestController],
  providers: [
    {
      provide: PaymentRepository,
      useClass: TypeOrmPaymentRepository,
    },
    CreatePaymentCommandHandler,
    SettleDuePaymentsCommandHandler,
    RefundPaymentCommandHandler,
    ListPaymentsQueryHandler,
    PaymentSettlementWorker,
  ],
})
export class PaymentsModule {}
