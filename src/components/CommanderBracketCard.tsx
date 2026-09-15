import { useMemo } from 'react'
import { defaultBracketFlags, estimateBracket, findGameChangers } from '../lib/bracket'
import { useDeckStore } from '../store/deckStore'
import type { DeckCard } from '../types/mtg'

interface CommanderBracketCardProps {
  formatId: string
  cards: DeckCard[]
  bracketFlags: ReturnType<typeof defaultBracketFlags> | undefined
}

export function CommanderBracketCard({ formatId, cards, bracketFlags }: CommanderBracketCardProps) {
  const setBracketFlags = useDeckStore((s) => s.setBracketFlags)
  const flags = bracketFlags ?? defaultBracketFlags()

  const gameChangers = useMemo(() => findGameChangers(cards), [cards])
  const estimate = useMemo(() => estimateBracket(gameChangers.count, flags), [gameChangers.count, flags])

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-1 text-sm font-medium text-neutral-300">Commander bracket (estimate)</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Based on Wizards of the Coast's Commander Brackets system. Game Changers are auto-detected;
        the rest are judgment calls only you can make.
      </p>

      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-4xl font-semibold text-white">{estimate.bracket}</span>
        <span className="text-sm text-neutral-400">
          {estimate.bracket <= 2
            ? 'Exhibition / Core'
            : estimate.bracket === 3
              ? 'Upgraded'
              : estimate.bracket === 4
                ? 'Optimized'
                : 'cEDH'}
        </span>
      </div>

      {estimate.reasons.length > 0 ? (
        <ul className="mb-4 list-inside list-disc text-xs text-amber-400">
          {estimate.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-xs text-neutral-500">
          Nothing detected that requires Bracket 3+. Whether this is a 1 (Exhibition) or 2 (Core) deck
          comes down to overall power level, which isn't something this can compute for you.
        </p>
      )}

      <div className="mb-4 border-t border-neutral-800 pt-3">
        <p className="mb-2 text-xs font-medium text-neutral-400">
          Game Changers detected ({gameChangers.count})
        </p>
        {gameChangers.names.length > 0 ? (
          <p className="text-sm text-neutral-300">{gameChangers.names.join(', ')}</p>
        ) : (
          <p className="text-sm text-neutral-600">None</p>
        )}
      </div>

      <div className="space-y-2 border-t border-neutral-800 pt-3">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={flags.massLandDenial}
            onChange={(e) => setBracketFlags(formatId, { ...flags, massLandDenial: e.target.checked })}
          />
          Includes mass land denial (destroys/exiles/bounces/taps 4+ lands per player, unreplaced)
        </label>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={flags.extraTurnChaining}
            onChange={(e) => setBracketFlags(formatId, { ...flags, extraTurnChaining: e.target.checked })}
          />
          Chains or loops extra turns
        </label>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={flags.hasCombo}
            onChange={(e) => setBracketFlags(formatId, { ...flags, hasCombo: e.target.checked })}
          />
          Includes an intentional 2-card infinite/game-ending combo
        </label>

        {flags.hasCombo && (
          <div className="ml-6 flex gap-3 text-sm text-neutral-300">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={flags.comboSpeed === 'slow'}
                onChange={() => setBracketFlags(formatId, { ...flags, comboSpeed: 'slow' })}
              />
              Closes the game turn 6+
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={flags.comboSpeed === 'fast'}
                onChange={() => setBracketFlags(formatId, { ...flags, comboSpeed: 'fast' })}
              />
              Can close before turn 6
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
