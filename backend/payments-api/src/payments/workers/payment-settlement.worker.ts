import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { IntervalJob } from '../../common/jobs/interval-job.js';
import { Env } from '../../config/env.schema.js';
import { SettleDuePaymentsCommand } from '../commands/settle-due-payments.command.js';

const BATCH_SIZE = 20;
const INTERVAL_MS = 500;

@Injectable()
export class PaymentSettlementWorker extends IntervalJob {
  constructor(
    private readonly commandBus: CommandBus,
    configService: ConfigService<Env, true>,
  ) {
    super(
      configService.get('BACKGROUND_JOBS', { infer: true }) === 'on',
      INTERVAL_MS,
    );
  }

  runOnce(): Promise<number> {
    return this.commandBus.execute(new SettleDuePaymentsCommand(BATCH_SIZE));
  }
}
