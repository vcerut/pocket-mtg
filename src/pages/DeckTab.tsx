import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { cardImageUrl } from '../api/scryfall'
import { groupCardsForDeckView } from '../lib/deckGrouping'
import { downloadTextFile } from '../lib/download'
import {
  parseDecklistJson,
  parseDecklistText,
  resolveDecklist,
  serializeDecklistText,
} from '../lib/decklist'
import { getFormat } from '../lib/formats'
import { cardLegality, deckCardWarnings, legalityLabel } from '../lib/legality'
import { useDeckStore, type DeckViewMode, type Zone } from '../store/deckStore'
import type { DeckCard, MtgCard } from '../types/mtg'
import type { FormatDef } from '../lib/formats'

const ZONE_LABELS: Record<Zone, string> = { main: 'Main', sideboard: 'Sideboard', maybeboard: 'Maybeboard' }
const ALL_ZONES: Zone[] = ['main', 'sideboard', 'maybeboard']

interface MoveTarget {
  label: string
  onClick: () => void
}

const AUTO_SCROLL_EDGE = 96 // px from the top/bottom of the viewport that triggers scrolling
const AUTO_SCROLL_MAX_SPEED = 18 // px per animation frame right at the edge

/** Scrolls the page while a native HTML5 drag is near the top/bottom of the viewport,
 * since browsers don't do this automatically for custom drop targets. */
function useAutoScrollWhileDragging() {
  const dragClientY = useRef<number | null>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    function handleDragOver(e: DragEvent) {
      dragClientY.current = e.clientY
    }
    function handleDragStart() {
      isDragging.current = true
    }
    function handleDragEnd() {
      isDragging.current = false
      dragClientY.current = null
    }
    function handleWheel(e: WheelEvent) {
      if (!isDragging.current) return
      e.preventDefault()
      window.scrollBy(0, e.deltaY)
    }

    let rafId: number
    function tick() {
      if (isDragging.current && dragClientY.current !== null) {
        const y = dragClientY.current
        const viewportHeight = window.innerHeight
        if (y < AUTO_SCROLL_EDGE) {
          window.scrollBy(0, -AUTO_SCROLL_MAX_SPEED * (1 - y / AUTO_SCROLL_EDGE))
        } else if (y > viewportHeight - AUTO_SCROLL_EDGE) {
          window.scrollBy(0, AUTO_SCROLL_MAX_SPEED * (1 - (viewportHeight - y) / AUTO_SCROLL_EDGE))
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragstart', handleDragStart)
    window.addEventListener('dragend', handleDragEnd)
    window.addEventListener('drop', handleDragEnd)
    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragstart', handleDragStart)
      window.removeEventListener('dragend', handleDragEnd)
      window.removeEventListener('drop', handleDragEnd)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [])
}

export function DeckTab() {
  const { formatId = '' } = useParams<{ formatId: string }>()
  const format = getFormat(formatId)

  const deck = useDeckStore((s) => s.decks[formatId]) ?? { cards: [], sideboard: [], maybeboard: [] }
  const sideboard = deck.sideboard ?? []
  const maybeboard = deck.maybeboard ?? []
  const viewMode = useDeckStore((s) => s.viewMode)
  const setViewMode = useDeckStore((s) => s.setViewMode)
  const setCommander = useDeckStore((s) => s.setCommander)
  const replaceDeck = useDeckStore((s) => s.replaceDeck)
  const setZoneQuantity = useDeckStore((s) => s.setZoneQuantity)
  const removeFromZone = useDeckStore((s) => s.removeFromZone)
  const moveCard = useDeckStore((s) => s.moveCard)

  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOverZone, setDragOverZone] = useState<Zone | null>(null)

  useAutoScrollWhileDragging()

  const cardCount = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0)
  const sideboardCount = sideboard.reduce((sum, dc) => sum + dc.quantity, 0)
  const maybeboardCount = maybeboard.reduce((sum, dc) => sum + dc.quantity, 0)

  function moveTargetsFor(zone: Zone, cardId: string): MoveTarget[] {
    return ALL_ZONES.filter((z) => z !== zone).map((z) => ({
      label: `→ ${ZONE_LABELS[z]}`,
      onClick: () => moveCard(formatId, cardId, z),
    }))
  }

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
    const text = serializeDecklistText(deck, format)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setImportError("Couldn't write to the clipboard. Check browser permissions and try again.")
    }
  }

  function renderZoneSection(zone: Zone, cards: DeckCard[], emptyText: string) {
    const groups = groupCardsForDeckView(cards)
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOverZone(zone)
        }}
        onDragLeave={() => setDragOverZone((current) => (current === zone ? null : current))}
        onDrop={(e) => {
          e.preventDefault()
          setDragOverZone(null)
          const cardId = e.dataTransfer.getData('text/plain')
          if (cardId) moveCard(formatId, cardId, zone)
        }}
        className={`rounded-md p-1 transition-colors ${
          dragOverZone === zone ? 'bg-violet-950/30 ring-2 ring-violet-500' : ''
        }`}
      >
        {groups.length === 0 ? (
          <p className="text-neutral-500">{emptyText}</p>
        ) : (
          <div className={viewMode === 'visual' ? 'flex flex-wrap items-start gap-x-6 gap-y-4' : viewMode === 'text' ? 'gap-x-8 md:columns-2 xl:columns-3' : ''}>
          {groups.map((group) => (
            <div key={group.category} className={viewMode === 'visual' ? 'w-56' : viewMode === 'text' ? 'mb-4 break-inside-avoid' : 'mb-4 last:mb-0'}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {group.category} · {group.cards.reduce((sum, dc) => sum + dc.quantity, 0)}
              </h3>
              {viewMode === 'text' ? (
                <ul className="divide-y divide-neutral-800/60">
                  {group.cards.map(({ card, quantity }) => (
                    <DeckCardRow
                      key={card.id}
                      card={card}
                      quantity={quantity}
                      warnings={deckCardWarnings(card, quantity, format, deck)}
                      isCommander={zone === 'main' && format.hasCommander && deck.commanderId === card.id}
                      onToggleCommander={
                        zone === 'main' && format.hasCommander
                          ? () => setCommander(formatId, deck.commanderId === card.id ? undefined : card.id)
                          : undefined
                      }
                      onDecrement={() => setZoneQuantity(formatId, zone, card.id, quantity - 1)}
                      onIncrement={() => setZoneQuantity(formatId, zone, card.id, quantity + 1)}
                      onRemove={() => removeFromZone(formatId, zone, card.id)}
                      moveTargets={moveTargetsFor(zone, card.id)}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', card.id)}
                    />
                  ))}
                </ul>
              ) : (
                <div className={viewMode === 'full' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' : 'flex flex-col rounded-lg'}>
                  {group.cards.map(({ card, quantity }) => {
                    const Visual = viewMode === 'full' ? DeckCardFull : DeckCardVisual
                    return (
                    <Visual
                      key={card.id}
                      card={card}
                      format={format}
                      quantity={quantity}
                      warnings={deckCardWarnings(card, quantity, format, deck)}
                      isCommander={zone === 'main' && format.hasCommander && deck.commanderId === card.id}
                      onToggleCommander={
                        zone === 'main' && format.hasCommander
                          ? () => setCommander(formatId, deck.commanderId === card.id ? undefined : card.id)
                          : undefined
                      }
                      onDecrement={() => setZoneQuantity(formatId, zone, card.id, quantity - 1)}
                      onIncrement={() => setZoneQuantity(formatId, zone, card.id, quantity + 1)}
                      onRemove={() => removeFromZone(formatId, zone, card.id)}
                      moveTargets={moveTargetsFor(zone, card.id)}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', card.id)}
                    />
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          </div>
        )}
      </div>
    )
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

      <div className="mb-4 flex items-center justify-end">
        <div className="flex items-center gap-0.5 rounded-md border border-neutral-700 p-0.5">
          <ViewModeButton mode="text" current={viewMode} onClick={setViewMode}>
            List
          </ViewModeButton>
          <ViewModeButton mode="visual" current={viewMode} onClick={setViewMode}>
            Compact
          </ViewModeButton>
          <ViewModeButton mode="full" current={viewMode} onClick={setViewMode}>
            Full
          </ViewModeButton>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-medium text-neutral-300">Main deck ({cardCount})</h2>
      {renderZoneSection('main', deck.cards, 'No cards yet. Go to Search to add some, or import a decklist above.')}

      <h2 className="mb-2 mt-6 text-sm font-medium text-neutral-300">Sideboard ({sideboardCount})</h2>
      {renderZoneSection('sideboard', sideboard, 'No sideboard cards.')}

      <h2 className="mb-2 mt-6 text-sm font-medium text-neutral-300">Maybeboard ({maybeboardCount})</h2>
      {renderZoneSection(
        'maybeboard',
        maybeboard,
        'No maybeboard cards. Drag cards here to park ideas outside the deck.',
      )}
    </div>
  )
}

function ViewModeButton({
  mode,
  current,
  onClick,
  children,
}: {
  mode: DeckViewMode
  current: DeckViewMode
  onClick: (mode: DeckViewMode) => void
  children: React.ReactNode
}) {
  const active = mode === current
  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      className={`rounded px-3 py-1 text-sm font-medium ${
        active ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  )
}

interface CardControlsProps {
  card: MtgCard
  quantity: number
  warnings: string[]
  isCommander?: boolean
  onToggleCommander?: () => void
  onDecrement: () => void
  onIncrement: () => void
  onRemove: () => void
  moveTargets: MoveTarget[]
  onDragStart: (e: React.DragEvent<HTMLElement>) => void
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
  moveTargets,
  onDragStart,
}: CardControlsProps) {
  const { previewHandlers, previewImage } = useCardPreview(card)

  return (
    <li
      draggable
      onDragStart={onDragStart}
      {...previewHandlers}
      className="group flex cursor-grab items-center gap-2 px-1 py-0.5 text-sm hover:bg-neutral-800/60 active:cursor-grabbing"
    >
      <span className="w-5 shrink-0 text-right text-neutral-400">{quantity}</span>
      <span className="min-w-0 flex-1 truncate text-white">
        {isCommander && <span className="mr-1 text-amber-400">★</span>}
        {card.name}
      </span>
      {warnings.length > 0 && (
        <span title={warnings.join(' · ')} className="shrink-0 text-amber-400">
          ⚠
        </span>
      )}
      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
        {onToggleCommander && (
          <button
            type="button"
            onClick={onToggleCommander}
            title={isCommander ? 'Unset commander' : 'Set as commander'}
            className={isCommander ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-300'}
          >
            ★
          </button>
        )}
        <button type="button" onClick={onDecrement} className="h-5 w-5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700">
          −
        </button>
        <button type="button" onClick={onIncrement} className="h-5 w-5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700">
          +
        </button>
        {moveTargets.map((target) => (
          <button
            key={target.label}
            type="button"
            onClick={target.onClick}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            {target.label.replace('→ ', '→')}
          </button>
        ))}
        <button type="button" onClick={onRemove} className="text-xs text-neutral-500 hover:text-red-400">
          ✕
        </button>
      </div>
      {previewImage}
    </li>
  )
}

const PREVIEW_WIDTH = 260
const PREVIEW_HEIGHT = 363

/** Hover handlers plus a floating full-card image, placed beside the hovered element. */
function useCardPreview(card: MtgCard) {
  const image = cardImageUrl(card)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const previewHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const fitsRight = rect.right + 8 + PREVIEW_WIDTH <= window.innerWidth
      const left = fitsRight ? rect.right + 8 : Math.max(8, rect.left - 8 - PREVIEW_WIDTH)
      const top = Math.min(Math.max(8, rect.top - 40), window.innerHeight - PREVIEW_HEIGHT - 8)
      setPos({ left, top })
    },
    onMouseLeave: () => setPos(null),
  }

  const previewImage =
    pos && image ? (
      <img
        src={image}
        alt=""
        style={{ position: 'fixed', left: pos.left, top: pos.top, width: PREVIEW_WIDTH }}
        className="pointer-events-none z-50 rounded-xl shadow-2xl shadow-black"
      />
    ) : null

  return { previewHandlers, previewImage, hidePreview: () => setPos(null) }
}

function DeckCardVisual({
  card,
  format,
  quantity,
  warnings,
  isCommander,
  onToggleCommander,
  onDecrement,
  onIncrement,
  onRemove,
  moveTargets,
  onDragStart,
}: CardControlsProps & { format: FormatDef }) {
  const image = cardImageUrl(card)
  const badge = legalityLabel(cardLegality(card, format))
  const { previewHandlers, previewImage, hidePreview } = useCardPreview(card)

  return (
    <div
      draggable
      onDragStart={(e) => {
        hidePreview()
        onDragStart(e)
      }}
      {...previewHandlers}
      className="group relative -mb-px h-[30px] shrink-0 cursor-grab overflow-hidden rounded-t-lg border border-neutral-700 bg-neutral-900 active:cursor-grabbing"
    >
      {image ? (
        <img src={image} alt={card.name} className="w-full" loading="lazy" draggable={false} />
      ) : (
        <div className="px-2 py-1 text-sm text-neutral-200">{card.name}</div>
      )}
      {warnings.length > 0 && (
        <span title={warnings.join(' · ')} className="absolute left-1 top-1 text-amber-400">
          ⚠
        </span>
      )}
      {badge && (
        <span className="absolute right-8 top-1 rounded-full bg-red-900/90 px-1.5 text-[10px] font-medium text-red-200">
          {badge}
        </span>
      )}
      <span className="absolute right-1 top-1 rounded-full bg-neutral-950/90 px-1.5 text-xs font-semibold text-white group-hover:opacity-0">
        ×{quantity}
      </span>
      <div className="absolute inset-y-0 right-0 hidden items-center gap-1 bg-neutral-950/90 pl-2 pr-1 group-hover:flex">
        {onToggleCommander && (
          <button
            type="button"
            onClick={onToggleCommander}
            title={isCommander ? 'Unset commander' : 'Set as commander'}
            className={isCommander ? 'text-amber-400' : 'text-neutral-400 hover:text-neutral-200'}
          >
            ★
          </button>
        )}
        <button type="button" onClick={onDecrement} className="px-1 text-white hover:bg-neutral-800">
          −
        </button>
        <span className="text-xs text-white">{quantity}</span>
        <button type="button" onClick={onIncrement} className="px-1 text-white hover:bg-neutral-800">
          +
        </button>
        {moveTargets.map((target) => (
          <button
            key={target.label}
            type="button"
            onClick={target.onClick}
            title={target.label}
            className="text-[10px] text-neutral-300 hover:text-white"
          >
            {target.label.replace('→ ', '→')}
          </button>
        ))}
        <button type="button" onClick={onRemove} className="text-xs text-neutral-300 hover:text-red-400">
          ✕
        </button>
      </div>
      {previewImage}
    </div>
  )
}

function DeckCardFull({
  card,
  format,
  quantity,
  warnings,
  isCommander,
  onToggleCommander,
  onDecrement,
  onIncrement,
  onRemove,
  moveTargets,
  onDragStart,
}: CardControlsProps & { format: FormatDef }) {
  const image = cardImageUrl(card)
  const badge = legalityLabel(cardLegality(card, format))

  return (
    <div className="flex flex-col gap-1">
      <div
        draggable
        onDragStart={onDragStart}
        className="group relative cursor-grab overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 active:cursor-grabbing"
      >
        {image ? (
          <img src={image} alt={card.name} className="w-full" loading="lazy" />
        ) : (
          <div className="flex aspect-5/7 items-center justify-center p-2 text-center text-sm text-neutral-400">
            {card.name}
          </div>
        )}
        <span className="absolute left-1 top-1 rounded-full bg-neutral-950/90 px-1.5 py-0.5 text-xs font-semibold text-white">
          ×{quantity}
        </span>
        {badge && (
          <span className="absolute right-1 top-1 rounded-full bg-red-900/90 px-1.5 py-0.5 text-[10px] font-medium text-red-200">
            {badge}
          </span>
        )}
        {onToggleCommander && (
          <button
            type="button"
            onClick={onToggleCommander}
            title={isCommander ? 'Unset commander' : 'Set as commander'}
            className={`absolute bottom-1 left-1 text-lg ${
              isCommander ? 'text-amber-400' : 'text-neutral-400 opacity-0 group-hover:opacity-100'
            }`}
          >
            ★
          </button>
        )}
        <div className="absolute inset-x-1 bottom-1 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center justify-between rounded-full bg-neutral-950/90 px-1 py-0.5">
            <button
              type="button"
              onClick={onDecrement}
              className="flex h-5 w-5 items-center justify-center rounded-full text-white hover:bg-neutral-800"
            >
              −
            </button>
            <span className="text-xs text-white">{quantity}</span>
            <button
              type="button"
              onClick={onIncrement}
              className="flex h-5 w-5 items-center justify-center rounded-full text-white hover:bg-neutral-800"
            >
              +
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-neutral-300 hover:text-red-400"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-1">
            {moveTargets.map((target) => (
              <button
                key={target.label}
                type="button"
                onClick={target.onClick}
                className="flex-1 rounded-full bg-neutral-950/90 px-1 py-0.5 text-[10px] text-neutral-200 hover:bg-neutral-800"
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {warnings.length > 0 && <p className="text-[11px] text-amber-400">{warnings.join(' · ')}</p>}
    </div>
  )
}
