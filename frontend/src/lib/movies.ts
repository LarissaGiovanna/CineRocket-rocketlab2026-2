import { api } from "./api";
import { type MovieCard, parseMovieCard } from "./movieCard";
import { type MovieDetail, parseMovieDetail } from "./movieDetail";
import { type MovieListResponse, parseMovieListResponse } from "./movieListResponse";
import { type MovieReviewCreate, type MovieReviewCreatedResponse,
  type MovieReviewItem,
  parseMovieReviewCreatedResponse,
  parseMovieReviewItem,
} from "./movieReview";
import { type MovieCreatePayload } from "./movieForm";

/** Home/Busca: lista paginada de filmes.
 * `query` filtra por título (ilike no backend); vazio traz tudo.
 * Sem parâmetro de gênero/sort — decisão já tomada (backend não suporta). */
export async function listMovies(
  page = 1,
  pageSize = 20,
  query = ""
): Promise<MovieListResponse> {
  const res = await api.get("/movies", {
    params: { page, page_size: pageSize, query },
  });
  return parseMovieListResponse(res.data);
}

/** Detalhes do Filme: busca por `id_filme`. 404 se não existir —
 * deixamos o erro do axios propagar pra página tratar (ex: redirecionar). */
export async function getMovieById(id: string): Promise<MovieDetail> {
  const res = await api.get(`/movies/${id}`);
  return parseMovieDetail(res.data);
}

/** Lista de avaliações de um filme (mais recentes primeiro).
 * Sempre 200 — filme sem avaliações (ou inexistente) retorna []. */
export async function getMovieReviews(id: string): Promise<MovieReviewItem[]> {
  const res = await api.get(`/movies/${id}/reviews`);
  const items = Array.isArray(res.data) ? res.data : [];
  return items.map(parseMovieReviewItem);
}

/** Adicionar Filme: cria e retorna o MovieDetail já cadastrado.
 * 400 se algum gênero não existir no catálogo — deixe o form mostrar o erro. */
export async function createMovie(payload: MovieCreatePayload): Promise<MovieDetail> {
  const res = await api.post("/movies", payload);
  return parseMovieDetail(res.data);
}

/** Editar Filme: mesmo corpo do cadastro.
 * 400 se o filme já tiver mais de um diretor vinculado (edição manual
 * necessária nesse caso — não deveria acontecer nos filmes que você mesma
 * cadastrar pelo front, já que sempre manda diretor único). */
export async function updateMovie(
  id: string,
  payload: MovieCreatePayload
): Promise<MovieDetail> {
  const res = await api.put(`/movies/${id}`, payload);
  return parseMovieDetail(res.data);
}

/** Excluir Filme: sem corpo de retorno (204). */
export async function deleteMovie(id: string): Promise<void> {
  await api.delete(`/movies/${id}`);
}

/** Chips/select de gênero no formulário de Adicionar/Editar. */
export async function getGenres(): Promise<string[]> {
  const res = await api.get("/genres");
  return Array.isArray(res.data) ? res.data.filter((g: unknown) => typeof g === "string") : [];
}

/** Publicar avaliação: retorna a review criada + média/contagem já
 * atualizadas — use isso pra atualizar a tela sem precisar refazer o GET. */
export async function createReview(
  movieId: string,
  payload: MovieReviewCreate
): Promise<MovieReviewCreatedResponse> {
  const res = await api.post(`/movies/${movieId}/reviews`, payload);
  return parseMovieReviewCreatedResponse(res.data);
}

// Re-exporta os tipos de cartão pra quem só importa de "movies.ts".
export type { MovieCard };