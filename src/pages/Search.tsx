import { useCallback, useEffect, useRef, useState } from 'react'
import { searchCards } from '../api/scryfall'
import { CardTile } from '../components/CardTile'
import { FilterSidebar } from '../components/FilterSidebar'
import { FORMATS, getFormat } from '../lib/formats'
import {
  buildSearchQuery,
  defaultSort,
  emptyFilters,
  hasAnyCriteria,
  type SearchFilters,
  type SortState,
} from '../lib/searchQuery'
import { useDeckStore } from '../store/deckStore'
import type { MtgCard } from '../types/mtg'

export function Search() {
  const [text, setText] = useState('')
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters())
  const [sort, setSort] = useState<SortState>(defaultSort())
  const [results, setResults] = useState<MtgCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const activeFormatId = useDeckStore((s) => s.activeFormatId)
  const setActiveFormat = useDeckStore((s) => s.setActiveFormat)
  const addCard = useDeckStore((s) => s.addCard)
  const activeFormat = getFormat(activeFormatId)

  const runSearch = useCallback(
    async (currentText: string, currentFilters: SearchFilters, currentSort: SortState) => {
      if (!hasAnyCriteria(currentText, currentFilters)) {
        setResults([])
        setHasSearched(false)
        return
      }
      setLoading(true)
      setError(null)
      setHasSearched(true)
      try {
        const query = buildSearchQuery(currentText, currentFilters, getFormat(activeFormatId))
        const cards = await searchCards(query, currentSort.by, currentSort.dir)
        setResults(cards)
      } catch {
        setError('Search failed. Try a different query.')
      } finally {
        setLoading(false)
      }
    },
    [activeFormatId],
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearTimeout(debounceRef.current)
    runSearch(text, filters, sort)
  }

  // Debounce so typing doesn't fire a request per keystroke, but results
  // still update live shortly after the user pauses (or changes a filter/sort).
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      runSearch(text, filters, sort)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [text, filters, sort, runSearch])

  return (
    <div className="mx-auto flex max-w-7xl gap-6 p-4">
      <FilterSidebar
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        activeFormatId={activeFormatId}
        activeFormat={activeFormat}
        formats={FORMATS}
        onActiveFormatChange={setActiveFormat}
      />

      <div className="min-w-0 flex-1">
        <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search cards…"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
          >
            Search
          </button>
        </form>

        {loading && <p className="text-neutral-400">Searching…</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && !error && hasSearched && results.length === 0 && (
          <p className="text-neutral-400">No cards found.</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              format={activeFormat}
              onAdd={(c) => addCard(activeFormatId, c)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
