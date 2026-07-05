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

export interface ProblemRow {
  id: string
  user_id: string
  notebook_id: string
  node_id: string
  answer_move_usi: string | null
  accept_any_child: boolean
  explanation_text: string | null
  explanation_from_node_id: string | null
  created_at: string
  updated_at: string
}

export interface ProblemReviewRow {
  problem_id: string
  attempts: number
  correct_count: number
  wrong_count: number
  last_result: string | null
  last_reviewed_at: string | null
  srs_ease: number | null
  srs_interval_days: number | null
  srs_due_at: string | null
}
