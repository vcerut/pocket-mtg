export interface MtgCard {
  id: string
  name: string
  mana_cost?: string
  cmc: number
  type_line: string
  oracle_text?: string
  colors?: string[]
  color_identity: string[]
  keywords?: string[]
  power?: string
  toughness?: string
  set: string
  set_name: string
  rarity: string
  legalities: Record<string, string>
  image_uris?: {
    small: string
    normal: string
    large: string
  }
  card_faces?: Array<{
    name: string
    image_uris?: {
      small: string
      normal: string
      large: string
    }
  }>
}

export interface DeckCard {
  card: MtgCard
  quantity: number
}

export interface BracketFlags {
  massLandDenial: boolean
  extraTurnChaining: boolean
  hasCombo: boolean
  comboSpeed: 'fast' | 'slow'
}

export interface FormatDeck {
  cards: DeckCard[]
  sideboard?: DeckCard[]
  maybeboard?: DeckCard[]
  commanderId?: string
  bracketFlags?: BracketFlags
}
