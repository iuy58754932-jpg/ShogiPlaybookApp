import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { MoveOrDrop } from 'shogiops/types'
import { makeUsi, parseUsi } from 'shogiops/util'
import { ReplayBoard } from '../components/shogi/ReplayBoard'
import { ShogiBoard } from '../components/shogi/ShogiBoard'
import { fetchNodes, fetchNodesByIds } from '../lib/api/nodes'
import { listProblems } from '../lib/api/problems'
import { recordResult } from '../lib/api/reviews'
import type { NodeRow, ProblemRow } from '../lib/db-types'
import { buildReplaySteps, type ReplayStep } from '../shogi/replay'
import { moveLabel, positionFromSfen } from '../shogi/shogi'

type Phase = 'loading' | 'empty' | 'question' | 'result' | 'done' | 'error'

interface AnswerResult {
  correct: boolean
  playedLabel: string
  answerLabels: string[]
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

export function StudyPage() {
  const { notebookId } = useParams<{ notebookId: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [queue, setQueue] = useState<ProblemRow[]>([])
  const [index, setIndex] = useState(0)
  const [nodeById, setNodeById] = useState<Map<string, NodeRow>>(new Map())
  const [treeNodes, setTreeNodes] = useState<Map<string, NodeRow[]>>(new Map())
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [stats, setStats] = useState({ asked: 0, correct: 0, wrong: 0 })
  const [recordFailed, setRecordFailed] = useState(false)
  const [skippedCount, setSkippedCount] = useState(0)
  const answeredRef = useRef(false)

  // 問題・出題ノード・関係する木のノードを読み込む
  useEffect(() => {
    if (!notebookId) return
    let cancelled = false
    ;(async () => {
      try {
        const probs = await listProblems(notebookId)
        if (probs.length === 0) {
          if (!cancelled) setPhase('empty')
          return
        }
        const nodes = await fetchNodesByIds(probs.map((p) => p.node_id))
        const treeIds = [...new Set(nodes.map((n) => n.tree_id))]
        const treeNodeLists = await Promise.all(treeIds.map((id) => fetchNodes(id)))
        if (cancelled) return
        const nodeMap = new Map(nodes.map((n) => [n.id, n]))
        const treeNodesMap = new Map(treeIds.map((id, i) => [id, treeNodeLists[i]]))
        // 出題不能な問題（出題ノード消失、または「どれでも正解」なのに子が
        // 全部削除された）は除外する — 残すと正解が存在せず演習が終わらない
        const playable = probs.filter((p) => {
          const n = nodeMap.get(p.node_id)
          if (!n) return false
          if (!p.accept_any_child) return true
          const all = treeNodesMap.get(n.tree_id) ?? []
          return all.some((x) => x.parent_id === n.id)
        })
        setSkippedCount(probs.length - playable.length)
        if (playable.length === 0) {
          setPhase('empty')
          return
        }
        setProblems(playable)
        setNodeById(nodeMap)
        setTreeNodes(treeNodesMap)
        setQueue(shuffle(playable))
        setIndex(0)
        answeredRef.current = false
        setPhase('question')
      } catch {
        if (!cancelled) setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [notebookId])

  const problem = queue[index] ?? null
  const node = problem ? (nodeById.get(problem.node_id) ?? null) : null

  const position = useMemo(() => {
    if (!node) return null
    const pos = positionFromSfen(node.sfen)
    if (pos && node.move_usi) {
      const md = parseUsi(node.move_usi)
      if (md) pos.lastMoveOrDrop = md
    }
    return pos
  }, [node])

  const children = useMemo(() => {
    if (!node) return []
    const all = treeNodes.get(node.tree_id) ?? []
    return all.filter((n) => n.parent_id === node.id)
  }, [node, treeNodes])

  const replaySteps: ReplayStep[] | null = useMemo(() => {
    if (!problem || !node || phase !== 'result') return null
    const all = treeNodes.get(node.tree_id)
    if (!all) return null
    return buildReplaySteps(all, problem)
  }, [problem, node, treeNodes, phase])

  function handleAnswer(md: MoveOrDrop) {
    if (!problem || !node || !position || answeredRef.current) return
    answeredRef.current = true
    const usi = makeUsi(md)
    const correct = problem.accept_any_child
      ? children.some((c) => c.move_usi === usi)
      : usi === problem.answer_move_usi
    const playedLabel = moveLabel(position, usi)
    const answerLabels = problem.accept_any_child
      ? children
          .filter((c) => c.move_usi)
          .map((c) => moveLabel(position, c.move_usi as string))
      : problem.answer_move_usi
        ? [moveLabel(position, problem.answer_move_usi)]
        : []
    setResult({ correct, playedLabel, answerLabels })
    setStats((s) => ({
      asked: s.asked + 1,
      correct: s.correct + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
    }))
    if (!correct) {
      // 間違えた問題はセッションのプール末尾に戻して再挑戦
      setQueue((q) => [...q, problem])
    }
    recordResult(problem.id, correct).catch(() => setRecordFailed(true))
    setPhase('result')
  }

  function handleNext() {
    const next = index + 1
    answeredRef.current = false
    setResult(null)
    if (next >= queue.length) {
      setPhase('done')
    } else {
      setIndex(next)
      setPhase('question')
    }
  }

  function handleRestart() {
    setQueue(shuffle(problems))
    setIndex(0)
    setStats({ asked: 0, correct: 0, wrong: 0 })
    setResult(null)
    answeredRef.current = false
    setPhase('question')
  }

  if (phase === 'loading') {
    return <p className="screen-message">読み込み中…</p>
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>演習</h1>
        <div className="header-right">
          <Link to={`/notebooks/${notebookId}`} className="header-link">
            ノートブックへ戻る
          </Link>
        </div>
      </header>
      <main className="board-page">
        {phase === 'error' && (
          <p className="message message-error">
            読み込みに失敗しました。db/migrations/004_problems.sql が未実行の
            可能性があります。
          </p>
        )}
        {phase === 'empty' && (
          <p className="empty-note">
            このノートブックにはまだ問題がありません。「問題を作る」から作成
            してください。
          </p>
        )}

        {(phase === 'question' || phase === 'result') && problem && position && (
          <>
            <p className="board-status" data-testid="study-status">
              第{index + 1}問／{queue.length}問
              {phase === 'question'
                ? ` — この局面で${position.turn === 'sente' ? '▲先手' : '△後手'}の次の一手は？`
                : ''}
            </p>

            {phase === 'question' ? (
              <ShogiBoard position={position} onMove={handleAnswer} />
            ) : (
              result && (
                <div className="study-result">
                  <p
                    className={`message ${result.correct ? 'message-notice' : 'message-error'}`}
                    data-testid="study-result"
                  >
                    {result.correct ? '正解！' : '不正解'} あなたの手:{' '}
                    {result.playedLabel}
                    {!result.correct &&
                      `（正解: ${result.answerLabels.join('、')}${problem.accept_any_child ? ' のいずれか' : ''}）`}
                    {result.correct &&
                      problem.accept_any_child &&
                      result.answerLabels.length > 1 &&
                      `（他の正解: ${result.answerLabels.filter((l) => l !== result.playedLabel).join('、')}）`}
                  </p>
                  {problem.explanation_text && (
                    <p className="study-explanation">{problem.explanation_text}</p>
                  )}
                  {replaySteps && replaySteps.length > 0 ? (
                    <ReplayBoard steps={replaySteps} />
                  ) : (
                    <ShogiBoard position={position} onMove={() => {}} readOnly />
                  )}
                  <button
                    type="button"
                    className="button-primary meta-save"
                    onClick={handleNext}
                  >
                    {index + 1 >= queue.length ? '結果を見る' : '次の問題へ'}
                  </button>
                </div>
              )
            )}
          </>
        )}

        {phase === 'done' && (
          <div className="study-summary">
            <h2>セッション終了</h2>
            <p>
              解答 {stats.asked} 回 — ○ {stats.correct} ／ × {stats.wrong}
            </p>
            <div className="home-links">
              <button
                type="button"
                className="button-link"
                onClick={handleRestart}
              >
                もう一度
              </button>
              <Link
                to={`/notebooks/${notebookId}`}
                className="button-link button-link-secondary"
              >
                ノートブックへ戻る
              </Link>
            </div>
          </div>
        )}

        {skippedCount > 0 && (
          <p className="meta-hint">
            ※ 出題できない問題を {skippedCount} 問スキップしました
            （出題局面の手が木から削除された可能性があります）
          </p>
        )}
        {recordFailed && (
          <p className="meta-hint">
            ※ 成績の記録に失敗した解答があります（演習は続けられます）
          </p>
        )}
      </main>
    </div>
  )
}
