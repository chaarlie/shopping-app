'use client';

import { useState } from 'react';
import type { Product } from '@shop/contracts';
import { useCart } from '@/lib/cart';
import { errorMessage } from '@/lib/api';

export function AddToCartButton({ product }: { product: Product }) {
  const cart = useCart();
  const [notice, setNotice] = useState('');
  const quantity =
    cart.items.find((item) => item.productId === product.id)?.quantity ?? 0;
  const unavailable = product.stock === 0;
  const atLimit = quantity >= Math.min(product.stock, 100);
  const label = unavailable
    ? `${product.name} is out of stock`
    : atLimit
      ? `Maximum quantity of ${product.name} already in cart`
      : `Add ${product.name} to cart`;

  return (
    <div className="product-cart">
      <button
        type="button"
        className="btn-black product-cart-button"
        aria-label={label}
        title={label}
        disabled={unavailable || atLimit}
        onClick={() => {
          try {
            cart.add(product.id, 1, product.stock);
            setNotice(`Added to cart · ${quantity + 1} in cart`);
          } catch (error) {
            setNotice(errorMessage(error));
          }
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 3h2l2.5 12h11L21 7H6" />
          <circle cx="9" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
        </svg>
      </button>
      <span className="product-cart-notice" role="status">
        {notice}
      </span>
    </div>
  );
}
