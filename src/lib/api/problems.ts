import type { ProblemRow } from '../db-types'
import { requireSupabase } from '../supabase'

export async function listProblems(notebookId: string): Promise<ProblemRow[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('problems')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ProblemRow[]
}

export async function createProblem(input: {
  user_id: string
  notebook_id: string
  node_id: string
  answer_move_usi: string | null
  accept_any_child: boolean
  explanation_text: string | null
  explanation_from_node_id: string | null
}): Promise<ProblemRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('problems')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data as ProblemRow
}

export async function getProblem(id: string): Promise<ProblemRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('problems')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as ProblemRow
}

/** 正解設定・解説を更新する（出題局面 node_id は変更しない。成績履歴は保持される） */
export async function updateProblem(
  id: string,
  patch: {
    answer_move_usi: string | null
    accept_any_child: boolean
    explanation_text: string | null
    explanation_from_node_id: string | null
  },
): Promise<ProblemRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('problems')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ProblemRow
}

export async function deleteProblem(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('problems').delete().eq('id', id)
  if (error) throw error
}

/** 指定ノードを出題局面とする問題を取得（ノード削除の影響調査に使う） */
export async function listProblemsByNode(nodeId: string): Promise<ProblemRow[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('problems')
    .select('*')
    .eq('node_id', nodeId)
  if (error) throw error
  return data as ProblemRow[]
}

export async function deleteProblems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const sb = requireSupabase()
  const { error } = await sb.from('problems').delete().in('id', ids)
  if (error) throw error
}
