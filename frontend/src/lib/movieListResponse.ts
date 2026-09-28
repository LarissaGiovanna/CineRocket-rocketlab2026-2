/** Envelope de listagem — espelho de MovieListResponse em schemas.py. */

import { type MovieCard, parseMovieCard } from "./movieCard";

export interface MovieListResponse {
  items: MovieCard[];
  total: number;
  page: number;
  page_size: number;
}

export function parseMovieListResponse(data: unknown): MovieListResponse {
  const r = data as Record<string, unknown>;
  const items = Array.isArray(r.items) ? r.items.map(parseMovieCard) : [];
  return {
    items,
    total: Number(r.total) || 0,
    page: Number(r.page) || 1,
    page_size: Number(r.page_size) || 20,
  };
}