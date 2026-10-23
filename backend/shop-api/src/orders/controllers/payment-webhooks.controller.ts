import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { paymentEventSchema } from '@shop/contracts';
import type { PaymentEvent } from '@shop/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PaymentWebhookSignatureGuard } from '../access/payment-webhook-signature.guard.js';
import {
  PaymentEventResult,
  RecordPaymentEventCommand,
} from '../commands/record-payment-event.command.js';

@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(PaymentWebhookSignatureGuard)
  async receive(
    @Body(new ZodValidationPipe(paymentEventSchema)) event: PaymentEvent,
  ): Promise<{ received: true; outcome: PaymentEventResult }> {
    const outcome = await this.commandBus.execute(
      new RecordPaymentEventCommand(event),
    );

    return { received: true, outcome };
  }
}
