import { useEffect } from 'react'
import { NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import { getFormat } from '../lib/formats'
import { useDeckStore } from '../store/deckStore'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium ${
    isActive
      ? 'bg-violet-600 text-white'
      : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
  }`

export function FormatLayout() {
  const { formatId } = useParams<{ formatId: string }>()
  const setActiveFormat = useDeckStore((s) => s.setActiveFormat)

  useEffect(() => {
    if (formatId) setActiveFormat(formatId)
  }, [formatId, setActiveFormat])

  if (!formatId) return <Navigate to="/" replace />
  const format = getFormat(formatId)

  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-semibold text-white">{format.label}</h1>
      <div className="mb-6 flex gap-2 border-b border-neutral-800 pb-3">
        <NavLink to={`/formats/${formatId}/deck`} className={tabClass}>
          Deck
        </NavLink>
        <NavLink to={`/formats/${formatId}/analysis`} className={tabClass}>
          Analysis
        </NavLink>
      </div>
      <Outlet />
    </div>
  )
}
