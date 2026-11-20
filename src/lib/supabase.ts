import { createClient } from '@supabase/supabase-js';

const appMode = import.meta.env.VITE_APP_MODE as string | undefined;
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Hosted preview deployments intentionally do not connect to the production database.
// Local dashboard development uses the local Supabase URL from .env.local.
export const isSupabaseConfigured = appMode !== 'preview-safe' && Boolean(url && key);
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export type AppRole = 'admin' | 'teacher' | 'assistant' | 'developer' | 'designer' | 'student' | 'parent';
export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  role: AppRole;
  is_active: boolean;
  preferred_language: 'en' | 'ar';
};
