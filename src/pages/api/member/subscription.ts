import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import { ZohoBillingAPI } from '../../../lib/zoho-billing-api';
import type { NextApiRequest, NextApiResponse } from 'next';

export default withApiAuthRequired(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, query } = req;
  const subscriptionId = query.id as string;

  try {
    switch (method) {
      case 'GET': {
        const data = await ZohoBillingAPI.getSubscription(subscriptionId);
        res.status(200).json({ subscription: data });
        break;
      }
      case 'POST': {
        const data = await ZohoBillingAPI.updateSubscription(subscriptionId, req.body);
        res.status(200).json({ subscription: data });
        break;
      }
      case 'DELETE': {
        const data = await ZohoBillingAPI.cancelSubscription(subscriptionId);
        res.status(200).json({ subscription: data });
        break;
      }
      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
