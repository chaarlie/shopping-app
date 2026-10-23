import { z } from 'zod';

export const testCards = [
  {
    number: '4242424242424242',
    brand: 'visa',
    outcome: 'approved',
    label: 'Visa, approved',
  },
  {
    number: '5555555555554444',
    brand: 'mastercard',
    outcome: 'approved',
    label: 'Mastercard, approved',
  },
  {
    number: '4000000000000002',
    brand: 'visa',
    outcome: 'declined',
    declineCode: 'card_declined',
    declineMessage: 'Your card was declined.',
    label: 'Visa, declined',
  },
  {
    number: '4000000000009995',
    brand: 'visa',
    outcome: 'declined',
    declineCode: 'insufficient_funds',
    declineMessage: 'Your card has insufficient funds.',
    label: 'Visa, declined for insufficient funds',
  },
] as const;

export type TestCard = (typeof testCards)[number];

export function findTestCard(number: string): TestCard | undefined {
  return testCards.find((card) => card.number === number);
}

const cardNumberSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((number) => findTestCard(number) !== undefined, {
    error:
      'Use one of the test cards, such as 4242 4242 4242 4242. Real card numbers are refused.',
  });

function isNotExpired(card: { expMonth: number; expYear: number }): boolean {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  return (
    card.expYear > year || (card.expYear === year && card.expMonth >= month)
  );
}

export const cardSchema = z
  .strictObject({
    number: cardNumberSchema,
    expMonth: z
      .number()
      .int('Expiry month must be 1 to 12')
      .min(1, 'Expiry month must be 1 to 12')
      .max(12, 'Expiry month must be 1 to 12'),
    expYear: z
      .number()
      .int('Expiry year must be a four-digit year')
      .min(2000, 'Expiry year must be a four-digit year')
      .max(2100, 'Expiry year must be a four-digit year'),
    cvc: z.string().regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits'),
  })
  .refine(isNotExpired, { error: 'The card has expired', path: ['expYear'] });

export type CardInput = z.input<typeof cardSchema>;

export type Card = z.output<typeof cardSchema>;
