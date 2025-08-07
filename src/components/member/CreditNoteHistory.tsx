import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CreditNoteHistory() {
  const { data } = useSWR('/api/member/credit-notes', fetcher);

  if (!data) return <div className="p-4 border rounded">Loading credit notes...</div>;

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Credit Notes</h2>
      <ul className="list-disc pl-5">
        {data.creditnotes?.map((note: any) => (
          <li key={note.creditnote_id}>{note.creditnote_number} - {note.status}</li>
        ))}
      </ul>
    </div>
  );
}
