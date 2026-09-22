import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_FORMAT_ID } from '../lib/formats'
import type { BracketFlags, DeckCard, FormatDeck, MtgCard } from '../types/mtg'

function emptyDeck(): FormatDeck {
  return { cards: [], sideboard: [] }
}

interface DeckStore {
  activeFormatId: string
  decks: Record<string, FormatDeck>

  setActiveFormat: (formatId: string) => void
  getDeck: (formatId: string) => FormatDeck

  addCard: (formatId: string, card: MtgCard, quantity?: number) => void
  removeCard: (formatId: string, cardId: string) => void
  setQuantity: (formatId: string, cardId: string, quantity: number) => void
  setCommander: (formatId: string, cardId: string | undefined) => void
  setBracketFlags: (formatId: string, flags: BracketFlags) => void
  replaceDeck: (formatId: string, cards: DeckCard[], commanderId?: string, sideboard?: DeckCard[]) => void
  clearDeck: (formatId: string) => void

  removeSideboardCard: (formatId: string, cardId: string) => void
  setSideboardQuantity: (formatId: string, cardId: string, quantity: number) => void
  moveToSideboard: (formatId: string, cardId: string) => void
  moveToMain: (formatId: string, cardId: string) => void
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set, get) => ({
      activeFormatId: DEFAULT_FORMAT_ID,
      decks: {},

      setActiveFormat: (formatId) => set({ activeFormatId: formatId }),

      getDeck: (formatId) => get().decks[formatId] ?? emptyDeck(),

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

      removeCard: (formatId, cardId) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const cards = deck.cards.filter((dc) => dc.card.id !== cardId)
        const commanderId = deck.commanderId === cardId ? undefined : deck.commanderId
        set({ decks: { ...get().decks, [formatId]: { ...deck, cards, commanderId } } })
      },

      setQuantity: (formatId, cardId, quantity) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        if (quantity <= 0) {
          const cards = deck.cards.filter((dc) => dc.card.id !== cardId)
          const commanderId = deck.commanderId === cardId ? undefined : deck.commanderId
          set({ decks: { ...get().decks, [formatId]: { ...deck, cards, commanderId } } })
          return
        }
        const cards = deck.cards.map((dc) =>
          dc.card.id === cardId ? { ...dc, quantity } : dc,
        )
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
        set({ decks: { ...get().decks, [formatId]: { cards, commanderId, sideboard } } })
      },

      clearDeck: (formatId) => {
        set({ decks: { ...get().decks, [formatId]: emptyDeck() } })
      },

      removeSideboardCard: (formatId, cardId) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const sideboard = (deck.sideboard ?? []).filter((dc) => dc.card.id !== cardId)
        set({ decks: { ...get().decks, [formatId]: { ...deck, sideboard } } })
      },

      setSideboardQuantity: (formatId, cardId, quantity) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        if (quantity <= 0) {
          const sideboard = (deck.sideboard ?? []).filter((dc) => dc.card.id !== cardId)
          set({ decks: { ...get().decks, [formatId]: { ...deck, sideboard } } })
          return
        }
        const sideboard = (deck.sideboard ?? []).map((dc) =>
          dc.card.id === cardId ? { ...dc, quantity } : dc,
        )
        set({ decks: { ...get().decks, [formatId]: { ...deck, sideboard } } })
      },

      moveToSideboard: (formatId, cardId) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const moved = deck.cards.find((dc) => dc.card.id === cardId)
        if (!moved) return
        const cards = deck.cards.filter((dc) => dc.card.id !== cardId)
        const commanderId = deck.commanderId === cardId ? undefined : deck.commanderId
        const existing = (deck.sideboard ?? []).find((dc) => dc.card.id === cardId)
        const sideboard = existing
          ? (deck.sideboard ?? []).map((dc) =>
              dc.card.id === cardId ? { ...dc, quantity: dc.quantity + moved.quantity } : dc,
            )
          : [...(deck.sideboard ?? []), moved]
        set({ decks: { ...get().decks, [formatId]: { ...deck, cards, commanderId, sideboard } } })
      },

      moveToMain: (formatId, cardId) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const moved = (deck.sideboard ?? []).find((dc) => dc.card.id === cardId)
        if (!moved) return
        const sideboard = (deck.sideboard ?? []).filter((dc) => dc.card.id !== cardId)
        const existing = deck.cards.find((dc) => dc.card.id === cardId)
        const cards = existing
          ? deck.cards.map((dc) =>
              dc.card.id === cardId ? { ...dc, quantity: dc.quantity + moved.quantity } : dc,
            )
          : [...deck.cards, moved]
        set({ decks: { ...get().decks, [formatId]: { ...deck, cards, sideboard } } })
      },
    }),
    { name: 'pocket-mtg-decks-v2' },
  ),
)
