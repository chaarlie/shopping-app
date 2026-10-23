const retryDelaysMs = [5_000, 30_000];

export const maxDeliveryAttempts = retryDelaysMs.length + 1;

export type NextDelivery = { kind: 'retry'; at: Date } | { kind: 'dead' };

export function nextDeliveryAfter(
  attemptsMade: number,
  now: Date,
): NextDelivery {
  const delay = retryDelaysMs[attemptsMade - 1];

  return delay === undefined
    ? { kind: 'dead' }
    : { kind: 'retry', at: new Date(now.getTime() + delay) };
}
