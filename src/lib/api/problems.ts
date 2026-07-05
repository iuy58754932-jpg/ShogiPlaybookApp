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

export async function deleteProblem(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('problems').delete().eq('id', id)
  if (error) throw error
}
