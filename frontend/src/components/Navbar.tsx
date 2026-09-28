import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/search?q=" + encodeURIComponent(value.trim()));
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:gap-4 md:px-6">
        {/* Esquerda: logo -> Home */}
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-lg" aria-hidden>
            🚀
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            CineRocket
          </span>
        </Link>

        {/* Centro: busca (oculta em mobile) */}
        <form onSubmit={submit} className="mx-auto hidden w-full max-w-md flex-1 md:flex" role="search">
          <div className="relative w-full">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>
              🔍
            </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Buscar filmes por título..."
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-border-hover"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {/* Mobile: lupa expansível */}
          <button
            type="button"
            className="rounded-xl border border-border p-2 md:hidden"
            aria-label="Abrir busca"
            onClick={() => setMobileOpen((v) => !v)}
          >
            🔍
          </button>
          {/* Direita: Adicionar Filme (oculto em mobile) */}
          <Link
            to="/add"
            className="hidden rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover md:inline-flex"
          >
            + Adicionar Filme
          </Link>
          {/* Avatar: ícone clicável direto para /auth, sem dropdown */}
          <Link
            to="/auth"
            aria-label="Entrar"
            title="Entrar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-base hover:border-border-hover"
          >
            👤
          </Link>
        </div>
      </div>

      {/* Busca expansível mobile */}
      {mobileOpen && (
        <div className="border-t border-border px-4 py-2 md:hidden">
          <form onSubmit={submit} role="search">
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Buscar filmes por título..."
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-border-hover"
            />
          </form>
        </div>
      )}
    </header>
  );
}
