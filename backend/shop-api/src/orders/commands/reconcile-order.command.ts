import { Command } from '@nestjs/cqrs';
import type { Payment } from '@shop/contracts';
import { ReconciliationDecision } from '../domain/decide-reconciliation.js';

export class ReconcileOrderCommand extends Command<
  ReconciliationDecision['kind']
> {
  constructor(
    public readonly reference: string,
    public readonly payments: Payment[],
  ) {
    super();
  }
}
