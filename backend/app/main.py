from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import engine, get_db
from app.movies import models as movies_models
from app.movies.schemas import (
    MovieCard,
    MovieCreate,
    MovieDetail,
    MovieListResponse,
    MovieReviewCreate,
    MovieReviewCreatedResponse,
    MovieReviewItem,
)

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Libera recursos de infraestrutura quando a aplicação é encerrada."""

    del app
    # A criação/evolução do schema é responsabilidade exclusiva do Alembic.
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.project_name,
        version=settings.project_version,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["root"])
    async def root() -> dict[str, str]:
        return {"message": "Hello World!"}
    
    @app.get("/movies", tags=["movies"], response_model=MovieListResponse)
    async def get_movies(
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=20, ge=1, le=100),
        query: str = Query(default=""),
        db: AsyncSession = Depends(get_db),
    ) -> MovieListResponse:
        stmt = (
            select(movies_models.DimMovie, movies_models.DimReview)
            .outerjoin(
                movies_models.DimReview,
                movies_models.DimReview.sk_movie_id == movies_models.DimMovie.sk_movie_id,
            )
            .order_by(movies_models.DimMovie.titulo)
        )
        if query.strip():
            stmt = stmt.where(movies_models.DimMovie.titulo.ilike(f"%{query.strip()}%"))

        total = (
            await db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar() or 0
        rows = (
            await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
        ).all()

        return MovieListResponse(
            items=[
                MovieCard(
                    id=movie.id_filme,
                    titulo=movie.titulo,
                    url_poster=movie.url_poster,
                    nota_media=review.nota_media_usuarios if review else None,
                )
                for movie, review in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
        )

    @app.get("/movies/{movie_id}", tags=["movies"], response_model=MovieDetail)
    async def get_movie_by_id(
        movie_id: str, db: AsyncSession = Depends(get_db)
    ) -> MovieDetail:
        """Busca um filme pelo ``id`` (coluna ``id_filme``).

        Traz gêneros, pessoas, performance e resumo das avaliações com
        ``selectinload`` (uma query por relação, sem N+1 e sem duplicar
        linhas). Filme inexistente -> 404.
        """
        stmt = (
            select(movies_models.DimMovie)
            .where(movies_models.DimMovie.id_filme == movie_id)
            .options(
                selectinload(movies_models.DimMovie.genres),
                selectinload(movies_models.DimMovie.people),
                selectinload(movies_models.DimMovie.performance),
                selectinload(movies_models.DimMovie.reviews_summary),
            )
        )
        movie = (await db.execute(stmt)).scalar_one_or_none()
        if movie is None:
            raise HTTPException(status_code=404, detail="Filme não encontrado")

        perf = movie.performance
        summary = movie.reviews_summary

        def _num(value):  # type: ignore[no-untyped-def]
            return float(value) if value is not None else None

        return MovieDetail(
            id=movie.id_filme,
            titulo=movie.titulo,
            ano_lancamento=movie.ano_lancamento,
            sinopse=movie.sinopse,
            url_poster=movie.url_poster,
            generos=[g.nome_genero for g in movie.genres],
            diretores=[
                p.nome_pessoa for p in movie.people if p.tipo_pessoa == "Diretor"
            ],
            atores=[p.nome_pessoa for p in movie.people if p.tipo_pessoa == "Ator"],
            orcamento_usd=_num(perf.orcamento_usd) if perf else None,
            receita_usd=_num(perf.receita_usd) if perf else None,
            lucro_usd=_num(perf.lucro_usd) if perf else None,
            popularidade=perf.popularidade if perf else None,
            nota_tmdb=perf.nota_tmdb if perf else None,
            qtd_tmdb=perf.qtd_tmdb if perf else None,
            nota_imdb=perf.nota_imdb if perf else None,
            qtd_imdb=perf.qtd_imdb if perf else None,
            qtd_avaliacoes=summary.qtd_avaliacoes_usuarios if summary else None,
            nota_media=summary.nota_media_usuarios if summary else None,
        )

    @app.get("/movies/{movie_id}/reviews", tags=["movies"], response_model=list[MovieReviewItem])
    async def get_movie_reviews(
        movie_id: str, db: AsyncSession = Depends(get_db)
    ) -> list[MovieReviewItem]:
        """Lista as avaliações individuais de um filme (mais recentes primeiro).

        Filme inexistente -> 404; filme sem avaliações -> 404 com mensagem
        própria (o front distingue pelo ``detail``).
        """
        sk_movie_id = (
            await db.execute(
                select(movies_models.DimMovie.sk_movie_id).where(
                    movies_models.DimMovie.id_filme == movie_id
                )
            )
        ).scalar_one_or_none()
        if sk_movie_id is None:
            raise HTTPException(status_code=404, detail="Filme não encontrado")

        rows = (
            await db.execute(
                select(movies_models.MovieReview)
                .where(movies_models.MovieReview.sk_movie_id == sk_movie_id)
                .order_by(movies_models.MovieReview.created_at.desc())
            )
        ).scalars()
        items = [
            MovieReviewItem(
                nome=r.nome, nota=r.nota, comentario=r.comentario, data=r.created_at
            )
            for r in rows
        ]
        return items
    
    @app.post(
        "/movies", tags=["movies"], response_model=MovieDetail, status_code=201
    )
    async def create_movie(
        payload: MovieCreate, db: AsyncSession = Depends(get_db)
    ) -> MovieDetail:
        """Cadastra um filme (formulário Adicionar Filme).

        1. Listas já vêm normalizadas pelo schema (strip, sem vazios/duplicados).
        2. Gêneros precisam existir no banco — se algum não existir, 400
           e nada é escrito.
        3. Diretores inexistentes são criados (tipo "Diretor"); os
           existentes são reaproveitados.
        4. ``id_filme`` é gerado via ``uuid4`` na faixa 000000–999999,
           verificando colisão com os ids já cadastrados.
        """
        genre_rows = (
            await db.execute(
                select(movies_models.DimGenre).where(
                    movies_models.DimGenre.nome_genero.in_(payload.generos)
                )
            )
        ).scalars()
        found_genres = {g.nome_genero: g for g in genre_rows}
        missing = [g for g in payload.generos if g not in found_genres]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Gêneros não cadastrados: {', '.join(missing)}",
            )

        person_rows = (
            await db.execute(
                select(movies_models.DimPerson).where(
                    movies_models.DimPerson.tipo_pessoa == "Diretor",
                    movies_models.DimPerson.nome_pessoa.in_(payload.diretores),
                )
            )
        ).scalars()
        directors = {p.nome_pessoa: p for p in person_rows}
        for name in payload.diretores:
            if name not in directors:
                person = movies_models.DimPerson(
                    sk_person_id=movies_models.generate_surrogate_key(),
                    nome_pessoa=name,
                    tipo_pessoa="Diretor",
                )
                db.add(person)
                directors[name] = person

        existing_ids = set(
            (
                await db.execute(select(movies_models.DimMovie.id_filme))
            ).scalars()
        )
        for _ in range(100000):
            candidate = f"{uuid4().int % 1000000:06d}"
            if candidate not in existing_ids:
                break
        else:
            raise HTTPException(status_code=500, detail="Não foi possível gerar um id único")

        movie = movies_models.DimMovie(
            sk_movie_id=movies_models.generate_surrogate_key(),
            id_filme=candidate,
            titulo=payload.titulo,
            ano_lancamento=payload.ano_lancamento,
            sinopse=payload.sinopse,
            genres=[found_genres[g] for g in payload.generos],
            people=[directors[n] for n in payload.diretores],
        )
        db.add(movie)
        # se dois filmes forem cadastrados ao mesmo tempo, pode haver colisão de id_filme; o commit falha e o rollback é feito
        try:
            await db.commit()
        except sqlalchemy.exc.IntegrityError as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao salvar o filme: {str(e)}")

        return MovieDetail(
            id=candidate,
            titulo=payload.titulo,
            ano_lancamento=payload.ano_lancamento,
            sinopse=payload.sinopse,
            generos=list(payload.generos),
            diretores=list(payload.diretores),
        )

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    @app.post(
        "/movies/{movie_id}/reviews",
        tags=["movies"],
        response_model=MovieReviewCreatedResponse,
        status_code=201,
    )
    async def create_movie_review(
        movie_id: str, payload: MovieReviewCreate, db: AsyncSession = Depends(get_db)
    ) -> MovieReviewCreatedResponse:
        """Cria uma avaliação (nome/comentário strings, nota double 0–10).

        Filme inexistente -> 404. O resumo (dim_reviews) é atualizado de
        forma incremental, com a média gravada em 2 casas decimais:
        ``nova_media = round((media*qtd + nota)/(qtd+1), 2)``.
        Retorna a review criada + média e quantidade atualizadas.
        """
        sk_movie_id = (
            await db.execute(
                select(movies_models.DimMovie.sk_movie_id).where(
                    movies_models.DimMovie.id_filme == movie_id
                )
            )
        ).scalar_one_or_none()
        if sk_movie_id is None:
            raise HTTPException(status_code=404, detail="Filme não encontrado")

        review = movies_models.MovieReview(
            sk_movie_review_id=movies_models.generate_surrogate_key(),
            sk_movie_id=sk_movie_id,
            nome=payload.nome,
            nota=payload.nota,
            comentario=payload.comentario,
        )
        db.add(review)

        summary = (
            await db.execute(
                select(movies_models.DimReview).where(
                    movies_models.DimReview.sk_movie_id == sk_movie_id
                )
            )
        ).scalar_one_or_none()
        if summary is None:
            new_qtd, new_avg = 1, round(payload.nota, 2)
            db.add(
                movies_models.DimReview(
                    sk_review_id=movies_models.generate_surrogate_key(),
                    sk_movie_id=sk_movie_id,
                    qtd_avaliacoes_usuarios=new_qtd,
                    nota_media_usuarios=new_avg,
                )
            )
        else:
            old_qtd = summary.qtd_avaliacoes_usuarios or 0
            old_avg = summary.nota_media_usuarios or 0.0
            new_qtd = old_qtd + 1
            new_avg = round((old_avg * old_qtd + payload.nota) / new_qtd, 2)
            summary.qtd_avaliacoes_usuarios = new_qtd
            summary.nota_media_usuarios = new_avg

        await db.commit()
        await db.refresh(review)
        return MovieReviewCreatedResponse(
            review=MovieReviewItem(
                nome=review.nome,
                nota=review.nota,
                comentario=review.comentario,
                data=review.created_at,
            ),
            nota_media_usuarios=new_avg,
            qtd_avaliacoes_usuarios=new_qtd,
        )
    return app


app = create_app()
