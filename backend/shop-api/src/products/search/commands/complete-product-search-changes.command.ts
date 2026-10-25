import { Command } from '@nestjs/cqrs';

export class CompleteProductSearchChangesCommand extends Command<void> {
  constructor(public readonly ids: string[]) {
    super();
  }
}
