'use client';
import { useState } from 'react';
import Link from 'next/link';
import { productSchema } from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { useCart } from '@/lib/cart';
import { errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { Feedback } from '../feedback';
import { ProductArt } from './product-card';
export default function ProductDetail({ id }: { id: string }) {
  const state = useResource(
    `/products/${encodeURIComponent(id)}`,
    productSchema,
  );
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  if (state.loading) {
    return <Feedback message="Loading product…" />;
  }
  if (state.error || !state.data) {
    return (
      <Feedback
        error
        message={state.error || 'Product unavailable'}
        retry={state.reload}
      />
    );
  }
  const p = state.data;
  return (
    <>
      <div className="page-head">
        <Link href="/shop">← Back to catalog</Link>
      </div>
      <div className="split">
        <ProductArt category={p.category} />
        <section className="stack">
          <span className="muted">
            {p.category} · {p.sku}
          </span>
          <div className="page-head">
            <h1>{p.name}</h1>
          </div>
          <strong className="price">{money(p.priceCents)}</strong>
          <p>{p.description || 'No description available.'}</p>
          <p>
            {p.stock ? `${p.stock} available` : 'Out of stock'}
            {p.weightGrams !== null && ` · ${p.weightGrams / 1000} kg`}
          </p>
          <form
            className="actions"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                cart.add(p.id, quantity, p.stock);
                setNotice('Added to your cart.');
              } catch (error) {
                setNotice(errorMessage(error));
              }
            }}
          >
            <label>
              Quantity
              <input
                type="number"
                min={1}
                max={Math.min(cart.maxQuantity ?? 0, p.stock)}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                disabled={!p.stock || cart.maxQuantity === null}
              />
            </label>
            <button
              className="btn-black"
              disabled={!p.stock || cart.maxQuantity === null}
            >
              {p.stock ? 'Add to cart' : 'Out of stock'}
            </button>
          </form>
          {cart.settingsError && (
            <Feedback
              error
              message={cart.settingsError}
              retry={cart.reloadSettings}
            />
          )}
          {notice && (
            <p role="status">
              {notice} <Link href="/cart">View cart →</Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
