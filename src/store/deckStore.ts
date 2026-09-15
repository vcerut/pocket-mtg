import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_FORMAT_ID } from '../lib/formats'
import type { BracketFlags, DeckCard, FormatDeck, MtgCard } from '../types/mtg'

function emptyDeck(): FormatDeck {
  return { cards: [] }
}

interface DeckStore {
  activeFormatId: string
  decks: Record<string, FormatDeck>

  setActiveFormat: (formatId: string) => void
  getDeck: (formatId: string) => FormatDeck

  addCard: (formatId: string, card: MtgCard) => void
  removeCard: (formatId: string, cardId: string) => void
  setQuantity: (formatId: string, cardId: string, quantity: number) => void
  setCommander: (formatId: string, cardId: string | undefined) => void
  setBracketFlags: (formatId: string, flags: BracketFlags) => void
  replaceDeck: (formatId: string, cards: DeckCard[], commanderId?: string) => void
  clearDeck: (formatId: string) => void
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set, get) => ({
      activeFormatId: DEFAULT_FORMAT_ID,
      decks: {},

      setActiveFormat: (formatId) => set({ activeFormatId: formatId }),

      getDeck: (formatId) => get().decks[formatId] ?? emptyDeck(),

      addCard: (formatId, card) => {
        const deck = get().decks[formatId] ?? emptyDeck()
        const existing = deck.cards.find((dc) => dc.card.id === card.id)
        const cards = existing
          ? deck.cards.map((dc) =>
              dc.card.id === card.id ? { ...dc, quantity: dc.quantity + 1 } : dc,
            )
          : [...deck.cards, { card, quantity: 1 }]
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

      replaceDeck: (formatId, cards, commanderId) => {
        set({ decks: { ...get().decks, [formatId]: { cards, commanderId } } })
      },

      clearDeck: (formatId) => {
        set({ decks: { ...get().decks, [formatId]: emptyDeck() } })
      },
    }),
    { name: 'pocket-mtg-decks-v2' },
  ),
)
