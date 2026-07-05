import type { NodeRow } from '../db-types'
import { requireSupabase } from '../supabase'

// PostgREST は既定で1リクエスト最大1000行を「エラーなしで」切り捨てるため、
// 全件そろうまでページングする（切り捨てに気づけないと重複分岐の原因になる）
const PAGE_SIZE = 1000

export async function fetchNodes(treeId: string): Promise<NodeRow[]> {
  const sb = requireSupabase()
  const rows: NodeRow[] = []
  for (;;) {
    const { data, error } = await sb
      .from('nodes')
      .select('*')
      .eq('tree_id', treeId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1)
    if (error) throw error
    const page = data as NodeRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export async function fetchNodesByIds(ids: string[]): Promise<NodeRow[]> {
  if (ids.length === 0) return []
  const sb = requireSupabase()
  const { data, error } = await sb.from('nodes').select('*').in('id', ids)
  if (error) throw error
  return data as NodeRow[]
}

export async function createNode(input: {
  tree_id: string
  parent_id: string | null
  move_usi: string | null
  sfen: string
}): Promise<NodeRow> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('nodes').insert(input).select().single()
  if (error) throw error
  return data as NodeRow
}

export async function updateNodeMeta(
  id: string,
  patch: { branch_label: string | null; comment: string | null },
): Promise<NodeRow> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('nodes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as NodeRow
}
