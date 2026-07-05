// Supabase テーブルの行型（db/migrations/ の DDL と対応）

export interface TreeRow {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface NotebookRow {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface NodeRow {
  id: string
  tree_id: string
  parent_id: string | null
  move_usi: string | null
  sfen: string
  branch_label: string | null
  comment: string | null
  created_at: string
}
