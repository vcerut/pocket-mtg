import { isGameChanger } from '../data/gameChangers'
import type { BracketFlags, DeckCard } from '../types/mtg'

export function defaultBracketFlags(): BracketFlags {
  return { massLandDenial: false, extraTurnChaining: false, hasCombo: false, comboSpeed: 'slow' }
}

export interface GameChangerMatch {
  count: number
  names: string[]
}

export function findGameChangers(cards: DeckCard[]): GameChangerMatch {
  const names = cards.filter((dc) => isGameChanger(dc.card.name)).map((dc) => dc.card.name)
  return { count: names.length, names }
}

export interface BracketEstimate {
  bracket: number
  reasons: string[]
}

/**
 * Estimates the *minimum* bracket a deck qualifies for, per Wizards of the
 * Coast's Commander Brackets criteria (as of the Feb 9, 2026 update):
 * Game Changers (0 / up to 3 / unlimited for brackets 1-2 / 3 / 4-5), mass
 * land denial and chained extra turns (bracket 4+ only), and two-card combos
 * (bracket 3+ if it closes the game turn 6 or later, bracket 4+ if faster).
 *
 * Choosing between Bracket 1 (Exhibition) and Bracket 2 (Core) isn't
 * something these criteria can decide — that's an overall-power judgment
 * call, not a checkable rule — so the floor here is 1.
 */
export function estimateBracket(gameChangerCount: number, flags: BracketFlags): BracketEstimate {
  let bracket = 1
  const reasons: string[] = []

  if (gameChangerCount >= 4) {
    bracket = Math.max(bracket, 4)
    reasons.push(`${gameChangerCount} Game Changers (4+ requires Bracket 4 or higher)`)
  } else if (gameChangerCount >= 1) {
    bracket = Math.max(bracket, 3)
    reasons.push(`${gameChangerCount} Game Changer${gameChangerCount > 1 ? 's' : ''} (requires Bracket 3 or higher)`)
  }

  if (flags.massLandDenial) {
    bracket = Math.max(bracket, 4)
    reasons.push('Mass land denial (requires Bracket 4 or higher)')
  }

  if (flags.extraTurnChaining) {
    bracket = Math.max(bracket, 4)
    reasons.push('Chained/looped extra turns (requires Bracket 4 or higher)')
  }

  if (flags.hasCombo) {
    if (flags.comboSpeed === 'fast') {
      bracket = Math.max(bracket, 4)
      reasons.push('Two-card combo that can close the game before turn 6 (requires Bracket 4 or higher)')
    } else {
      bracket = Math.max(bracket, 3)
      reasons.push('Two-card combo that closes the game turn 6 or later (requires Bracket 3 or higher)')
    }
  }

  return { bracket, reasons }
}
