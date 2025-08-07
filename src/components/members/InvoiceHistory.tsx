import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function InvoiceHistory() {
  const { data } = useSWR('/api/billing/invoices', fetcher);
  if (!data) return <div>Loading invoices...</div>;
  const invoices = data.invoices || [];
  if (invoices.length === 0) return <div>No invoices found.</div>;

  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Invoices</h2>
      <ul className="space-y-2">
        {invoices.map((inv: any) => (
          <li key={inv.invoice_id} className="p-4 border rounded">
            <span>{inv.invoice_number}</span> - <span>{inv.total}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
