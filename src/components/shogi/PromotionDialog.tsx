import { useEffect } from 'react'
import type { Piece } from 'shogiops/types'
import { pieceKanji, promotedRole, roleKanji } from '../../shogi/shogi'

interface PromotionDialogProps {
  piece: Piece
  onChoose: (promotion: boolean) => void
  onCancel: () => void
}

export function PromotionDialog({
  piece,
  onChoose,
  onCancel,
}: PromotionDialogProps) {
  const promoted = promotedRole(piece.role)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="promotion-overlay" onClick={onCancel}>
      <div
        className="promotion-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="成りますか？"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="promotion-title">成りますか？</p>
        <div className="promotion-choices">
          <button
            type="button"
            className="promotion-choice"
            data-promote="true"
            autoFocus
            onClick={() => onChoose(true)}
          >
            <span className="shogi-piece promoted">
              {promoted ? roleKanji(promoted) : '?'}
            </span>
            成る
          </button>
          <button
            type="button"
            className="promotion-choice"
            data-promote="false"
            onClick={() => onChoose(false)}
          >
            <span className="shogi-piece">{pieceKanji(piece)}</span>
            不成
          </button>
        </div>
      </div>
    </div>
  )
}
