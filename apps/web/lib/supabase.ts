import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bkhldfjqxarnqmcidwog.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_nSiFOIthyCgonT-zq4OJDg_PkUjYe0H';
export const supabase = url && key ? createClient(url, key) : null;
export const configured = Boolean(url && key);
