import type { Color, Role } from 'shogiops/types'
import type { Shogi } from 'shogiops/variant/shogi'
import { HAND_ROLES, roleKanji } from '../../shogi/shogi'
import { PieceView } from './PieceView'

interface HandStandProps {
  position: Shogi
  color: Color
  selectedRole: Role | null
  onSelectRole: (color: Color, role: Role) => void
  /** false なら閲覧専用（タップ不可） */
  interactive?: boolean
}

export function HandStand({
  position,
  color,
  selectedRole,
  onSelectRole,
  interactive = true,
}: HandStandProps) {
  const hand = position.hands.color(color)
  const isTurn = position.turn === color && interactive

  return (
    <div className={`hand-stand ${color}`}>
      <span className="hand-label">{color === 'sente' ? '☗' : '☖'}</span>
      {HAND_ROLES.map((role) => {
        const count = hand.get(role)
        if (count === 0) return null
        return (
          <button
            key={role}
            type="button"
            className={`hand-piece${selectedRole === role ? ' selected' : ''}`}
            data-hand={`${color}-${role}`}
            aria-label={`持ち駒 ${roleKanji(role)} ${count}枚`}
            disabled={!isTurn}
            onClick={() => onSelectRole(color, role)}
          >
            <PieceView piece={{ color, role }} />
            {count > 1 && <span className="hand-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
