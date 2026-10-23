import { maxDeliveryAttempts, nextDeliveryAfter } from './delivery-schedule.js';

const now = new Date('2026-10-23T10:00:00.000Z');

describe('nextDeliveryAfter', () => {
  it('retries 5 seconds after the first failure', () => {
    expect(nextDeliveryAfter(1, now)).toEqual({
      kind: 'retry',
      at: new Date('2026-10-23T10:00:05.000Z'),
    });
  });

  it('retries 30 seconds after the second failure', () => {
    expect(nextDeliveryAfter(2, now)).toEqual({
      kind: 'retry',
      at: new Date('2026-10-23T10:00:30.000Z'),
    });
  });

  it('gives up after the third attempt', () => {
    expect(maxDeliveryAttempts).toBe(3);
    expect(nextDeliveryAfter(3, now)).toEqual({ kind: 'dead' });
  });
});
