import { NavLink } from 'react-router-dom'
import { FORMATS } from '../lib/formats'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium ${
    isActive
      ? 'bg-violet-600 text-white'
      : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
  }`

export function Nav() {
  return (
    <nav className="flex items-center gap-2 overflow-x-auto border-b border-neutral-800 bg-neutral-950 px-4 py-3">
      <span className="mr-2 whitespace-nowrap text-lg font-semibold text-white">
        Pocket MTG
      </span>
      <NavLink to="/" end className={linkClass}>
        Search
      </NavLink>
      <span className="mx-1 h-5 w-px bg-neutral-800" />
      {FORMATS.map((format) => (
        <NavLink key={format.id} to={`/formats/${format.id}`} className={linkClass}>
          {format.label}
        </NavLink>
      ))}
    </nav>
  )
}
