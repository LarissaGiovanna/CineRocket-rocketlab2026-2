"""Seed do catálogo de filmes a partir dos CSVs em ``dados/``.

Uso:
    cd backend
    .venv/Scripts/python scripts/seed.py
    .venv/Scripts/python scripts/seed.py --limit 500 --verbose
    .venv/Scripts/python scripts/seed.py --truncate --batch-size 5000

Lê os CSVs da pasta ``dados/`` (dim, bridge, fact, reviews), normaliza
os valores conforme ``app/movies/models.py`` e insere respeitando a
ordem de chaves estrangeiras:

    genres -> companies -> people -> movies -> performance
    -> dim_reviews -> movie_reviews -> merge incremental -> bridges

Regras aplicadas:

- Vazio -> valor padrão do tipo (int 0, double 0.0, Decimal 0,
  data 1970-01-01). Strings obrigatórias vazias pulam a linha (não se
  inventa PK/título/nome); strings opcionais vazias viram NULL (ausência).
- Textos acima do limite da coluna são truncados E registrados no
  relatório final; se um dia houver truncamento real, o correto é migrar
  a coluna para TEXT via Alembic em vez de perder dados em silêncio.
- ``dim_reviews`` não guarda linha vazia (qtd 0 é pulada: filme sem
  avaliação não ganha resumo, conforme decisão do projeto) e é atualizada
  de forma incremental a partir das avaliações individuais inseridas na
  execução (média ponderada preservando o acumulado anterior).
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import bindparam, delete, insert, select, text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Permite `python scripts/seed.py` a partir de `backend/`.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.movies import models as m  # noqa: E402

PERSON_TYPES = set(m.PERSON_TYPES)

# Valores padrão quando o CSV chega vazio/ilegível (mínimo do tipo).
DEFAULT_INT = 0
DEFAULT_FLOAT = 0.0
DEFAULT_DECIMAL = Decimal("0")
EPOCH_DATE = date(1970, 1, 1)

# Nome usado quando a avaliação individual chega sem autor.
ANONYMOUS_REVIEWER = "Anônimo"

# Auditoria: quantas vezes cada parse caiu no valor padrão e
# quantas vezes cada campo de texto foi truncado (com exemplos).
fallback_stats: Counter[str] = Counter()
trunc_stats: Counter[str] = Counter()
trunc_examples: dict[str, list[str]] = {}

# Limites das colunas (para truncar sem estourar o banco).
LIMITS = {
    "titulo": 500,
    "sinopse": 4000,
    "url": 2048,
    "nome_pessoa": 255,
    "nome_produtora": 255,
    "nome_genero": 50,
    "nome_review": 120,
    "comentario": 4000,
    "id_filme": 50,
}


def clean_str(
    value: object | None, limit: int | None = None, field: str = "?", ref: str = ""
) -> str | None:
    """Strip + vazio->None + truncagem.

    Truncagem é registrada em ``trunc_stats``/``trunc_examples`` para o
    relatório final: nenhum caractere pode se perder em silêncio. Se um
    dia houver truncamento real, migrar a coluna para TEXT via Alembic.
    """
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if limit is not None and len(s) > limit:
        trunc_stats[field] += 1
        examples = trunc_examples.setdefault(field, [])
        if len(examples) < 3:
            examples.append(f"{ref or '?'} ({len(s)} chars)")
        s = s[:limit]
    return s


def req_str(
    value: object | None, limit: int | None = None, field: str = "?", ref: str = ""
) -> str | None:
    """Igual a clean_str, mas pensada para campos obrigatórios."""
    return clean_str(value, limit, field, ref)


def parse_date(value: object | None, field: str = "data") -> date:
    """Data ou EPOCH_DATE (1970-01-01) quando vazia/ilegível."""
    s = clean_str(value)
    if s is not None:
        # Formato esperado: YYYY-MM-DD. Tenta também YYYY/MM/DD e YYYY.
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y"):
            try:
                from datetime import datetime as _dt

                return _dt.strptime(s[:10] if len(s) > 4 else s, fmt).date()
            except ValueError:
                continue
    fallback_stats[field] += 1
    return EPOCH_DATE


def parse_int(value: object | None, field: str = "int") -> int:
    """Inteiro ou 0 quando vazio/ilegível ("2375.0" -> 2375)."""
    s = clean_str(value)
    if s is not None:
        try:
            # CSVs trazem contadores como "2375.0" — converte via float.
            return int(float(s.replace(",", ".")))
        except (ValueError, OverflowError):
            pass
    fallback_stats[field] += 1
    return DEFAULT_INT


def parse_float(value: object | None, field: str = "float") -> float:
    """Double ou 0.0 quando vazio/ilegível."""
    s = clean_str(value)
    if s is not None:
        try:
            return float(s.replace(",", "."))
        except ValueError:
            pass
    fallback_stats[field] += 1
    return DEFAULT_FLOAT


def parse_decimal(value: object | None, field: str = "decimal") -> Decimal:
    """Decimal ou 0 quando vazio/ilegível."""
    s = clean_str(value)
    if s is not None:
        try:
            return Decimal(s.replace(",", "."))
        except (InvalidOperation, ValueError):
            pass
    fallback_stats[field] += 1
    return DEFAULT_DECIMAL


def incremental_mean(
    old_avg: float | None, old_n: int, new_values: list[float]
) -> tuple[int, float]:
    """Média incremental preservando o acumulado anterior.

    Mesma fórmula que o endpoint de avaliações deve usar em runtime:
    não requer reler todas as notas, só a quantidade anterior.
    Filmes sem resumo prévio entram com ``old_n=0`` e ``old_avg=None``.
    """
    total = (old_avg or 0.0) * old_n + sum(new_values)
    new_n = old_n + len(new_values)
    return new_n, (total / new_n if new_n else 0.0)


def read_csv(path: Path, limit: int = 0):
    """Itera linhas do CSV com DictReader (utf-8-sig para BOM)."""
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break
            yield row


async def bulk_insert(session, table, rows: list[dict], batch_size: int) -> int:
    """Insert em lotes com OR IGNORE (idempotente no SQLite)."""
    total = 0
    stmt = insert(table).prefix_with("OR IGNORE")
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        if not batch:
            continue
        await session.execute(stmt, batch)
        total += len(batch)
    return total


async def table_count(session, table) -> int:
    result = await session.execute(select(text("count(*)")).select_from(table))
    return int(result.scalar() or 0)


def build_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Popula o banco a partir de dados/*.csv")
    p.add_argument(
        "--dados-dir",
        default=str(BACKEND_DIR.parent / "dados"),
        help="Pasta com dim/, bridge/, fact_*.csv e movies_reviews.csv",
    )
    p.add_argument("--batch-size", type=int, default=5000)
    p.add_argument("--limit", type=int, default=0, help="Limita linhas por CSV (smoke test).")
    p.add_argument("--truncate", action="store_true", help="Limpa as tabelas antes de inserir.")
    p.add_argument(
        "--only",
        nargs="*",
        default=[],
        help="Só estas etapas: genres,companies,people,movies,performance,"
        "dim_reviews,movie_reviews,bridges",
    )
    p.add_argument("--database-url", default=None, help="Sobrescreve DATABASE_URL do .env")
    p.add_argument("--verbose", action="store_true")
    return p.parse_args()


async def main() -> None:
    args = build_args()
    dados = Path(args.dados_dir)
    if not dados.exists():
        print(f"[seed] pasta de dados não encontrada: {dados}", file=sys.stderr)
        sys.exit(1)

    db_url = args.database_url
    if db_url is None:
        from app.core.config import get_settings

        db_url = get_settings().database_url

    engine = create_async_engine(db_url, echo=False)
    # FKs ligadas no SQLite.
    from sqlalchemy import event as _event

    @_event.listens_for(engine.sync_engine, "connect")
    def _pragma(dbapi_conn, _rec):  # type: ignore[no-untyped-def]
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    only = set(args.only or [])

    def run(name: str) -> bool:
        return (not only) or (name in only)

    def log(*a, **k):  # type: ignore[no-untyped-def]
        if args.verbose:
            print(*a, **k)

    def need(name: str) -> bool:
        return run(name)

    async with Session() as session:
        if args.truncate:
            print("[seed] limpando tabelas...")
            # Ordem reversa das dependências.
            for tbl in (
                m.bridge_movie_person,
                m.bridge_movie_genre,
                m.bridge_movie_company,
                m.MovieReview.__table__,
                m.DimReview.__table__,
                m.FactMoviePerformance.__table__,
                m.DimMovie.__table__,
                m.DimPerson.__table__,
                m.DimCompany.__table__,
                m.DimGenre.__table__,
            ):
                await session.execute(delete(tbl))
            await session.commit()

        stats: dict[str, int] = {}

        # --- 1. Gêneros ---
        if need("genres"):
            rows, seen = [], set()
            for r in read_csv(dados / "dim" / "dim_genres.csv", args.limit):
                nome = req_str(r.get("nome_genero"), LIMITS["nome_genero"])
                if nome is None or nome in seen:
                    continue
                seen.add(nome)
                sk = clean_str(r.get("sk_genre_id")) or m.generate_surrogate_key()
                rows.append(
                    {
                        "sk_genre_id": sk,
                        "nome_genero": nome,
                    }
                )
            await bulk_insert(session, m.DimGenre.__table__, rows, args.batch_size)
            await session.commit()
            stats["genres"] = len(rows)
            print(f"[seed] genres: {len(rows)} linhas preparadas")

        # --- 2. Produtoras ---
        if need("companies"):
            rows, seen = [], set()
            for r in read_csv(dados / "dim" / "dim_companies.csv", args.limit):
                nome = req_str(r.get("nome_produtora"), LIMITS["nome_produtora"])
                if nome is None or nome in seen:
                    continue
                seen.add(nome)
                rows.append(
                    {
                        "sk_company_id": clean_str(r.get("sk_company_id"))
                        or m.generate_surrogate_key(),
                        "nome_produtora": nome,
                    }
                )
            await bulk_insert(session, m.DimCompany.__table__, rows, args.batch_size)
            await session.commit()
            stats["companies"] = len(rows)
            print(f"[seed] companies: {len(rows)} linhas preparadas")

        # --- 3. Pessoas (valida tipo_pessoa; dedup por nome+tipo) ---
        if need("people"):
            rows, seen = [], set()
            skipped_type = 0
            for r in read_csv(dados / "dim" / "dim_people.csv", args.limit):
                nome = req_str(r.get("nome_pessoa"), LIMITS["nome_pessoa"])
                tipo = clean_str(r.get("tipo_pessoa"))
                if nome is None or tipo not in PERSON_TYPES:
                    skipped_type += 1
                    continue
                key = (nome, tipo)
                if key in seen:
                    continue
                seen.add(key)
                rows.append(
                    {
                        "sk_person_id": clean_str(r.get("sk_person_id"))
                        or m.generate_surrogate_key(),
                        "nome_pessoa": nome,
                        "tipo_pessoa": tipo,
                    }
                )
            await bulk_insert(session, m.DimPerson.__table__, rows, args.batch_size)
            await session.commit()
            stats["people"] = len(rows)
            print(f"[seed] people: {len(rows)} ok, {skipped_type} ignoradas (vazia/tipo inválido)")

        # --- 4. Filmes ---
        movie_ids: set[str] = set()
        if need("movies"):
            rows, seen_ids, seen_idfilme = [], set(), set()
            skipped = 0
            for r in read_csv(dados / "dim" / "dim_movies.csv", args.limit):
                sk = clean_str(r.get("sk_movie_id"))
                id_filme = req_str(r.get("id_filme"), LIMITS["id_filme"], "id_filme", sk or "?")
                titulo = req_str(r.get("titulo"), LIMITS["titulo"], "titulo", sk or "?")
                if sk is None or id_filme is None or titulo is None:
                    skipped += 1
                    continue
                if sk in seen_ids or id_filme in seen_idfilme:
                    skipped += 1
                    continue
                seen_ids.add(sk)
                seen_idfilme.add(id_filme)
                movie_ids.add(sk)
                rows.append(
                    {
                        "sk_movie_id": sk,
                        "id_filme": id_filme,
                        "titulo": titulo,
                        "data_lancamento": parse_date(r.get("data_lancamento"), "data_lancamento"),
                        "ano_lancamento": parse_int(r.get("ano_lancamento"), "ano_lancamento"),
                        "duracao_minutos": parse_int(r.get("duracao_minutos"), "duracao_minutos"),
                        "status_filme": clean_str(r.get("status_filme"), 50, "status_filme", sk),
                        "sinopse": clean_str(r.get("sinopse"), LIMITS["sinopse"], "sinopse", sk),
                        "url_poster": clean_str(
                            r.get("url_poster"), LIMITS["url"], "url_poster", sk
                        ),
                        "url_backdrop": clean_str(
                            r.get("url_backdrop"), LIMITS["url"], "url_backdrop", sk
                        ),
                    }
                )
            await bulk_insert(session, m.DimMovie.__table__, rows, args.batch_size)
            await session.commit()
            stats["movies"] = len(rows)
            print(f"[seed] movies: {len(rows)} ok, {skipped} ignorados")
        else:
            # Etapas seguintes precisam dos ids existentes.
            res = await session.execute(select(m.DimMovie.__table__.c.sk_movie_id))
            movie_ids = {row[0] for row in res.all()}

        # --- 5. Performance financeira ---
        if need("performance"):
            rows = []
            for r in read_csv(dados / "fact_movies_performance.csv", args.limit):
                sk = clean_str(r.get("sk_movie_id"))
                if sk is None or sk not in movie_ids:
                    continue
                rows.append(
                    {
                        "sk_movie_id": sk,
                        "orcamento_usd": parse_decimal(r.get("orcamento_usd"), "orcamento_usd"),
                        "receita_usd": parse_decimal(r.get("receita_usd"), "receita_usd"),
                        "lucro_usd": parse_decimal(r.get("lucro_usd"), "lucro_usd"),
                        "orcamento_brl": parse_decimal(r.get("orcamento_brl"), "orcamento_brl"),
                        "receita_brl": parse_decimal(r.get("receita_brl"), "receita_brl"),
                        "lucro_brl": parse_decimal(r.get("lucro_brl"), "lucro_brl"),
                        "popularidade": parse_float(r.get("popularidade"), "popularidade"),
                        "nota_tmdb": parse_float(r.get("nota_tmdb"), "nota_tmdb"),
                        "qtd_tmdb": parse_int(r.get("qtd_tmdb"), "qtd_tmdb"),
                        "nota_imdb": parse_float(r.get("nota_imdb"), "nota_imdb"),
                        "qtd_imdb": parse_int(r.get("qtd_imdb"), "qtd_imdb"),
                    }
                )
            await bulk_insert(session, m.FactMoviePerformance.__table__, rows, args.batch_size)
            await session.commit()
            stats["performance"] = len(rows)
            print(f"[seed] performance: {len(rows)} linhas")

        # --- 6. Resumo de avaliações (dim_reviews) ---
        # Filme sem avaliação NÃO ganha linha (decisão do projeto): pula
        # resumos vazios (qtd 0) em vez de guardar informação vazia.
        if need("dim_reviews"):
            rows, skipped_empty = [], 0
            for r in read_csv(dados / "dim" / "dim_reviews.csv", args.limit):
                sk_movie = clean_str(r.get("sk_movie_id"))
                if sk_movie is None or sk_movie not in movie_ids:
                    continue
                qtd = parse_int(r.get("qtd_avaliacoes_usuarios"), "qtd_avaliacoes_usuarios")
                if qtd <= 0:
                    skipped_empty += 1
                    continue
                media = parse_float(r.get("nota_media_usuarios"), "nota_media_usuarios")
                rows.append(
                    {
                        "sk_review_id": clean_str(r.get("sk_review_id"))
                        or m.generate_surrogate_key(),
                        "sk_movie_id": sk_movie,
                        "qtd_avaliacoes_usuarios": qtd,
                        "nota_media_usuarios": media,
                    }
                )
            await bulk_insert(session, m.DimReview.__table__, rows, args.batch_size)
            await session.commit()
            stats["dim_reviews"] = len(rows)
            print(f"[seed] dim_reviews: {len(rows)} linhas, {skipped_empty} vazias puladas")

        # --- 7. Avaliações individuais (nota 0-10, FK válida) ---
        # Regras: nome vazio -> "Anônimo"; comentário vazio -> "" (a crítica
        # é opcional no design, mas a coluna é NOT NULL); sem nota válida a
        # linha é pulada — inventar 0.0 fabricaria uma avaliação falsa e
        # corromperia as médias.
        new_review_groups: dict[str, list[float]] = {}
        if need("movie_reviews"):
            res = await session.execute(select(m.MovieReview.__table__.c.sk_movie_review_id))
            existing_review_ids = {row[0] for row in res.all()}
            rows, skipped_nota, skipped_fk, skipped_dup = [], 0, 0, 0
            for r in read_csv(dados / "movies_reviews.csv", args.limit):
                sk_movie = clean_str(r.get("sk_movie_id"))
                if sk_movie is None or sk_movie not in movie_ids:
                    skipped_fk += 1
                    continue
                nota_raw = (r.get("nota") or "").strip().replace(",", ".")
                try:
                    nota = float(nota_raw)
                except ValueError:
                    skipped_nota += 1
                    continue
                if not (0 <= nota <= 10):
                    skipped_nota += 1
                    continue
                sk_review = clean_str(r.get("sk_movie_review_id"))
                if sk_review is None or sk_review in existing_review_ids:
                    skipped_dup += 1
                    continue
                existing_review_ids.add(sk_review)
                nome = req_str(
                    r.get("nome"), LIMITS["nome_review"], "review_nome", sk_review
                ) or ANONYMOUS_REVIEWER
                comentario = clean_str(
                    r.get("comentario"), LIMITS["comentario"], "comentario", sk_review
                ) or ""
                rows.append(
                    {
                        "sk_movie_review_id": sk_review,
                        "sk_movie_id": sk_movie,
                        "nome": nome,
                        "nota": nota,
                        "comentario": comentario,
                    }
                )
                new_review_groups.setdefault(sk_movie, []).append(nota)
            await bulk_insert(session, m.MovieReview.__table__, rows, args.batch_size)
            await session.commit()
            stats["movie_reviews"] = len(rows)
            print(
                f"[seed] movie_reviews: {len(rows)} novas, "
                f"{skipped_nota} sem nota válida, {skipped_fk} sem filme, "
                f"{skipped_dup} duplicadas/ignoradas"
            )

        # --- 7b. Merge incremental em dim_reviews ---
        # Só as avaliações NOVAS desta execução entram na média, via
        # incremental_mean (preserva o acumulado anterior). Reexecuções
        # são seguras: nada é somado duas vezes. Filmes com avaliações
        # mas sem resumo ganham a linha aqui (não se perde filme).
        if need("dim_reviews") and need("movie_reviews") and new_review_groups:
            dim_tbl = m.DimReview.__table__
            affected = list(new_review_groups)
            existing: dict[str, tuple[int, float | None]] = {}
            for i in range(0, len(affected), 500):
                chunk = affected[i : i + 500]
                res = await session.execute(
                    select(
                        dim_tbl.c.sk_movie_id,
                        dim_tbl.c.qtd_avaliacoes_usuarios,
                        dim_tbl.c.nota_media_usuarios,
                    ).where(dim_tbl.c.sk_movie_id.in_(chunk))
                )
                for sk_movie, qtd, media in res.all():
                    existing[sk_movie] = (qtd, media)
            to_update, to_insert = [], []
            for sk_movie, notas in new_review_groups.items():
                old_qtd, old_avg = existing.get(sk_movie, (0, None))
                new_qtd, new_avg = incremental_mean(old_avg, old_qtd, notas)
                if sk_movie in existing:
                    to_update.append(
                        {"b_sk_movie_id": sk_movie, "qtd": new_qtd, "media": new_avg}
                    )
                else:
                    to_insert.append(
                        {
                            "sk_review_id": m.generate_surrogate_key(),
                            "sk_movie_id": sk_movie,
                            "qtd_avaliacoes_usuarios": new_qtd,
                            "nota_media_usuarios": new_avg,
                        }
                    )
            if to_update:
                upd = (
                    update(dim_tbl)
                    .where(dim_tbl.c.sk_movie_id == bindparam("b_sk_movie_id"))
                    .values(
                        qtd_avaliacoes_usuarios=bindparam("qtd"),
                        nota_media_usuarios=bindparam("media"),
                    )
                )
                for i in range(0, len(to_update), args.batch_size):
                    await session.execute(upd, to_update[i : i + args.batch_size])
            if to_insert:
                await bulk_insert(session, dim_tbl, to_insert, args.batch_size)
            await session.commit()
            print(
                f"[seed] dim_reviews merge incremental: "
                f"{len(to_update)} atualizados, {len(to_insert)} criados"
            )

        # --- 8. Bridges (só pares com FK existente, deduplicados) ---
        if need("bridges"):
            res = await session.execute(select(m.DimGenre.__table__.c.sk_genre_id))
            genre_ids = {row[0] for row in res.all()}
            res = await session.execute(select(m.DimCompany.__table__.c.sk_company_id))
            company_ids = {row[0] for row in res.all()}
            res = await session.execute(select(m.DimPerson.__table__.c.sk_person_id))
            person_ids = {row[0] for row in res.all()}
            log(f"[seed] FKs no banco: movies={len(movie_ids)} genres={len(genre_ids)}")

            def load_bridge(fname: str, left: str, right: str, valid_l: set, valid_r: set):
                pairs, seen = [], set()
                for r in read_csv(dados / "bridge" / fname, args.limit):
                    a, b = clean_str(r.get(left)), clean_str(r.get(right))
                    if a is None or b is None or a not in valid_l or b not in valid_r:
                        continue
                    if (a, b) in seen:
                        continue
                    seen.add((a, b))
                    pairs.append({left: a, right: b})
                return pairs

            bg = load_bridge(
                "bridge_movie_genre.csv", "sk_movie_id", "sk_genre_id", movie_ids, genre_ids
            )
            await bulk_insert(session, m.bridge_movie_genre, bg, args.batch_size)
            await session.commit()
            print(f"[seed] bridge_movie_genre: {len(bg)}")

            bc = load_bridge(
                "bridge_movie_company.csv",
                "sk_movie_id",
                "sk_company_id",
                movie_ids,
                company_ids,
            )
            await bulk_insert(session, m.bridge_movie_company, bc, args.batch_size)
            await session.commit()
            print(f"[seed] bridge_movie_company: {len(bc)}")

            bp = load_bridge(
                "bridge_movie_person.csv", "sk_movie_id", "sk_person_id", movie_ids, person_ids
            )
            await bulk_insert(session, m.bridge_movie_person, bp, args.batch_size)
            await session.commit()
            print(f"[seed] bridge_movie_person: {len(bp)}")
            stats["bridges"] = len(bg) + len(bc) + len(bp)

        # Contagem final.
        print("[seed] contagem final no banco:")
        async with Session() as s2:
            for label, table in [
                ("dim_genres", m.DimGenre.__table__),
                ("dim_companies", m.DimCompany.__table__),
                ("dim_people", m.DimPerson.__table__),
                ("dim_movies", m.DimMovie.__table__),
                ("fact_movies_performance", m.FactMoviePerformance.__table__),
                ("dim_reviews", m.DimReview.__table__),
                ("movie_reviews", m.MovieReview.__table__),
                ("bridge_movie_genre", m.bridge_movie_genre),
                ("bridge_movie_company", m.bridge_movie_company),
                ("bridge_movie_person", m.bridge_movie_person),
            ]:
                try:
                    n = await table_count(s2, table)
                    print(f"  {label}: {n}")
                except Exception as exc:  # noqa: BLE001
                    print(f"  {label}: erro ({exc})")

    await engine.dispose()
    if fallback_stats:
        print("[seed] valores padrão aplicados (vazio/ilegível -> mínimo do tipo):")
        for field, n in sorted(fallback_stats.items()):
            print(f"  {field}: {n}")
    else:
        print("[seed] valores padrão aplicados: nenhum (todos os campos vieram preenchidos)")
    if trunc_stats:
        print("[seed] ATENÇÃO — truncamento de texto (dado maior que a coluna):")
        for field, n in sorted(trunc_stats.items()):
            print(f"  {field}: {n} ocorrências, ex.: {trunc_examples.get(field, [])}")
        print("[seed] Se houver truncamento real, migre a coluna para TEXT via Alembic.")
    else:
        print("[seed] truncamento de texto: 0 ocorrências — nenhum dado perdido")
    print("[seed] concluído:", {k: v for k, v in stats.items()})


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
