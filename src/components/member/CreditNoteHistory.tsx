import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CreditNoteHistory() {
  const { data } = useSWR('/api/member/credit-notes', fetcher);
  return (
    <div className="border p-4 rounded">
      <h2 className="text-xl font-semibold mb-2">Credit Notes</h2>
      <ul className="list-disc pl-5 space-y-1">
        {data?.creditnotes?.map((cn: any) => (
          <li key={cn.creditnote_id}>{cn.creditnote_number}</li>
        )) || <li>None</li>}
      </ul>
    </div>
  );
}
