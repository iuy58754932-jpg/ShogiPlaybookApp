import type { Piece } from 'shogiops/types'
import { PROMOTED_ROLES, pieceKanji } from '../../shogi/shogi'

export function PieceView({ piece }: { piece: Piece }) {
  const classes = ['shogi-piece', piece.color]
  if (PROMOTED_ROLES.has(piece.role)) classes.push('promoted')
  return <span className={classes.join(' ')}>{pieceKanji(piece)}</span>
}
