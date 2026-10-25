import { testCards } from '@shop/contracts';
export default function PaymentFields() {
  return (
    <fieldset className="stack">
      <legend>Simulated payment</legend>
      <p>Use a test card below. Real card numbers are not accepted.</p>
      <label>
        Test card
        <select name="number" required>
          {testCards.map((card) => (
            <option key={card.number} value={card.number}>
              {card.label} · {card.number.slice(-4)}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <label>
          Expiry month
          <input
            name="expMonth"
            type="number"
            min={1}
            max={12}
            defaultValue={12}
            required
          />
        </label>
        <label>
          Expiry year
          <input
            name="expYear"
            type="number"
            min={2026}
            max={2100}
            defaultValue={2030}
            required
          />
        </label>
        <label>
          Test CVC
          <input
            name="cvc"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{3,4}"
            maxLength={4}
            autoComplete="off"
            required
          />
        </label>
      </div>
    </fieldset>
  );
}
export function cardFromForm(data: FormData) {
  return {
    number: String(data.get('number')),
    expMonth: Number(data.get('expMonth')),
    expYear: Number(data.get('expYear')),
    cvc: String(data.get('cvc') || ''),
  };
}
