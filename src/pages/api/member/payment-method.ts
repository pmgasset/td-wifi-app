import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ZohoBillingAPI } from '../../../lib/zoho-billing-api';
import type { NextApiRequest, NextApiResponse } from 'next';

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const subscriptionId = req.query.id as string;
    const data = await ZohoBillingAPI.updatePaymentMethod(subscriptionId, req.body);
    res.status(200).json({ subscription: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
