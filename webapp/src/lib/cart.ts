'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { maxOrderQuantity } from '@shop/contracts';
import { useCheckoutSettings } from './checkout-settings';
const key = 'stockroom.cart.v1';
const schema = z
  .array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(maxOrderQuantity),
    }),
  )
  .max(50);
export type CartItem = z.infer<typeof schema>[number];
export function parseCart(value: string | null): CartItem[] {
  try {
    const parsed = schema.safeParse(JSON.parse(value || '[]'));
    return parsed.success
      ? parsed.data.filter(
          (item, i, all) =>
            all.findIndex((other) => other.productId === item.productId) === i,
        )
      : [];
  } catch {
    return [];
  }
}
function snapshot() {
  try {
    return localStorage.getItem(key) || '[]';
  } catch {
    return '[]';
  }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('cart-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('cart-change', callback);
  };
}
function save(items: CartItem[]) {
  localStorage.setItem(key, JSON.stringify(schema.parse(items)));
  window.dispatchEvent(new Event('cart-change'));
}
export function useCart() {
  const settings = useCheckoutSettings();
  const value = useSyncExternalStore(subscribe, snapshot, () => '[]');
  const items = useMemo(() => parseCart(value), [value]);
  return {
    items,
    maxQuantity: settings.maxQuantity,
    settingsError: settings.error,
    reloadSettings: settings.reload,
    setQuantity(productId: number, quantity: number) {
      if (
        quantity > 0 &&
        (settings.maxQuantity === null || quantity > settings.maxQuantity)
      ) {
        throw new Error(
          'Quantity exceeds the configured limit or checkout settings are unavailable.',
        );
      }
      const current = parseCart(snapshot());
      const rest = current.filter((i) => i.productId !== productId);
      save(quantity > 0 ? [...rest, { productId, quantity }] : rest);
    },
    add(productId: number, quantity: number, stock: number) {
      const current = parseCart(snapshot());
      const existing = current.find((i) => i.productId === productId);
      const next = (existing?.quantity || 0) + quantity;
      if (settings.maxQuantity === null) {
        throw new Error('Checkout settings are unavailable. Please retry.');
      }
      if (next > Math.min(stock, settings.maxQuantity)) {
        throw new Error(
          `That quantity exceeds the available stock or the ${settings.maxQuantity}-item limit.`,
        );
      }
      save([
        ...current.filter((i) => i.productId !== productId),
        { productId, quantity: next },
      ]);
    },
    clear() {
      save([]);
    },
  };
}
