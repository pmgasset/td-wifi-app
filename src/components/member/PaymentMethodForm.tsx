import { useState } from 'react';

export default function PaymentMethodForm() {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const res = await fetch('/api/member/payment-method', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    });
    setStatus(res.ok ? 'Updated payment method' : 'Failed to update');
  };

  return (
    <form onSubmit={submit} className="p-4 border rounded mb-4">
      <h2 className="text-lg font-semibold mb-2">Payment Method</h2>
      <input
        className="border p-2 w-full mb-2"
        placeholder="Payment method token"
        value={paymentMethod}
        onChange={e => setPaymentMethod(e.target.value)}
      />
      <button className="px-4 py-2 bg-blue-500 text-white rounded" type="submit">
        Save
      </button>
      {status && <p className="mt-2">{status}</p>}
    </form>
  );
}
