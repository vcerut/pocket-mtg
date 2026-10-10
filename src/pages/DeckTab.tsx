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
import { COLOR_CHIPS, COLOR_SWATCH, TYPE_CHIPS } from '../lib/searchQuery'
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

const MANA_VALUES = [0, 1, 2, 3, 4, 5, 6, 7] // 7 means "7+"

interface DeckFilters {
  colors: string[]
  types: string[]
  manaValues: number[]
}

const EMPTY_DECK_FILTERS: DeckFilters = { colors: [], types: [], manaValues: [] }

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** Within each filter group any selected value matches (OR); groups combine with AND. */
function matchesDeckFilters(card: MtgCard, f: DeckFilters): boolean {
  if (f.colors.length > 0) {
    const colors = card.colors ?? card.color_identity ?? []
    const cardColors = colors.length === 0 ? ['c'] : colors.map((c) => c.toLowerCase())
    if (!f.colors.some((c) => cardColors.includes(c))) return false
  }
  if (f.types.length > 0 && !f.types.some((t) => new RegExp(`\\b${t}\\b`).test(card.type_line))) return false
  if (f.manaValues.length > 0 && !f.manaValues.includes(Math.min(Math.floor(card.cmc), 7))) return false
  return true
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
  const [filterText, setFilterText] = useState('')
  const [filters, setFilters] = useState<DeckFilters>(EMPTY_DECK_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersActive = filters.colors.length + filters.types.length + filters.manaValues.length > 0
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
    const needle = filterText.trim().toLowerCase()
    const visibleCards =
      needle || filtersActive
        ? cards.filter(
            ({ card }) =>
              matchesDeckFilters(card, filters) &&
              (!needle ||
                [card.name, card.type_line, card.oracle_text ?? ''].some((f) => f.toLowerCase().includes(needle))),
          )
        : cards
    const groups = groupCardsForDeckView(visibleCards)
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
          <p className="text-neutral-500">{(needle || filtersActive) && cards.length > 0 ? 'No cards match your search.' : emptyText}</p>
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

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex w-full max-w-md items-center gap-2">
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search in deck (name, type, text)…"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            title="Filters"
            aria-label="Filters"
            className={`relative flex h-8 w-9 shrink-0 items-center justify-center rounded-md border ${
              filtersActive
                ? 'border-violet-500 text-violet-300'
                : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {filtersActive && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-semibold text-white">
                {filters.colors.length + filters.types.length + filters.manaValues.length}
              </span>
            )}
          </button>
        </div>
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
      {filtersOpen && (
        <FiltersModal
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  )
}

function FiltersModal({
  filters,
  onChange,
  onClose,
}: {
  filters: DeckFilters
  onChange: (filters: DeckFilters) => void
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const active = filters.colors.length + filters.types.length + filters.manaValues.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-label="Filters" className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="divide-y divide-neutral-800">
          <ModalSection title="Color">
            <div className="flex flex-wrap gap-2">
              {COLOR_CHIPS.map(({ code, label }) => {
                const on = filters.colors.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    title={label}
                    onClick={() => onChange({ ...filters, colors: toggleIn(filters.colors, code) })}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold text-neutral-900 ${
                      on ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90'
                    }`}
                    style={{ background: COLOR_SWATCH[code] }}
                  >
                    {code.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </ModalSection>

          <ModalSection title="Card type">
            <div className="flex flex-wrap gap-1.5">
              {TYPE_CHIPS.map((type) => (
                <FilterChip
                  key={type}
                  active={filters.types.includes(type)}
                  onClick={() => onChange({ ...filters, types: toggleIn(filters.types, type) })}
                >
                  {type}
                </FilterChip>
              ))}
            </div>
          </ModalSection>

          <ModalSection title="Mana value">
            <div className="flex flex-wrap gap-1.5">
              {MANA_VALUES.map((mv) => (
                <FilterChip
                  key={mv}
                  active={filters.manaValues.includes(mv)}
                  onClick={() => onChange({ ...filters, manaValues: toggleIn(filters.manaValues, mv) })}
                >
                  {mv === 7 ? '7+' : mv}
                </FilterChip>
              ))}
            </div>
          </ModalSection>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-3">
          <button
            type="button"
            onClick={() => onChange(EMPTY_DECK_FILTERS)}
            disabled={!active}
            className="text-sm text-neutral-400 hover:text-white disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</h3>
      {children}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm ${
        active
          ? 'border-violet-500 bg-violet-600 text-white'
          : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
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
