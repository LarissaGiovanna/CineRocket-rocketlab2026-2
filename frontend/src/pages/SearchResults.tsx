import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MovieCardView from "../components/MovieCard";
import { fetchGenreGroups } from "../lib/genreBrowse";
import { listMovies } from "../lib/movies";
import type { MovieCard } from "../lib/movieCard";

/**
 * Resultados de Busca (`/search?q=...` ou `/search?genre=...`).
 * - `q`: busca por título (server-side, via GET /movies?query=).
 * - `genre`: filtro por gênero (client-side — o backend não filtra
 *   por gênero, então o pool é agrupado no navegador).
 * Podem ser combinados: o pool respeita `q` e o recorte aplica `genre`.
 */
export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const genre = params.get("genre") ?? "";
  const [items, setItems] = useState<MovieCard[]>([]);
  const [total, setTotal] = useState(0);
  const [suggestions, setSuggestions] = useState<MovieCard[]>([]);
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSuggestions([]);

    if (genre) {
      // Filtro por gênero: agrupa o pool no navegador e recorta a seção.
      fetchGenreGroups(q.trim())
        .then((res) => {
          if (!alive) return;
          const group = res.groups.find((g) => g.genre === genre);
          setItems(group ? group.movies : []);
          setTotal(group ? group.movies.length : 0);
          if (!group || group.movies.length === 0) {
            listMovies(1, 5, "")
              .then((r) => alive && setSuggestions(r.items))
              .catch(() => {});
          }
        })
        .catch(() => alive && setItems([]))
        .finally(() => alive && setLoading(false));
    } else {
      listMovies(1, 20, q.trim())
        .then((res) => {
          if (!alive) return;
          setItems(res.items);
          setTotal(res.total);
        })
        .catch(() => alive && setItems([]))
        .finally(() => alive && setLoading(false));
    }
    return () => {
      alive = false;
    };
  }, [q, genre]);

  const heading = genre ? (
    <>
      Gênero: <span className="text-primary">“{genre}”</span>
      {q && <span className="text-foreground-muted"> · com “{q}”</span>}
    </>
  ) : q ? (
    <>“{q}”</>
  ) : (
    "Buscar filmes"
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <Link to="/" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
        ← Resultados da busca
      </Link>
      <h1 className="mt-2 font-display text-2xl md:text-3xl">{heading}</h1>
      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {loading ? "buscando…" : `${total} resultado(s)`}
        {genre && !loading && (
          <span className="normal-case tracking-normal"> · filtro por gênero aplicado no navegador</span>
        )}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setLayout("grid")}
          aria-pressed={layout === "grid"}
          className={`rounded-xl border px-3 py-1.5 text-sm ${layout === "grid" ? "border-transparent bg-primary text-white" : "border-border hover:border-border-hover"}`}
        >
          Grade
        </button>
        <button
          type="button"
          onClick={() => setLayout("list")}
          aria-pressed={layout === "list"}
          className={`rounded-xl border px-3 py-1.5 text-sm ${layout === "list" ? "border-transparent bg-primary text-white" : "border-border hover:border-border-hover"}`}
        >
          Lista
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Buscando…</p>
        ) : items.length > 0 ? (
          layout === "grid" ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 md:gap-4">
              {items.map((m) => (
                <MovieCardView key={m.id} movie={m} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((m) => (
                <MovieCardView key={m.id} movie={m} layout="list" />
              ))}
            </div>
          )
        ) : (
          <div className="text-center">
            <p className="text-5xl" aria-hidden>🔍</p>
            <p className="mt-3 font-display text-2xl">
              {genre ? (
                <>Nada em “{genre}”{q && <> com “{q}”</>}</>
              ) : q ? (
                <>Nada para “{q}”</>
              ) : (
                "Digite algo para buscar"
              )}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/" className="rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
                Ver todos os filmes
              </Link>
              <Link to="/add" className="rounded-xl border border-border px-4 py-2 text-sm hover:border-border-hover">
                Adicionar este filme
              </Link>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-8 text-left">
                <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Talvez você queira ver
                </p>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {suggestions.map((m) => (
                    <MovieCardView key={m.id} movie={m} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
