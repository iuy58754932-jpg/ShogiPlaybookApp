import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// createClient は URL/キーが空だと同期的に throw するため、未設定時は null に倒して
// アプリ側で設定案内画面を出す（ローカルで .env なしでも起動できるようにする）
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

/** 保護ルート内などクライアントが必ず存在する文脈で使う */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase が設定されていません')
  return supabase
}
