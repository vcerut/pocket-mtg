import { cardImageUrl } from '../api/scryfall'
import { cardLegality, legalityLabel } from '../lib/legality'
import type { FormatDef } from '../lib/formats'
import type { MtgCard } from '../types/mtg'

interface CardTileProps {
  card: MtgCard
  format?: FormatDef
  onAdd?: (card: MtgCard) => void
}

export function CardTile({ card, format, onAdd }: CardTileProps) {
  const image = cardImageUrl(card)
  const badge = format ? legalityLabel(cardLegality(card, format)) : null

  return (
    <div className="group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
      {image ? (
        <img src={image} alt={card.name} className="w-full" loading="lazy" />
      ) : (
        <div className="flex aspect-[5/7] items-center justify-center p-2 text-center text-sm text-neutral-400">
          {card.name}
        </div>
      )}
      {badge && (
        <span className="absolute left-2 top-2 rounded-full bg-red-900/90 px-2 py-0.5 text-xs font-medium text-red-200">
          {badge}
        </span>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(card)}
          className="absolute bottom-2 right-2 rounded-full bg-violet-600 px-3 py-1 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-violet-500"
        >
          + Add
        </button>
      )}
    </div>
  )
}
