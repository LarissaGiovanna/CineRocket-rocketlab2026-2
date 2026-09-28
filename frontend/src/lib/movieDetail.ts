/** Contrato do detalhe do filme — espelho de `MovieDetail` em schemas.py. */

export interface MovieDetail {
  id: string;
  titulo: string;
  ano_lancamento: number | null;
  sinopse: string | null;
  url_poster: string | null;
  generos: string[];
  diretores: string[];
  atores: string[];
  orcamento_usd: number | null;
  receita_usd: number | null;
  lucro_usd: number | null;
  popularidade: number | null;
  nota_tmdb: number | null;
  qtd_tmdb: number | null;
  nota_imdb: number | null;
  qtd_imdb: number | null;
  qtd_avaliacoes: number | null;
  nota_media: number | null;
}

function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data === null) {
    throw new Error("MovieDetail: esperado um objeto");
  }
  return data as Record<string, unknown>;
}

// Backend sempre manda essas listas (default_factory=list), mas por
// segurança tratamos ausência/null como lista vazia em vez de quebrar.
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

// Todos os campos numéricos opcionais seguem o mesmo formato no JSON:
// null vira null, number passa direto. Não precisam de round aqui —
// o backend já manda nota_media arredondada em 1 casa.
function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export function parseMovieDetail(data: unknown): MovieDetail {
  const r = asRecord(data);

  const id = typeof r.id === "string" ? r.id : "";
  const titulo = typeof r.titulo === "string" ? r.titulo : "";
  if (!id || !titulo) {
    throw new Error("MovieDetail: 'id' e 'titulo' são obrigatórios");
  }

  return {
    id,
    titulo,
    ano_lancamento: asNumberOrNull(r.ano_lancamento),
    sinopse: typeof r.sinopse === "string" ? r.sinopse : null,
    url_poster: typeof r.url_poster === "string" ? r.url_poster : null,
    generos: asStringArray(r.generos),
    diretores: asStringArray(r.diretores),
    atores: asStringArray(r.atores),
    orcamento_usd: asNumberOrNull(r.orcamento_usd),
    receita_usd: asNumberOrNull(r.receita_usd),
    lucro_usd: asNumberOrNull(r.lucro_usd),
    popularidade: asNumberOrNull(r.popularidade),
    nota_tmdb: asNumberOrNull(r.nota_tmdb),
    qtd_tmdb: asNumberOrNull(r.qtd_tmdb),
    nota_imdb: asNumberOrNull(r.nota_imdb),
    qtd_imdb: asNumberOrNull(r.qtd_imdb),
    qtd_avaliacoes: asNumberOrNull(r.qtd_avaliacoes),
    nota_media: asNumberOrNull(r.nota_media),
  };
}