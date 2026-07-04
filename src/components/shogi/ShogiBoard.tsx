import { useEffect, useState } from 'react'
import type { SquareSet } from 'shogiops/square-set'
import type { Color, MoveOrDrop, Role, Square } from 'shogiops/types'
import type { Shogi } from 'shogiops/variant/shogi'
import { makeSquareName } from 'shogiops/util'
import {
  canPromoteMove,
  mustPromoteMove,
  pieceKanji,
  squareAt,
} from '../../shogi/shogi'
import { HandStand } from './HandStand'
import { PieceView } from './PieceView'
import { PromotionDialog } from './PromotionDialog'
import './shogi-board.css'

type Selection =
  | { kind: 'board'; square: Square; dests: SquareSet }
  | { kind: 'hand'; role: Role; dests: SquareSet }

interface ShogiBoardProps {
  position: Shogi
  onMove: (md: MoveOrDrop) => void
}

const COL_LABELS = ['9', '8', '7', '6', '5', '4', '3', '2', '1']
const ROW_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const COLS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export function ShogiBoard({ position, onMove }: ShogiBoardProps) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square
    to: Square
  } | null>(null)

  // 局面が変わったら選択・成り確認をリセット
  useEffect(() => {
    setSelection(null)
    setPendingPromotion(null)
  }, [position])

  const checkedSquares = position.checks()
  const promotionPiece = pendingPromotion
    ? position.board.get(pendingPromotion.from)
    : undefined
  const last = position.lastMoveOrDrop
  const lastSquares: Square[] = last
    ? 'from' in last
      ? [last.from, last.to]
      : [last.to]
    : []

  function playNormal(from: Square, to: Square) {
    if (mustPromoteMove(position, from, to)) {
      // 行き所のない駒になる手は自動で成り（isLegal は promotion:true を要求する）
      onMove({ from, to, promotion: true })
    } else if (canPromoteMove(position, from, to)) {
      setPendingPromotion({ from, to })
      return
    } else {
      onMove({ from, to, promotion: false })
    }
    setSelection(null)
  }

  function handleSquareClick(square: Square) {
    if (pendingPromotion) return
    if (selection?.dests.has(square)) {
      if (selection.kind === 'board') {
        playNormal(selection.square, square)
      } else {
        onMove({ role: selection.role, to: square })
        setSelection(null)
      }
      return
    }
    if (selection?.kind === 'board' && selection.square === square) {
      setSelection(null)
      return
    }
    const piece = position.board.get(square)
    if (piece && piece.color === position.turn) {
      setSelection({ kind: 'board', square, dests: position.moveDests(square) })
    } else {
      setSelection(null)
    }
  }

  function handleHandSelect(color: Color, role: Role) {
    if (pendingPromotion || color !== position.turn) return
    if (selection?.kind === 'hand' && selection.role === role) {
      setSelection(null)
      return
    }
    setSelection({ kind: 'hand', role, dests: position.dropDests({ color, role }) })
  }

  function handlePromotionChoice(promotion: boolean) {
    if (pendingPromotion) {
      onMove({ ...pendingPromotion, promotion })
    }
    setPendingPromotion(null)
    setSelection(null)
  }

  return (
    <div className="shogi-board-wrap">
      <HandStand
        position={position}
        color="gote"
        selectedRole={
          selection?.kind === 'hand' && position.turn === 'gote'
            ? selection.role
            : null
        }
        onSelectRole={handleHandSelect}
      />

      <div className="board-with-labels">
        <div className="col-labels">
          {COL_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="board-and-rows">
          <div className="board-grid">
            {ROWS.map((row) =>
              COLS.map((col) => {
                const square = squareAt(col, row)
                const piece = position.board.get(square)
                const isDest = selection?.dests.has(square) ?? false
                const classes = ['board-square']
                if (selection?.kind === 'board' && selection.square === square)
                  classes.push('selected')
                if (isDest) classes.push(piece ? 'dest-capture' : 'dest')
                if (lastSquares.includes(square)) classes.push('last')
                if (checkedSquares.has(square)) classes.push('check')
                return (
                  <button
                    key={square}
                    type="button"
                    className={classes.join(' ')}
                    data-square={makeSquareName(square)}
                    aria-label={`${makeSquareName(square)}${piece ? ` ${pieceKanji(piece)}` : ''}`}
                    onClick={() => handleSquareClick(square)}
                  >
                    {piece && <PieceView piece={piece} />}
                  </button>
                )
              }),
            )}
          </div>
          <div className="row-labels">
            {ROW_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      <HandStand
        position={position}
        color="sente"
        selectedRole={
          selection?.kind === 'hand' && position.turn === 'sente'
            ? selection.role
            : null
        }
        onSelectRole={handleHandSelect}
      />

      {pendingPromotion && promotionPiece && (
        <PromotionDialog
          piece={promotionPiece}
          onChoose={handlePromotionChoice}
          onCancel={() => {
            setPendingPromotion(null)
            setSelection(null)
          }}
        />
      )}
    </div>
  )
}
