import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { zohoBillingAPI } from '../../../lib/zoho-billing-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const email = session.user.email as string;
    switch (req.method) {
      case 'GET': {
        const subscription = await zohoBillingAPI.getSubscription(email);
        return res.status(200).json(subscription);
      }
      case 'POST': {
        const { subscriptionId, data } = req.body || {};
        let subId = subscriptionId;
        if (!subId) {
          const sub = await zohoBillingAPI.getSubscription(email);
          subId = sub?.subscriptions?.[0]?.subscription_id;
        }
        const result = await zohoBillingAPI.changeSubscription(subId, data);
        return res.status(200).json(result);
      }
      case 'DELETE': {
        const { subscriptionId } = req.body || {};
        let subId = subscriptionId;
        if (!subId) {
          const sub = await zohoBillingAPI.getSubscription(email);
          subId = sub?.subscriptions?.[0]?.subscription_id;
        }
        const result = await zohoBillingAPI.cancelSubscription(subId);
        return res.status(200).json(result);
      }
      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end('Method Not Allowed');
    }
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
