import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { initialSfen, makeSfen } from 'shogiops/sfen'
import type { MoveOrDrop } from 'shogiops/types'
import { makeUsi, parseUsi } from 'shogiops/util'
import { ShogiBoard } from '../components/shogi/ShogiBoard'
import { TreeGraph } from '../components/shogi/TreeGraph'
import {
  createNode,
  deleteNode,
  fetchNodes,
  updateNodeMeta,
} from '../lib/api/nodes'
import { deleteProblems, listProblemsByNode } from '../lib/api/problems'
import { getTree, touchTree } from '../lib/api/trees'
import type { NodeRow, TreeRow } from '../lib/db-types'
import { moveLabel, playMove, positionFromSfen } from '../shogi/shogi'

export function TreeEditorPage() {
  const { treeId } = useParams<{ treeId: string }>()
  const [tree, setTree] = useState<TreeRow | null>(null)
  const [nodes, setNodes] = useState<NodeRow[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaNotice, setMetaNotice] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'graph'>('board')
  const [orientation, setOrientation] = useState<'sente' | 'gote'>('sente')
  const busyRef = useRef(false)
  // 削除の await 中にユーザーが別ノードへ移動した場合に備え、最新の現在地を持つ
  const currentIdRef = useRef<string | null>(null)
  useEffect(() => {
    currentIdRef.current = currentId
  }, [currentId])

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  )
  const childrenByParent = useMemo(() => {
    const map = new Map<string, NodeRow[]>()
    for (const node of nodes) {
      if (!node.parent_id) continue
      const siblings = map.get(node.parent_id)
      if (siblings) siblings.push(node)
      else map.set(node.parent_id, [node])
    }
    return map
  }, [nodes])

  const current = currentId ? (nodeById.get(currentId) ?? null) : null
  const children = current ? (childrenByParent.get(current.id) ?? []) : []
  const parent = current?.parent_id
    ? (nodeById.get(current.parent_id) ?? null)
    : null
  const root = useMemo(
    () => nodes.find((n) => n.parent_id === null) ?? null,
    [nodes],
  )

  const position = useMemo(() => {
    if (!current) return null
    const pos = positionFromSfen(current.sfen)
    if (pos && current.move_usi) {
      // 盤上の「最終手」ハイライトに使う
      const md = parseUsi(current.move_usi)
      if (md) pos.lastMoveOrDrop = md
    }
    return pos
  }, [current])

  const parentPosition = useMemo(() => {
    if (!parent) return null
    const pos = positionFromSfen(parent.sfen)
    if (pos && parent.move_usi) {
      // 「同」表記の判定に親の直前手が要る（子候補リストと表記を揃える）
      const md = parseUsi(parent.move_usi)
      if (md) pos.lastMoveOrDrop = md
    }
    return pos
  }, [parent])
  const currentMoveLabel =
    current?.move_usi && parentPosition
      ? moveLabel(parentPosition, current.move_usi)
      : null

  // ツリーとノードの読込
  useEffect(() => {
    if (!treeId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      try {
        const [treeRow, initialRows] = await Promise.all([
          getTree(treeId),
          fetchNodes(treeId),
        ])
        let nodeRows = initialRows
        let rootNode = nodeRows.find((n) => n.parent_id === null)
        if (!rootNode) {
          // 根ノードが無い場合は自己修復（作成時の失敗など）。
          // StrictMode の二重実行や他タブと競合し得るので、キャンセル済みなら
          // 作らない。作成に失敗（一意制約違反など）したら再取得して既存を使う
          if (cancelled) return
          try {
            rootNode = await createNode({
              tree_id: treeId,
              parent_id: null,
              move_usi: null,
              sfen: initialSfen('standard'),
            })
            nodeRows = [...nodeRows, rootNode]
          } catch {
            nodeRows = await fetchNodes(treeId)
            rootNode = nodeRows.find((n) => n.parent_id === null)
            if (!rootNode) throw new Error('根ノードを用意できませんでした')
          }
        }
        if (!cancelled) {
          setTree(treeRow)
          setNodes(nodeRows)
          setCurrentId(rootNode.id)
        }
      } catch {
        if (!cancelled) setLoadError('ツリーの読み込みに失敗しました。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [treeId])

  // 現在ノードが変わったらラベル・コメントのドラフトを同期し、古い表示を掃除
  useEffect(() => {
    setLabelDraft(current?.branch_label ?? '')
    setCommentDraft(current?.comment ?? '')
    setMetaNotice(null)
    setMoveError(null)
    // currentId 変更時のみ同期（保存直後にドラフトを巻き戻さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  /** 未保存のラベル・コメントがあれば裏で保存する（移動時のデータ消失防止） */
  function flushDirtyMeta() {
    if (!current) return
    const label = labelDraft.trim() === '' ? null : labelDraft.trim()
    const comment = commentDraft.trim() === '' ? null : commentDraft.trim()
    if (label === current.branch_label && comment === current.comment) return
    void updateNodeMeta(current.id, { branch_label: label, comment })
      .then((updated) =>
        setNodes((ns) => ns.map((n) => (n.id === updated.id ? updated : n))),
      )
      .catch(() => {
        // 自動保存の失敗は静かに諦める（明示の保存ボタンが別にある）
      })
  }

  /** 局面ノード間の移動はすべてここを通す */
  function goTo(nodeId: string) {
    flushDirtyMeta()
    setCurrentId(nodeId)
  }

  /** 現在ノードとその子孫のノード ID を集める */
  function collectSubtreeIds(rootNodeId: string): Set<string> {
    const ids = new Set<string>()
    const stack = [rootNodeId]
    while (stack.length > 0) {
      const id = stack.pop() as string
      ids.add(id)
      for (const child of childrenByParent.get(id) ?? []) {
        stack.push(child.id)
      }
    }
    return ids
  }

  async function handleDeleteNode() {
    if (!treeId || !current || !current.parent_id || busyRef.current) return
    const subtree = collectSubtreeIds(current.id)
    const descendants = subtree.size - 1
    const label = currentMoveLabel ?? 'この手'
    const parentId = current.parent_id
    busyRef.current = true
    setMoveError(null)
    try {
      // 親局面に紐づく問題のうち、この手の削除で壊れるものを調べる:
      // ・「子ならどれでも正解」の問題は、この手が唯一の子だと正解が消滅する
      // ・単一正解の問題は、正解の手そのものが消える場合がある
      const siblings = childrenByParent.get(parentId) ?? []
      const isOnlyChild = siblings.length === 1
      let brokenProblems: string[] = []
      try {
        const parentProblems = await listProblemsByNode(parentId)
        brokenProblems = parentProblems
          .filter((p) =>
            p.accept_any_child
              ? isOnlyChild
              : p.answer_move_usi === current.move_usi,
          )
          .map((p) => p.id)
      } catch {
        // 影響調査に失敗しても削除自体は続行できる（警告が出せないだけ）
      }
      const detail =
        descendants > 0
          ? `\nこの先の ${descendants} 手もまとめて削除されます。`
          : ''
      const problemNote =
        brokenProblems.length > 0
          ? `\nこの手を正解とする問題 ${brokenProblems.length} 問も削除されます。`
          : ''
      if (
        !window.confirm(
          `${label} を削除しますか？${detail}${problemNote}\nこれらの局面から作成した問題（全ノートブック）も削除されます。`,
        )
      ) {
        return
      }
      await deleteNode(current.id)
      await deleteProblems(brokenProblems)
      setNodes((ns) => ns.filter((n) => !subtree.has(n.id)))
      // await 中に別ノードへ移動していた場合はそこに留まる
      if (!currentIdRef.current || subtree.has(currentIdRef.current)) {
        setCurrentId(parentId)
      }
      void touchTree(treeId)
    } catch {
      setMoveError('手の削除に失敗しました。通信環境を確認してください。')
    } finally {
      busyRef.current = false
    }
  }

  async function handleMove(md: MoveOrDrop) {
    if (!treeId || !current || !position || busyRef.current) return
    const usi = makeUsi(md)
    const existing = children.find((c) => c.move_usi === usi)
    if (existing) {
      // 既存の子ノードに一致 → そのノードへ移動
      goTo(existing.id)
      return
    }
    // 新規子ノード作成（＝分岐）
    busyRef.current = true
    setMoveError(null)
    try {
      const next = playMove(position, md)
      const node = await createNode({
        tree_id: treeId,
        parent_id: current.id,
        move_usi: usi,
        sfen: makeSfen(next),
      })
      setNodes((ns) => [...ns, node])
      goTo(node.id)
      void touchTree(treeId)
    } catch {
      // 応答喪失後のリトライや一意制約違反の可能性があるため、
      // サーバー状態と再同期してから判断する（重複子ノードの防止）
      try {
        const rows = await fetchNodes(treeId)
        setNodes(rows)
        const committed = rows.find(
          (n) => n.parent_id === current.id && n.move_usi === usi,
        )
        if (committed) {
          goTo(committed.id)
          return
        }
      } catch {
        // 再同期も失敗 → 下のエラー表示に任せる
      }
      setMoveError('手の保存に失敗しました。通信環境を確認してください。')
    } finally {
      busyRef.current = false
    }
  }

  async function handleSaveMeta() {
    if (!current) return
    setMetaSaving(true)
    setMetaNotice(null)
    try {
      const updated = await updateNodeMeta(current.id, {
        branch_label: labelDraft.trim() === '' ? null : labelDraft.trim(),
        comment: commentDraft.trim() === '' ? null : commentDraft.trim(),
      })
      setNodes((ns) => ns.map((n) => (n.id === updated.id ? updated : n)))
      setMetaNotice('保存しました')
    } catch {
      setMetaNotice('保存に失敗しました')
    } finally {
      setMetaSaving(false)
    }
  }

  if (loading) {
    return <p className="screen-message">読み込み中…</p>
  }
  if (loadError || !tree || !current || !position) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>定跡ツリー</h1>
          <div className="header-right">
            <Link to="/trees" className="header-link">
              ツリー一覧
            </Link>
          </div>
        </header>
        <main className="app-main">
          <p className="message message-error">
            {loadError ?? 'この局面を表示できません。'}
          </p>
        </main>
      </div>
    )
  }

  const moveCount = position.moveNumber - 1
  const turnLabel = position.turn === 'sente' ? '▲先手' : '△後手'

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{tree.name}</h1>
        <div className="header-right">
          <Link to="/trees" className="header-link">
            ツリー一覧
          </Link>
        </div>
      </header>
      <main className="board-page">
        <p className="board-status" data-testid="editor-status">
          {moveCount === 0 ? '初期局面' : `${moveCount}手目 ${currentMoveLabel ?? ''}`}
          {' ／ '}
          {turnLabel}の手番{position.isCheck() ? '【王手】' : ''}
        </p>

        <div className="view-toggle">
          <button
            type="button"
            className={view === 'board' ? 'active' : ''}
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
          >
            盤面
          </button>
          <button
            type="button"
            className={view === 'graph' ? 'active' : ''}
            aria-pressed={view === 'graph'}
            onClick={() => setView('graph')}
          >
            樹形図
          </button>
        </div>

        {view === 'board' ? (
          <ShogiBoard
            position={position}
            onMove={handleMove}
            orientation={orientation}
          />
        ) : (
          <TreeGraph nodes={nodes} currentId={currentId} onSelect={goTo} />
        )}

        {moveError && <p className="message message-error">{moveError}</p>}

        <div className="editor-nav">
          <button
            type="button"
            className="button-secondary"
            disabled={!parent}
            onClick={() => parent && goTo(parent.id)}
          >
            一手戻る
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={!root || root.id === current.id}
            onClick={() => root && goTo(root.id)}
          >
            初期局面へ
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              setOrientation((o) => (o === 'sente' ? 'gote' : 'sente'))
            }
          >
            盤を反転
          </button>
          <button
            type="button"
            className="button-secondary button-danger"
            disabled={!parent}
            onClick={handleDeleteNode}
          >
            この手を削除
          </button>
        </div>

        <section className="editor-panel">
          <h2>次の一手候補（{children.length}）</h2>
          {children.length === 0 ? (
            <p className="empty-note">
              まだ手がありません。盤で駒を動かすとこの局面の子ノードとして保存されます。
            </p>
          ) : (
            <ul className="children-list">
              {children.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    className="child-button"
                    onClick={() => goTo(child.id)}
                  >
                    <span className="child-move">
                      {child.move_usi
                        ? moveLabel(position, child.move_usi)
                        : '?'}
                    </span>
                    {child.branch_label && (
                      <span className="branch-chip">{child.branch_label}</span>
                    )}
                    {(childrenByParent.get(child.id)?.length ?? 0) > 0 && (
                      <span className="child-more">…</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="editor-panel">
          <h2>この局面のメモ</h2>
          <label className="field">
            <span>分岐ラベル（例: 急戦）</span>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
            />
          </label>
          <label className="field">
            <span>コメント</span>
            <textarea
              rows={3}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
            />
          </label>
          <div className="meta-actions">
            <button
              type="button"
              className="button-primary meta-save"
              disabled={metaSaving}
              onClick={handleSaveMeta}
            >
              保存
            </button>
            {metaNotice && <span className="meta-notice">{metaNotice}</span>}
          </div>
          <p className="meta-hint">
            別の局面へ移動したときも、未保存の内容は自動保存されます。
          </p>
        </section>
      </main>
    </div>
  )
}
