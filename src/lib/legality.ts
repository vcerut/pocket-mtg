import type { FormatDef } from './formats'
import type { MtgCard, FormatDeck } from '../types/mtg'

export type Legality = 'legal' | 'not_legal' | 'banned' | 'restricted'

export function cardLegality(card: MtgCard, format: FormatDef): Legality {
  const status = card.legalities?.[format.scryfallKey]
  if (status === 'legal' || status === 'banned' || status === 'restricted') return status
  return 'not_legal'
}

export function legalityLabel(legality: Legality): string | null {
  switch (legality) {
    case 'banned':
      return 'Banned'
    case 'restricted':
      return 'Restricted'
    case 'not_legal':
      return 'Not legal'
    default:
      return null
  }
}

function isBasicLand(card: MtgCard): boolean {
  return card.type_line.startsWith('Basic Land')
}

export function deckCardWarnings(
  card: MtgCard,
  quantity: number,
  format: FormatDef,
  deck: FormatDeck,
): string[] {
  const warnings: string[] = []

  const legality = cardLegality(card, format)
  const label = legalityLabel(legality)
  if (label) warnings.push(`${label} in ${format.label}`)

  if (format.singleton && quantity > 1 && !isBasicLand(card)) {
    warnings.push(`${quantity} copies exceeds singleton limit`)
  }

  if (format.hasCommander && deck.commanderId) {
    const commanderCard = deck.cards.find((dc) => dc.card.id === deck.commanderId)?.card
    if (commanderCard && card.id !== commanderCard.id) {
      const commanderIdentity = new Set(commanderCard.color_identity)
      const outside = card.color_identity.filter((c) => !commanderIdentity.has(c))
      if (outside.length > 0) {
        warnings.push('Outside commander color identity')
      }
    }
  }

  return warnings
}
