/**
 * Client-safe public environment configuration.
 * NEVER read or reference server secrets (CPCB_API_KEY, GEMINI_API_KEY, FIREBASE_PRIVATE_KEY) here.
 */
export const publicConfig = {
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  },
  mappls: {
    mapKey: import.meta.env.VITE_MAPPLS_MAP_KEY ?? '',
  },
} as const;

export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId, appId } = publicConfig.firebase;
  return Boolean(apiKey && projectId && appId);
}

export function isMapplsConfigured(): boolean {
  return Boolean(publicConfig.mappls.mapKey);
}
