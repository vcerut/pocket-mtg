import type { DeckCard, MtgCard } from '../types/mtg'

export type DeckCategory =
  | 'Creature'
  | 'Instant'
  | 'Sorcery'
  | 'Artifact'
  | 'Enchantment'
  | 'Land'
  | 'Basic Land'
  | 'Other'

const CATEGORY_ORDER: DeckCategory[] = [
  'Creature',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Land',
  'Basic Land',
  'Other',
]

/**
 * Single-category classification for the deck-view grouping. A card with
 * multiple types (e.g. "Artifact Creature") lands in a single category: lands and
 * creatures take precedence, then the order of the checks below.
 */
export function deckCardCategory(card: MtgCard): DeckCategory {
  const frontFace = card.type_line.split('//')[0]

  // Lands and creatures win over every other type, so e.g. an Artifact Land is a Land
  // and an Artifact Creature is a Creature.
  if (/\bLand\b/.test(frontFace)) return /\bBasic\b/.test(frontFace) ? 'Basic Land' : 'Land'
  if (/\bCreature\b/.test(frontFace)) return 'Creature'
  if (/\bInstant\b/.test(frontFace)) return 'Instant'
  if (/\bSorcery\b/.test(frontFace)) return 'Sorcery'
  if (/\bArtifact\b/.test(frontFace)) return 'Artifact'
  if (/\bEnchantment\b/.test(frontFace)) return 'Enchantment'
  return 'Other'
}

export interface DeckGroup {
  category: DeckCategory
  cards: DeckCard[]
}

/** Groups deck cards by category in classic deckbuilder order, dropping empty groups. */
export function groupCardsForDeckView(cards: DeckCard[]): DeckGroup[] {
  const buckets = new Map<DeckCategory, DeckCard[]>()
  for (const dc of cards) {
    const category = deckCardCategory(dc.card)
    const list = buckets.get(category) ?? []
    list.push(dc)
    buckets.set(category, list)
  }

  return CATEGORY_ORDER.map((category) => ({
    category,
    cards: (buckets.get(category) ?? []).slice().sort((a, b) => a.card.name.localeCompare(b.card.name)),
  })).filter((group) => group.cards.length > 0)
}
