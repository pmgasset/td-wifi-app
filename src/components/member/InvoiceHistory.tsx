import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function InvoiceHistory() {
  const { data } = useSWR('/api/member/invoices', fetcher);

  if (!data) return <div className="p-4 border rounded">Loading invoices...</div>;

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-semibold mb-2">Invoice History</h2>
      <ul className="list-disc pl-5">
        {data.invoices?.map((inv: any) => (
          <li key={inv.invoice_id}>{inv.invoice_number} - {inv.status}</li>
        ))}
      </ul>
    </div>
  );
}
