import { maxPaymentAmountCents } from '@shop/contracts';

export interface CartItem {
  productId: number;
  quantity: number;
}

export interface CartProduct {
  id: number;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
}

export interface PricedLine {
  productId: number;
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export type CartPricing =
  | { ok: true; lines: PricedLine[]; totalCents: number }
  | {
      ok: false;
      problem: 'unknown_product' | 'out_of_stock' | 'too_expensive';
      message: string;
    };

export function priceCart(
  items: CartItem[],
  products: CartProduct[],
): CartPricing {
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: PricedLine[] = [];

  for (const item of items) {
    const product = byId.get(item.productId);

    if (!product) {
      return {
        ok: false,
        problem: 'unknown_product',
        message: `Product ${item.productId} doesn't exist`,
      };
    }

    if (product.stock < item.quantity) {
      return {
        ok: false,
        problem: 'out_of_stock',
        message:
          product.stock === 0
            ? `${product.name} is out of stock`
            : `Only ${product.stock} of ${product.name} left`,
      };
    }

    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
    });
  }

  const totalCents = lines.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity,
    0,
  );

  if (totalCents > maxPaymentAmountCents) {
    return {
      ok: false,
      problem: 'too_expensive',
      message: 'Orders over 999,999.99 cannot be paid by card',
    };
  }

  return { ok: true, lines, totalCents };
}
