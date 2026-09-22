import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { downloadTextFile } from '../lib/download'
import {
  parseDecklistJson,
  parseDecklistText,
  resolveDecklist,
  serializeDecklistJson,
  serializeDecklistText,
} from '../lib/decklist'
import { getFormat } from '../lib/formats'
import { deckCardWarnings } from '../lib/legality'
import { useDeckStore } from '../store/deckStore'
import type { MtgCard } from '../types/mtg'

export function DeckTab() {
  const { formatId = '' } = useParams<{ formatId: string }>()
  const format = getFormat(formatId)

  const deck = useDeckStore((s) => s.decks[formatId]) ?? { cards: [], sideboard: [] }
  const sideboard = deck.sideboard ?? []
  const setQuantity = useDeckStore((s) => s.setQuantity)
  const removeCard = useDeckStore((s) => s.removeCard)
  const setCommander = useDeckStore((s) => s.setCommander)
  const replaceDeck = useDeckStore((s) => s.replaceDeck)
  const setSideboardQuantity = useDeckStore((s) => s.setSideboardQuantity)
  const removeSideboardCard = useDeckStore((s) => s.removeSideboardCard)
  const moveToSideboard = useDeckStore((s) => s.moveToSideboard)
  const moveToMain = useDeckStore((s) => s.moveToMain)

  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const cardCount = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0)
  const sideboardCount = sideboard.reduce((sum, dc) => sum + dc.quantity, 0)

  function confirmOverwriteIfNeeded(): boolean {
    if (deck.cards.length === 0 && sideboard.length === 0) return true
    return window.confirm(`Replace current ${format.label} deck with the imported list?`)
  }

  async function handleImportText() {
    if (!importText.trim()) return
    if (!confirmOverwriteIfNeeded()) return
    setImporting(true)
    setImportError(null)
    try {
      const parsed = parseDecklistText(importText)
      const resolved = await resolveDecklist(parsed)
      replaceDeck(formatId, resolved.cards, resolved.commanderId, resolved.sideboard)
      if (resolved.notFound.length > 0) {
        setImportError(`Couldn't find: ${resolved.notFound.join(', ')}`)
      }
      setImportText('')
    } catch {
      setImportError('Import failed. Check the decklist format and try again.')
    } finally {
      setImporting(false)
    }
  }

  async function handlePasteFromClipboard() {
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      setImportError("Couldn't read the clipboard. Check browser permissions and try again.")
      return
    }
    if (!text.trim()) return
    if (!confirmOverwriteIfNeeded()) return
    setImporting(true)
    setImportError(null)
    try {
      try {
        const parsed = parseDecklistJson(text)
        replaceDeck(formatId, parsed.cards, parsed.commanderId, parsed.sideboard)
      } catch {
        const parsed = parseDecklistText(text)
        const resolved = await resolveDecklist(parsed)
        replaceDeck(formatId, resolved.cards, resolved.commanderId, resolved.sideboard)
        if (resolved.notFound.length > 0) {
          setImportError(`Couldn't find: ${resolved.notFound.join(', ')}`)
        }
      }
    } catch {
      setImportError("Import failed. Check the clipboard content and try again.")
    } finally {
      setImporting(false)
    }
  }

  function handleExportTxt() {
    const text = serializeDecklistText(deck, format)
    downloadTextFile(`${format.id}-deck.txt`, text, 'text/plain')
  }

  async function handleCopyToClipboard() {
    const json = serializeDecklistJson(deck, formatId)
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setImportError("Couldn't write to the clipboard. Check browser permissions and try again.")
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-md border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">Import / Export</h2>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={
            format.hasCommander
              ? 'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n...'
              : '4 Lightning Bolt\n2 Mountain\n...'
          }
          rows={4}
          className="mb-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleImportText}
            disabled={importing}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import pasted list'}
          </button>
          <button
            type="button"
            onClick={handlePasteFromClipboard}
            disabled={importing}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            Paste from clipboard
          </button>
          <span className="mx-1 h-5 w-px bg-neutral-800" />
          <button
            type="button"
            onClick={handleExportTxt}
            disabled={deck.cards.length === 0 && sideboard.length === 0}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            Export .txt
          </button>
          <button
            type="button"
            onClick={handleCopyToClipboard}
            disabled={deck.cards.length === 0 && sideboard.length === 0}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
        {importError && <p className="mt-2 text-sm text-amber-400">{importError}</p>}
      </div>

      <p className="mb-2 text-sm text-neutral-400">
        {cardCount} card{cardCount === 1 ? '' : 's'}
      </p>

      {deck.cards.length === 0 ? (
        <p className="text-neutral-500">
          No cards yet. Go to Search to add some, or import a decklist above.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 bg-neutral-900">
          {deck.cards.map(({ card, quantity }) => (
            <DeckCardRow
              key={card.id}
              card={card}
              quantity={quantity}
              warnings={deckCardWarnings(card, quantity, format, deck)}
              isCommander={format.hasCommander && deck.commanderId === card.id}
              onToggleCommander={
                format.hasCommander
                  ? () => setCommander(formatId, deck.commanderId === card.id ? undefined : card.id)
                  : undefined
              }
              onDecrement={() => setQuantity(formatId, card.id, quantity - 1)}
              onIncrement={() => setQuantity(formatId, card.id, quantity + 1)}
              onRemove={() => removeCard(formatId, card.id)}
              onMove={{ label: '→ SB', onClick: () => moveToSideboard(formatId, card.id) }}
            />
          ))}
        </ul>
      )}

      <h2 className="mb-2 mt-6 text-sm font-medium text-neutral-300">
        Sideboard{sideboard.length > 0 ? ` (${sideboardCount})` : ''}
      </h2>
      {sideboard.length === 0 ? (
        <p className="text-neutral-500">No sideboard cards.</p>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 bg-neutral-900">
          {sideboard.map(({ card, quantity }) => (
            <DeckCardRow
              key={card.id}
              card={card}
              quantity={quantity}
              warnings={deckCardWarnings(card, quantity, format, deck)}
              onDecrement={() => setSideboardQuantity(formatId, card.id, quantity - 1)}
              onIncrement={() => setSideboardQuantity(formatId, card.id, quantity + 1)}
              onRemove={() => removeSideboardCard(formatId, card.id)}
              onMove={{ label: '→ Main', onClick: () => moveToMain(formatId, card.id) }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface DeckCardRowProps {
  card: MtgCard
  quantity: number
  warnings: string[]
  isCommander?: boolean
  onToggleCommander?: () => void
  onDecrement: () => void
  onIncrement: () => void
  onRemove: () => void
  onMove: { label: string; onClick: () => void }
}

function DeckCardRow({
  card,
  quantity,
  warnings,
  isCommander,
  onToggleCommander,
  onDecrement,
  onIncrement,
  onRemove,
  onMove,
}: DeckCardRowProps) {
  return (
    <li className="flex flex-col gap-1 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onToggleCommander && (
            <button
              type="button"
              onClick={onToggleCommander}
              title={isCommander ? 'Unset commander' : 'Set as commander'}
              className={`text-lg ${isCommander ? 'text-amber-400' : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              ★
            </button>
          )}
          <span className="text-white">{card.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDecrement}
            className="h-6 w-6 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          >
            −
          </button>
          <span className="w-6 text-center text-neutral-300">{quantity}</span>
          <button
            type="button"
            onClick={onIncrement}
            className="h-6 w-6 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          >
            +
          </button>
          <button
            type="button"
            onClick={onMove.onClick}
            className="ml-2 text-sm text-neutral-500 hover:text-neutral-300"
          >
            {onMove.label}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-neutral-500 hover:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>
      {warnings.length > 0 && <p className="text-xs text-amber-400">{warnings.join(' · ')}</p>}
    </li>
  )
}
