import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// createClient は URL/キーが空だと同期的に throw するため、未設定時は null に倒して
// アプリ側で設定案内画面を出す（ローカルで .env なしでも起動できるようにする）
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
