import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import AuthPage from './pages/AuthPage'
import Home from './pages/Home'
import MovieDetailPage from './pages/MovieDetailPage'
import { AddMoviePage, EditMoviePage } from './pages/MovieFormPage'
import SearchResults from './pages/SearchResults'

/**
 * Rotas:
 * / → Home real (grid via listMovies)
 * /movie/:id, /add, /edit/:id, /search → design.md
 * /auth → formulário visual; submit só mostra "em breve" (sem API).
 *
 * Navbar fica direto aqui, acima do <Routes> — sem <Outlet/>,
 * sem layouts diferentes por rota. Sem estado de sessão.
 */
export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movie/:id" element={<MovieDetailPage />} />
        <Route path="/add" element={<AddMoviePage />} />
        <Route path="/edit/:id" element={<EditMoviePage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </Router>
  )
}
