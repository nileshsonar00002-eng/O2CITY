import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CPCBError, fetchCPCBData } from '../_lib/cpcb.js';
import { isFirebaseAdminConfigured } from '../_lib/firebaseAdmin.js';
import { FirestoreIngestError, persistIngestedData } from '../_lib/ingestService.js';

function isAuthorizedIngestion(req: VercelRequest): boolean {
  const expectedSecret =
    process.env.CRON_SECRET?.trim() || process.env.INGEST_CRON_SECRET?.trim();
  const authHeader = req.headers.authorization ?? '';

  if (expectedSecret) {
    return authHeader === `Bearer ${expectedSecret}`;
  }

  const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  return !isProd;
}

function logSafeError(stage: string, code: string, message: string, durationMs: number): void {
  console.error(
    JSON.stringify({
      event: 'cpcb_ingest_failed',
      stage,
      code,
      message,
      durationMs,
      timestamp: new Date().toISOString(),
    })
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (!isAuthorizedIngestion(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (!isFirebaseAdminConfigured()) {
    logSafeError('CONFIG', 'FIREBASE_ENV_MISSING', 'Firebase Admin env vars missing', Date.now() - startedAt);
    res.status(503).json({
      success: false,
      stage: 'CONFIG',
      code: 'FIREBASE_ENV_MISSING',
      error: 'Server database credentials are not configured',
    });
    return;
  }

  if (!process.env.CPCB_API_KEY?.trim()) {
    logSafeError('CONFIG', 'CPCB_ENV_MISSING', 'CPCB_API_KEY missing', Date.now() - startedAt);
    res.status(503).json({
      success: false,
      stage: 'CONFIG',
      code: 'CPCB_ENV_MISSING',
      error: 'CPCB API credentials are not configured',
    });
    return;
  }

  try {
    const { stations, readings, skippedCount } = await fetchCPCBData();
    const summary = await persistIngestedData(stations, readings, skippedCount);
    res.status(200).json(summary);
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    if (err instanceof CPCBError) {
      logSafeError('CPCB_FETCH', err.code, err.message, durationMs);
      res.status(err.statusCode).json({
        success: false,
        stage: 'CPCB_FETCH',
        code: err.code,
        error: err.message,
      });
      return;
    }

    if (err instanceof FirestoreIngestError) {
      logSafeError('FIRESTORE_WRITE', err.code, err.message, durationMs);
      res.status(500).json({
        success: false,
        stage: 'FIRESTORE_WRITE',
        code: err.code,
        error: err.message,
      });
      return;
    }

    const safeMessage = err instanceof Error ? err.name : 'Unexpected error';
    logSafeError('UNKNOWN', 'INTERNAL_ERROR', safeMessage, durationMs);
    res.status(500).json({
      success: false,
      stage: 'UNKNOWN',
      code: 'INTERNAL_ERROR',
      error: 'CPCB ingestion failed due to an internal server error.',
    });
  }
}
