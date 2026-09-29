# CineRocket — Avaliador de Filmes (RocketLab 2026.2)
Aplicação web para catalogar filmes e receber avaliações de usuários, com nota de 0 a 10 e uma classificação temática inspirada em foguetes.

Este projeto é a atividade DEV do RocketLab 2026.2: o front foi construído em React + TypeScript (Vite), o back em FastAPI e o banco é SQLite, com o schema (SQLAlchemy) e as migrações (Alembic) herdados do repositório base do curso.

## Como funciona
1. Na Home, o usuário navega por um grid de filmes com pôster, nome e nota média.
2. Ao clicar em um filme, a página de detalhes mostra sinopse, gêneros, diretor(es), atores, orçamento/receita, popularidade e notas do TMDB/IMDb, além das avaliações da plataforma.
3. O usuário pode registrar uma nova avaliação (nome, nota de 0 a 10 com até 2 casas decimais e comentário); a média da plataforma é recalculada de forma incremental.
4. Também é possível cadastrar, editar e excluir filmes diretamente pela interface.

## Como executar
### Requisitos
1. Python 3.11 ou superior
2. Node.js (para o front em Vite + React)
3. Os arquivos CSV da camada Diamond (filmes, gêneros, pessoas, produtoras, performance e reviews) — não incluídos no repositório

### 1. Backend
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env
.venv/bin/alembic upgrade head
```

Coloque os CSVs na pasta esperada pelo script de carga e rode o seed:
```bash
.venv/bin/python seed.py --truncate
```

Inicie a API:
```bash
.venv/bin/uvicorn app.main:app --reload
```

A API ficará disponível em `http://localhost:8000`; use `http://localhost:8000/docs` para a documentação automática (Swagger).

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

O front ficará disponível em `http://localhost:5173` e consome a API em `http://localhost:8000`.

## Estrutura

```text
.
├── backend/
│   ├── app/
│   │   ├── core/          # configurações e logging
│   │   ├── db/            # Base ORM, engine e sessões
│   │   ├── movies/        # modelos SQLAlchemy do domínio de filmes
│   │   └── main.py        # rotas da API (sem router separado por domínio)
│   ├── migrations/        # Alembic
│   └── seed.py            # carga dos CSVs para o SQLite
├── frontend/               # React + TypeScript (Vite)
└── ia/
```

> Todas as rotas de filmes estão diretamente em `app/main.py`;

## Rotas da API
| Método | Rota | Descrição |
|---|---|---|
| GET | `/movies` | Lista paginada de filmes (`page`, `page_size`, `query`); ordenação fixa por título |
| GET | `/movies/{id_filme}` | Detalhe do filme: gêneros, diretores, atores, orçamento/receita/lucro, popularidade, notas TMDB/IMDb e resumo de avaliações |
| GET | `/movies/{id_filme}/reviews` | Lista de avaliações do filme |
| POST | `/movies/{id_filme}/reviews` | Cria uma avaliação e atualiza a média incremental |
| POST | `/movies` | Cadastra um filme (diretores e gêneros como listas) |
| PUT | `/movies/{id_filme}` | Edita um filme (mesmo schema do POST; usa apenas `diretores[0]`) |
| DELETE | `/movies/{id_filme}` | Remove um filme e seus dados relacionados (cascata) |
| GET | `/genres` | Lista de gêneros cadastrados, em ordem alfabética |

## Decisões de escopo
- Sem autenticação real: a tela `/auth` existe visualmente (toggle Entrar/Cadastrar), mas o botão de envio apenas redireciona para uma página "em breve".
- Formulário de Adicionar/Editar filme não inclui pôster, duração, país ou idioma (fora do schema `MovieCreate`).
- Campo de diretor tratado como único no formulário (mesmo o backend aceitando lista), para simplificar o fluxo dentro do prazo.
- O repositório não inclui os CSVs de dados; quem for rodar o projeto precisa obtê-los e adicioná-los por conta própria antes do `seed.py`.

## Banco de dados
O banco padrão é SQLite local (`backend/rocketlab.db`). O schema segue o modelo estrela do repositório base (dimensões de filmes, gêneros, pessoas, produtoras e avaliações, mais o fato de desempenho financeiro/engajamento). Filmes novos cadastrados pela aplicação são salvos apenas no banco — os CSVs originais não são alterados.
