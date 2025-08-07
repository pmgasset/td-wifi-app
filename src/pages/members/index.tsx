import { withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import Layout from '../../components/Layout';
import SubscriptionManager from '../../components/members/SubscriptionManager';
import PaymentMethod from '../../components/members/PaymentMethod';
import InvoiceHistory from '../../components/members/InvoiceHistory';
import CreditNoteHistory from '../../components/members/CreditNoteHistory';

function MembersPage() {
  return (
    <Layout title="Member Portal">
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Member Portal</h1>
          <a href="/api/auth/logout" className="text-sm text-logo-teal hover:underline">Logout</a>
        </div>
        <SubscriptionManager />
        <PaymentMethod />
        <InvoiceHistory />
        <CreditNoteHistory />
      </div>
    </Layout>
  );
}

export default withPageAuthRequired(MembersPage);
