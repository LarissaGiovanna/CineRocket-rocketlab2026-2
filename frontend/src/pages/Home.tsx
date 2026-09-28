import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GenreRail from "../components/GenreRail";
import { loadGenreCatalog, type GenreGroup, type GenreLoadProgress } from "../lib/genreBrowse";

/** Cartões visíveis por seção antes do "Ver mais". */
const RAIL_LIMIT = 10;

/** Placeholder com brilho enquanto o banco está sendo lido. */
function SkeletonRail({ label }: { label: string }) {
  return (
    <section className="mb-8" aria-label={label} aria-busy="true">
      <div className="mb-3 h-6 w-40 animate-pulse rounded-lg bg-secondary" />
      <div className="flex gap-3 overflow-hidden md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-28 shrink-0 sm:w-32 md:w-36">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-secondary" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Home real (`/`): filmes separados por gênero, cada seção com
 * carrossel + botão "Ver mais" → /search?genre=...
 * Leitura página por página com renderização progressiva
 * (o backend não filtra por gênero — agrupamento client-side).
 */
export default function Home() {
  const [total, setTotal] = useState<number | null>(null);
  const [groups, setGroups] = useState<GenreGroup[]>([]);
  const [progress, setProgress] = useState<GenreLoadProgress | null>(null);
  const [done, setDone] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    loadGenreCatalog({
      railLimit: RAIL_LIMIT,
      isCancelled: () => cancelled.current,
      onUpdate: (g, p) => {
        if (cancelled.current) return;
        setGroups(g);
        setProgress(p);
        setTotal(p.total);
      },
    })
      .then((res) => {
        if (cancelled.current) return;
        setTotal(res.total);
        setGroups(res.groups);
        setTruncated(res.truncated);
        setDone(true);
      })
      .catch(() => {
        if (cancelled.current) return;
        setError("Não foi possível carregar os filmes. Verifique o backend.");
        setDone(true);
      });
    return () => {
      cancelled.current = true;
    };
  }, []);

  const pct = progress
    ? Math.min(100, Math.round((progress.page / Math.max(1, progress.maxPages)) * 100))
    : 0;

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

      {/* Progresso da leitura no banco */}
      {!done && !error && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4" role="status">
          <p className="text-sm text-foreground-muted">
            Buscando filmes no banco de dados…{" "}
            {progress && (
              <span className="font-mono text-xs">
                página {progress.page} de {progress.maxPages} · {progress.moviesSeen} visto(s)
              </span>
            )}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {done && !error && groups.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-4xl" aria-hidden>🎞️</p>
          <p className="mt-3 font-display text-xl">Nenhum filme encontrado</p>
          <p className="mt-1 text-sm text-foreground-muted">O catálogo está vazio.</p>
          <Link to="/add" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
            Adicionar filme
          </Link>
        </div>
      )}

      {/* Seções progressivas + esqueletos enquanto lê */}
      {(!done || groups.length > 0) && groups.length === 0 && !error && (
        <div>
          <SkeletonRail label="Carregando seção 1" />
          <SkeletonRail label="Carregando seção 2" />
          <SkeletonRail label="Carregando seção 3" />
        </div>
      )}

      {groups.length > 0 && (
        <div>
          {done && truncated && (
            <p className="mb-4 font-mono text-xs text-muted-foreground">
              Amostra inicial do catálogo — as seções mostram até {RAIL_LIMIT} títulos; use "Ver mais" para explorar.
            </p>
          )}
          {groups.map((g) => (
            <section key={g.genre} className="mb-8" aria-label={`Filmes de ${g.genre}`}>
              <div className="mb-3 flex items-center justify-between gap-2 sm:gap-3">
                <h2 className="min-w-0 truncate font-display text-lg sm:text-xl">
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
          {!done && (
            <div>
              <SkeletonRail label="Buscando mais gêneros" />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
