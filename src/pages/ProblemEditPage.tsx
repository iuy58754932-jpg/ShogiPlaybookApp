import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseUsi } from 'shogiops/util'
import { ShogiBoard } from '../components/shogi/ShogiBoard'
import { fetchNodes, fetchNodesByIds } from '../lib/api/nodes'
import { getProblem, updateProblem } from '../lib/api/problems'
import type { NodeRow, ProblemRow } from '../lib/db-types'
import { moveLabel, positionFromSfen } from '../shogi/shogi'

export function ProblemEditPage() {
  const { notebookId, problemId } = useParams<{
    notebookId: string
    problemId: string
  }>()
  const navigate = useNavigate()

  const [problem, setProblem] = useState<ProblemRow | null>(null)
  const [node, setNode] = useState<NodeRow | null>(null)
  const [nodes, setNodes] = useState<NodeRow[]>([])
  const [answerMode, setAnswerMode] = useState<'any' | 'single'>('single')
  const [answerUsi, setAnswerUsi] = useState('')
  const [explanation, setExplanation] = useState('')
  const [startNodeId, setStartNodeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!problemId) return
    let cancelled = false
    ;(async () => {
      try {
        const p = await getProblem(problemId)
        const [problemNode] = await fetchNodesByIds([p.node_id])
        if (!problemNode) throw new Error('出題局面のノードが見つかりません')
        const treeNodes = await fetchNodes(problemNode.tree_id)
        if (cancelled) return

        // 保存値が木の現状と食い違っている場合はここで補正する
        // （作成後に木側の手が削除されたケースなど）
        const kids = treeNodes.filter((n) => n.parent_id === p.node_id)
        const answerStillValid =
          p.answer_move_usi != null &&
          kids.some((k) => k.move_usi === p.answer_move_usi)
        const byId = new Map(treeNodes.map((n) => [n.id, n]))
        let startValid = false
        let cur: NodeRow | undefined = problemNode
        while (cur) {
          if (cur.id === p.explanation_from_node_id) {
            startValid = true
            break
          }
          cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
        }

        setProblem(p)
        setNode(problemNode)
        setNodes(treeNodes)
        setAnswerMode(p.accept_any_child ? 'any' : 'single')
        setAnswerUsi(
          answerStillValid
            ? (p.answer_move_usi as string)
            : (kids[0]?.move_usi ?? ''),
        )
        setExplanation(p.explanation_text ?? '')
        setStartNodeId(startValid ? (p.explanation_from_node_id as string) : '')
      } catch {
        if (!cancelled) setError('問題の読み込みに失敗しました。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [problemId])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const children = useMemo(
    () => (node ? nodes.filter((n) => n.parent_id === node.id) : []),
    [nodes, node],
  )

  const position = useMemo(() => {
    if (!node) return null
    const pos = positionFromSfen(node.sfen)
    if (pos && node.move_usi) {
      const md = parseUsi(node.move_usi)
      if (md) pos.lastMoveOrDrop = md
    }
    return pos
  }, [node])

  const ancestorOptions = useMemo(() => {
    if (!node) return []
    const path: NodeRow[] = []
    let cur: NodeRow | undefined = node
    while (cur) {
      path.push(cur)
      cur = cur.parent_id ? nodeById.get(cur.parent_id) : undefined
    }
    path.reverse()
    return path.map((n, depth) => {
      let label = '初期局面'
      if (n.move_usi) {
        const parent = n.parent_id ? nodeById.get(n.parent_id) : undefined
        const pos = parent ? positionFromSfen(parent.sfen) : null
        if (pos && parent?.move_usi) {
          const md = parseUsi(parent.move_usi)
          if (md) pos.lastMoveOrDrop = md
        }
        label = `${depth}手目 ${pos ? moveLabel(pos, n.move_usi) : n.move_usi}`
      }
      return { id: n.id, label }
    })
  }, [node, nodeById])

  async function handleSave() {
    if (!problem || !notebookId) return
    if (children.length === 0) return
    if (answerMode === 'single' && answerUsi === '') return
    setSaving(true)
    setError(null)
    try {
      await updateProblem(problem.id, {
        answer_move_usi: answerMode === 'single' ? answerUsi : null,
        accept_any_child: answerMode === 'any',
        explanation_text: explanation.trim() === '' ? null : explanation.trim(),
        explanation_from_node_id: startNodeId === '' ? null : startNodeId,
      })
      navigate(`/notebooks/${notebookId}`)
    } catch {
      setError('保存に失敗しました。通信環境を確認してください。')
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="screen-message">読み込み中…</p>
  }

  if (error && !problem) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>問題を編集</h1>
          <div className="header-right">
            <Link to={`/notebooks/${notebookId}`} className="header-link">
              ノートブックへ戻る
            </Link>
          </div>
        </header>
        <main className="app-main">
          <p className="message message-error">{error}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>問題を編集</h1>
        <div className="header-right">
          <Link to={`/notebooks/${notebookId}`} className="header-link">
            ノートブックへ戻る
          </Link>
        </div>
      </header>
      <main className="board-page">
        <p className="board-status">
          出題局面（変更する場合は問題を作り直してください）
        </p>
        {position && (
          <ShogiBoard position={position} onMove={() => {}} readOnly />
        )}

        <section className="editor-panel">
          <h2>正解の設定</h2>
          {children.length === 0 ? (
            <p className="message message-error">
              この局面には次の一手（子ノード）が残っていないため、正解を設定
              できません。木で続きの手を登録し直すか、この問題を削除してください。
            </p>
          ) : (
            <>
              <label className="radio-row">
                <input
                  type="radio"
                  name="answer-mode"
                  checked={answerMode === 'single'}
                  onChange={() => setAnswerMode('single')}
                />
                <span>単一の手を正解にする</span>
              </label>
              {answerMode === 'single' && (
                <label className="field">
                  <span>正解の手</span>
                  <select
                    value={answerUsi}
                    onChange={(e) => setAnswerUsi(e.target.value)}
                  >
                    {children.map((c) => (
                      <option key={c.id} value={c.move_usi ?? ''}>
                        {c.move_usi && position
                          ? moveLabel(position, c.move_usi)
                          : c.move_usi}
                        {c.branch_label ? `（${c.branch_label}）` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="radio-row">
                <input
                  type="radio"
                  name="answer-mode"
                  checked={answerMode === 'any'}
                  onChange={() => setAnswerMode('any')}
                />
                <span>
                  木にある子の手ならどれでも正解（{children.length}手）
                </span>
              </label>
            </>
          )}
        </section>

        <section className="editor-panel">
          <h2>解説（任意）</h2>
          <label className="field">
            <span>解説文</span>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </label>
          <label className="field">
            <span>局面再生の起点（解説で手順をたどり直す開始局面）</span>
            <select
              value={startNodeId}
              onChange={(e) => setStartNodeId(e.target.value)}
            >
              <option value="">再生なし</option>
              {ancestorOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        {error && <p className="message message-error">{error}</p>}

        <button
          type="button"
          className="button-primary meta-save"
          disabled={
            saving ||
            children.length === 0 ||
            (answerMode === 'single' && answerUsi === '')
          }
          onClick={handleSave}
        >
          変更を保存
        </button>
      </main>
    </div>
  )
}
