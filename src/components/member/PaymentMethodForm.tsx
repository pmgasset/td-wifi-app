import { useState } from 'react';

export default function PaymentMethodForm() {
  const [method, setMethod] = useState('card');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/member/payment-method', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { method } }),
    });
  };

  return (
    <form onSubmit={submit} className="p-4 border rounded space-y-2">
      <h2 className="text-xl font-semibold">Payment Method</h2>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="border p-2 w-full"
      >
        <option value="card">Card</option>
        <option value="ach">ACH</option>
      </select>
      <button type="submit" className="px-4 py-2 bg-logo-teal text-white rounded">
        Update
      </button>
    </form>
  );
}
