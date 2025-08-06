import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CreditNoteList() {
  const { data, error } = useSWR('/api/member/credit-notes', fetcher);

  if (error) return <div className="text-red-500">Failed to load credit notes</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div className="p-4 border rounded mb-4">
      <h2 className="text-lg font-semibold mb-2">Credit Notes</h2>
      <ul className="list-disc pl-5">
        {(data.creditNotes || []).map((note: any) => (
          <li key={note.creditnote_id}>{note.creditnote_number}</li>
        ))}
      </ul>
    </div>
  );
}
