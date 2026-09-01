import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || 'https://configuration-required.supabase.co', anonKey || 'configuration-required', {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
