import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchCPCBData } from '../_lib/cpcb.js';
import { isFirebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { persistIngestedData } from '../_lib/ingestService.js';

function isAuthorizedIngestion(req: VercelRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET || process.env.INGEST_CRON_SECRET;
  const authHeader = req.headers.authorization ?? '';

  if (expectedSecret) {
    return authHeader === `Bearer ${expectedSecret}`;
  }

  // Never allow unauthenticated public ingestion in production/Vercel
  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  return !isProd;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorizedIngestion(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isFirebaseAdminConfigured()) {
    res.status(503).json({ error: 'Server database credentials are not configured' });
    return;
  }

  try {
    const { stations, readings, skippedCount } = await fetchCPCBData();
    const summary = await persistIngestedData(stations, readings, skippedCount);
    res.status(200).json(summary);
  } catch {
    res.status(500).json({ error: 'CPCB ingestion failed. Check server configuration.' });
  }
}
