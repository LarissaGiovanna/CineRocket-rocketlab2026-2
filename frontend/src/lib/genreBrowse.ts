import { getGenres, getMovieById, listMovies } from "./movies";
import type { MovieCard } from "./movieCard";

const POOL_PAGE_SIZE = 100;
/**
 * Teto do pool client-side. O backend não filtra por gênero
 * (GET /movies só aceita `query` por título), então o agrupamento
 * por gênero é feito no navegador a partir deste pool.
 */
const POOL_MAX_ITEMS = 300;

export interface GenreGroup {
  genre: string;
  movies: MovieCard[];
}

export interface GenreCatalog {
  total: number;
  groups: GenreGroup[];
  /** true quando o catálogo tem mais filmes que o pool (seções podem estar incompletas) */
  truncated: boolean;
}

/**
 * Monta o catálogo agrupado por gênero:
 * 1. busca o pool de filmes (paginado, até POOL_MAX_ITEMS),
 * 2. busca o detalhe de cada um (só o detalhe traz `generos`),
 * 3. agrupa por gênero na ordem do catálogo oficial (GET /genres).
 */
export async function fetchGenreGroups(query = ""): Promise<GenreCatalog> {
  const first = await listMovies(1, POOL_PAGE_SIZE, query);
  const total = first.total;
  const all: MovieCard[] = [...first.items];

  const maxPages = Math.min(
    Math.ceil(total / POOL_PAGE_SIZE),
    Math.ceil(POOL_MAX_ITEMS / POOL_PAGE_SIZE),
  );
  if (maxPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: maxPages - 1 }, (_, i) =>
        listMovies(i + 2, POOL_PAGE_SIZE, query).catch(() => null),
      ),
    );
    for (const r of rest) if (r) all.push(...r.items);
  }
  const truncated = total > all.length;

  const catalog = await getGenres().catch(() => [] as string[]);

  const details = await Promise.all(all.map((m) => getMovieById(m.id).catch(() => null)));
  const byGenre = new Map<string, MovieCard[]>();
  details.forEach((d, i) => {
    if (!d) return;
    for (const g of d.generos) {
      const arr = byGenre.get(g);
      if (arr) arr.push(all[i]);
      else byGenre.set(g, [all[i]]);
    }
  });

  const order = new Map(catalog.map((g, i) => [g, i]));
  const groups: GenreGroup[] = [...byGenre.entries()]
    .map(([genre, movies]) => ({ genre, movies }))
    .sort(
      (a, b) =>
        (order.get(a.genre) ?? 999) - (order.get(b.genre) ?? 999) ||
        a.genre.localeCompare(b.genre),
    );

  return { total, groups, truncated };
}
