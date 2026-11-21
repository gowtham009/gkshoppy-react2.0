import { createClient } from '@supabase/supabase-js';

// Support runtime injection (Docker) or build-time env vars (local dev)
const w = window as Window & { __env?: Record<string, string> };
const supabaseUrl =
  w.__env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  w.__env?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not configured; auth features will be disabled.');
}

export const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseAnonKey || 'placeholder-key');
