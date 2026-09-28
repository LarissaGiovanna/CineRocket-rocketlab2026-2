import { useState } from "react";
import { Link } from "react-router-dom";

/**
 * Auth visual completo (toggle Entrar/Cadastrar, e-mail/senha),
 * mas SEM chamada de API: o submit só revela o estado "em breve"
 * dentro da própria /auth. App abre sempre sem conta logada.
 */
export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [soon, setSoon] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (mode === "signup" && !nome.trim()) errs.nome = "Nome é obrigatório.";
    if (!email.trim()) errs.email = "E-mail é obrigatório.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "E-mail inválido.";
    if (!senha) errs.senha = "Senha é obrigatória.";
    else if (senha.length < 6) errs.senha = "Mínimo de 6 caracteres.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // Sem API: só navega para estado "em breve".
    setSoon(true);
  }

  const inputCls = (bad?: string) =>
    `w-full rounded-xl border bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus:border-border-hover md:text-sm ${
      bad ? "border-red-500" : "border-border"
    }`;

  if (soon) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 text-center">
        <p className="text-5xl" aria-hidden>🚀</p>
        <h1 className="mt-4 font-display text-3xl">Em breve</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          O login ainda não está disponível — o catálogo segue aberto sem conta.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setSoon(false)}
            className="rounded-xl border border-border px-4 py-2 text-sm hover:border-border-hover"
          >
            Voltar ao formulário
          </button>
          <Link to="/" className="rounded-xl bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
            Explorar filmes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-10">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-3xl" aria-hidden>
          🚀
        </span>
        <p className="mt-3 font-display text-2xl font-semibold">CineRocket</p>
        <p className="text-sm italic text-muted-foreground">Dê a nota. Lance o filme.</p>
      </div>

      {/* Toggle Entrar / Cadastrar */}
      <div className="mt-6 grid grid-cols-2 rounded-xl border border-border bg-card p-1" role="tablist">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setErrors({});
              setSoon(false);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              mode === m ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "login" ? "Entrar" : "Cadastrar"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="a-nome" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Nome
            </label>
            <input
              id="a-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className={inputCls(errors.nome)}
            />
            {errors.nome && <p className="mt-1 text-xs text-red-400">{errors.nome}</p>}
          </div>
        )}
        <div>
          <label htmlFor="a-email" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            E-mail
          </label>
          <input
            id="a-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className={inputCls(errors.email)}
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="a-senha" className="mb-1 block font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Senha
          </label>
          <div className="relative">
            <input
              id="a-senha"
              type={showPass ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={inputCls(errors.senha) + " pr-14"}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showPass ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {errors.senha && <p className="mt-1 text-xs text-red-400">{errors.senha}</p>}
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Demo rápida</p>
        <button
          type="button"
          onClick={() => setSoon(true)}
          className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border bg-secondary px-3 py-2 text-left text-sm hover:border-border-hover"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-card" aria-hidden>👤</span>
          Continuar como visitante
        </button>
      </div>
    </main>
  );
}
