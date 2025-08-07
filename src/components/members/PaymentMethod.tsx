import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PaymentMethod() {
  const { data } = useSWR('/api/billing/payment-method', fetcher);
  if (!data) return <div>Loading payment method...</div>;
  const method = data.payment_methods?.[0] || data.payment_method;
  if (!method) return <div>No payment method on file.</div>;

  const card = method.card || {};
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Payment Method</h2>
      <p>{card.brand ? `${card.brand} ****${card.last4}` : 'Payment method details unavailable'}</p>
    </section>
  );
}
