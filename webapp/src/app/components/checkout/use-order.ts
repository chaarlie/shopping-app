'use client';
import { useEffect, useState } from 'react';
import { orderSchema, type Order } from '@shop/contracts';
import { ApiError, errorMessage, request } from '@/lib/api';
export function useOrder(reference: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let unavailable = false;
    let source: EventSource | undefined;
    let polling: ReturnType<typeof setInterval> | undefined;
    function update(next: Order) {
      setOrder((previous) =>
        !previous || next.version > previous.version ? next : previous,
      );
      setError('');
    }
    async function load() {
      try {
        update(
          await request(`/orders/${reference}`, orderSchema, {
            signal: controller.signal,
          }),
        );
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(errorMessage(cause));
          if (
            cause instanceof ApiError &&
            [401, 403, 404].includes(cause.status)
          ) {
            unavailable = true;
            source?.close();
            clearInterval(polling);
          }
        }
      }
    }
    void load().then(() => {
      if (controller.signal.aborted || unavailable) {
        return;
      }
      source = new EventSource(`/api/orders/${reference}/events`);
      source.addEventListener('open', () => {
        setConnected(true);
        void load();
      });
      source.addEventListener('order', (event) => {
        try {
          update(orderSchema.parse(JSON.parse((event as MessageEvent).data)));
        } catch {
          void load();
        }
      });
      source.onerror = () => {
        setConnected(false);
        source?.close();
        void load();
      };
      polling = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void load();
        }
      }, 5000);
    });
    return () => {
      controller.abort();
      source?.close();
      clearInterval(polling);
    };
  }, [reference]);
  return { order, setOrder, error, setError, connected };
}
