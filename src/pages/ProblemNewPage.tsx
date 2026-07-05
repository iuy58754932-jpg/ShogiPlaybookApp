import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseUsi } from 'shogiops/util'
import { ShogiBoard } from '../components/shogi/ShogiBoard'
import { TreeGraph } from '../components/shogi/TreeGraph'
import { useAuth } from '../auth/auth-context'
import { fetchNodes } from '../lib/api/nodes'
import { createProblem } from '../lib/api/problems'
import { listTrees } from '../lib/api/trees'
import type { NodeRow, TreeRow } from '../lib/db-types'
import { moveLabel, positionFromSfen } from '../shogi/shogi'

export function ProblemNewPage() {
  const { notebookId } = useParams<{ notebookId: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [trees, setTrees] = useState<TreeRow[]>([])
  const [treeId, setTreeId] = useState<string>('')
  const [nodes, setNodes] = useState<NodeRow[]>([])
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [answerMode, setAnswerMode] = useState<'any' | 'single'>('single')
  const [answerUsi, setAnswerUsi] = useState<string>('')
  const [explanation, setExplanation] = useState('')
  const [startNodeId, setStartNodeId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ツリー一覧の読込
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listTrees()
        if (!cancelled) {
          setTrees(rows)
          if (rows.length > 0) setTreeId(rows[0].id)
          else setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('ツリー一覧の読み込みに失敗しました。')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 選択ツリーのノード読込
  useEffect(() => {
    if (!treeId) return
    let cancelled = false
    setLoading(true)
    // 切替中・切替失敗後に前のツリーのノードが見えたり保存できたりしないよう、
    // 選択とノード一覧の両方をクリアする
    setCurrentNodeId(null)
    setNodes([])
    ;(async () => {
      try {
        const rows = await fetchNodes(treeId)
        if (cancelled) return
        setNodes(rows)
        const root = rows.find((n) => n.parent_id === null)
        setCurrentNodeId(root?.id ?? null)
        setStartNodeId('')
      } catch {
        if (!cancelled) setError('ノードの読み込みに失敗しました。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [treeId])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const current = currentNodeId ? (nodeById.get(currentNodeId) ?? null) : null

  const children = useMemo(
    // currentNodeId が null のとき parent_id === null（根）が誤って一致しないようガード
    () => (currentNodeId ? nodes.filter((n) => n.parent_id === currentNodeId) : []),
    [nodes, currentNodeId],
  )

  const position = useMemo(() => {
    if (!current) return null
    const pos = positionFromSfen(current.sfen)
    if (pos && current.move_usi) {
      const md = parseUsi(current.move_usi)
      if (md) pos.lastMoveOrDrop = md
    }
    return pos
  }, [current])

  // 出題ノードが変わったら正解候補と再生起点を選び直す
  // （起点を残すと、別の枝のノードが起点として保存され再生が壊れる）
  useEffect(() => {
    setAnswerUsi(children[0]?.move_usi ?? '')
    setStartNodeId('')
  }, [currentNodeId, children])

  // 起点候補: 根から出題ノードまでの経路
  const ancestorOptions = useMemo(() => {
    if (!current) return []
    const path: NodeRow[] = []
    let cur: NodeRow | undefined = current
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
  }, [current, nodeById])

  async function handleSave() {
    const userId = session?.user.id
    if (!notebookId || !userId || !current) return
    // 表示中のツリーと選択ノードの不整合を保存させない最終ガード
    if (current.tree_id !== treeId) return
    if (children.length === 0) return
    if (answerMode === 'single' && answerUsi === '') return
    setSaving(true)
    setError(null)
    try {
      await createProblem({
        user_id: userId,
        notebook_id: notebookId,
        node_id: current.id,
        answer_move_usi: answerMode === 'single' ? answerUsi : null,
        accept_any_child: answerMode === 'any',
        explanation_text: explanation.trim() === '' ? null : explanation.trim(),
        explanation_from_node_id: startNodeId === '' ? null : startNodeId,
      })
      navigate(`/notebooks/${notebookId}`)
    } catch {
      setError('問題の保存に失敗しました。db/migrations/004_problems.sql が未実行の可能性があります。')
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>問題を作る</h1>
        <div className="header-right">
          <Link to={`/notebooks/${notebookId}`} className="header-link">
            ノートブックへ戻る
          </Link>
        </div>
      </header>
      <main className="board-page">
        {trees.length === 0 && !loading ? (
          <p className="empty-note">
            定跡ツリーがまだありません。先に「定跡ツリー」で木を作ってください。
          </p>
        ) : (
          <>
            <section className="editor-panel">
              <h2>1. 出題する局面を選ぶ</h2>
              <label className="field">
                <span>定跡ツリー</span>
                <select
                  value={treeId}
                  onChange={(e) => setTreeId(e.target.value)}
                >
                  {trees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {loading ? (
                <p className="screen-message">読み込み中…</p>
              ) : (
                <TreeGraph
                  nodes={nodes}
                  currentId={currentNodeId}
                  onSelect={setCurrentNodeId}
                />
              )}
            </section>

            {position && (
              <ShogiBoard position={position} onMove={() => {}} readOnly />
            )}

            {current && (
              <>
            <section className="editor-panel">
              <h2>2. 正解の設定</h2>
              {children.length === 0 ? (
                <p className="message message-error">
                  この局面には次の一手（子ノード）がありません。木で続きの手を
                  登録するか、別の局面を選んでください。
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
              <h2>3. 解説（任意）</h2>
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
              </>
            )}

            {error && <p className="message message-error">{error}</p>}

            {current && (
              <button
                type="button"
                className="button-primary meta-save"
                disabled={
                  saving ||
                  loading ||
                  children.length === 0 ||
                  (answerMode === 'single' && answerUsi === '')
                }
                onClick={handleSave}
              >
                この局面で問題を作成
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
