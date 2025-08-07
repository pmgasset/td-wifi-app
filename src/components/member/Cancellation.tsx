import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Cancellation() {
  const { data, mutate } = useSWR('/api/member/subscription', fetcher);

  if (!data?.subscription_id) return null;

  const cancel = async () => {
    await fetch('/api/member/subscription', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: data.subscription_id }),
    });
    mutate();
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Cancel Subscription</h2>
      <button
        onClick={cancel}
        className="px-4 py-2 bg-red-500 text-white rounded"
      >
        Cancel
      </button>
    </div>
  );
}
