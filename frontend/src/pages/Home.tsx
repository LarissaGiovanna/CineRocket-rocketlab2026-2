import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MovieCardView from "../components/MovieCard";
import { listMovies } from "../lib/movies";
import type { MovieListResponse } from "../lib/movieListResponse";

const PAGE_SIZE = 21;

/**
 * Home real (`/`): grid de filmes via listMovies.
 * Sem filtro de gênero nem ordenação (backend só ordena por título).
 */
export default function Home() {
  const [data, setData] = useState<MovieListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listMovies(page, PAGE_SIZE, "")
      .then((res) => alive && setData(res))
      .catch(() => alive && setError("Não foi possível carregar os filmes. Verifique o backend."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Hero simplificado (sem usuário logado) */}
      <section className="mb-8">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          CineRocket · catálogo
        </p>
        <h1 className="mt-2 font-display text-3xl md:text-5xl">Dê a nota. Lance o filme.</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {data ? `${data.total} filme(s)` : "carregando…"}
        </p>
      </section>

      {loading && <p className="text-sm text-muted-foreground">Carregando filmes…</p>}
      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-4xl" aria-hidden>🎞️</p>
          <p className="mt-3 font-display text-xl">Nenhum filme encontrado</p>
          <p className="mt-1 text-sm text-foreground-muted">
            O catálogo está vazio.
          </p>
          <Link to="/add" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
            Adicionar filme
          </Link>
        </div>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 md:gap-4 lg:grid-cols-6 xl:grid-cols-7">
            {data.items.map((m) => (
              <MovieCardView key={m.id} movie={m} />
            ))}
          </div>
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:border-border-hover disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:border-border-hover disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        </>
      )}
    </main>
  );
}
