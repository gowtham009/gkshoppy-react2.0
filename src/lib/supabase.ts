import { createClient } from '@supabase/supabase-js';

// Support runtime injection (Docker) or build-time env vars (local dev)
const w = window as Window & { __env?: Record<string, string> };
const supabaseUrl =
  w.__env?.VITE_SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  w.__env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
