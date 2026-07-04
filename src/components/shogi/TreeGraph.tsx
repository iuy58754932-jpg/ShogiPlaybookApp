import { useEffect, useMemo, useRef } from 'react'
import { parseUsi } from 'shogiops/util'
import type { NodeRow } from '../../lib/db-types'
import { moveLabel, positionFromSfen } from '../../shogi/shogi'

interface TreeGraphProps {
  nodes: NodeRow[]
  currentId: string | null
  onSelect: (nodeId: string) => void
}

// レイアウト定数（px）
const CELL_W = 96
const CELL_H = 56
const BOX_W = 84
const BOX_H = 30
const PAD = 16

interface PlacedNode {
  node: NodeRow
  depth: number
  row: number
}

export function TreeGraph({ nodes, currentId, onSelect }: TreeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const children = new Map<string, NodeRow[]>()
    let root: NodeRow | null = null
    for (const n of nodes) {
      if (n.parent_id === null) {
        // 万一複数の根があっても最初（最古）のみ描画対象にする
        if (!root) root = n
        continue
      }
      const siblings = children.get(n.parent_id)
      if (siblings) siblings.push(n)
      else children.set(n.parent_id, [n])
    }

    // 棋譜ツリー型レイアウト: 深さ→列。葉に行を割り当て、親は最初の子と同じ行
    const placed: PlacedNode[] = []
    let rowCount = 0
    let maxDepth = 0
    if (root) {
      const visit = (node: NodeRow, depth: number): number => {
        if (depth > maxDepth) maxDepth = depth
        const kids = children.get(node.id) ?? []
        let row: number
        if (kids.length === 0) {
          row = rowCount++
        } else {
          row = visit(kids[0], depth + 1)
          for (let i = 1; i < kids.length; i++) visit(kids[i], depth + 1)
        }
        placed.push({ node, depth, row })
        return row
      }
      visit(root, 0)
    }

    // 手の日本語符号（親局面は兄弟で1回だけパースする）
    const labels = new Map<string, string>()
    for (const [parentId, kids] of children) {
      const parent = byId.get(parentId)
      if (!parent) continue
      const pos = positionFromSfen(parent.sfen)
      if (pos && parent.move_usi) {
        // 「同」表記の判定に親の直前手が要る
        const md = parseUsi(parent.move_usi)
        if (md) pos.lastMoveOrDrop = md
      }
      for (const kid of kids) {
        if (!kid.move_usi) continue
        labels.set(kid.id, pos ? moveLabel(pos, kid.move_usi) : kid.move_usi)
      }
    }

    // タブ順・読み上げ順を視覚順（列→行）に揃える
    placed.sort((a, b) => a.depth - b.depth || a.row - b.row)

    const posById = new Map(placed.map((p) => [p.node.id, p]))
    return { placed, posById, labels, rowCount, maxDepth }
  }, [nodes])

  const width = PAD * 2 + (layout.maxDepth + 1) * CELL_W
  const height = PAD * 2 + Math.max(layout.rowCount, 1) * CELL_H

  // 現在ノードが変わったときだけ表示範囲へスクロール
  // （メモ保存などで nodes が更新されただけなら手動スクロール位置を保つ）
  const lastCenteredRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentId === lastCenteredRef.current) return
    const el = containerRef.current
    const pos = currentId ? layout.posById.get(currentId) : undefined
    if (!el || !pos) return
    lastCenteredRef.current = currentId
    const x = PAD + pos.depth * CELL_W
    const y = PAD + pos.row * CELL_H
    el.scrollTo({
      left: x - el.clientWidth / 2 + BOX_W / 2,
      top: y - el.clientHeight / 2 + BOX_H / 2,
      behavior: 'smooth',
    })
  }, [currentId, layout])

  return (
    <div className="tree-graph-container" ref={containerRef}>
      <svg
        width={width}
        height={height}
        className="tree-graph"
        role="group"
        aria-label="樹形図"
      >
        {layout.placed.map((p) => {
          if (!p.node.parent_id) return null
          const parent = layout.posById.get(p.node.parent_id)
          if (!parent) return null
          const px = PAD + parent.depth * CELL_W
          const py = PAD + parent.row * CELL_H
          const cx = PAD + p.depth * CELL_W
          const cy = PAD + p.row * CELL_H
          const d =
            parent.row === p.row
              ? `M ${px + BOX_W} ${py + BOX_H / 2} H ${cx}`
              : `M ${px + BOX_W / 2} ${py + BOX_H} V ${cy + BOX_H / 2} H ${cx}`
          return <path key={p.node.id} className="graph-edge" d={d} />
        })}

        {layout.placed.map((p) => {
          const x = PAD + p.depth * CELL_W
          const y = PAD + p.row * CELL_H
          const isRoot = p.node.parent_id === null
          const label = isRoot
            ? '開始'
            : (layout.labels.get(p.node.id) ?? p.node.move_usi ?? '?')
          const branchLabel = p.node.branch_label
          // 長いラベルは箱幅に収まるよう切り詰め（全文は title で読める）
          const branchLabelShort =
            branchLabel && branchLabel.length > 8
              ? `${branchLabel.slice(0, 7)}…`
              : branchLabel
          const classes = ['graph-node']
          if (p.node.id === currentId) classes.push('current')
          // 深さ偶数 = 後手の指した手（根=0 は開始局面）
          if (!isRoot && p.depth % 2 === 0) classes.push('gote')
          return (
            <g
              key={p.node.id}
              className={classes.join(' ')}
              transform={`translate(${x}, ${y})`}
              role="button"
              tabIndex={0}
              aria-label={branchLabel ? `${label}（${branchLabel}）` : label}
              aria-current={p.node.id === currentId ? 'true' : undefined}
              data-graph-node={p.node.id}
              onClick={() => onSelect(p.node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(p.node.id)
                }
              }}
            >
              <rect className="graph-box" width={BOX_W} height={BOX_H} rx={6} />
              <text
                className="graph-move"
                x={BOX_W / 2}
                y={BOX_H / 2 + 1}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
              {p.node.comment && (
                <circle className="graph-comment-dot" cx={BOX_W - 6} cy={6} r={3} />
              )}
              {branchLabelShort && (
                <text
                  className="graph-branch"
                  x={BOX_W / 2}
                  y={BOX_H + 13}
                  textAnchor="middle"
                >
                  <title>{branchLabel}</title>
                  {branchLabelShort}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
