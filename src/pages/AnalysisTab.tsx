import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CommanderBracketCard } from '../components/CommanderBracketCard'
import {
  COLOR_HEX,
  averageManaValue,
  colorDistribution,
  keywordTally,
  landSpellRatio,
  manaCurve,
  powerToughnessCurve,
  typeBreakdown,
} from '../lib/deckStats'
import { getFormat } from '../lib/formats'
import { atLeastProbability, drawsByTurn } from '../lib/hypergeometric'
import { useDeckStore } from '../store/deckStore'

const TYPE_COLORS = ['#a855f7', '#4a90d9', '#d94a4a', '#4ad96f', '#f0e6c8', '#f59e0b', '#ec4899', '#9ca3af']

const chartTooltipProps = {
  contentStyle: { background: '#1f2028', border: '1px solid #2e303a' },
  labelStyle: { color: '#f3f4f6' },
}

type Target = 'any-land' | string

export function AnalysisTab() {
  const { formatId = '' } = useParams<{ formatId: string }>()
  const deck = useDeckStore((s) => s.decks[formatId]) ?? { cards: [] }
  const format = getFormat(formatId)

  const deckSize = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0)
  const curve = useMemo(() => manaCurve(deck.cards), [deck.cards])
  const colors = useMemo(() => colorDistribution(deck.cards), [deck.cards])
  const types = useMemo(() => typeBreakdown(deck.cards), [deck.cards])
  const ratio = useMemo(() => landSpellRatio(deck.cards), [deck.cards])
  const avgMv = useMemo(() => averageManaValue(deck.cards), [deck.cards])
  const keywords = useMemo(() => keywordTally(deck.cards).slice(0, 10), [deck.cards])
  const ptCurve = useMemo(() => powerToughnessCurve(deck.cards), [deck.cards])

  const [target, setTarget] = useState<Target>('any-land')
  const [minSuccesses, setMinSuccesses] = useState(1)
  const [turn, setTurn] = useState(1)
  const [onThePlay, setOnThePlay] = useState(false)

  const successCount =
    target === 'any-land'
      ? ratio.lands
      : (deck.cards.find((dc) => dc.card.id === target)?.quantity ?? 0)

  const sampleSize = drawsByTurn(turn, onThePlay)
  const probability = atLeastProbability(deckSize, successCount, sampleSize, minSuccesses)

  const openingHandLandOdds = [1, 2, 3, 4].map((n) => ({
    n,
    probability: atLeastProbability(deckSize, ratio.lands, 7, n),
  }))

  if (deck.cards.length === 0) {
    return <p className="text-neutral-500">No cards yet. Add some from Search or import a decklist.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ChartCard title="Mana curve">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={curve}>
              <XAxis dataKey="cmc" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
              <Tooltip {...chartTooltipProps} />
              <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Color distribution">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={colors} layout="vertical">
              <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={70} />
              <Tooltip {...chartTooltipProps} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {colors.map((entry) => (
                  <Cell key={entry.name} fill={COLOR_HEX[entry.name] ?? '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Type breakdown">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={types} layout="vertical">
              <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
              <YAxis dataKey="type" type="category" stroke="#9ca3af" fontSize={12} width={80} />
              <Tooltip {...chartTooltipProps} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {types.map((entry, i) => (
                  <Cell key={entry.type} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Land / spell ratio">
          <div className="flex h-[200px] flex-col items-center justify-center gap-3">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full bg-green-600"
                style={{ width: `${(ratio.lands / (deckSize || 1)) * 100}%` }}
              />
              <div
                className="h-full bg-violet-600"
                style={{ width: `${(ratio.nonLands / (deckSize || 1)) * 100}%` }}
              />
            </div>
            <div className="flex gap-6 text-sm text-neutral-300">
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600" />
                Lands: {ratio.lands}
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-600" />
                Spells: {ratio.nonLands}
              </span>
            </div>
          </div>
        </ChartCard>
      </div>

      {format.hasCommander ? (
        <CommanderBracketCard formatId={formatId} cards={deck.cards} bracketFlags={deck.bracketFlags} />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ChartCard title="Average mana value">
            <div className="flex h-[200px] flex-col items-center justify-center">
              <span className="text-4xl font-semibold text-white">{avgMv.toFixed(2)}</span>
              <span className="mt-1 text-xs text-neutral-500">nonland cards only</span>
            </div>
          </ChartCard>

          <ChartCard title="Keyword abilities">
            {keywords.length === 0 ? (
              <p className="flex h-[200px] items-center justify-center text-sm text-neutral-500">
                No keyword abilities found.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={keywords} layout="vertical">
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <YAxis dataKey="keyword" type="category" stroke="#9ca3af" fontSize={12} width={90} />
                  <Tooltip {...chartTooltipProps} />
                  <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Creature power / toughness curve">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ptCurve}>
                <XAxis dataKey="cmc" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                <Tooltip {...chartTooltipProps} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="avgPower" name="Avg. power" stroke="#d94a4a" connectNulls />
                <Line type="monotone" dataKey="avgToughness" name="Avg. toughness" stroke="#4a90d9" connectNulls />
              </LineChart>
            </ResponsiveContainer>
            {ptCurve.some((p) => p.variableCount > 0) && (
              <p className="mt-2 text-xs text-neutral-500">
                Creatures with variable power/toughness (e.g. */*) are excluded from the averages.
              </p>
            )}
          </ChartCard>
        </div>
      )}

      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">Draw probability</h2>

        <div className="mb-4">
          <p className="mb-1 text-xs text-neutral-500">Lands in opening hand (7 cards)</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {openingHandLandOdds.map(({ n, probability: p }) => (
              <span key={n} className="text-neutral-300">
                {n}+: <span className="font-medium text-white">{(p * 100).toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-neutral-800 pt-4 sm:grid-cols-2">
          <label className="text-sm text-neutral-300">
            Target
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
            >
              <option value="any-land">Any land</option>
              {deck.cards.map((dc) => (
                <option key={dc.card.id} value={dc.card.id}>
                  {dc.card.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-neutral-300">
            At least
            <input
              type="number"
              min={1}
              value={minSuccesses}
              onChange={(e) => setMinSuccesses(Math.max(1, Number(e.target.value)))}
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
            />
          </label>

          <label className="text-sm text-neutral-300">
            By turn
            <input
              type="number"
              min={0}
              value={turn}
              onChange={(e) => setTurn(Math.max(0, Number(e.target.value)))}
              className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-white"
            />
          </label>

          <div className="text-sm text-neutral-300">
            <span className="mb-1 block">Draw order</span>
            <div className="flex gap-3">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={!onThePlay}
                  onChange={() => setOnThePlay(false)}
                />
                On the draw
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={onThePlay}
                  onChange={() => setOnThePlay(true)}
                />
                On the play
              </label>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-neutral-400">
          Sampling {sampleSize} cards from a {deckSize}-card deck ({successCount} copies of the target).
        </p>
        <p className="mt-1 text-2xl font-semibold text-white">{(probability * 100).toFixed(1)}%</p>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-2 text-sm font-medium text-neutral-300">{title}</h2>
      {children}
    </div>
  )
}
