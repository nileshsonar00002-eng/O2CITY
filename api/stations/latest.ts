import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleLatestStations } from '../_lib/stationsHandler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleLatestStations(req, res);
}
