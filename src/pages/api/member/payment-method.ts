import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { zohoBillingAPI } from '../../../lib/zoho-billing-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { subscriptionId, data } = req.body || {};
    let subId = subscriptionId;
    if (!subId) {
      const sub = await zohoBillingAPI.getSubscription(session.user.email as string);
      subId = sub?.subscriptions?.[0]?.subscription_id;
    }
    const result = await zohoBillingAPI.updatePaymentMethod(subId, data);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
