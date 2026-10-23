import { findTestCard } from '@shop/contracts';

export type ProviderResponse =
  | { outcome: 'approved' }
  | { outcome: 'declined'; code: string; message: string };

export interface CardAuthorization {
  brand: string;
  last4: string;
  response: ProviderResponse;
}

export function authorizeTestCard(number: string): CardAuthorization {
  const card = findTestCard(number);
  const last4 = number.slice(-4);

  if (!card) {
    return {
      brand: 'unknown',
      last4,
      response: {
        outcome: 'declined',
        code: 'card_not_supported',
        message: 'Only test cards are accepted.',
      },
    };
  }

  return {
    brand: card.brand,
    last4,
    response:
      card.outcome === 'approved'
        ? { outcome: 'approved' }
        : {
            outcome: 'declined',
            code: card.declineCode,
            message: card.declineMessage,
          },
  };
}
