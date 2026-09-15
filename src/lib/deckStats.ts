import type { DeckCard } from '../types/mtg'

export interface ManaCurvePoint {
  cmc: string
  count: number
}

export function manaCurve(cards: DeckCard[]): ManaCurvePoint[] {
  const buckets = new Map<number, number>()

  for (const { card, quantity } of cards) {
    if (card.type_line.includes('Land')) continue
    const cmc = Math.min(Math.floor(card.cmc), 7)
    buckets.set(cmc, (buckets.get(cmc) ?? 0) + quantity)
  }

  return Array.from({ length: 8 }, (_, cmc) => ({
    cmc: cmc === 7 ? '7+' : String(cmc),
    count: buckets.get(cmc) ?? 0,
  }))
}

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}

export const COLOR_HEX: Record<string, string> = {
  White: '#f0e6c8',
  Blue: '#4a90d9',
  Black: '#4a4a4a',
  Red: '#d94a4a',
  Green: '#4ad96f',
  Colorless: '#9ca3af',
}

export interface ColorPoint {
  name: string
  count: number
}

export function colorDistribution(cards: DeckCard[]): ColorPoint[] {
  const buckets = new Map<string, number>()

  for (const { card, quantity } of cards) {
    const colors = card.color_identity
    if (!colors || colors.length === 0) {
      buckets.set('Colorless', (buckets.get('Colorless') ?? 0) + quantity)
      continue
    }
    for (const c of colors) {
      const name = COLOR_NAMES[c] ?? c
      buckets.set(name, (buckets.get(name) ?? 0) + quantity)
    }
  }

  return Array.from(buckets.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

const SUPERTYPES = new Set(['Basic', 'Legendary', 'Snow', 'World', 'Elite', 'Ongoing', 'Host'])

export function primaryType(card: { type_line: string }): string {
  const frontFace = card.type_line.split('//')[0]
  const typesPart = frontFace.split('—')[0].trim()
  const words = typesPart.split(/\s+/).filter(Boolean)
  return words.find((w) => !SUPERTYPES.has(w)) ?? words[0] ?? 'Other'
}

export interface TypePoint {
  type: string
  count: number
}

export function typeBreakdown(cards: DeckCard[]): TypePoint[] {
  const buckets = new Map<string, number>()

  for (const { card, quantity } of cards) {
    const type = primaryType(card)
    buckets.set(type, (buckets.get(type) ?? 0) + quantity)
  }

  return Array.from(buckets.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

export interface LandSpellRatio {
  lands: number
  nonLands: number
}

export function landSpellRatio(cards: DeckCard[]): LandSpellRatio {
  let lands = 0
  let nonLands = 0
  for (const { card, quantity } of cards) {
    if (primaryType(card) === 'Land') lands += quantity
    else nonLands += quantity
  }
  return { lands, nonLands }
}

export function averageManaValue(cards: DeckCard[]): number {
  let totalCmc = 0
  let totalCount = 0
  for (const { card, quantity } of cards) {
    if (card.type_line.includes('Land')) continue
    totalCmc += card.cmc * quantity
    totalCount += quantity
  }
  return totalCount > 0 ? totalCmc / totalCount : 0
}

export interface KeywordPoint {
  keyword: string
  count: number
}

export function keywordTally(cards: DeckCard[]): KeywordPoint[] {
  const buckets = new Map<string, number>()
  for (const { card, quantity } of cards) {
    for (const keyword of card.keywords ?? []) {
      buckets.set(keyword, (buckets.get(keyword) ?? 0) + quantity)
    }
  }
  return Array.from(buckets.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
}

function parsePT(value: string | undefined): number | null {
  if (value === undefined) return null
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : null
}

export interface PowerToughnessPoint {
  cmc: string
  avgPower: number | null
  avgToughness: number | null
  count: number
  variableCount: number
}

/** Average power/toughness of creatures at each mana-value bucket (0-7+). Creatures with
 * variable stats (e.g. "*", "1+*") are excluded from the averages but counted separately. */
export function powerToughnessCurve(cards: DeckCard[]): PowerToughnessPoint[] {
  const buckets = new Map<number, { power: number[]; toughness: number[]; variableCount: number }>()

  for (const { card, quantity } of cards) {
    if (!card.type_line.includes('Creature')) continue
    const cmc = Math.min(Math.floor(card.cmc), 7)
    const bucket = buckets.get(cmc) ?? { power: [], toughness: [], variableCount: 0 }

    const power = parsePT(card.power)
    const toughness = parsePT(card.toughness)
    if (power === null || toughness === null) {
      bucket.variableCount += quantity
    } else {
      for (let i = 0; i < quantity; i++) {
        bucket.power.push(power)
        bucket.toughness.push(toughness)
      }
    }
    buckets.set(cmc, bucket)
  }

  return Array.from({ length: 8 }, (_, cmc) => {
    const bucket = buckets.get(cmc)
    const count = bucket?.power.length ?? 0
    const avg = (values: number[]) => (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null)
    return {
      cmc: cmc === 7 ? '7+' : String(cmc),
      avgPower: bucket ? avg(bucket.power) : null,
      avgToughness: bucket ? avg(bucket.toughness) : null,
      count,
      variableCount: bucket?.variableCount ?? 0,
    }
  })
}
