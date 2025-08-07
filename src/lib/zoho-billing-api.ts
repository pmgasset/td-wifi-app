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
    const customerId = await this.getCustomerIdByEmail(email);
    return this.request(`/subscriptions?customer_id=${customerId}`);
  }

  async cancelSubscription(subscriptionId: string) {
    return this.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  async resumeSubscription(subscriptionId: string) {
    return this.request(`/subscriptions/${subscriptionId}/resume`, { method: 'POST' });
  }

  async getInvoicesByEmail(email: string) {
    const customerId = await this.getCustomerIdByEmail(email);
    return this.request(`/invoices?customer_id=${customerId}`);
  }

  async getCreditNotesByEmail(email: string) {
    const customerId = await this.getCustomerIdByEmail(email);
    return this.request(`/creditnotes?customer_id=${customerId}`);
  }

  async getPaymentMethodByEmail(email: string) {
    const customerId = await this.getCustomerIdByEmail(email);
    return this.request(`/paymentmethods?customer_id=${customerId}`);
  }

  private async getCustomerIdByEmail(email: string): Promise<string> {
    const data = await this.request(`/customers?filter_by=Email==${encodeURIComponent(email)}`);
    const customer = data?.customers?.[0];
    if (!customer?.customer_id) {
      throw new Error('Customer not found');
    }
    return customer.customer_id as string;
  }
}

export const zohoBillingAPI = new ZohoBillingAPI();
