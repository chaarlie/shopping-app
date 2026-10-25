import OrderStatus from '../../components/checkout/order-status';
export default async function OrderPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return (
    <div className="section">
      <OrderStatus reference={reference} />
    </div>
  );
}
