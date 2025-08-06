import { tokenManager } from './enhanced-token-manager';

const BASE_URL = 'https://billing.zoho.com/api/v3';

async function request(endpoint: string, options: RequestInit = {}) {
  const token = await tokenManager.getAccessToken('billing');
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'X-com-zoho-subscriptions-organizationid': process.env.ZOHO_BILLING_ORG_ID || '',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho Billing API error: ${res.status} ${text}`);
  }
  return res.json();
}

export const ZohoBillingAPI = {
  getSubscription: (id: string) => request(`/subscriptions/${id}`),
  updateSubscription: (id: string, data: any) =>
    request(`/subscriptions/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  cancelSubscription: (id: string) =>
    request(`/subscriptions/${id}/cancel`, { method: 'POST' }),
  updatePaymentMethod: (id: string, data: any) =>
    request(`/subscriptions/${id}/payment_method`, { method: 'POST', body: JSON.stringify(data) }),
  getInvoices: (customerId: string) => request(`/invoices?customer_id=${customerId}`),
  getCreditNotes: (customerId: string) => request(`/creditnotes?customer_id=${customerId}`)
};
