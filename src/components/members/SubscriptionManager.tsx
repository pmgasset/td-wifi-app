import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function SubscriptionManager() {
  const { data, mutate } = useSWR('/api/billing/subscription', fetcher);
  const [loading, setLoading] = useState(false);

  if (!data) return <div>Loading subscription...</div>;
  const subscription = data.subscriptions?.[0];
  if (!subscription) return <div>No active subscription.</div>;

  const handle = async (action: 'cancel' | 'resume') => {
    setLoading(true);
    await fetch(`/api/billing/subscription/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: subscription.subscription_id }),
    });
    await mutate();
    setLoading(false);
  };

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Subscription</h2>
      <p className="mb-4">Status: {subscription.status}</p>
      {subscription.status === 'active' ? (
        <button
          onClick={() => handle('cancel')}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Cancel
        </button>
      ) : (
        <button
          onClick={() => handle('resume')}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Restart
        </button>
      )}
    </section>
  );
}
