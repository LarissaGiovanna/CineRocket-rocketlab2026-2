import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getGenres } from "../lib/movies";
import { toMovieCreatePayload, type MovieFormInput } from "../lib/movieForm";
import { createMovie, updateMovie } from "../lib/movies";
import { useEffect } from "react";

export interface MovieFormInitial {
  titulo: string;
  diretor: string;
  ano_lancamento: string;
  generos: string[];
  sinopse: string;
}

export const emptyInitial: MovieFormInitial = {
  titulo: "",
  diretor: "",
  ano_lancamento: "",
  generos: [],
  sinopse: "",
};

interface Props {
  mode: "add" | "edit";
  movieId?: string;
  initial?: MovieFormInitial;
}

/**
 * Formulário Adicionar/Editar — contrato MovieCreate:
 * título, diretor (único), ano, gêneros (multi), sinopse.
 * Sem pôster/duração/país/idioma (backend não aceita).
 */
export default function MovieForm({ mode, movieId, initial = emptyInitial }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState<MovieFormInitial>(initial);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initial), [initial.titulo, initial.diretor, initial.ano_lancamento, initial.sinopse, JSON.stringify(initial.generos)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    getGenres().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  function set<K extends keyof MovieFormInitial>(key: K, value: MovieFormInitial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleGenre(g: string) {
    setForm((f) => ({
      ...f,
      generos: f.generos.includes(g) ? f.generos.filter((x) => x !== g) : [...f.generos, g],
    }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.titulo.trim()) errs.titulo = "Título é obrigatório.";
    const ano = Number(form.ano_lancamento);
    const maxAno = new Date().getFullYear() + 2;
    if (!form.ano_lancamento.trim() || !Number.isInteger(ano) || ano < 1888 || ano > maxAno)
      errs.ano_lancamento = `Ano deve ser inteiro entre 1888 e ${maxAno}.`;
    if (!form.diretor.trim()) errs.diretor = "Diretor(a) é obrigatório(a).";
    if (form.generos.length < 1) errs.generos = "Selecione ao menos 1 gênero.";
    if (!form.sinopse.trim()) errs.sinopse = "Sinopse é obrigatória.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;
    const input: MovieFormInput = {
      titulo: form.titulo.trim(),
      diretor: form.diretor.trim(),
      ano_lancamento: Number(form.ano_lancamento),
      generos: form.generos,
      sinopse: form.sinopse.trim(),
    };
    const payload = toMovieCreatePayload(input); // diretores: [único]
    setSaving(true);
    try {
      if (mode === "add") {
        const created = await createMovie(payload);
        navigate(`/movie/${created.id}`);
      } else {
        const updated = await updateMovie(movieId!, payload);
        navigate(`/movie/${updated.id}`);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.");
      setApiError(typeof msg === "string" ? msg : "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (bad?: string) =>
    `w-full rounded-xl border bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus:border-border-hover md:text-sm ${
      bad ? "border-red-500" : "border-border"
    }`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="f-titulo" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Título *
        </label>
        <input
          id="f-titulo"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Ex: Ainda Estou Aqui"
          className={inputCls(errors.titulo)}
        />
        {errors.titulo && <p className="mt-1 text-xs text-red-400">{errors.titulo}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="f-diretor" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Diretor(a) *
          </label>
          <input
            id="f-diretor"
            value={form.diretor}
            onChange={(e) => set("diretor", e.target.value)}
            placeholder="Nome único (front envia array de 1 item)"
            className={inputCls(errors.diretor)}
          />
          {errors.diretor && <p className="mt-1 text-xs text-red-400">{errors.diretor}</p>}
        </div>
        <div>
          <label htmlFor="f-ano" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Ano *
          </label>
          <input
            id="f-ano"
            inputMode="numeric"
            value={form.ano_lancamento}
            onChange={(e) => set("ano_lancamento", e.target.value)}
            placeholder={`1888–${new Date().getFullYear() + 2}`}
            className={inputCls(errors.ano_lancamento)}
          />
          {errors.ano_lancamento && <p className="mt-1 text-xs text-red-400">{errors.ano_lancamento}</p>}
        </div>
      </div>

      <div>
        <span className="mb-2 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Gêneros * (selecione 1 ou mais)
        </span>
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Carregando gêneros…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {catalog.map((g) => {
              const active = form.generos.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-transparent bg-primary text-white"
                      : "border-border bg-secondary text-muted-foreground hover:border-border-hover"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        )}
        {errors.generos && <p className="mt-1 text-xs text-red-400">{errors.generos}</p>}
      </div>

      <div>
        <label htmlFor="f-sinopse" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Sinopse *
        </label>
        <textarea
          id="f-sinopse"
          rows={5}
          value={form.sinopse}
          onChange={(e) => set("sinopse", e.target.value)}
          placeholder="Resumo da história…"
          className={inputCls(errors.sinopse)}
        />
        {errors.sinopse && <p className="mt-1 text-xs text-red-400">{errors.sinopse}</p>}
      </div>

      {apiError && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {apiError}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate(mode === "edit" && movieId ? `/movie/${movieId}` : "/")}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:border-border-hover"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? "Salvando…" : mode === "add" ? "Cadastrar Filme" : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}
