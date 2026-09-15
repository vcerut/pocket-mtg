import type { FormatDef } from '../lib/formats'
import {
  COLOR_CHIPS,
  COLOR_SWATCH,
  SORT_OPTIONS,
  TYPE_CHIPS,
  emptyFilters,
  hasActiveFilters,
  type SearchFilters,
  type SortState,
} from '../lib/searchQuery'

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-800 px-4 py-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </div>
  )
}

interface FilterSidebarProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  sort: SortState
  onSortChange: (sort: SortState) => void
  activeFormatId: string
  activeFormat: FormatDef
  formats: FormatDef[]
  onActiveFormatChange: (formatId: string) => void
}

export function FilterSidebar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  activeFormatId,
  activeFormat,
  formats,
  onActiveFormatChange,
}: FilterSidebarProps) {
  return (
    <aside className="w-64 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Filters</h2>
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => onFiltersChange(emptyFilters())}
            className="text-xs font-medium text-neutral-500 hover:text-white"
          >
            Reset
          </button>
        )}
      </div>

      <SidebarSection title="Deck target">
        <select
          value={activeFormatId}
          onChange={(e) => onActiveFormatChange(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
        >
          {formats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </SidebarSection>

      <SidebarSection title="Sort by">
        <div className="flex gap-2">
          <select
            value={sort.by}
            onChange={(e) => onSortChange({ ...sort, by: e.target.value })}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onSortChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
            className="rounded-md border border-neutral-700 px-2 text-sm text-neutral-300 hover:bg-neutral-800"
            title={sort.dir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sort.dir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </SidebarSection>

      <SidebarSection title="Color">
        <div className="flex flex-wrap gap-2">
          {COLOR_CHIPS.map(({ code, label }) => {
            const active = filters.colors.includes(code)
            return (
              <button
                key={code}
                type="button"
                title={label}
                onClick={() => onFiltersChange({ ...filters, colors: toggle(filters.colors, code) })}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  active ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90'
                }`}
                style={{ background: COLOR_SWATCH[code] }}
              >
                {code.toUpperCase()}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex overflow-hidden rounded-md border border-neutral-700 text-xs">
          {(['include', 'exact'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={filters.colors.length === 0}
              onClick={() => onFiltersChange({ ...filters, colorMode: mode })}
              className={`flex-1 py-1 font-medium capitalize disabled:opacity-40 ${
                filters.colorMode === mode ? 'bg-violet-600 text-white' : 'bg-neutral-950 text-neutral-400'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="Type">
        <div className="flex flex-col gap-1.5">
          {TYPE_CHIPS.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={filters.types.includes(type)}
                onChange={() => onFiltersChange({ ...filters, types: toggle(filters.types, type) })}
              />
              {type}
            </label>
          ))}
        </div>
      </SidebarSection>

      <SidebarSection title="Mana value">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.cmcMin}
            onChange={(e) => onFiltersChange({ ...filters, cmcMin: e.target.value })}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white"
          />
          <span className="text-neutral-600">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.cmcMax}
            onChange={(e) => onFiltersChange({ ...filters, cmcMax: e.target.value })}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-white"
          />
        </div>
      </SidebarSection>

      <SidebarSection title="Legality">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={filters.legalOnly}
            onChange={(e) => onFiltersChange({ ...filters, legalOnly: e.target.checked })}
          />
          Legal in {activeFormat.label} only
        </label>
      </SidebarSection>
    </aside>
  )
}
