import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PlanManagement() {
  const { data } = useSWR('/api/member/subscription', fetcher);

  if (!data) {
    return <div className="p-4 border rounded">Loading plan...</div>;
  }

  const changePlan = async () => {
    if (!data.subscription_id) return;
    await fetch('/api/member/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: data.subscription_id, data: {} }),
    });
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Plan Management</h2>
      <p className="mb-4">{data.plan_name || 'No active subscription'}</p>
      {data.subscription_id && (
        <button
          onClick={changePlan}
          className="px-4 py-2 bg-logo-teal text-white rounded"
        >
          Change Plan
        </button>
      )}
    </div>
  );
}
