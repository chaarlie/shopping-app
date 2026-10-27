import Link from 'next/link';
import type { Product } from '@shop/contracts';
import { money } from '@/lib/format';
import { AddToCartButton } from './add-to-cart-button';

export function ProductArt({ category }: { category: string }) {
  return (
    <div
      className="product-art"
      role="img"
      aria-label={`${category} category placeholder`}
    >
      <span aria-hidden="true">{category.slice(0, 2)}</span>
      <span className="cat-tag">{category}</span>
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product">
      <Link href={`/products/${product.id}`} tabIndex={-1} aria-hidden="true">
        <ProductArt category={product.category} />
      </Link>
      <div className="product-line">
        <h3>
          <Link href={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <span className="num">{money(product.priceCents)}</span>
      </div>
      <div className="product-meta">
        <span className="mono">{product.sku}</span>
        <span
          className={`stock ${product.stock === 0 ? 'stock-out' : product.stock < 10 ? 'stock-low' : 'stock-in'}`}
        >
          {product.stock === 0
            ? 'Out of stock'
            : product.stock < 10
              ? `Only ${product.stock} left`
              : 'In stock'}
        </span>
      </div>
      <AddToCartButton product={product} />
    </article>
  );
}
