import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// A valid client is always created so the UI never becomes a white screen when Vercel env vars are missing.
// Network operations fail safely and are surfaced by the app's connection state instead of crashing startup.
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const supabaseConfig = {
  configured: Boolean(supabaseUrl && supabaseAnonKey),
  url: supabaseUrl,
};
