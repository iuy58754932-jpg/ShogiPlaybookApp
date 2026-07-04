import { makeJapaneseMoveOrDrop } from 'shogiops/notation/japanese'
import { initialSfen, parseSfen } from 'shogiops/sfen'
import type { MoveOrDrop, Piece, Role, Square } from 'shogiops/types'
import type { Shogi } from 'shogiops/variant/shogi'
import { parseUsi, squareFile, squareRank } from 'shogiops/util'
import {
  handRoles,
  pieceCanPromote,
  pieceForcePromote,
  promote,
} from 'shogiops/variant/util'

export function initialPosition(): Shogi {
  return parseSfen('standard', initialSfen('standard')).unwrap()
}

/** SFEN から局面を復元する（不正な SFEN は null） */
export function positionFromSfen(sfen: string): Shogi | null {
  const result = parseSfen('standard', sfen)
  return result.isOk ? result.value : null
}

/** 手の日本語表記（例 "▲７六歩"）。pos はその手を指す前の局面 */
export function moveLabel(pos: Shogi, usi: string): string {
  const md = parseUsi(usi)
  if (!md) return usi
  const mark = pos.turn === 'sente' ? '▲' : '△'
  return mark + (makeJapaneseMoveOrDrop(pos, md) ?? usi)
}

/** clone してから指す（shogiops の play() は破壊的更新のため） */
export function playMove(pos: Shogi, md: MoveOrDrop): Shogi {
  const next = pos.clone()
  next.play(md)
  return next
}

// ---- 描画座標（先手を下に固定した表示） ----
// shogiops のマス番号は「筋(0始まり) + 16 × 段(0始まり)」。筋0 = 1筋（画面右端）、
// 段0 = 一段目（画面最上段）なので、左上原点の col/row とは筋が反転する。

export function squareAt(col: number, row: number): Square {
  return 8 - col + 16 * row
}

export function boardCol(square: Square): number {
  return 8 - squareFile(square)
}

export function boardRow(square: Square): number {
  return squareRank(square)
}

// ---- 成り ----

export function canPromoteMove(pos: Shogi, from: Square, to: Square): boolean {
  const piece = pos.board.get(from)
  if (!piece) return false
  return pieceCanPromote('standard')(piece, from, to, pos.board.get(to))
}

export function mustPromoteMove(pos: Shogi, from: Square, to: Square): boolean {
  const piece = pos.board.get(from)
  if (!piece) return false
  return pieceForcePromote('standard')(piece, to)
}

export function promotedRole(role: Role): Role | undefined {
  return promote('standard')(role)
}

// ---- 表示 ----

/** 持ち駒台の表示順（SFEN の持ち駒順と同じ: 飛角金銀桂香歩） */
export const HAND_ROLES: readonly Role[] = handRoles('standard')

export const PROMOTED_ROLES: ReadonlySet<Role> = new Set<Role>([
  'tokin',
  'promotedlance',
  'promotedknight',
  'promotedsilver',
  'horse',
  'dragon',
])

const ROLE_KANJI: Partial<Record<Role, string>> = {
  pawn: '歩',
  lance: '香',
  knight: '桂',
  silver: '銀',
  gold: '金',
  bishop: '角',
  rook: '飛',
  king: '玉',
  tokin: 'と',
  promotedlance: '杏',
  promotedknight: '圭',
  promotedsilver: '全',
  horse: '馬',
  dragon: '龍',
}

export function pieceKanji(piece: Piece): string {
  if (piece.role === 'king' && piece.color === 'gote') return '王'
  return ROLE_KANJI[piece.role] ?? '?'
}

export function roleKanji(role: Role): string {
  return ROLE_KANJI[role] ?? '?'
}
