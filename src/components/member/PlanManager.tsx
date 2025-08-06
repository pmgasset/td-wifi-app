import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PlanManager() {
  const { data, error } = useSWR('/api/member/subscription', fetcher);

  if (error) return <div className="text-red-500">Failed to load subscription</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div className="p-4 border rounded mb-4">
      <h2 className="text-lg font-semibold mb-2">Current Plan</h2>
      <p className="mb-2">{data.subscription?.plan?.name || 'No active subscription'}</p>
      {/* Add plan change UI here */}
    </div>
  );
}
