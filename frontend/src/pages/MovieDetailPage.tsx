import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import RatingPicker from "../components/RatingPicker";
import { deleteMovie, getMovieById, getMovieReviews, createReview } from "../lib/movies";
import type { MovieDetail } from "../lib/movieDetail";
import type { MovieReviewItem } from "../lib/movieReview";
import { formatNota, rocketTier } from "../lib/rocket";

/** Detalhes do Filme (`/movie/:id`) conforme design.md (sem metadados fora do contrato). */
export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [reviews, setReviews] = useState<MovieReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form inline de avaliação
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState(8);
  const [comentario, setComentario] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    Promise.all([getMovieById(id), getMovieReviews(id)])
      .then(([m, r]) => {
        if (!alive) return;
        setMovie(m);
        setReviews(r);
      })
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteMovie(id);
      navigate("/");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setFormError(null);
    if (!nome.trim()) {
      setFormError("Informe seu nome.");
      return;
    }
    setSending(true);
    try {
      const res = await createReview(id, { nome: nome.trim(), nota, comentario: comentario.trim() });
      setReviews((r) => [res.review, ...r]);
      setMovie((m) =>
        m ? { ...m, nota_media: res.nota_media_usuarios, qtd_avaliacoes: res.qtd_avaliacoes_usuarios } : m,
      );
      setFormOpen(false);
      setComentario("");
    } catch {
      setFormError("Não foi possível publicar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <p className="text-sm text-muted-foreground">Carregando filme…</p>
      </main>
    );
  }

  if (notFound || !movie) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <h1 className="font-display text-3xl">Filme não encontrado</h1>
        <Link to="/" className="mt-2 inline-block text-sm text-primary hover:underline">← Voltar para Home</Link>
      </main>
    );
  }

  const tier = movie.nota_media !== null && movie.nota_media !== undefined ? rocketTier(movie.nota_media) : null;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 md:px-6">
      {/* Hero backdrop */}
      <div className="relative -mx-4 h-64 overflow-hidden md:-mx-6 md:h-80">
        {movie.url_poster ? (
          <img src={movie.url_poster} alt="" aria-hidden className="h-full w-full scale-105 object-cover opacity-35 blur-sm" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary text-6xl" aria-hidden>🎬</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      {/* Poster + info */}
      <div className="-mt-20 flex flex-col gap-5 sm:flex-row">
        {movie.url_poster ? (
          <img
            src={movie.url_poster}
            alt={movie.titulo}
            className="h-44 w-32 shrink-0 rounded-xl border border-border object-cover sm:h-56 sm:w-40"
          />
        ) : (
          <div className="flex h-44 w-32 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-5xl sm:h-56 sm:w-40" aria-hidden>
            🎬
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl md:text-4xl">{movie.titulo}</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {movie.diretores.join(", ") || "Diretor desconhecido"}
            {movie.ano_lancamento ? ` · ${movie.ano_lancamento}` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <Link to={`/edit/${movie.id}`} className="rounded-xl border border-border px-3 py-1.5 text-sm hover:border-border-hover">
              Editar
            </Link>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border border-red-500/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              Excluir
            </button>
          </div>
          {movie.generos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {movie.generos.map((g) => (
                <span key={g} className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
                  {g}
                </span>
              ))}
            </div>
          )}
          {movie.sinopse && <p className="mt-3 max-w-2xl text-sm text-foreground-muted">{movie.sinopse}</p>}
        </div>
      </div>

      {/* Ratings */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Nota da plataforma</p>
          <p className="mt-1 font-display text-5xl" style={tier ? { color: tier.color } : undefined}>
            {formatNota(movie.nota_media)}
          </p>
          {tier ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs" style={{ background: `${tier.color}22`, color: tier.color }}>
              <span aria-hidden>{tier.emoji}</span> {tier.label} · {tier.sublabel}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Ainda sem avaliações de usuários.</p>
          )}
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {movie.qtd_avaliacoes ?? 0} avaliação(ões)
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Nota IMDb</p>
          <p className="mt-1 font-display text-5xl text-imdb">{movie.nota_imdb ?? "—"}</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {movie.qtd_imdb ? `${movie.qtd_imdb} voto(s)` : "sem votos registrados"}
          </p>
          {movie.nota_imdb !== null && movie.nota_imdb !== undefined && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-imdb" style={{ width: `${Math.min(100, (movie.nota_imdb / 10) * 100)}%` }} />
            </div>
          )}
        </div>
      </section>

      {/* Avaliações */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">
            Avaliações {reviews.length > 0 && <span className="font-mono text-sm text-muted-foreground">({reviews.length})</span>}
          </h2>
          {!formOpen && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover"
            >
              Avaliar
            </button>
          )}
        </div>

        {formOpen && (
          <form onSubmit={handleReview} className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-5">
            <div>
              <label htmlFor="r-nome" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Seu nome *
              </label>
              <input
                id="r-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-border-hover"
                placeholder="Como quer aparecer?"
              />
            </div>
            <RatingPicker value={nota} onChange={setNota} />
            <div>
              <label htmlFor="r-coment" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Crítica (opcional)
              </label>
              <textarea
                id="r-coment"
                rows={3}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-border-hover"
                placeholder="O que achou do filme?"
              />
            </div>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm hover:border-border-hover"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={sending}
                className="rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {sending ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {reviews.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-4xl" aria-hidden>🚀</p>
              <p className="mt-2 text-sm text-foreground-muted">Nenhuma avaliação ainda — seja a primeira pessoa a avaliar!</p>
            </div>
          )}
          {reviews.map((r, i) => {
            const t = rocketTier(r.nota);
            return (
              <article key={`${r.nome}-${r.data}-${i}`} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm" aria-hidden>👤</span>
                  <strong className="text-sm">{r.nome}</strong>
                  <span className="rounded-full px-2 py-0.5 font-mono text-xs" style={{ background: `${t.color}22`, color: t.color }}>
                    {t.emoji} · {r.nota}/10 · {t.label}
                  </span>
                  {r.data && <span className="ml-auto font-mono text-xs text-muted-foreground">{r.data.slice(0, 10)}</span>}
                </div>
                {r.comentario && <p className="mt-2 text-sm text-foreground-muted">{r.comentario}</p>}
              </article>
            );
          })}
        </div>
      </section>

      {/* Modal de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-xl">Excluir filme?</h3>
            <p className="mt-2 text-sm text-foreground-muted">
              Confirmar exclusão de <strong className="text-foreground">{movie.titulo}</strong>? Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm hover:border-border-hover"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
              >
                {deleting ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
