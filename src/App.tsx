import { Navigate, Route, Routes } from 'react-router-dom'
import { Nav } from './components/Nav'
import { DEFAULT_FORMAT_ID } from './lib/formats'
import { AnalysisTab } from './pages/AnalysisTab'
import { DeckTab } from './pages/DeckTab'
import { FormatLayout } from './pages/FormatLayout'
import { Search } from './pages/Search'

function App() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <Nav />
      <Routes>
        <Route path="/" element={<Search />} />
        <Route path="/formats/:formatId" element={<FormatLayout />}>
          <Route index element={<Navigate to="deck" replace />} />
          <Route path="deck" element={<DeckTab />} />
          <Route path="analysis" element={<AnalysisTab />} />
        </Route>
        <Route path="*" element={<Navigate to={`/formats/${DEFAULT_FORMAT_ID}`} replace />} />
      </Routes>
    </div>
  )
}

export default App
