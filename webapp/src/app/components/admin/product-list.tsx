'use client';
import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { productPageSchema } from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { request, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { Feedback, Pagination } from '../feedback';
export default function ProductList() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [reorder, setReorder] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const state = useResource(
    `/admin/products?page=${page}&pageSize=14&q=${encodeURIComponent(q)}&reorder=${reorder}`,
    productPageSchema,
  );
  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <p>Your catalog, ready to manage.</p>
      </div>
      <div className="admin-tiles">
        <div className="panel">
          <span>Matching products</span>
          <strong>{state.data?.total ?? '—'}</strong>
        </div>
        <button
          className={`panel dark-tile ${reorder ? 'selected' : ''}`}
          onClick={() => {
            setReorder((v) => !v);
            setPage(1);
          }}
          aria-pressed={reorder}
        >
          <span>To reorder</span>
          <strong>
            {reorder ? 'Showing empty shelves' : 'View zero stock →'}
          </strong>
        </button>
      </div>
      <form
        className="catalog-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get('q') || '').trim());
          setPage(1);
        }}
      >
        <label>
          Find a product
          <input
            name="q"
            type="search"
            placeholder="Name or SKU"
            maxLength={100}
          />
        </label>
        <button className="btn-grey">Search</button>
        <Link className="btn-black" href="/admin/products/new">
          Create product
        </Link>
      </form>
      {error && <p role="alert">{error}</p>}
      {remove !== null && (
        <div
          role="alertdialog"
          aria-label="Delete product"
          className="panel actions"
        >
          <p>Delete this product? Existing order lines will be preserved.</p>
          <button
            className="btn-black"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await request(`/products/${remove}`, z.undefined(), {
                  method: 'DELETE',
                });
                setRemove(null);
                state.reload();
              } catch (cause) {
                setError(errorMessage(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete product
          </button>
          <button className="btn-grey" onClick={() => setRemove(null)}>
            Cancel
          </button>
        </div>
      )}
      {state.loading ? (
        <Feedback message="Loading products…" />
      ) : state.error ? (
        <Feedback error message={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            <div className="table-scroll">
              <table>
                <caption className="sr">Catalog products</caption>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <span className="table-description">
                          {p.description}
                        </span>
                      </td>
                      <td className="mono">{p.sku}</td>
                      <td>{p.category}</td>
                      <td>{money(p.priceCents)}</td>
                      <td>
                        {p.stock === 0 ? (
                          <span className="stock stock-low">Reorder</span>
                        ) : (
                          p.stock
                        )}
                      </td>
                      <td>
                        <div className="actions">
                          <Link
                            className="btn-grey"
                            href={`/admin/products/${p.id}`}
                          >
                            Edit
                          </Link>
                          <button
                            className="btn-grey"
                            onClick={() => setRemove(p.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!state.data.items.length && (
              <Feedback message="No products match this view." />
            )}
            <Pagination
              page={page}
              pageSize={14}
              total={state.data.total}
              onPage={setPage}
            />
          </>
        )
      )}
      <aside className="import-bar">
        <div>
          <h2>Bring your catalog into Stockroom.</h2>
          <p>Upload a CSV, review every row, then apply.</p>
        </div>
        <Link className="btn-grey" href="/admin/imports/new">
          Import CSV →
        </Link>
      </aside>
    </>
  );
}
