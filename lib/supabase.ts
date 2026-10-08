import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True once both public env vars are set. Until then the app runs in demo mode. */
export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * Anonymous Supabase client. Safe on both server and browser: it only ever
 * carries the anon key, and row-level security does the rest.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
