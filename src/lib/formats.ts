export interface FormatDef {
  id: string
  label: string
  scryfallKey: string
  hasCommander: boolean
  singleton: boolean
}

export const FORMATS: FormatDef[] = [
  { id: 'standard', label: 'Standard', scryfallKey: 'standard', hasCommander: false, singleton: false },
  { id: 'pioneer', label: 'Pioneer', scryfallKey: 'pioneer', hasCommander: false, singleton: false },
  { id: 'modern', label: 'Modern', scryfallKey: 'modern', hasCommander: false, singleton: false },
  { id: 'legacy', label: 'Legacy', scryfallKey: 'legacy', hasCommander: false, singleton: false },
  { id: 'vintage', label: 'Vintage', scryfallKey: 'vintage', hasCommander: false, singleton: false },
  { id: 'commander', label: 'Commander', scryfallKey: 'commander', hasCommander: true, singleton: true },
  { id: 'pauper', label: 'Pauper', scryfallKey: 'pauper', hasCommander: false, singleton: false },
  { id: 'pauper_commander', label: 'Pauper Commander', scryfallKey: 'paupercommander', hasCommander: true, singleton: true },
]

export const DEFAULT_FORMAT_ID = FORMATS[0].id

export function getFormat(formatId: string): FormatDef {
  return FORMATS.find((f) => f.id === formatId) ?? FORMATS[0]
}
