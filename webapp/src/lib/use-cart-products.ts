'use client';
import { useEffect, useState } from 'react';
import { productSchema, type Product } from '@shop/contracts';
import { ApiError, errorMessage, request } from './api';
import type { CartItem } from './cart';
export function useCartProducts(items: CartItem[]) {
  const ids = items
    .map((i) => i.productId)
    .sort((a, b) => a - b)
    .join(',');
  const [state, setState] = useState<{
    ids: string;
    products: Product[];
    error: string | null;
  }>({ ids: '', products: [], error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ids
        .split(',')
        .filter(Boolean)
        .map((id) =>
          request(`/products/${id}`, productSchema, {
            signal: controller.signal,
          }).catch((error) => {
            if (error instanceof ApiError && error.status === 404) {
              return null;
            }
            throw error;
          }),
        ),
    ).then(
      (products) =>
        setState({
          ids,
          products: products.filter((p) => p !== null),
          error: null,
        }),
      (error) => {
        if (!controller.signal.aborted) {
          setState({ ids, products: [], error: errorMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, [ids, revision]);
  return {
    products: state.ids === ids ? state.products : [],
    loading: state.ids !== ids,
    error: state.ids === ids ? state.error : null,
    reload: () => {
      setState({ ids: 'loading', products: [], error: null });
      setRevision((v) => v + 1);
    },
  };
}
