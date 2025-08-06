import { tokenManager } from './enhanced-token-manager';

const BASE_URL = 'https://billing.zoho.com/api/v3';

class ZohoBillingAPI {
  private async request(path: string, init: RequestInit = {}) {
    const token = await tokenManager.getAccessToken('billing');
    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    };
    if (process.env.ZOHO_BILLING_ORG_ID) {
      headers['X-Zoho-Organization'] = process.env.ZOHO_BILLING_ORG_ID;
    }
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as any) },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho Billing API error: ${res.status} ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  getSubscription(id: string) {
    return this.request(`/subscriptions/${id}`);
  }

  changeSubscription(id: string, data: any) {
    return this.request(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  cancelSubscription(id: string) {
    return this.request(`/subscriptions/${id}/cancel`, { method: 'POST' });
  }

  updatePaymentMethod(id: string, data: any) {
    return this.request(`/subscriptions/${id}/paymentmethod`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getInvoices(customerId: string) {
    return this.request(`/invoices?customer_id=${customerId}`);
  }

  getCreditNotes(customerId: string) {
    return this.request(`/creditnotes?customer_id=${customerId}`);
  }
}

export const zohoBillingAPI = new ZohoBillingAPI();
export default ZohoBillingAPI;
