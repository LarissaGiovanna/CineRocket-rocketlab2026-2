import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MovieForm, { emptyInitial, type MovieFormInitial } from "../components/MovieForm";
import { getMovieById } from "../lib/movies";

/** Página Adicionar Filme (`/add`). */
export function AddMoviePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      <h1 className="mt-2 font-display text-2xl md:text-3xl">Adicionar Filme</h1>
      <p className="mt-1 text-sm text-foreground-muted">Cadastre um novo título no catálogo.</p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 md:p-6">
        <MovieForm mode="add" initial={emptyInitial} />
      </div>
    </main>
  );
}

/** Página Editar Filme (`/edit/:id`) — mesmos campos, pré-preenchidos + preview. */
export function EditMoviePage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<MovieFormInitial | null>(null);
  const [title, setTitle] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMovieById(id)
      .then((m) => {
        setTitle(m.titulo);
        setInitial({
          titulo: m.titulo,
          diretor: m.diretores[0] ?? "",
          ano_lancamento: m.ano_lancamento !== null && m.ano_lancamento !== undefined ? String(m.ano_lancamento) : "",
          generos: m.generos,
          sinopse: m.sinopse ?? "",
        });
      })
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <h1 className="font-display text-2xl">Filme não encontrado</h1>
        <Link to="/" className="mt-2 inline-block text-sm text-primary hover:underline">← Voltar para Home</Link>
      </main>
    );
  }

  if (!initial) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <p className="text-sm text-muted-foreground">Carregando dados do filme…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <Link to={`/movie/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao filme</Link>
      <h1 className="mt-2 font-display text-2xl md:text-3xl">Editar Filme</h1>
      <p className="mt-1 truncate text-sm text-foreground-muted">{title}</p>

      {/* Preview ao vivo dos valores atuais seria ideal; exibimos resumo inicial */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 md:p-6">
        <MovieForm mode="edit" movieId={id} initial={initial} />
      </div>
    </main>
  );
}
