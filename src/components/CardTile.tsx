import { useState } from 'react'
import { cardImageUrl } from '../api/scryfall'
import { cardLegality, legalityLabel } from '../lib/legality'
import type { FormatDef } from '../lib/formats'
import type { MtgCard } from '../types/mtg'

interface CardTileProps {
  card: MtgCard
  format?: FormatDef
  onAdd?: (card: MtgCard, quantity: number) => void
}

export function CardTile({ card, format, onAdd }: CardTileProps) {
  const image = cardImageUrl(card)
  const badge = format ? legalityLabel(cardLegality(card, format)) : null
  const [quantity, setQuantity] = useState(1)

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
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-full bg-neutral-950/90 px-1 py-0.5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-white hover:bg-neutral-800"
            >
              −
            </button>
            <span className="w-4 text-center text-xs text-white">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-white hover:bg-neutral-800"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => onAdd(card, quantity)}
            className="rounded-full bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-500"
          >
            + Add
          </button>
        </div>
      )}
    </div>
  )
}
