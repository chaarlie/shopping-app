'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { orderSchema, placeOrderSchema } from '@shop/contracts';
import { useCart } from '@/lib/cart';
import { useCartProducts } from '@/lib/use-cart-products';
import { ApiError, errorMessage, request } from '@/lib/api';
import { paymentIntent, clearPaymentIntent } from '@/lib/payment-intent';
import { money } from '@/lib/format';
import { Feedback } from '../feedback';
import PaymentFields, { cardFromForm } from './payment-fields';
export default function CheckoutForm() {
  const cart = useCart();
  const state = useCartProducts(cart.items);
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!cart.items.length) {
    return (
      <Feedback message="Your cart is empty. Add products before checking out." />
    );
  }
  if (state.loading) {
    return <Feedback message="Loading your order…" />;
  }
  if (state.error) {
    return <Feedback error message={state.error} retry={state.reload} />;
  }
  if (cart.settingsError) {
    return (
      <Feedback
        error
        message={cart.settingsError}
        retry={cart.reloadSettings}
      />
    );
  }
  if (cart.maxQuantity === null) {
    return <Feedback message="Loading checkout limits…" />;
  }
  if (cart.items.some((item) => item.quantity > cart.maxQuantity!)) {
    return (
      <section className="panel">
        <p role="alert">
          The limit is {cart.maxQuantity} units per product. Adjust your cart
          before checkout.
        </p>
        <Link href="/cart">Review cart</Link>
      </section>
    );
  }
  const total = cart.items.reduce(
    (sum, i) =>
      sum +
      (state.products.find((p) => p.id === i.productId)?.priceCents || 0) *
        i.quantity,
    0,
  );
  return (
    <div className="split">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy.current) {
            return;
          }
          busy.current = true;
          setPending(true);
          setError('');
          try {
            const form = new FormData(e.currentTarget);
            const input = placeOrderSchema.parse({
              name: form.get('name'),
              email: form.get('email'),
              items: [...cart.items].sort((a, b) => a.productId - b.productId),
              card: cardFromForm(form),
            });
            const { cvc, ...card } = input.card;
            void cvc;
            const key = await paymentIntent('stockroom.checkout', {
              ...input,
              card,
            });
            const order = await request('/orders', orderSchema, {
              method: 'POST',
              headers: { 'Idempotency-Key': key },
              body: JSON.stringify(input),
            });
            clearPaymentIntent('stockroom.checkout');
            cart.clear();
            router.push(`/orders/${order.reference}`);
          } catch (cause) {
            if (
              cause instanceof ApiError &&
              (cause.status === 400 ||
                (cause.status === 409 &&
                  /out of stock|^Only \d/.test(cause.message)))
            ) {
              clearPaymentIntent('stockroom.checkout');
            }
            setError(errorMessage(cause));
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="stack">
          <legend>Your details</legend>
          <label>
            Name
            <input name="name" autoComplete="name" maxLength={200} required />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <PaymentFields />
        </fieldset>
        {error && (
          <div role="alert" className="feedback feedback-error">
            {error}
          </div>
        )}
        <button className="btn-black" disabled={pending}>
          {pending ? 'Placing order…' : 'Place demo order'}
        </button>
        <p className="muted">
          If the connection fails, retry with the same details. The same request
          key is reused to avoid a duplicate order.
        </p>
      </form>
      <aside className="panel stack">
        <h2>Your order</h2>
        {cart.items.map((i) => (
          <p key={i.productId}>
            {state.products.find((p) => p.id === i.productId)?.name ||
              'Unavailable product'}{' '}
            × {i.quantity}
          </p>
        ))}
        <strong>Current total: {money(total)}</strong>
        <p>The server confirms prices and stock at purchase time.</p>
        <Link href="/cart">Edit cart</Link>
      </aside>
    </div>
  );
}
