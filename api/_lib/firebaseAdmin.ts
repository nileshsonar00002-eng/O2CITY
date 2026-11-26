import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedApp: App | null = null;

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key) as { private_key?: unknown };
      if (typeof parsed.private_key === 'string') {
        key = parsed.private_key;
      }
    } catch {
      // Fall through to standard PEM normalization
    }
  }
  return key
    .replace(/^["']|["']$/g, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
      process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
      process.env.FIREBASE_PRIVATE_KEY?.trim()
  );
}

export function getFirebaseAdminDb(): Firestore | null {
  if (!isFirebaseAdminConfigured()) {
    return null;
  }

  if (!cachedApp) {
    const existing = getApps();
    if (existing.length > 0) {
      cachedApp = existing[0] ?? null;
    } else {
      const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY!);
      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        throw new Error('FIREBASE_PRIVATE_KEY_INVALID_FORMAT');
      }

      cachedApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!.trim(),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!.trim(),
          privateKey,
        }),
      });
    }
  }

  return cachedApp ? getFirestore(cachedApp) : null;
}
