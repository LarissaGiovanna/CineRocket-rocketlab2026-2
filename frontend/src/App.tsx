import { useEffect, useState } from 'react'
import { Link, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { api } from './lib/api'

function HealthBadge() {
  const [status, setStatus] = useState<string>('checando...')

  useEffect(() => {
    api
      .get('/health')
      .then((r) => setStatus(r.data.status ?? 'ok'))
      .catch(() => setStatus('backend offline'))
  }, [])

  return (
    <span className="font-mono text-xs uppercase tracking-wider rounded-full border border-border px-3 py-1 text-muted-foreground">
      API: {status}
    </span>
  )
}

function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 py-10">
      <h1 className="font-display text-3xl md:text-5xl">{title}</h1>
      <p className="text-foreground-muted mt-2">
        Rota base criada — desenvolva esta tela seguindo o design.md.
      </p>
      <Link to="/" className="text-primary hover:underline">
        ← Voltar
      </Link>
    </main>
  )
}

function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 py-10">
      <p className="font-mono text-xs uppercase tracking-wider text-primary">
        CineRocket · base instalada
      </p>
      <h1 className="font-display text-3xl md:text-5xl mt-2">
        Dê a nota. Lance o filme.
      </h1>
      <p className="text-foreground-muted mt-3 max-w-2xl">
        Frontend React + TS + Tailwind v4 conectado ao FastAPI. Rotas de
        referência criadas conforme design.md.
      </p>
      <div className="mt-4 flex gap-2">
        <HealthBadge />
        <span className="font-mono text-xs uppercase tracking-wider rounded-full bg-secondary border border-border px-3 py-1">
          Tailwind OK
        </span>
      </div>
      <nav className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link className="rounded-xl bg-primary px-4 py-2 text-white hover:bg-primary-hover" to="/auth">Auth</Link>
        <Link className="rounded-xl border border-border px-4 py-2 hover:border-border-hover" to="/home">Home</Link>
        <Link className="rounded-xl border border-border px-4 py-2 hover:border-border-hover" to="/search?q=">Busca</Link>
        <Link className="rounded-xl border border-border px-4 py-2 hover:border-border-hover" to="/add">Adicionar</Link>
      </nav>
    </main>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Placeholder title="Login / Cadastro" />} />
        <Route path="/home" element={<Placeholder title="Home" />} />
        <Route path="/movie/:id" element={<Placeholder title="Detalhes do Filme" />} />
        <Route path="/add" element={<Placeholder title="Adicionar Filme" />} />
        <Route path="/edit/:id" element={<Placeholder title="Editar Filme" />} />
        <Route path="/search" element={<Placeholder title="Resultados de Busca" />} />
      </Routes>
    </Router>
  )
}
