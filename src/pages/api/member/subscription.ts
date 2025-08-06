import type { NextApiRequest, NextApiResponse } from 'next';
// @ts-ignore - Auth0 SDK types may not expose this helper
import { getSession } from '@auth0/nextjs-auth0';
import { zohoBillingAPI } from '../../../lib/zoho-billing-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = (req.query.id as string) || '';

  try {
    if (req.method === 'GET') {
      const data = await zohoBillingAPI.getSubscription(id);
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const data = await zohoBillingAPI.changeSubscription(id, req.body);
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const data = await zohoBillingAPI.cancelSubscription(id);
      return res.status(200).json(data);
    }
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end('Method Not Allowed');
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
