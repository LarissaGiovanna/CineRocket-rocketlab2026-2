# RocketLab 2026.2 — repositório base

Base inicial para evoluir a atividade do RocketLab 2026.2. Ela preserva a organização do backend,
o modelo relacional do catálogo de filmes em SQLAlchemy 2.0 e o histórico de
migrações com Alembic, sem incluir interface, dados CSV, endpoints de negócio
ou rotinas de carga.

> **Nota:** `RocketLab` é apenas o nome de referência desta base. O diretório,
> nome do pacote, título da API e arquivo do banco podem ser renomeados para o
> que preferirem; eles não representam uma exigência da
> estrutura-base.

## Estrutura

```text
.
├── backend/
│   ├── app/
│   │   ├── api/v1/        # ponto de composição dos futuros routers
│   │   ├── core/          # configurações e logging
│   │   ├── db/            # Base ORM, engine e sessões
│   │   └── movies/        # modelos SQLAlchemy do domínio de filmes
│   ├── migrations/        # ambiente e revisões Alembic
│   ├── scripts/seed.py    # importação dos CSVs de dados/
│   └── tests/
├── frontend/              # CineRocket (Vite + React + TS + Tailwind v4)
│   ├── src/
│   │   ├── lib/api.ts     # client axios (VITE_API_URL)
│   │   ├── App.tsx        # rotas base
│   │   └── index.css      # tema Tailwind + tokens do design.md
│   └── .env.example
└── README.md
```

## Pré-requisitos

- Python 3.11 ou superior
- Node 20+ e npm 10+

## Execução — Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Linux/macOS:
.venv/bin/pip install -e ".[dev]"
cp .env.example .env
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload

# Windows (PowerShell / Git Bash):
.venv/Scripts/pip install -e ".[dev]"
copy .env.example .env
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload
```

A API mínima ficará disponível em `http://localhost:8000`; use
`http://localhost:8000/docs` para a documentação automática. O endpoint
`GET /health` permite conferir se a aplicação iniciou corretamente.

## Execução — Frontend (React + TS + Tailwind)

```bash
cd frontend
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

O app ficará disponível em `http://localhost:5173` e consome a API via
`VITE_API_URL` (padrão `http://localhost:8000`, ver `frontend/.env.example`).
O `vite.config.ts` já faz proxy de `/api` para `http://localhost:8000`.

Outros comandos:

```bash
npm run build   # tsc -b + vite build, gera dist/
npm run preview # serve o build local para conferência
```

## Importação dos CSVs (seed)

O script `backend/scripts/seed.py` lê a pasta `dados/` (`dim/`, `bridge/`,
`fact_movies_performance.csv`, `movies_reviews.csv`), normaliza conforme
`app/movies/models.py` e insere na ordem das chaves estrangeiras
(genres → companies → people → movies → performance → dim_reviews →
movie_reviews → merge incremental → bridges). Rode com o banco já migrado
(`alembic upgrade head`).

```bash
cd backend
# Carga total:
.venv/Scripts/python scripts/seed.py
# Linux/macOS: .venv/bin/python scripts/seed.py

# Smoke test (200 linhas por CSV, com log detalhado):
.venv/Scripts/python scripts/seed.py --limit 200 --verbose

# Recriar tudo do zero:
.venv/Scripts/python scripts/seed.py --truncate --batch-size 5000

# Só algumas etapas:
.venv/Scripts/python scripts/seed.py --only movies performance
# Etapas: genres, companies, people, movies, performance,
#         dim_reviews, movie_reviews, bridges
```

Opções: `--dados-dir` (pasta dos CSVs, padrão `../dados`),
`--database-url` (sobrescreve o `.env`), `--batch-size` (padrão 5000),
`--truncate` (limpa as tabelas antes), `--verbose`.

Regras aplicadas: campo vazio vira o mínimo do tipo (int `0`, double `0.0`,
data `1970-01-01`); texto acima do limite é truncado e reportado ao final
(hoje: 0 ocorrências); `dim_reviews` pula resumos vazios e é atualizada de
forma incremental a partir das avaliações novas (média ponderada, sem
duplicar em reexecuções). Carga total esperada: ~95k filmes, ~425k pessoas,
~44k avaliações, ~983k bridges.

## Banco de dados e migrações

O modelo usa um esquema estrela para o catálogo de filmes:

- dimensões de filmes, gêneros, pessoas, produtoras e resumo de avaliações;
- fato de desempenho financeiro e de engajamento;
- tabelas de associação N:N entre filmes, gêneros, produtoras e pessoas;

O schema corresponde aos nove arquivos CSV atuais da camada Diamond, com a
adição de `movie_reviews`: uma avaliação individual por linha, na escala 0–10.
A tabela aceita diretamente as colunas `sk_movie_review_id`, `sk_movie_id`,
`nome`, `nota` e `comentario` do CSV enviado separadamente. `created_at` é
gerado pelo banco. O contexto generativo não faz parte desta base.

O repositório não inclui CSVs nem rotinas de carga. Para usar avaliações,
importe primeiro os filmes em `dim_movies` e depois o CSV de `movie_reviews`.

As tabelas são criadas exclusivamente pelo Alembic. Para evoluir os modelos,
crie uma revisão e aplique-a:

```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "descreva a alteração"
.venv/bin/alembic upgrade head
```

O banco padrão é SQLite local em `backend/rocketlab.db`. Ajuste
`DATABASE_URL` no arquivo `.env` para usar outro banco compatível.
