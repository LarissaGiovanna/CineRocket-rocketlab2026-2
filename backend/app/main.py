from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

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
from app.movies.schemas import MovieCard, MovieDetail, MovieListResponse

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
        
    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}
    

    return app


app = create_app()
