import type { FormatDef } from './formats'

export const COLOR_CHIPS = [
  { code: 'w', label: 'White' },
  { code: 'u', label: 'Blue' },
  { code: 'b', label: 'Black' },
  { code: 'r', label: 'Red' },
  { code: 'g', label: 'Green' },
  { code: 'c', label: 'Colorless' },
]

export const COLOR_SWATCH: Record<string, string> = {
  w: '#f0e6c8',
  u: '#4a90d9',
  b: '#4a4a4a',
  r: '#d94a4a',
  g: '#4ad96f',
  c: '#9ca3af',
}

export const TYPE_CHIPS = [
  'Creature',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Planeswalker',
  'Land',
  'Battle',
]

export const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'cmc', label: 'Mana value' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'color', label: 'Color' },
  { value: 'released', label: 'Release date' },
]

export interface SortState {
  by: string
  dir: 'asc' | 'desc'
}

export function defaultSort(): SortState {
  return { by: 'name', dir: 'asc' }
}

export type ColorMode = 'include' | 'exact'

export interface SearchFilters {
  colors: string[]
  colorMode: ColorMode
  types: string[]
  cmcMin: string
  cmcMax: string
  legalOnly: boolean
}

export function emptyFilters(): SearchFilters {
  return { colors: [], colorMode: 'include', types: [], cmcMin: '', cmcMax: '', legalOnly: false }
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.colors.length > 0 ||
    filters.types.length > 0 ||
    filters.cmcMin.trim().length > 0 ||
    filters.cmcMax.trim().length > 0 ||
    filters.legalOnly
  )
}

export function hasAnyCriteria(text: string, filters: SearchFilters): boolean {
  return text.trim().length > 0 || hasActiveFilters(filters)
}

export function buildSearchQuery(text: string, filters: SearchFilters, activeFormat: FormatDef): string {
  const clauses: string[] = []

  if (text.trim()) clauses.push(text.trim())

  if (filters.colors.length > 0) {
    if (filters.colorMode === 'exact') {
      const coloredLetters = filters.colors.filter((c) => c !== 'c')
      clauses.push(coloredLetters.length > 0 ? `c=${coloredLetters.join('')}` : 'c=c')
    } else {
      clauses.push(`(${filters.colors.map((c) => `c:${c}`).join(' or ')})`)
    }
  }

  if (filters.types.length > 0) {
    clauses.push(`(${filters.types.map((t) => `t:${t.toLowerCase()}`).join(' or ')})`)
  }

  if (filters.cmcMin.trim()) clauses.push(`cmc>=${filters.cmcMin.trim()}`)
  if (filters.cmcMax.trim()) clauses.push(`cmc<=${filters.cmcMax.trim()}`)

  if (filters.legalOnly) clauses.push(`legal:${activeFormat.scryfallKey}`)

  return clauses.join(' ')
}
