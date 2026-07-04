import { initialSfen } from 'shogiops/sfen'
import type { TreeRow } from '../db-types'
import { requireSupabase } from '../supabase'

export async function listTrees(): Promise<TreeRow[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('trees')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as TreeRow[]
}

export async function getTree(id: string): Promise<TreeRow> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('trees').select('*').eq('id', id).single()
  if (error) throw error
  return data as TreeRow
}

/** ツリーを作成し、根ノード（初期局面）も同時に作る */
export async function createTree(
  userId: string,
  name: string,
  description: string | null,
): Promise<TreeRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('trees')
    .insert({ user_id: userId, name, description })
    .select()
    .single()
  if (error) throw error
  const tree = data as TreeRow
  // 根ノード。ここで失敗しても throw しない — ツリー行は既に存在しており、
  // エディタが読込時に根を自己修復するため、作成自体は成功として扱う
  const { error: nodeError } = await sb.from('nodes').insert({
    tree_id: tree.id,
    parent_id: null,
    move_usi: null,
    sfen: initialSfen('standard'),
  })
  if (nodeError) console.warn('根ノードの作成に失敗（エディタで自己修復されます）', nodeError)
  return tree
}

export async function updateTree(
  id: string,
  patch: { name?: string; description?: string | null },
): Promise<TreeRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('trees')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as TreeRow
}

export async function deleteTree(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('trees').delete().eq('id', id)
  if (error) throw error
}

/** ノード追加時などに一覧の並び順（updated_at 降順）へ反映させる */
export async function touchTree(id: string): Promise<void> {
  const sb = requireSupabase()
  await sb
    .from('trees')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)
}
