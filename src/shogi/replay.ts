import { parseUsi } from 'shogiops/util'
import type { NodeRow, ProblemRow } from '../lib/db-types'
import { moveLabel, positionFromSfen } from './shogi'

export interface ReplayStep {
  sfen: string
  usi: string | null
  label: string
}

/**
 * 解説の局面再生の経路を作る。
 * 起点ノード → （起点が出題ノードの祖先なら）出題ノードまでの経路 →
 * 正解の子（単一正解ならその手、任意なら最初の子）→ 以降は最初の子をたどる。
 */
export function buildReplaySteps(
  nodes: NodeRow[],
  problem: ProblemRow,
): ReplayStep[] | null {
  if (!problem.explanation_from_node_id) return null
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const children = new Map<string, NodeRow[]>()
  for (const n of nodes) {
    if (!n.parent_id) continue
    const arr = children.get(n.parent_id)
    if (arr) arr.push(n)
    else children.set(n.parent_id, [n])
  }
  const problemNode = byId.get(problem.node_id)
  const startNode = byId.get(problem.explanation_from_node_id)
  if (!problemNode || !startNode) return null

  // 出題ノードから根へ遡り、起点が祖先かどうか調べる
  const upPath: NodeRow[] = []
  let cur: NodeRow | undefined = problemNode
  while (cur) {
    upPath.push(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  const startIdx = upPath.findIndex((n) => n.id === startNode.id)
  const path: NodeRow[] =
    startIdx >= 0 ? upPath.slice(0, startIdx + 1).reverse() : [startNode]

  // 出題ノードの先へ: 正解の手 → 以降は最初の子（本線）
  const last = path[path.length - 1]
  if (last.id === problemNode.id) {
    const kids = children.get(problemNode.id) ?? []
    // 単一正解の手が木から消えている場合、別の線を正解のように再生しない
    let next = problem.accept_any_child
      ? kids[0]
      : kids.find((k) => k.move_usi === problem.answer_move_usi)
    while (next && path.length < 200) {
      path.push(next)
      next = (children.get(next.id) ?? [])[0]
    }
  }

  return path.map((n) => {
    let label = '初期局面'
    if (n.move_usi) {
      const parent = n.parent_id ? byId.get(n.parent_id) : undefined
      const pos = parent ? positionFromSfen(parent.sfen) : null
      if (pos && parent?.move_usi) {
        const md = parseUsi(parent.move_usi)
        if (md) pos.lastMoveOrDrop = md
      }
      label = pos ? moveLabel(pos, n.move_usi) : n.move_usi
    }
    return { sfen: n.sfen, usi: n.move_usi, label }
  })
}
