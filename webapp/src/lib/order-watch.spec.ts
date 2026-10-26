import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@shop/contracts';
import { watchOrder } from './order-watch';
const pending: Order = {
  reference: 'SR-1234-5678',
  status: 'pending_payment',
  name: 'Test',
  email: 'test@example.test',
  items: [],
  totalCents: 100,
  currency: 'USD',
  dueAt: '',
  payment: null,
  version: 1,
  createdAt: '',
  updatedAt: '',
};
function setup(initial = pending) {
  vi.useFakeTimers();
  let events!: Parameters<Parameters<typeof watchOrder>[0]['subscribe']>[0];
  const close = vi.fn();
  const load = vi.fn().mockResolvedValue(initial);
  const onOrder = vi.fn();
  const subscribe = vi.fn((callbacks: typeof events) => {
    events = callbacks;
    return close;
  });
  const stop = watchOrder({
    load,
    subscribe,
    onOrder,
    onError: () => true,
    onConnection: vi.fn(),
    visible: () => true,
  });
  return { load, onOrder, subscribe, close, stop, events: () => events };
}
afterEach(() => vi.useRealTimers());
describe('order live updates', () => {
  it('does not poll or subscribe when the initial order is paid', async () => {
    const test = setup({ ...pending, status: 'paid' });
    await vi.advanceTimersByTimeAsync(15000);
    expect(test.load).toHaveBeenCalledTimes(1);
    expect(test.subscribe).not.toHaveBeenCalled();
    test.stop();
  });
  it('keeps the subscription available for reconnect and polls while disconnected', async () => {
    const test = setup();
    await vi.advanceTimersByTimeAsync(0);
    test.events().error();
    await vi.advanceTimersByTimeAsync(5000);
    expect(test.close).not.toHaveBeenCalled();
    expect(test.load).toHaveBeenCalledTimes(3);
    test.events().open();
    await vi.advanceTimersByTimeAsync(10000);
    expect(test.load).toHaveBeenCalledTimes(4);
    test.stop();
    expect(test.close).toHaveBeenCalledTimes(1);
  });
  it('stops after paid and ignores stale responses still in flight', async () => {
    const test = setup();
    await vi.advanceTimersByTimeAsync(0);
    let finish!: (order: Order) => void;
    test.load.mockImplementationOnce(
      () =>
        new Promise<Order>((resolve) => {
          finish = resolve;
        }),
    );
    test.events().error();
    test.events().order({ ...pending, version: 3, status: 'paid' });
    finish({ ...pending, version: 2 });
    await vi.advanceTimersByTimeAsync(15000);
    expect(test.load).toHaveBeenCalledTimes(2);
    expect(test.close).toHaveBeenCalledTimes(1);
    expect(test.onOrder).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'paid', version: 3 }),
    );
  });
  it('continues observing a cancelled order with an unresolved payment', async () => {
    const test = setup({
      ...pending,
      status: 'cancelled',
      payment: {
        status: 'processing',
        cardLast4: '4242',
        declineCode: null,
        declineMessage: null,
      },
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(test.subscribe).toHaveBeenCalledTimes(1);
    expect(test.load).toHaveBeenCalledTimes(2);
    test.stop();
  });
});
