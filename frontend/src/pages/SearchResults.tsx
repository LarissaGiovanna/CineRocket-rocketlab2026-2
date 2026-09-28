import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MovieCardView from "../components/MovieCard";
import { listMovies } from "../lib/movies";
import type { MovieCard } from "../lib/movieCard";

/** Resultados de Busca (`/search?q=...`) — busca por título via listMovies. */
export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [items, setItems] = useState<MovieCard[]>([]);
  const [total, setTotal] = useState(0);
  const [suggestions, setSuggestions] = useState<MovieCard[]>([]);
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listMovies(1, 20, q.trim())
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q]);

  useEffect(() => {
    if (items.length > 0 || q.trim()) return;
    listMovies(1, 5, "").then((res) => setSuggestions(res.items)).catch(() => setSuggestions([]));
  }, [items.length, q]);

  // Sugestões do estado vazio ("talvez você queira ver")
  useEffect(() => {
    if (items.length === 0 && q.trim()) {
      listMovies(1, 5, "").then((res) => setSuggestions(res.items)).catch(() => {});
    }
  }, [items.length, q]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <Link to="/" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
        ← Resultados da busca
      </Link>
      <h1 className="mt-2 font-display text-2xl md:text-3xl">
        {q ? <>“{q}”</> : "Buscar filmes"}
      </h1>
      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {loading ? "buscando…" : `${total} resultado(s)`}
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
              {q ? <>Nada para “{q}”</> : "Digite algo para buscar"}
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
