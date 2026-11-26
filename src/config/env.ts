/**
 * Client-safe public environment configuration.
 * NEVER read or reference server secrets (CPCB_API_KEY, GEMINI_API_KEY, FIREBASE_PRIVATE_KEY) here.
 */
export const publicConfig = {
  firebase: {
    apiKey:
      import.meta.env.VITE_FIREBASE_API_KEY ||
      'AIzaSyABNdDaEwWYU1LoeC3g7eydKr13Wb7r3gA',
    authDomain:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'o2city.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'o2city',
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
      'o2city.firebasestorage.app',
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '887316440069',
    appId:
      import.meta.env.VITE_FIREBASE_APP_ID ||
      '1:887316440069:web:61cfdfe1dc00d51893286c',
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
