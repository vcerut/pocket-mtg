import { useRef, useState } from 'react'
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

export function DeckTab() {
  const { formatId = '' } = useParams<{ formatId: string }>()
  const format = getFormat(formatId)

  const deck = useDeckStore((s) => s.decks[formatId]) ?? { cards: [] }
  const setQuantity = useDeckStore((s) => s.setQuantity)
  const removeCard = useDeckStore((s) => s.removeCard)
  const setCommander = useDeckStore((s) => s.setCommander)
  const replaceDeck = useDeckStore((s) => s.replaceDeck)

  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cardCount = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0)

  function confirmOverwriteIfNeeded(): boolean {
    if (deck.cards.length === 0) return true
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
      replaceDeck(formatId, resolved.cards, resolved.commanderId)
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

  async function handleFileImport(file: File) {
    const text = await file.text()
    if (!confirmOverwriteIfNeeded()) return
    setImporting(true)
    setImportError(null)
    try {
      if (file.name.endsWith('.json')) {
        const parsed = parseDecklistJson(text)
        replaceDeck(formatId, parsed.cards, parsed.commanderId)
      } else {
        const parsed = parseDecklistText(text)
        const resolved = await resolveDecklist(parsed)
        replaceDeck(formatId, resolved.cards, resolved.commanderId)
        if (resolved.notFound.length > 0) {
          setImportError(`Couldn't find: ${resolved.notFound.join(', ')}`)
        }
      }
    } catch {
      setImportError('Import failed. Check the file format and try again.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleExportTxt() {
    const text = serializeDecklistText(deck, format)
    downloadTextFile(`${format.id}-deck.txt`, text, 'text/plain')
  }

  function handleExportJson() {
    const json = serializeDecklistJson(deck, formatId)
    downloadTextFile(`${format.id}-deck.json`, json, 'application/json')
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
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            Upload .txt / .json
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileImport(file)
            }}
          />
          <span className="mx-1 h-5 w-px bg-neutral-800" />
          <button
            type="button"
            onClick={handleExportTxt}
            disabled={deck.cards.length === 0}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            Export .txt
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            disabled={deck.cards.length === 0}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            Export .json
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
          {deck.cards.map(({ card, quantity }) => {
            const warnings = deckCardWarnings(card, quantity, format, deck)
            const isCommander = deck.commanderId === card.id
            return (
              <li key={card.id} className="flex flex-col gap-1 px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {format.hasCommander && (
                      <button
                        type="button"
                        onClick={() => setCommander(formatId, isCommander ? undefined : card.id)}
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
                      onClick={() => setQuantity(formatId, card.id, quantity - 1)}
                      className="h-6 w-6 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-neutral-300">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(formatId, card.id, quantity + 1)}
                      className="h-6 w-6 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCard(formatId, card.id)}
                      className="ml-2 text-sm text-neutral-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {warnings.length > 0 && (
                  <p className="text-xs text-amber-400">{warnings.join(' · ')}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
