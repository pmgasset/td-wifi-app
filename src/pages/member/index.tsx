// @ts-ignore - Auth0 SDK exports client helpers from root
import { withPageAuthRequired } from '@auth0/nextjs-auth0';
import PlanManager from '../../components/member/PlanManager';
import PaymentMethodForm from '../../components/member/PaymentMethodForm';
import InvoiceHistory from '../../components/member/InvoiceHistory';
import CreditNoteHistory from '../../components/member/CreditNoteHistory';

function MemberPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Member Portal</h1>
      <PlanManager />
      <PaymentMethodForm />
      <InvoiceHistory />
      <CreditNoteHistory />
    </div>
  );
}

export default withPageAuthRequired(MemberPage);
