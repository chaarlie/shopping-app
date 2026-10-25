import { Public } from '../../admin/access.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  orderReferenceSchema,
  placeOrderSchema,
  retryPaymentSchema,
} from '@shop/contracts';
import type {
  Order,
  PlaceOrderInput,
  RetryPaymentInput,
} from '@shop/contracts';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { IdempotencyKey } from '../../common/decorators/idempotency-key.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { OrderAccess } from '../access/order-access.js';
import { OrderAccessGuard } from '../access/order-access.guard.js';
import { PlaceOrderCommand } from '../commands/place-order.command.js';
import { StartPaymentAttemptCommand } from '../commands/start-payment-attempt.command.js';
import { OrderEventStream } from '../live/order-event-stream.js';
import { PaymentAttemptSubmitter } from '../payments/payment-attempt-submitter.js';
import { GetOrderQuery } from '../queries/get-order.query.js';

@Public()
@Controller('orders')
export class OrdersRestController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly access: OrderAccess,
    private readonly submitter: PaymentAttemptSubmitter,
    private readonly stream: OrderEventStream,
  ) {}

  @Post()
  async place(
    @IdempotencyKey() idempotencyKey: string,
    @Body(new ZodValidationPipe(placeOrderSchema)) input: PlaceOrderInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Order> {
    const { order, attempt } = await this.commandBus.execute(
      new PlaceOrderCommand(input, idempotencyKey),
    );

    this.access.grant(response, order.reference);
    await this.submitter.submit(order, attempt, input.card);

    return this.queryBus.execute(new GetOrderQuery(order.reference));
  }

  @Get(':reference')
  @UseGuards(OrderAccessGuard)
  get(
    @Param('reference', new ZodValidationPipe(orderReferenceSchema))
    reference: string,
  ): Promise<Order> {
    return this.queryBus.execute(new GetOrderQuery(reference));
  }

  @Sse(':reference/events')
  @UseGuards(OrderAccessGuard)
  events(
    @Param('reference', new ZodValidationPipe(orderReferenceSchema))
    reference: string,
  ): Observable<MessageEvent> {
    return this.stream.open(reference);
  }

  @Post(':reference/payments')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OrderAccessGuard)
  async retryPayment(
    @Param('reference', new ZodValidationPipe(orderReferenceSchema))
    reference: string,
    @IdempotencyKey() idempotencyKey: string,
    @Body(new ZodValidationPipe(retryPaymentSchema))
    { card }: RetryPaymentInput,
  ): Promise<Order> {
    const { order, attempt } = await this.commandBus.execute(
      new StartPaymentAttemptCommand(reference, idempotencyKey),
    );

    await this.submitter.submit(order, attempt, card);

    return this.queryBus.execute(new GetOrderQuery(reference));
  }
}
