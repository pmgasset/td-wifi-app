import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ZohoBillingAPI } from '../../../lib/zoho-billing-api';
import type { NextApiRequest, NextApiResponse } from 'next';

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const customerId = req.query.customerId as string;
    const data = await ZohoBillingAPI.getInvoices(customerId);
    res.status(200).json({ invoices: data.invoices || data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
