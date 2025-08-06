import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function InvoiceHistory() {
  const { data } = useSWR('/api/member/invoices', fetcher);
  return (
    <div className="border p-4 rounded">
      <h2 className="text-xl font-semibold mb-2">Invoices</h2>
      <ul className="list-disc pl-5 space-y-1">
        {data?.invoices?.map((inv: any) => (
          <li key={inv.invoice_id}>{inv.invoice_number}</li>
        )) || <li>None</li>}
      </ul>
    </div>
  );
}
