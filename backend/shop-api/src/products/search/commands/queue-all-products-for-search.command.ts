import { Command } from '@nestjs/cqrs';

export class QueueAllProductsForSearchCommand extends Command<number> {}
