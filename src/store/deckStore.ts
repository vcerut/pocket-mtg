import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_FORMAT_ID } from '../lib/formats'
import type { BracketFlags, DeckCard, FormatDeck, MtgCard } from '../types/mtg'

export type Zone = 'main' | 'sideboard' | 'maybeboard'

function emptyDeck(): FormatDeck {
  return { cards: [], sideboard: [], maybeboard: [] }
}

function zoneCards(deck: FormatDeck, zone: Zone): DeckCard[] {
  if (zone === 'main') return deck.cards
  return deck[zone] ?? []
}

function withZoneCards(deck: FormatDeck, zone: Zone, cards: DeckCard[]): FormatDeck {
  return zone === 'main' ? { ...deck, cards } : { ...deck, [zone]: cards }
}

export type DeckViewMode = 'text' | 'visual'

interface DeckStore {
  activeFormatId: string
  decks: Record<string, FormatDeck>
  viewMode: DeckViewMode

  setActiveFormat: (formatId: string) => void
  getDeck: (formatId: string) => FormatDeck
  setViewMode: (mode: DeckViewMode) => void

  addCard: (formatId: string, card: MtgCard, quantity?: number) => void
  setCommander: (formatId: string, cardId: string | undefined) => void
  setBracketFlags: (formatId: string, flags: BracketFlags) => void
  replaceDeck: (formatId: string, cards: DeckCard[], commanderId?: string, sideboard?: DeckCard[]) => void
  clearDeck: (formatId: string) => void

  setZoneQuantity: (formatId: string, zone: Zone, cardId: string, quantity: number) => void
  removeFromZone: (formatId: string, zone: Zone, cardId: string) => void
  moveCard: (formatId: string, cardId: string, to: Zone) => void
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set, get) => ({
      activeFormatId: DEFAULT_FORMAT_ID,
      decks: {},
      viewMode: 'text',

      setActiveFormat: (formatId) => set({ activeFormatId: formatId }),

      getDeck: (formatId) => get().decks[formatId] ?? emptyDeck(),

      setViewMode: (mode) => set({ viewMode: mode }),

      addCard: (formatId, card, quantity = 1) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const existing = deck.cards.find((dc) => dc.card.id === card.id)
        const cards = existing
          ? deck.cards.map((dc) =>
              dc.card.id === card.id ? { ...dc, quantity: dc.quantity + quantity } : dc,
            )
          : [...deck.cards, { card, quantity }]
        set({ decks: { ...get().decks, [formatId]: { ...deck, cards } } })
      },

      setCommander: (formatId, cardId) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        set({ decks: { ...get().decks, [formatId]: { ...deck, commanderId: cardId } } })
      },

      setBracketFlags: (formatId, flags) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        set({ decks: { ...get().decks, [formatId]: { ...deck, bracketFlags: flags } } })
      },

      replaceDeck: (formatId, cards, commanderId, sideboard = []) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        set({
          decks: {
            ...get().decks,
            [formatId]: { ...deck, cards, commanderId, sideboard },
          },
        })
      },

      clearDeck: (formatId) => {
        set({ decks: { ...get().decks, [formatId]: emptyDeck() } })
      },

      setZoneQuantity: (formatId, zone, cardId, quantity) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const list = zoneCards(deck, zone)
        if (quantity <= 0) {
          const commanderId = zone === 'main' && deck.commanderId === cardId ? undefined : deck.commanderId
          set({
            decks: {
              ...get().decks,
              [formatId]: { ...withZoneCards(deck, zone, list.filter((dc) => dc.card.id !== cardId)), commanderId },
            },
          })
          return
        }
        const updated = list.map((dc) => (dc.card.id === cardId ? { ...dc, quantity } : dc))
        set({ decks: { ...get().decks, [formatId]: withZoneCards(deck, zone, updated) } })
      },

      removeFromZone: (formatId, zone, cardId) => {
        get().setZoneQuantity(formatId, zone, cardId, 0)
      },

      moveCard: (formatId, cardId, to) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const zones: Zone[] = ['main', 'sideboard', 'maybeboard']
        const from = zones.find((z) => zoneCards(deck, z).some((dc) => dc.card.id === cardId))
        if (!from || from === to) return

        const moved = zoneCards(deck, from).find((dc) => dc.card.id === cardId)!
        const sourceList = zoneCards(deck, from).filter((dc) => dc.card.id !== cardId)
        const targetList = zoneCards(deck, to)
        const existing = targetList.find((dc) => dc.card.id === cardId)
        const updatedTarget = existing
          ? targetList.map((dc) => (dc.card.id === cardId ? { ...dc, quantity: dc.quantity + moved.quantity } : dc))
          : [...targetList, moved]

        let next = withZoneCards(deck, from, sourceList)
        next = withZoneCards(next, to, updatedTarget)
        if (from === 'main' && next.commanderId === cardId) {
          next = { ...next, commanderId: undefined }
        }

        set({ decks: { ...get().decks, [formatId]: next } })
      },
    }),
    { name: 'pocket-mtg-decks-v2' },
  ),
)
