import PlanManager from './PlanManager';
import PaymentMethodForm from './PaymentMethodForm';
import InvoiceList from './InvoiceList';
import CreditNoteList from './CreditNoteList';

export default function MemberDashboard() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <PlanManager />
      <PaymentMethodForm />
      <InvoiceList />
      <CreditNoteList />
    </div>
  );
}
