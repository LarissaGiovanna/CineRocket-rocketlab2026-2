import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GenreRail from "../components/GenreRail";
import { fetchGenreGroups, type GenreGroup } from "../lib/genreBrowse";

/** Cartões visíveis por seção antes do "Ver mais". */
const RAIL_LIMIT = 10;

/**
 * Home real (`/`): filmes separados por gênero, cada seção com
 * lista em carrossel + botão "Ver mais" → /search?genre=...
 * (agrupamento client-side: o backend não filtra por gênero).
 */
export default function Home() {
  const [total, setTotal] = useState<number | null>(null);
  const [groups, setGroups] = useState<GenreGroup[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchGenreGroups()
      .then((res) => {
        if (!alive) return;
        setTotal(res.total);
        setGroups(res.groups);
        setTruncated(res.truncated);
      })
      .catch(() => alive && setError("Não foi possível carregar os filmes. Verifique o backend."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      {/* Hero simplificado (sem usuário logado) */}
      <section className="mb-8">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          CineRocket · catálogo
        </p>
        <h1 className="mt-2 font-display text-3xl md:text-5xl">Dê a nota. Lance o filme.</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {total !== null ? `${total} filme(s)` : "carregando…"}
        </p>
      </section>

      {loading && <p className="text-sm text-muted-foreground">Carregando catálogo…</p>}
      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && groups && groups.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-4xl" aria-hidden>🎞️</p>
          <p className="mt-3 font-display text-xl">Nenhum filme encontrado</p>
          <p className="mt-1 text-sm text-foreground-muted">O catálogo está vazio.</p>
          <Link to="/add" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
            Adicionar filme
          </Link>
        </div>
      )}

      {!loading && !error && groups && groups.length > 0 && (
        <div>
          {truncated && (
            <p className="mb-4 font-mono text-xs text-muted-foreground">
              Catálogo parcial — as seções mostram até {RAIL_LIMIT} títulos; use "Ver mais" para explorar.
            </p>
          )}
          {groups.map((g) => (
            <section key={g.genre} className="mb-8" aria-label={`Filmes de ${g.genre}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl">
                  {g.genre}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({g.movies.length})
                  </span>
                </h2>
                <Link
                  to={`/search?genre=${encodeURIComponent(g.genre)}`}
                  className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-sm hover:border-border-hover"
                >
                  Ver mais →
                </Link>
              </div>
              <GenreRail label={`Filmes de ${g.genre}`} movies={g.movies.slice(0, RAIL_LIMIT)} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
