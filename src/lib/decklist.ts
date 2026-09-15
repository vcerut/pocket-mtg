import type { DeckCard, FormatDeck, MtgCard } from '../types/mtg'
import type { FormatDef } from './formats'
import { getCardsByNames } from '../api/scryfall'

export interface ParsedLine {
  quantity: number
  name: string
}

const LINE_RE = /^(\d+)\s*x?\s+(.+)$/i
const TRAILING_SET_CODE_RE = /\s*\([A-Za-z0-9]+\)\s*[A-Za-z0-9]*\s*$/

function parseLine(line: string): ParsedLine | null {
  const match = line.trim().match(LINE_RE)
  if (!match) return null
  const quantity = Number(match[1])
  const name = match[2].replace(TRAILING_SET_CODE_RE, '').trim()
  if (!name) return null
  return { quantity, name }
}

export interface ParsedDecklist {
  commander: ParsedLine | null
  cards: ParsedLine[]
}

/**
 * Parses a plain-text decklist. Recognizes an optional `Commander` / `Deck`
 * section split (case-insensitive); falls back to a flat card list otherwise.
 */
export function parseDecklistText(text: string): ParsedDecklist {
  const lines = text.split('\n').map((l) => l.trim())

  let section: 'commander' | 'deck' = 'deck'
  let commander: ParsedLine | null = null
  const cards: ParsedLine[] = []

  for (const raw of lines) {
    if (!raw) continue
    const lower = raw.toLowerCase()
    if (lower === 'commander') {
      section = 'commander'
      continue
    }
    if (lower === 'deck' || lower === 'decklist' || lower === 'mainboard') {
      section = 'deck'
      continue
    }

    const parsed = parseLine(raw)
    if (!parsed) continue

    if (section === 'commander') {
      commander = parsed
    } else {
      cards.push(parsed)
    }
  }

  return { commander, cards }
}

export interface ResolvedDecklist {
  cards: DeckCard[]
  commanderId?: string
  notFound: string[]
}

export async function resolveDecklist(parsed: ParsedDecklist): Promise<ResolvedDecklist> {
  const allNames = [
    ...(parsed.commander ? [parsed.commander.name] : []),
    ...parsed.cards.map((c) => c.name),
  ]
  const { found, notFound } = await getCardsByNames(allNames)

  const cards: DeckCard[] = []
  for (const line of parsed.cards) {
    const card = found.get(line.name.toLowerCase())
    if (card) cards.push({ card, quantity: line.quantity })
  }

  let commanderId: string | undefined
  if (parsed.commander) {
    const commanderCard = found.get(parsed.commander.name.toLowerCase())
    if (commanderCard) {
      commanderId = commanderCard.id
      if (!cards.some((dc) => dc.card.id === commanderCard.id)) {
        cards.push({ card: commanderCard, quantity: parsed.commander.quantity })
      }
    }
  }

  return { cards, commanderId, notFound }
}

export function serializeDecklistText(deck: FormatDeck, format: FormatDef): string {
  const lines: string[] = []
  const commanderCard = deck.cards.find((dc) => dc.card.id === deck.commanderId)

  if (format.hasCommander && commanderCard) {
    lines.push('Commander', `1 ${commanderCard.card.name}`, '')
    lines.push('Deck')
    for (const { card, quantity } of deck.cards) {
      if (card.id === commanderCard.card.id) continue
      lines.push(`${quantity} ${card.name}`)
    }
  } else {
    for (const { card, quantity } of deck.cards) {
      lines.push(`${quantity} ${card.name}`)
    }
  }

  return lines.join('\n')
}

interface DeckJson {
  formatId: string
  commanderId?: string
  cards: Array<{ card: MtgCard; quantity: number }>
}

export function serializeDecklistJson(deck: FormatDeck, formatId: string): string {
  const payload: DeckJson = {
    formatId,
    commanderId: deck.commanderId,
    cards: deck.cards,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseDecklistJson(text: string): { formatId?: string; cards: DeckCard[]; commanderId?: string } {
  const json = JSON.parse(text) as DeckJson
  if (!Array.isArray(json.cards)) throw new Error('Invalid deck JSON: missing cards array')
  return {
    formatId: json.formatId,
    commanderId: json.commanderId,
    cards: json.cards.map((dc) => ({ card: dc.card, quantity: dc.quantity })),
  }
}
