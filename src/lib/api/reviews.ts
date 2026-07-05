import type { ProblemReviewRow } from '../db-types'
import { requireSupabase } from '../supabase'

export async function listReviews(
  problemIds: string[],
): Promise<ProblemReviewRow[]> {
  if (problemIds.length === 0) return []
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('problem_reviews')
    .select('*')
    .in('problem_id', problemIds)
  if (error) throw error
  return data as ProblemReviewRow[]
}

// 同一問題への連続解答（間違い→再挑戦）で read-modify-write が交錯して
// 加算が失われないよう、問題ごとに直列化する
const recordQueues = new Map<string, Promise<void>>()

/** 1回の解答結果を加算する（行が無ければ作る）。問題ごとに順番に実行される */
export function recordResult(problemId: string, correct: boolean): Promise<void> {
  const prev = recordQueues.get(problemId) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(() => doRecordResult(problemId, correct))
  recordQueues.set(problemId, next)
  return next
}

async function doRecordResult(
  problemId: string,
  correct: boolean,
): Promise<void> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('problem_reviews')
    .select('*')
    .eq('problem_id', problemId)
    .maybeSingle()
  if (error) throw error
  const prev = data as ProblemReviewRow | null
  const { error: upsertError } = await sb.from('problem_reviews').upsert({
    problem_id: problemId,
    attempts: (prev?.attempts ?? 0) + 1,
    correct_count: (prev?.correct_count ?? 0) + (correct ? 1 : 0),
    wrong_count: (prev?.wrong_count ?? 0) + (correct ? 0 : 1),
    last_result: correct ? 'correct' : 'wrong',
    last_reviewed_at: new Date().toISOString(),
  })
  if (upsertError) throw upsertError
}
