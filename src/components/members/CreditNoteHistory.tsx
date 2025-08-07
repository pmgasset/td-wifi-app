import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CreditNoteHistory() {
  const { data } = useSWR('/api/billing/credit-notes', fetcher);
  if (!data) return <div>Loading credit notes...</div>;
  const notes = data.creditnotes || [];
  if (notes.length === 0) return <div>No credit notes found.</div>;

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Credit Notes</h2>
      <ul className="space-y-2">
        {notes.map((note: any) => (
          <li key={note.creditnote_id} className="p-4 border rounded">
            <span>{note.creditnote_number}</span> - <span>{note.total}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
