import { tokenManager } from './enhanced-token-manager';

class ZohoBillingAPI {
  private baseURL = 'https://www.zohoapis.com/billing/v1';

  private async request(endpoint: string, options: RequestInit = {}) {
    const orgId = process.env.ZOHO_BILLING_ORG_ID;
    if (!orgId) {
      throw new Error('Missing ZOHO_BILLING_ORG_ID environment variable');
    }
    const token = await tokenManager.getAccessToken('billing');
    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      'X-com-zoho-subscriptions-organizationid': orgId,
    };
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
    });
    if (!response.ok) {
      throw new Error(`Zoho Billing API error: ${response.status} ${await response.text()}`);
    }
    return response.json();
  }

  async getSubscriptionByEmail(email: string) {
    return this.request(`/subscriptions?customer_email=${encodeURIComponent(email)}`);
  }

  async cancelSubscription(subscriptionId: string) {
    return this.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  async resumeSubscription(subscriptionId: string) {
    return this.request(`/subscriptions/${subscriptionId}/resume`, { method: 'POST' });
  }

  async getInvoicesByEmail(email: string) {
    return this.request(`/invoices?customer_email=${encodeURIComponent(email)}`);
  }

  async getCreditNotesByEmail(email: string) {
    return this.request(`/creditnotes?customer_email=${encodeURIComponent(email)}`);
  }

  async getPaymentMethodByEmail(email: string) {
    return this.request(`/paymentmethods?customer_email=${encodeURIComponent(email)}`);
  }
}

export const zohoBillingAPI = new ZohoBillingAPI();
