import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import { Observable, Subject } from 'rxjs';
import { Env } from '../../config/env.schema.js';
import { ORDER_UPDATES_CHANNEL } from '../order-updates.publisher.js';

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10_000, 30_000];

@Injectable()
export class OrderUpdatesListener
  implements
    OnApplicationBootstrap,
    BeforeApplicationShutdown,
    OnApplicationShutdown
{
  private readonly logger = new Logger(OrderUpdatesListener.name);
  private readonly watchers = new Map<string, Set<() => void>>();
  private readonly closing = new Subject<void>();
  private readonly databaseUrl: string;
  private client?: pg.Client;
  private reconnectTimer?: NodeJS.Timeout;
  private failures = 0;
  private stopped = false;

  constructor(configService: ConfigService<Env, true>) {
    this.databaseUrl = configService.get('DATABASE_URL', { infer: true });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.connect();
  }

  beforeApplicationShutdown(): void {
    this.stopped = true;
    this.closing.complete();
  }

  async onApplicationShutdown(): Promise<void> {
    clearTimeout(this.reconnectTimer);
    await this.client?.end().catch(() => undefined);
  }

  watch(reference: string): Observable<void> {
    return new Observable<void>((subscriber) => {
      const listener = () => subscriber.next();
      const listeners = this.watchers.get(reference) ?? new Set<() => void>();
      listeners.add(listener);
      this.watchers.set(reference, listeners);
      const closing = this.closing.subscribe({
        complete: () => subscriber.complete(),
      });

      subscriber.next();

      return () => {
        closing.unsubscribe();
        listeners.delete(listener);

        if (listeners.size === 0) {
          this.watchers.delete(reference);
        }
      };
    });
  }

  private async connect(): Promise<void> {
    const client = new pg.Client({ connectionString: this.databaseUrl });
    let lost = false;
    const onLost = (error?: unknown) => {
      if (lost || this.stopped) {
        return;
      }

      lost = true;
      void client.end().catch(() => undefined);
      this.reconnectLater(error);
    };

    client.on('notification', ({ payload }) => {
      if (payload) {
        this.notify(payload);
      }
    });
    client.on('error', onLost);
    client.on('end', () => onLost());

    try {
      await client.connect();
      await client.query(`LISTEN ${ORDER_UPDATES_CHANNEL}`);
    } catch (error) {
      onLost(error);
      return;
    }

    this.client = client;

    if (this.failures > 0) {
      this.logger.log('Listening for order updates again');
      this.notifyAll();
    }

    this.failures = 0;
  }

  private reconnectLater(error?: unknown): void {
    const delay =
      RECONNECT_DELAYS_MS[
        Math.min(this.failures, RECONNECT_DELAYS_MS.length - 1)
      ];
    const reason = error instanceof Error ? `: ${error.message}` : '';

    this.failures += 1;
    this.logger.warn(
      `Lost the order updates connection${reason}. Reconnecting in ${delay / 1000} s.`,
    );
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private notify(reference: string): void {
    for (const listener of this.watchers.get(reference) ?? []) {
      listener();
    }
  }

  private notifyAll(): void {
    for (const listeners of this.watchers.values()) {
      for (const listener of listeners) {
        listener();
      }
    }
  }
}
