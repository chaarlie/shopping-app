'use client';

import Link from 'next/link';
import { categoryListSchema, productPageSchema } from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { Feedback } from '../feedback';
import ProductCard from '../catalog/product-card';

export default function Storefront() {
  const categories = useResource('/categories', categoryListSchema);
  const catalog = useResource(
    '/products?pageSize=6&sort=name',
    productPageSchema,
  );
  return (
    <>
      <section className="hero">
        <span className="chip">
          <i aria-hidden="true" />
          Demo store · payments are simulated
        </span>
        <h1>Everything you need, nothing you don’t.</h1>
        <p>Search the catalog by name, SKU or category.</p>
        <form className="search-pill" action="/shop">
          <label className="sr" htmlFor="home-search">
            Search products
          </label>
          <input
            id="home-search"
            name="q"
            type="search"
            maxLength={100}
            placeholder="Try “desk lamp” or WM-042"
            required
          />
          <button className="btn-black">Search</button>
        </form>
        <div className="cat-chips">
          {categories.data?.items.slice(0, 6).map((c) => (
            <Link
              key={c.name}
              href={`/shop?category=${encodeURIComponent(c.name)}`}
            >
              {c.name}
              <span>{c.productCount}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="showcase" aria-label="Explore Stockroom">
        <div className="showcase-copy">
          <small>Discover the Stockroom catalog</small>
          <strong>Everyday essentials, all in one place.</strong>
        </div>
        <div className="shelf" aria-hidden="true">
          {categories.data?.items.slice(0, 6).map((c) => (
            <span key={c.name}>{c.name}</span>
          ))}
        </div>
      </section>
      <section className="section" id="categories">
        <div className="section-head">
          <h2>Shop by category</h2>
          <Link href="/shop">All products</Link>
        </div>
        {categories.error ? (
          <Feedback
            error
            message={categories.error}
            retry={categories.reload}
          />
        ) : categories.loading ? (
          <Feedback message="Loading categories…" />
        ) : (
          <div className="grid-3">
            {categories.data?.items.slice(0, 3).map((c) => (
              <Link
                className="collection"
                key={c.name}
                href={`/shop?category=${encodeURIComponent(c.name)}`}
              >
                <span className="count">{c.productCount} products</span>
                <span className="big" aria-hidden="true">
                  {c.name[0]}
                </span>
                <span className="label">
                  <b>{c.name}</b>
                  <i aria-hidden="true">→</i>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-head">
          <h2>From the catalog</h2>
          <Link href="/shop">View all</Link>
        </div>
        {catalog.loading ? (
          <Feedback message="Loading products…" />
        ) : catalog.error ? (
          <Feedback error message={catalog.error} retry={catalog.reload} />
        ) : catalog.data?.items.length ? (
          <div className="grid-products">
            {catalog.data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <Feedback message="The shelves are empty. Products will appear here after the catalog is imported." />
        )}
      </section>
      <section className="section">
        <div className="grid-3">
          <div className="feature">
            <strong>Browse the essentials</strong>
            <span>Find products for home, work and the outdoors.</span>
          </div>
          <div className="feature">
            <strong>Simulated payments</strong>
            <span>
              Try checkout with a test card. No real money changes hands.
            </span>
          </div>
          <div className="feature">
            <strong>Follow your order</strong>
            <span>Watch payment and order updates from your order page.</span>
          </div>
        </div>
      </section>
    </>
  );
}
