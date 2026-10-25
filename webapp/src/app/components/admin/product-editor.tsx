'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { productSchema, type Product } from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { ApiError, errorMessage, request } from '@/lib/api';
import { productFromForm } from '@/lib/product-form';
import { Feedback } from '../feedback';
import Link from 'next/link';
export default function ProductEditor({ id }: { id?: string }) {
  return id ? <ExistingProduct id={id} /> : <ProductForm />;
}
function ExistingProduct({ id }: { id: string }) {
  const state = useResource(`/products/${id}`, productSchema);
  if (state.loading) {
    return <Feedback message="Loading product…" />;
  }
  if (!state.data) {
    return (
      <Feedback
        error
        message={state.error || 'Product unavailable'}
        retry={state.reload}
      />
    );
  }
  return (
    <ProductForm
      key={`${state.data.id}-${state.data.version}`}
      product={state.data}
      reload={state.reload}
    />
  );
}
function ProductForm({
  product,
  reload,
}: {
  product?: Product;
  reload?: () => void;
}) {
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <div className="page-head">
        <h1>{product ? 'Edit product' : 'Create product'}</h1>
      </div>
      <form
        className="panel stack product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const input = productFromForm(
              new FormData(e.currentTarget),
              product?.version,
            );
            await request(
              product ? `/products/${product.id}` : '/products',
              productSchema,
              {
                method: product ? 'PATCH' : 'POST',
                body: JSON.stringify(input),
              },
            );
            router.push('/admin/products');
          } catch (cause) {
            setError(errorMessage(cause));
            setStale(
              !!product && cause instanceof ApiError && cause.status === 409,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="stack" disabled={busy}>
          <label>
            SKU
            <input
              name="sku"
              maxLength={32}
              defaultValue={product?.sku}
              readOnly={!!product}
              required
            />
          </label>
          <label>
            Name
            <input
              name="name"
              maxLength={200}
              defaultValue={product?.name}
              required
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={product?.description}
            />
          </label>
          <label>
            Category
            <input
              name="category"
              maxLength={100}
              defaultValue={product?.category}
              required
            />
          </label>
          <div className="actions">
            <label>
              Price (USD)
              <input
                name="price"
                inputMode="decimal"
                defaultValue={
                  product ? (product.priceCents / 100).toFixed(2) : ''
                }
                required
              />
            </label>
            <label>
              Stock
              <input
                name="stock"
                type="number"
                min={0}
                max={1000000}
                defaultValue={product?.stock ?? 0}
                required
              />
            </label>
            <label>
              Weight (kg, optional)
              <input
                name="weight"
                inputMode="decimal"
                defaultValue={
                  product?.weightGrams === null || !product
                    ? ''
                    : product.weightGrams / 1000
                }
              />
            </label>
          </div>
        </fieldset>
        {error && (
          <div role="alert" className="feedback feedback-error">
            <p>{error}</p>
            {stale && reload && (
              <button type="button" className="btn-grey" onClick={reload}>
                Discard edits and load latest version
              </button>
            )}
          </div>
        )}
        <div className="actions">
          <button className="btn-black" disabled={busy || stale}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
          <Link href="/admin/products">Cancel</Link>
        </div>
      </form>
    </>
  );
}
