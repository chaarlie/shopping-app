'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  categoryListSchema,
  productPageSchema,
  productSearchQuerySchema,
} from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { Feedback, Pagination } from '../feedback';
import ProductCard from './product-card';

export default function Catalog() {
  const router = useRouter();
  const params = useSearchParams();
  const parsed = productSearchQuerySchema.safeParse(Object.fromEntries(params));
  const query = parsed.success ? parsed.data : null;
  const path = query
    ? `/products?${new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`
    : '/products?pageSize=20';
  const products = useResource(path, productPageSchema);
  const categories = useResource('/categories', categoryListSchema);
  function change(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.set('page', '1');
    for (const [key, value] of Object.entries(values)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    router.push(`/shop?${next}`);
  }
  return (
    <>
      <div className="page-head">
        <h1>
          {params.get('q')
            ? `Results for “${params.get('q')}”`
            : 'Explore the catalog'}
        </h1>
        <p>Find your everyday essentials.</p>
      </div>
      <form
        className="catalog-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          change({
            q: String(data.get('q') || '').trim(),
            category: String(data.get('category') || ''),
            sort: String(data.get('sort') || ''),
          });
        }}
        key={params.toString()}
      >
        <label>
          Search
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={params.get('q') || ''}
            placeholder="Product name or SKU"
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={params.get('category') || ''}>
            <option value="">All categories</option>
            {categories.data?.items.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.productCount})
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={params.get('sort') || ''}>
            <option value="">Recommended</option>
            <option value="relevance">Relevance</option>
            <option value="name">Name</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="newest">Newest</option>
          </select>
        </label>
        <button className="btn-black">Search</button>
        <Link className="btn-grey" href="/shop">
          Clear
        </Link>
      </form>
      {categories.error && (
        <p role="status">
          Category filters are unavailable. You can still search or browse.
        </p>
      )}
      {!query ? (
        <Feedback
          error
          message={
            parsed.error?.issues.map((i) => i.message).join(' ') ||
            'Invalid search'
          }
        />
      ) : products.loading ? (
        <Feedback message="Loading products…" />
      ) : products.error ? (
        <Feedback error message={products.error} retry={products.reload} />
      ) : (
        products.data && (
          <>
            <p className="muted">{products.data.total} results</p>
            {products.data.items.length ? (
              <div className="grid-products">
                {products.data.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <Feedback message="No products found. Try another search or clear the filters." />
            )}
            <Pagination
              page={query.page}
              pageSize={query.pageSize}
              total={products.data.total}
              onPage={(page) => change({ page: String(page) })}
            />
          </>
        )
      )}
    </>
  );
}
