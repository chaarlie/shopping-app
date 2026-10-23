import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { createPaymentSchema, paymentListQuerySchema } from '@shop/contracts';
import type {
  CreatePaymentInput,
  Payment,
  PaymentList,
  PaymentListQuery,
} from '@shop/contracts';
import { IdempotencyKey } from '../../common/decorators/idempotency-key.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CreatePaymentCommand } from '../commands/create-payment.command.js';
import { RefundPaymentCommand } from '../commands/refund-payment.command.js';
import { toPayment } from '../payment.mapper.js';
import { ListPaymentsQuery } from '../queries/list-payments.query.js';

@Controller('payments')
export class PaymentsRestController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(
    @IdempotencyKey() idempotencyKey: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) input: CreatePaymentInput,
  ): Promise<Payment> {
    return toPayment(
      await this.commandBus.execute(
        new CreatePaymentCommand(input, idempotencyKey),
      ),
    );
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(paymentListQuerySchema))
    { orderReference }: PaymentListQuery,
  ): Promise<PaymentList> {
    return this.queryBus.execute(new ListPaymentsQuery(orderReference));
  }

  @Post(':id/refunds')
  @HttpCode(HttpStatus.OK)
  async refund(
    @Param('id', new ParseUUIDPipe()) id: string,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<Payment> {
    return toPayment(
      await this.commandBus.execute(
        new RefundPaymentCommand(id, idempotencyKey),
      ),
    );
  }
}
