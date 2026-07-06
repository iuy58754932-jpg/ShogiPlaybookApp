import { useMemo, useState } from 'react'
import type { Color } from 'shogiops/types'
import { parseUsi } from 'shogiops/util'
import type { ReplayStep } from '../../shogi/replay'
import { positionFromSfen } from '../../shogi/shogi'
import { ShogiBoard } from './ShogiBoard'

/** 解説用のミニ盤: 経路を1手ずつ進めて/戻して眺める */
export function ReplayBoard({
  steps,
  orientation = 'sente',
}: {
  steps: ReplayStep[]
  orientation?: Color
}) {
  const [index, setIndex] = useState(0)

  const position = useMemo(() => {
    const step = steps[index]
    if (!step) return null
    const pos = positionFromSfen(step.sfen)
    if (pos && step.usi) {
      const md = parseUsi(step.usi)
      if (md) pos.lastMoveOrDrop = md
    }
    return pos
  }, [steps, index])

  if (steps.length === 0 || !position) return null

  return (
    <div className="replay-board">
      <ShogiBoard
        position={position}
        onMove={() => {}}
        readOnly
        orientation={orientation}
      />
      <div className="replay-controls">
        <button
          type="button"
          className="button-secondary"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          ◀ 前へ
        </button>
        <span className="replay-step">
          {steps[index].label}（{index + 1}/{steps.length}）
        </span>
        <button
          type="button"
          className="button-secondary"
          disabled={index === steps.length - 1}
          onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
        >
          次へ ▶
        </button>
      </div>
    </div>
  )
}
