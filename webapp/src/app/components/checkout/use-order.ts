'use client';
import { useEffect, useState } from 'react';
import { orderSchema, type Order } from '@shop/contracts';
import { ApiError, errorMessage, request } from '@/lib/api';
import { watchOrder } from '@/lib/order-watch';
export function useOrder(reference: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const stop = watchOrder({
      load: () =>
        request(`/orders/${reference}`, orderSchema, {
          signal: controller.signal,
        }),
      onOrder: (next) => {
        setOrder((previous) =>
          !previous ||
          previous.reference !== next.reference ||
          next.version > previous.version
            ? next
            : previous,
        );
        setError('');
      },
      onError: (cause) => {
        if (controller.signal.aborted) {
          return false;
        }
        setError(errorMessage(cause));
        return !(
          cause instanceof ApiError && [401, 403, 404].includes(cause.status)
        );
      },
      onConnection: setConnected,
      visible: () => document.visibilityState === 'visible',
      subscribe: (callbacks) => {
        const source = new EventSource(`/api/orders/${reference}/events`);
        source.addEventListener('open', callbacks.open);
        source.addEventListener('order', (event) => {
          try {
            callbacks.order(
              orderSchema.parse(JSON.parse((event as MessageEvent).data)),
            );
          } catch {
            callbacks.error();
          }
        });
        source.onerror = callbacks.error;
        return () => source.close();
      },
    });
    return () => {
      controller.abort();
      stop();
    };
  }, [reference]);
  return { order, setOrder, error, setError, connected };
}
