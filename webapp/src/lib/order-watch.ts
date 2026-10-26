import type { Order } from '@shop/contracts';
export function needsOrderUpdates(
  order: Pick<Order, 'status' | 'payment'>,
): boolean {
  return (
    order.status === 'pending_payment' ||
    order.status === 'refund_pending' ||
    (order.status === 'cancelled' &&
      (order.payment?.status === 'requested' ||
        order.payment?.status === 'processing'))
  );
}
type Callbacks = {
  open: () => void;
  order: (order: Order) => void;
  error: () => void;
};
export function watchOrder(options: {
  load: () => Promise<Order>;
  subscribe: (callbacks: Callbacks) => () => void;
  onOrder: (order: Order) => void;
  onError: (cause: unknown) => boolean;
  onConnection: (connected: boolean) => void;
  visible: () => boolean;
}) {
  let stopped = false;
  let loading = false;
  let connected = false;
  let version = -1;
  let unsubscribe: (() => void) | undefined;
  let polling: ReturnType<typeof setInterval> | undefined;
  function stop() {
    stopped = true;
    unsubscribe?.();
    clearInterval(polling);
    options.onConnection(false);
  }
  function update(order: Order) {
    if (stopped || order.version <= version) {
      return;
    }
    version = order.version;
    options.onOrder(order);
    if (!needsOrderUpdates(order)) {
      stop();
    }
  }
  async function refresh() {
    if (stopped || loading) {
      return;
    }
    loading = true;
    try {
      update(await options.load());
    } catch (cause) {
      if (!stopped && !options.onError(cause)) {
        stop();
      }
    } finally {
      loading = false;
    }
  }
  void refresh().then(() => {
    if (stopped) {
      return;
    }
    unsubscribe = options.subscribe({
      open: () => {
        if (stopped) {
          return;
        }
        connected = true;
        options.onConnection(true);
        void refresh();
      },
      order: update,
      error: () => {
        if (stopped) {
          return;
        }
        connected = false;
        options.onConnection(false);
        void refresh();
      },
    });
    polling = setInterval(() => {
      if (!connected && options.visible()) {
        void refresh();
      }
    }, 5000);
  });
  return stop;
}
