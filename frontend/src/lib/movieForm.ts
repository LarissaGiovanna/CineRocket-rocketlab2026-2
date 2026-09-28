/** Corpo enviado no POST/PUT /movies — espelho de MovieCreate, já com a
 *  decisão de "diretor único" (o form usa string, aqui viramos array de 1). */

export interface MovieFormInput {
  titulo: string;
  diretor: string; // um só, decisão do front — ver notas do PUT no backend
  ano_lancamento: number;
  generos: string[];
  sinopse: string;
}

export interface MovieCreatePayload {
  titulo: string;
  diretores: string[];
  ano_lancamento: number;
  generos: string[];
  sinopse: string;
}

export function toMovieCreatePayload(input: MovieFormInput): MovieCreatePayload {
  return {
    titulo: input.titulo,
    diretores: [input.diretor],
    ano_lancamento: input.ano_lancamento,
    generos: input.generos,
    sinopse: input.sinopse,
  };
}