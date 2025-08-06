import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PlanManager() {
  const { data } = useSWR('/api/member/subscription', fetcher);

  const changePlan = async () => {
    await fetch('/api/member/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'new-plan' }),
    });
  };

  const cancel = async () => {
    await fetch('/api/member/subscription', { method: 'DELETE' });
  };

  return (
    <div className="border p-4 rounded">
      <h2 className="text-xl font-semibold mb-2">Plan</h2>
      <p className="mb-4">{data?.subscription?.plan_name || 'Loading...'}</p>
      <div className="space-x-2">
        <button className="px-3 py-1 bg-blue-500 text-white rounded" onClick={changePlan}>Change Plan</button>
        <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}
