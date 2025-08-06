import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function InvoiceList() {
  const { data, error } = useSWR('/api/member/invoices', fetcher);

  if (error) return <div className="text-red-500">Failed to load invoices</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div className="p-4 border rounded mb-4">
      <h2 className="text-lg font-semibold mb-2">Invoices</h2>
      <ul className="list-disc pl-5">
        {(data.invoices || []).map((inv: any) => (
          <li key={inv.invoice_id}>{inv.invoice_number}</li>
        ))}
      </ul>
    </div>
  );
}
