from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import engine, get_db
from app.movies import models as movies_models
from app.movies.schemas import MovieCard, MovieListResponse

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

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}
    

    return app


app = create_app()
