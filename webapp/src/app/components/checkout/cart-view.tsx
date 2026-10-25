'use client';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { useCartProducts } from '@/lib/use-cart-products';
import { money } from '@/lib/format';
import { Feedback } from '../feedback';
export default function CartView() {
  const cart = useCart();
  const state = useCartProducts(cart.items);
  if (!cart.items.length) {
    return (
      <Feedback message="Your cart is empty. Find something in the catalog to get started." />
    );
  }
  if (state.loading) {
    return <Feedback message="Checking current prices and stock…" />;
  }
  if (state.error) {
    return <Feedback error message={state.error} retry={state.reload} />;
  }
  const total = cart.items.reduce(
    (sum, item) =>
      sum +
      (state.products.find((p) => p.id === item.productId)?.priceCents || 0) *
        item.quantity,
    0,
  );
  const invalid = cart.items.some((i) => {
    const p = state.products.find((p) => p.id === i.productId);
    return !p || p.stock < i.quantity;
  });
  return (
    <div className="split">
      <div className="stack">
        {cart.items.map((item) => {
          const p = state.products.find((p) => p.id === item.productId);
          return (
            <article className="panel cart-line" key={item.productId}>
              <div>
                <h2>
                  {p ? (
                    <Link href={`/products/${p.id}`}>{p.name}</Link>
                  ) : (
                    'Product no longer available'
                  )}
                </h2>
                {p && (
                  <p>
                    {money(p.priceCents)} each · {p.stock} available
                  </p>
                )}
              </div>
              <div className="actions">
                <label>
                  Quantity
                  <input
                    aria-label={`Quantity for ${p?.name || 'unavailable product'}`}
                    type="number"
                    min={1}
                    max={100}
                    value={item.quantity}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      if (Number.isInteger(q) && q >= 1 && q <= 100) {
                        cart.setQuantity(item.productId, q);
                      }
                    }}
                  />
                </label>
                <button
                  className="btn-grey"
                  onClick={() => cart.setQuantity(item.productId, 0)}
                >
                  Remove
                </button>
              </div>
              {(!p || p.stock < item.quantity) && (
                <p role="alert">
                  Reduce the quantity or remove this product before checkout.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <aside className="panel stack">
        <h2>Order summary</h2>
        <p>
          Total <strong>{money(total)}</strong>
        </p>
        <p>
          No shipping or tax charges. Final price and availability are checked
          when you place the order.
        </p>
        {invalid ? (
          <p role="alert">Some items need your attention.</p>
        ) : (
          <Link className="btn-black" href="/checkout">
            Continue to checkout
          </Link>
        )}
        <button className="btn-grey" onClick={state.reload}>
          Refresh prices and stock
        </button>
      </aside>
    </div>
  );
}
