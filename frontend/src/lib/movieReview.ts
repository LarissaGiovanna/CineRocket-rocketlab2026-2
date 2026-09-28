/** Contratos de avaliação — espelho de MovieReviewItem/MovieReviewCreate/
 *  MovieReviewCreatedResponse em schemas.py. */

export interface MovieReviewItem {
  nome: string;
  nota: number;
  comentario: string;
  data: string | null; // ISO datetime como string; formatar na hora de exibir
}

export interface MovieReviewCreatedResponse {
  review: MovieReviewItem;
  nota_media_usuarios: number;
  qtd_avaliacoes_usuarios: number;
}

// Corpo enviado no POST /movies/{id}/reviews — não precisa de parser,
// é o formulário mandando pro backend, não o backend mandando pra nós.
export interface MovieReviewCreate {
  nome: string;
  nota: number;
  comentario: string;
}

function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data === null) {
    throw new Error("MovieReview: esperado um objeto");
  }
  return data as Record<string, unknown>;
}

export function parseMovieReviewItem(data: unknown): MovieReviewItem {
  const r = asRecord(data);
  const nome = typeof r.nome === "string" ? r.nome : "";
  const nota = typeof r.nota === "number" ? r.nota : NaN;
  if (!nome || Number.isNaN(nota)) {
    throw new Error("MovieReviewItem: 'nome' e 'nota' são obrigatórios");
  }
  return {
    nome,
    nota,
    comentario: typeof r.comentario === "string" ? r.comentario : "",
    data: typeof r.data === "string" ? r.data : null,
  };
}

export function parseMovieReviewCreatedResponse(
  data: unknown
): MovieReviewCreatedResponse {
  const r = asRecord(data);
  return {
    review: parseMovieReviewItem(r.review),
    nota_media_usuarios: Number(r.nota_media_usuarios),
    qtd_avaliacoes_usuarios: Number(r.qtd_avaliacoes_usuarios),
  };
}