import { createClient } from '@supabase/supabase-js';

type SupabaseEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

declare global {
  interface Window {
    __env?: SupabaseEnv;
  }
}

const w = typeof window !== 'undefined' ? window : undefined;
const env = (import.meta as ImportMeta & { env?: SupabaseEnv }).env ?? {};
const supabaseUrl = w?.__env?.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = w?.__env?.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
