import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from '@auth0/nextjs-auth0';
import { zohoBillingAPI } from '../../../lib/zoho-billing-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }
  try {
    const method = await zohoBillingAPI.getPaymentMethodByEmail(session.user.email as string);
    return res.status(200).json(method);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
