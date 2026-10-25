import CheckoutForm from '../components/checkout/checkout-form';
export default function CheckoutPage() {
  return (
    <>
      <div className="page-head">
        <h1>Checkout</h1>
        <p>Guest checkout · no real charges</p>
      </div>
      <CheckoutForm />
    </>
  );
}
