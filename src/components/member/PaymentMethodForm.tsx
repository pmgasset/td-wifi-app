import { useState } from 'react';

export default function PaymentMethodForm() {
  const [number, setNumber] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/member/payment-method', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'subscription-id', number }),
    });
    setNumber('');
  };

  return (
    <form onSubmit={submit} className="border p-4 rounded space-y-2">
      <h2 className="text-xl font-semibold">Payment Method</h2>
      <input
        className="border p-2 w-full"
        placeholder="Card Number"
        value={number}
        onChange={e => setNumber(e.target.value)}
      />
      <button className="px-3 py-1 bg-green-500 text-white rounded" type="submit">Update</button>
    </form>
  );
}
