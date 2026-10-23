import { authorizeTestCard } from './simulated-card-provider.js';

describe('authorizeTestCard', () => {
  it('approves the Visa and Mastercard success cards', () => {
    expect(authorizeTestCard('4242424242424242')).toEqual({
      brand: 'visa',
      last4: '4242',
      response: { outcome: 'approved' },
    });
    expect(authorizeTestCard('5555555555554444').brand).toBe('mastercard');
  });

  it('declines the generic decline card with its reason', () => {
    expect(authorizeTestCard('4000000000000002').response).toEqual({
      outcome: 'declined',
      code: 'card_declined',
      message: 'Your card was declined.',
    });
  });

  it('declines for insufficient funds', () => {
    expect(authorizeTestCard('4000000000009995').response).toMatchObject({
      outcome: 'declined',
      code: 'insufficient_funds',
    });
  });

  it('declines any card that is not a test card', () => {
    expect(authorizeTestCard('4111111111111111').response).toMatchObject({
      outcome: 'declined',
      code: 'card_not_supported',
    });
  });
});
