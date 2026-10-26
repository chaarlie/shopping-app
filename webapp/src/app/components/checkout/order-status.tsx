'use client';
import { needsOrderUpdates } from '@/lib/order-watch';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useOrder } from './use-order';
import { orderSchema, retryPaymentSchema } from '@shop/contracts';
import { errorMessage, request } from '@/lib/api';
import { paymentIntent, clearPaymentIntent } from '@/lib/payment-intent';
import { money, dateTime } from '@/lib/format';
import { Feedback } from '../feedback';
import PaymentFields, { cardFromForm } from './payment-fields';
const labels = {
  pending_payment: 'Awaiting payment',
  paid: 'Payment approved',
  cancelled: 'Order cancelled',
  refund_pending: 'Refund in progress',
  refunded: 'Payment refunded',
};
export default function OrderStatus({ reference }: { reference: string }) {
  const { order, setOrder, error, setError, connected } = useOrder(reference);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  if (!order) {
    return (
      <Feedback message={error || 'Loading your order…'} error={!!error} />
    );
  }
  const declined =
    order.status === 'pending_payment' && order.payment?.status === 'declined';
  return (
    <div className="split">
      <section className="stack">
        <div
          className={`panel ${order.status === 'paid' ? 'success-panel' : ''}`}
        >
          <h1>{labels[order.status]}</h1>
          <p className="mono">{order.reference}</p>
          <p>
            {order.status === 'paid'
              ? 'Thank you. Your demo purchase is confirmed.'
              : order.status === 'cancelled'
                ? 'This order expired and its reserved stock was released.'
                : order.status === 'refunded'
                  ? 'The late payment was refunded because the order could not be fulfilled.'
                  : 'Payment and order updates will appear here.'}
          </p>
        </div>
        <p role="status">
          {!needsOrderUpdates(order)
            ? 'Order status confirmed'
            : connected
              ? 'Live updates connected'
              : 'Reconnecting · checking for updates every 5 seconds'}
        </p>
        {error && <p role="alert">{error}</p>}
        {order.status === 'pending_payment' && (
          <p>
            Payment window ends {dateTime(order.dueAt)}. Keep this browser’s
            cookies to access the order.
          </p>
        )}
        {declined && (
          <form
            className="panel stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy.current) {
                return;
              }
              busy.current = true;
              setPending(true);
              setError('');
              try {
                const input = retryPaymentSchema.parse({
                  card: cardFromForm(new FormData(e.currentTarget)),
                });
                const { cvc, ...card } = input.card;
                void cvc;
                const storageKey = `stockroom.retry.${reference}.${order.version}`;
                const key = await paymentIntent(storageKey, card);
                const next = await request(
                  `/orders/${reference}/payments`,
                  orderSchema,
                  {
                    method: 'POST',
                    headers: { 'Idempotency-Key': key },
                    body: JSON.stringify(input),
                  },
                );
                clearPaymentIntent(storageKey);
                setOrder((previous) =>
                  !previous || next.version >= previous.version
                    ? next
                    : previous,
                );
              } catch (cause) {
                setError(errorMessage(cause));
              } finally {
                busy.current = false;
                setPending(false);
              }
            }}
          >
            <h2>Try another test card</h2>
            <p role="alert">
              {order.payment?.declineMessage || 'Payment declined.'}
            </p>
            <fieldset disabled={pending}>
              <PaymentFields />
            </fieldset>
            <button className="btn-black" disabled={pending}>
              {pending ? 'Submitting…' : 'Retry payment'}
            </button>
          </form>
        )}
        <Link href="/shop">Continue shopping →</Link>
      </section>
      <aside className="panel stack">
        <h2>Order summary</h2>
        {order.items.map((line, i) => (
          <div className="summary-line" key={`${line.sku}-${i}`}>
            <span>
              {line.name} × {line.quantity}
            </span>
            <strong>{money(line.lineTotalCents)}</strong>
          </div>
        ))}
        <strong>Total {money(order.totalCents)}</strong>
        <p>
          {order.name} · {order.email}
        </p>
      </aside>
    </div>
  );
}
