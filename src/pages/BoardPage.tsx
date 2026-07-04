import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MoveOrDrop, Outcome } from 'shogiops/types'
import type { Shogi } from 'shogiops/variant/shogi'
import { ShogiBoard } from '../components/shogi/ShogiBoard'
import { initialPosition, playMove } from '../shogi/shogi'

function colorLabel(color: 'sente' | 'gote'): string {
  return color === 'sente' ? '▲先手' : '△後手'
}

function outcomeLabel(outcome: Outcome): string {
  const winner = outcome.winner ? `${colorLabel(outcome.winner)}の勝ち` : ''
  switch (outcome.result) {
    case 'checkmate':
      return `詰み — ${winner}`
    case 'stalemate':
      // 将棋では手詰まり（合法手なし）も負け
      return `手詰まり — ${winner}`
    default:
      return winner ? `終局 — ${winner}` : '終局'
  }
}

export function BoardPage() {
  const [position, setPosition] = useState<Shogi>(() => initialPosition())

  const outcome = position.outcome()
  const inCheck = position.isCheck()

  function handleMove(md: MoveOrDrop) {
    setPosition(playMove(position, md))
  }

  function reset() {
    setPosition(initialPosition())
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>盤面（練習）</h1>
        <div className="header-right">
          <Link to="/" className="header-link">
            ホーム
          </Link>
        </div>
      </header>
      <main className="board-page">
        <p className="board-status" data-testid="board-status">
          {outcome
            ? outcomeLabel(outcome)
            : `${position.moveNumber}手目 ${colorLabel(position.turn)}の手番${
                inCheck ? '【王手】' : ''
              }`}
        </p>
        <ShogiBoard position={position} onMove={handleMove} />
        <button type="button" className="button-secondary" onClick={reset}>
          初期局面に戻す
        </button>
      </main>
    </div>
  )
}
