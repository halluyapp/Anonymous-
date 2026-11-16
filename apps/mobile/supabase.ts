import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
const storage={getItem:(k:string)=>SecureStore.getItemAsync(k),setItem:(k:string,v:string)=>SecureStore.setItemAsync(k,v),removeItem:(k:string)=>SecureStore.deleteItemAsync(k)};
export const supabase=createClient(process.env.EXPO_PUBLIC_SUPABASE_URL||'https://bkhldfjqxarnqmcidwog.supabase.co',process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_nSiFOIthyCgonT-zq4OJDg_PkUjYe0H',{auth:{storage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
