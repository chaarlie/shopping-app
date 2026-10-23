import {
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

export abstract class IntervalJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  protected readonly logger = new Logger(this.constructor.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  protected constructor(
    private readonly enabled: boolean,
    private readonly intervalMs: number,
  ) {}

  abstract runOnce(): Promise<unknown>;

  onApplicationBootstrap(): void {
    if (this.enabled) {
      this.timer = setInterval(() => this.tick(), this.intervalMs);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  private tick(): void {
    if (this.running) {
      return;
    }

    this.running = this.runOnce()
      .then(
        () => undefined,
        (error: unknown) => {
          this.logger.error(
            error instanceof Error ? (error.stack ?? error.message) : error,
          );
        },
      )
      .finally(() => {
        this.running = undefined;
      });
  }
}
