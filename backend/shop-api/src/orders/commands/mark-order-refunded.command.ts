import { Command } from '@nestjs/cqrs';

export class MarkOrderRefundedCommand extends Command<boolean> {
  constructor(public readonly reference: string) {
    super();
  }
}
