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
  /** true なら閲覧専用（駒操作を受け付けない）。解説の局面再生などに使う */
  readOnly?: boolean
  /** 手前にする側。'gote' で盤を 180 度回転した後手視点になる */
  orientation?: Color
}

const COL_LABELS_SENTE = ['9', '8', '7', '6', '5', '4', '3', '2', '1']
const COL_LABELS_GOTE = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const ROW_LABELS_SENTE = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const ROW_LABELS_GOTE = ['九', '八', '七', '六', '五', '四', '三', '二', '一']
const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const COLS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export function ShogiBoard({
  position,
  onMove,
  readOnly = false,
  orientation = 'sente',
}: ShogiBoardProps) {
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
    if (readOnly || pendingPromotion) return
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
    if (readOnly || pendingPromotion || color !== position.turn) return
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

  const farColor: Color = orientation === 'sente' ? 'gote' : 'sente'
  const nearColor: Color = orientation
  const colLabels = orientation === 'sente' ? COL_LABELS_SENTE : COL_LABELS_GOTE
  const rowLabels = orientation === 'sente' ? ROW_LABELS_SENTE : ROW_LABELS_GOTE

  return (
    <div
      className={`shogi-board-wrap${orientation === 'gote' ? ' board-flipped' : ''}`}
    >
      <HandStand
        position={position}
        color={farColor}
        interactive={!readOnly}
        selectedRole={
          selection?.kind === 'hand' && position.turn === farColor
            ? selection.role
            : null
        }
        onSelectRole={handleHandSelect}
      />

      <div className="board-with-labels">
        <div className="col-labels">
          {colLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="board-and-rows">
          <div className="board-grid">
            {ROWS.map((row) =>
              COLS.map((col) => {
                const square = squareAt(col, row, orientation)
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
            {rowLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      <HandStand
        position={position}
        color={nearColor}
        interactive={!readOnly}
        selectedRole={
          selection?.kind === 'hand' && position.turn === nearColor
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
