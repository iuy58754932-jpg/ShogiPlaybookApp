import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchNodesByIds } from '../lib/api/nodes'
import { getNotebook } from '../lib/api/notebooks'
import { deleteProblem, listProblems } from '../lib/api/problems'
import { listReviews } from '../lib/api/reviews'
import { listTrees } from '../lib/api/trees'
import type {
  NodeRow,
  NotebookRow,
  ProblemReviewRow,
  ProblemRow,
} from '../lib/db-types'
import { parseUsi } from 'shogiops/util'
import { moveLabel, positionFromSfen } from '../shogi/shogi'

function problemAnswerLabel(problem: ProblemRow, node: NodeRow | undefined): string {
  if (problem.accept_any_child) return '木にある手ならどれでも'
  if (!problem.answer_move_usi) return '未設定'
  if (!node) return problem.answer_move_usi
  const pos = positionFromSfen(node.sfen)
  if (pos && node.move_usi) {
    // 「同」表記の判定に直前手が要る（作成・演習画面と表記を揃える）
    const md = parseUsi(node.move_usi)
    if (md) pos.lastMoveOrDrop = md
  }
  return pos ? moveLabel(pos, problem.answer_move_usi) : problem.answer_move_usi
}

function nodePlaceLabel(node: NodeRow | undefined): string {
  if (!node) return '局面情報なし'
  const moveNumber = Number(node.sfen.split(' ')[3] ?? '1')
  return moveNumber <= 1 ? '初期局面' : `${moveNumber - 1}手目の局面`
}

export function NotebookDetailPage() {
  const { notebookId } = useParams<{ notebookId: string }>()
  const [notebook, setNotebook] = useState<NotebookRow | null>(null)
  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [nodeById, setNodeById] = useState<Map<string, NodeRow>>(new Map())
  const [treeNameById, setTreeNameById] = useState<Map<string, string>>(new Map())
  const [reviewByProblem, setReviewByProblem] = useState<
    Map<string, ProblemReviewRow>
  >(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!notebookId) return
    let cancelled = false
    ;(async () => {
      try {
        const [nb, probs, trees] = await Promise.all([
          getNotebook(notebookId),
          listProblems(notebookId),
          listTrees(),
        ])
        const [nodes, reviews] = await Promise.all([
          fetchNodesByIds(probs.map((p) => p.node_id)),
          listReviews(probs.map((p) => p.id)),
        ])
        if (cancelled) return
        setNotebook(nb)
        setProblems(probs)
        setNodeById(new Map(nodes.map((n) => [n.id, n])))
        setTreeNameById(new Map(trees.map((t) => [t.id, t.name])))
        setReviewByProblem(new Map(reviews.map((r) => [r.problem_id, r])))
      } catch {
        if (!cancelled) {
          setError(
            '読み込みに失敗しました。テーブルが未作成の場合は db/migrations/004_problems.sql を Supabase の SQL Editor で実行してください。',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [notebookId])

  async function handleDelete(problem: ProblemRow) {
    if (!window.confirm('この問題を削除しますか？（成績履歴も削除されます）')) {
      return
    }
    setError(null)
    try {
      await deleteProblem(problem.id)
      setProblems((ps) => ps.filter((p) => p.id !== problem.id))
    } catch {
      setError('問題の削除に失敗しました。')
    }
  }

  if (loading) {
    return <p className="screen-message">読み込み中…</p>
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{notebook?.name ?? 'ノートブック'}</h1>
        <div className="header-right">
          <Link to="/notebooks" className="header-link">
            ノートブック一覧
          </Link>
        </div>
      </header>
      <main className="app-main">
        {notebook?.description && (
          <p className="notebook-description">{notebook.description}</p>
        )}

        <div className="home-links">
          <Link to={`/notebooks/${notebookId}/new`} className="button-link">
            問題を作る
          </Link>
          {problems.length > 0 && (
            <Link
              to={`/notebooks/${notebookId}/study`}
              className="button-link"
            >
              演習を始める（{problems.length}問）
            </Link>
          )}
        </div>

        {error && <p className="message message-error">{error}</p>}
        {!error && problems.length === 0 && (
          <p className="empty-note">
            まだ問題がありません。「問題を作る」から、定跡ツリーの局面を選んで
            1手当ての問題を作成できます。
          </p>
        )}

        <ul className="tree-list">
          {problems.map((problem, i) => {
            const node = nodeById.get(problem.node_id)
            const review = reviewByProblem.get(problem.id)
            const treeName = node ? treeNameById.get(node.tree_id) : undefined
            return (
              <li key={problem.id} className="tree-card">
                <div className="tree-card-main">
                  <span className="tree-name">
                    第{i + 1}問 — {treeName ? `${treeName} / ` : ''}
                    {nodePlaceLabel(node)}
                  </span>
                  <span className="tree-description">
                    正解: {problemAnswerLabel(problem, node)}
                    {problem.explanation_text ? ' ／ 解説あり' : ''}
                    {review
                      ? ` ／ 成績: ${review.attempts}回（○${review.correct_count} ×${review.wrong_count}）`
                      : ' ／ 未挑戦'}
                  </span>
                </div>
                <div className="tree-card-actions">
                  <Link
                    to={`/notebooks/${notebookId}/problems/${problem.id}/edit`}
                    className="button-secondary button-edit-link"
                  >
                    編集
                  </Link>
                  <button
                    type="button"
                    className="button-secondary button-danger"
                    onClick={() => handleDelete(problem)}
                  >
                    削除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
