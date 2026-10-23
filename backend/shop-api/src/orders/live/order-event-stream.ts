import { Injectable, MessageEvent } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { isFinalOrderStatus } from '@shop/contracts';
import { concatMap, Observable } from 'rxjs';
import { GetOrderQuery } from '../queries/get-order.query.js';
import { OrderUpdatesListener } from './order-updates.listener.js';

const HEARTBEAT_MS = 20_000;
const MAX_STREAM_MS = 10 * 60_000;

@Injectable()
export class OrderEventStream {
  constructor(
    private readonly updates: OrderUpdatesListener,
    private readonly queryBus: QueryBus,
  ) {}

  open(reference: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let lastVersion = 0;
      const heartbeat = setInterval(
        () => subscriber.next({ type: 'heartbeat', data: '' }),
        HEARTBEAT_MS,
      );
      const maxAge = setTimeout(() => subscriber.complete(), MAX_STREAM_MS);
      const subscription = this.updates
        .watch(reference)
        .pipe(
          concatMap(() => this.queryBus.execute(new GetOrderQuery(reference))),
        )
        .subscribe({
          next: (order) => {
            if (order.version <= lastVersion) {
              return;
            }

            lastVersion = order.version;
            subscriber.next({
              type: 'order',
              id: String(order.version),
              data: order,
            });

            if (isFinalOrderStatus(order.status)) {
              subscriber.complete();
            }
          },
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });

      return () => {
        clearInterval(heartbeat);
        clearTimeout(maxAge);
        subscription.unsubscribe();
      };
    });
  }
}
