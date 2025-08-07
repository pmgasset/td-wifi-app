import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Layout from '../../components/Layout';
import PlanManagement from '../../components/member/PlanManagement';
import Cancellation from '../../components/member/Cancellation';
import PaymentMethodForm from '../../components/member/PaymentMethodForm';
import InvoiceHistory from '../../components/member/InvoiceHistory';
import CreditNoteHistory from '../../components/member/CreditNoteHistory';

function MemberPage() {
  return (
    <Layout title="Member Portal">
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Member Portal</h1>
          <a href="/api/auth/logout" className="text-sm text-logo-teal hover:underline">Logout</a>
        </div>
        <PlanManagement />
        <Cancellation />
        <PaymentMethodForm />
        <InvoiceHistory />
        <CreditNoteHistory />
      </div>
    </Layout>
  );
}

export default withPageAuthRequired(MemberPage);
