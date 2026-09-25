/** Contrato do cartão do filme — espelho de `backend/app/movies/schemas.py`.
 *
 * Mesmas regras nos dois lados: `id` (1–50 chars, aceita `id_filme` na
 * entrada), `titulo` (1–500), `url_poster` (vazio → null, máx. 2048),
 * `nota_media` (null ou 0–10 com 1 casa decimal).
 */

export interface MovieCard {
  id: string;
  titulo: string;
  url_poster: string | null;
  nota_media: number | null;
}

function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data === null) {
    throw new Error("MovieCard: esperado um objeto");
  }
  return data as Record<string, unknown>;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s === "" ? null : s;
}

export function parseMovieCard(data: unknown): MovieCard {
  const r = asRecord(data);

  const id = cleanText(r.id ?? r.id_filme);
  if (id === null || id.length > 50) {
    throw new Error("MovieCard: 'id' obrigatório (1–50 caracteres)");
  }

  const titulo = cleanText(r.titulo);
  if (titulo === null || titulo.length > 500) {
    throw new Error("MovieCard: 'titulo' obrigatório (1–500 caracteres)");
  }

  const poster = cleanText(r.url_poster);
  if (poster !== null && poster.length > 2048) {
    throw new Error("MovieCard: 'url_poster' acima de 2048 caracteres");
  }

  let nota_media: number | null = null;
  const rawNota = r.nota_media;
  if (rawNota !== null && rawNota !== undefined && rawNota !== "") {
    const n = typeof rawNota === "string" ? Number(rawNota.trim()) : Number(rawNota);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      throw new Error("MovieCard: 'nota_media' deve ser um número de 0 a 10");
    }
    nota_media = Math.round(n * 10) / 10;
  }

  return { id, titulo, url_poster: poster, nota_media };
}
