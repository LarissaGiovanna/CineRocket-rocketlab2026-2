/** Envelope de listagem paginada — espelho de `MovieListResponse` do back. */
import { type MovieCard, parseMovieCard } from "./movieCard";

export interface MovieListResponse {
  items: MovieCard[];
  total: number;
  page: number;
  page_size: number;
}

function toInt(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  return Number.isInteger(n) ? n : NaN;
}

export function parseMovieListResponse(data: unknown): MovieListResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("MovieListResponse: esperado um objeto");
  }
  const r = data as Record<string, unknown>;

  const rawItems = r.items;
  if (!Array.isArray(rawItems)) {
    throw new Error("MovieListResponse: 'items' deve ser uma lista");
  }
  const items = rawItems.map(parseMovieCard);

  const total = toInt(r.total, NaN);
  if (!Number.isInteger(total) || (total as number) < 0) {
    throw new Error("MovieListResponse: 'total' deve ser inteiro >= 0");
  }

  const page = toInt(r.page, 1);
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("MovieListResponse: 'page' deve ser inteiro >= 1");
  }

  const page_size = toInt(r.page_size, 20);
  if (!Number.isInteger(page_size) || page_size < 1 || page_size > 100) {
    throw new Error("MovieListResponse: 'page_size' deve ser inteiro entre 1 e 100");
  }

  return { items, total: total as number, page, page_size };
}

export function totalPages(res: MovieListResponse): number {
  if (res.page_size <= 0) return 0;
  return Math.ceil(res.total / res.page_size);
}
