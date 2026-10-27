'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { checkoutSettingsSchema } from '@shop/contracts';
import { useResource } from './use-resource';

const SettingsContext = createContext<{
  maxQuantity: number | null;
  error: string | null;
  reload: () => void;
}>({ maxQuantity: null, error: null, reload: () => {} });

export function CheckoutSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const settings = useResource('/orders/settings', checkoutSettingsSchema);
  return (
    <SettingsContext
      value={{
        maxQuantity: settings.data?.maxQuantityPerProduct ?? null,
        error: settings.error,
        reload: settings.reload,
      }}
    >
      {children}
    </SettingsContext>
  );
}

export function useCheckoutSettings() {
  return useContext(SettingsContext);
}
