'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  categoryListSchema,
  productPageSchema,
  productSearchQuerySchema,
} from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { Feedback, Pagination } from '../feedback';
import ProductCard from './product-card';
import { CatalogFilters } from './catalog-filters';

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
      <CatalogFilters
        key={params.toString()}
        query={params.get('q') || ''}
        category={params.get('category') || ''}
        sort={params.get('sort') || ''}
        categories={categories.data?.items ?? []}
        onSearch={change}
      />
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
