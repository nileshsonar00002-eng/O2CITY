import type { VercelRequest, VercelResponse } from '@vercel/node';
import cpcbIngestHandler from './ingest/cpcb.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return cpcbIngestHandler(req, res);
}
