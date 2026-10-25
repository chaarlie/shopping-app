import { SignedWebhook } from '../../admin/access.js';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { paymentEventSchema } from '@shop/contracts';
import type { PaymentEvent } from '@shop/contracts';
import { ValidationError } from '../../common/errors.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PaymentWebhookSignatureGuard } from '../access/payment-webhook-signature.guard.js';
import {
  PaymentEventResult,
  RecordPaymentEventCommand,
} from '../commands/record-payment-event.command.js';

@SignedWebhook()
@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(PaymentWebhookSignatureGuard)
  async receive(
    @Body(new ZodValidationPipe(paymentEventSchema)) event: PaymentEvent,
    @Headers('webhook-id') webhookId: string,
  ): Promise<{ received: true; outcome: PaymentEventResult }> {
    if (event.id !== webhookId) {
      throw new ValidationError('Webhook ID must match the payment event ID');
    }

    const outcome = await this.commandBus.execute(
      new RecordPaymentEventCommand(event),
    );

    return { received: true, outcome };
  }
}
