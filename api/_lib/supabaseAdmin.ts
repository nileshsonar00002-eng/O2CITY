import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

function readSupabaseConfig(): { url: string; secretKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    return null;
  }

  return { url, secretKey };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig() !== null;
}

/**
 * Returns a server-only Supabase admin client using SUPABASE_URL and SUPABASE_SECRET_KEY.
 * Never import this module from frontend client code.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const config = readSupabaseConfig();
  if (!config) {
    return null;
  }

  cachedClient = createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
