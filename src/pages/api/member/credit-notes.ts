import type { NextApiRequest, NextApiResponse } from 'next';
// @ts-ignore - Auth0 SDK types may not expose this helper
import { getSession } from '@auth0/nextjs-auth0';
import { zohoBillingAPI } from '../../../lib/zoho-billing-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }
  try {
    const customerId = (req.query.customerId as string) || '';
    const data = await zohoBillingAPI.getCreditNotes(customerId);
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
