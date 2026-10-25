import { beforeEach, describe, it, expect, vi } from 'vitest';
import { paymentIntent, clearPaymentIntent } from './payment-intent';
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});
describe('payment retry identity', () => {
  it('reuses the key after an uncertain outcome, even on another call', async () => {
    const first = await paymentIntent('checkout', {
      name: 'Carlos',
      items: [1],
    });
    expect(
      await paymentIntent('checkout', { name: 'Carlos', items: [1] }),
    ).toBe(first);
  });
  it('blocks a changed payload while a previous outcome is unknown', async () => {
    await paymentIntent('checkout', { items: [1] });
    await expect(paymentIntent('checkout', { items: [2] })).rejects.toThrow(
      'unknown outcome',
    );
  });
  it('starts a new attempt only after the previous attempt is resolved', async () => {
    const first = await paymentIntent('retry', { card: 'approved' });
    clearPaymentIntent('retry');
    expect(await paymentIntent('retry', { card: 'approved' })).not.toBe(first);
  });
});
