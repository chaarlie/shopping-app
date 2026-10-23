import { Command } from '@nestjs/cqrs';

export class SettleDuePaymentsCommand extends Command<number> {
  constructor(public readonly limit: number) {
    super();
  }
}
