import { getGenres, getMovieById, listMovies } from "./movies";
import type { MovieCard } from "./movieCard";

export interface GenreGroup {
  genre: string;
  movies: MovieCard[];
}

export interface GenreLoadProgress {
  /** página atual sendo lida (1-based) */
  page: number;
  /** total de páginas que serão lidas nesta varredura */
  maxPages: number;
  /** filmes já examinados */
  moviesSeen: number;
  /** total de filmes no banco */
  total: number;
}

interface LoadGenreOptions {
  query?: string;
  /** filmes por página do GET /movies */
  pageSize?: number;
  /** teto de páginas lidas por varredura */
  maxPages?: number;
  /** filmes por gênero para considerar a seção "cheia" (parada antecipada) */
  railLimit?: number;
  /** detalhes buscados em paralelo por lote */
  detailBatch?: number;
  isCancelled?: () => boolean;
  /** chamado após cada página, com os grupos parciais (renderização progressiva) */
  onUpdate?: (groups: GenreGroup[], progress: GenreLoadProgress) => void;
}

function sortGroups(byGenre: Map<string, MovieCard[]>, catalog: string[]): GenreGroup[] {
  const order = new Map(catalog.map((g, i) => [g, i]));
  return [...byGenre.entries()]
    .map(([genre, movies]) => ({ genre, movies }))
    .sort(
      (a, b) =>
        (order.get(a.genre) ?? 999) - (order.get(b.genre) ?? 999) ||
        a.genre.localeCompare(b.genre),
    );
}

/**
 * Monta o catálogo agrupado por gênero lendo UMA PÁGINA POR VEZ
 * (GET /movies?page=...), nunca o banco inteiro de uma vez.
 *
 * O backend não filtra por gênero (só `query` por título) e o cartão
 * não traz `generos` — por isso o detalhe de cada filme do pool é
 * buscado em lotes pequenos e o agrupamento é feito no navegador.
 * A cada página lida o `onUpdate` entrega os grupos parciais para
 * a tela renderizar progressivamente + barra de progresso.
 *
 * Parada antecipada: após 2 páginas, se todas as seções encontradas
 * já têm `railLimit` filmes, a varredura encerra (evita ler o banco
 * à toa). `truncated=true` indica que nem todo o banco foi varrido.
 */
export async function loadGenreCatalog(
  opts: LoadGenreOptions = {},
): Promise<{ total: number; groups: GenreGroup[]; truncated: boolean }> {
  const {
    query = "",
    pageSize = 40,
    maxPages = 5,
    railLimit = 10,
    detailBatch = 10,
    isCancelled,
    onUpdate,
  } = opts;

  const first = await listMovies(1, pageSize, query);
  const total = first.total;
  const effectiveMax = Math.max(1, Math.min(maxPages, Math.ceil(total / pageSize) || 1));
  const catalog = await getGenres().catch(() => [] as string[]);

  const byGenre = new Map<string, MovieCard[]>();
  let moviesSeen = 0;
  let pagesScanned = 0;

  for (let p = 1; p <= effectiveMax; p++) {
    if (isCancelled?.()) break;
    const res = p === 1 ? first : await listMovies(p, pageSize, query).catch(() => null);
    if (!res || res.items.length === 0) break;
    pagesScanned++;
    moviesSeen += res.items.length;

    // Detalhes em lotes pequenos (não dispara centenas de requests de uma vez).
    for (let i = 0; i < res.items.length; i += detailBatch) {
      if (isCancelled?.()) break;
      const slice = res.items.slice(i, i + detailBatch);
      const details = await Promise.all(
        slice.map((m) => getMovieById(m.id).catch(() => null)),
      );
      details.forEach((d, j) => {
        if (!d) return;
        for (const g of d.generos) {
          const arr = byGenre.get(g);
          if (arr) arr.push(res.items[i + j]);
          else byGenre.set(g, [res.items[i + j]]);
        }
      });
    }

    const groups = sortGroups(byGenre, catalog);
    onUpdate?.(groups, { page: p, maxPages: effectiveMax, moviesSeen, total });

    if (res.items.length < pageSize) break; // chegou ao fim do banco
    if (pagesScanned >= 2 && groups.length > 0 && groups.every((g) => g.movies.length >= railLimit)) break;
  }

  return { total, groups: sortGroups(byGenre, catalog), truncated: moviesSeen < total };
}
