import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Reserved endpoint for Phase 2 Gemini AI integration.
 * GEMINI_API_KEY will be consumed strictly server-side here.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(501).json({
    error: 'AI air-quality insights will be available in Phase 2.',
  });
}
