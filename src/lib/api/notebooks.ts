import type { NotebookRow } from '../db-types'
import { requireSupabase } from '../supabase'

export async function listNotebooks(): Promise<NotebookRow[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('notebooks')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as NotebookRow[]
}

export async function createNotebook(
  userId: string,
  name: string,
  description: string | null,
): Promise<NotebookRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('notebooks')
    .insert({ user_id: userId, name, description })
    .select()
    .single()
  if (error) throw error
  return data as NotebookRow
}

export async function updateNotebook(
  id: string,
  patch: { name?: string; description?: string | null },
): Promise<NotebookRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('notebooks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as NotebookRow
}

export async function deleteNotebook(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('notebooks').delete().eq('id', id)
  if (error) throw error
}
