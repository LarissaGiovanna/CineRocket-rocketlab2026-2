import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.movies.models import DimMovie


async def test_health_check() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_get_movie_by_id_not_found() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/movies/id-que-nao-existe")

    assert response.status_code == 404


async def test_get_movie_by_id_ok() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        listing = await client.get("/movies", params={"page": 1, "page_size": 1})
        items = listing.json()["items"]
        if not items:
            pytest.skip("banco sem filmes (rode scripts/seed.py)")
        response = await client.get(f"/movies/{items[0]['id']}")

    assert response.status_code == 200
    body = response.json()
    assert {"id", "titulo", "generos", "diretores", "atores"} <= set(body)
    assert isinstance(body["diretores"], list)
    assert isinstance(body["atores"], list)


async def test_get_movie_reviews_not_found() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/movies/id-que-nao-existe/reviews")

    assert response.status_code == 404


async def test_get_movie_reviews_shape() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        listing = await client.get("/movies", params={"page": 1, "page_size": 50})
        items = listing.json()["items"]
        if not items:
            pytest.skip("banco sem filmes (rode scripts/seed.py)")
        for item in items:
            response = await client.get(f"/movies/{item['id']}/reviews")
            if response.status_code == 200:
                break
        else:
            pytest.skip("nenhum filme da amostra tem avaliações")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list) and len(body) > 0
    for review in body:
        assert {"nome", "nota", "comentario", "data"} <= set(review)


async def test_get_movie_reviews_vazias_retorna_404() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        listing = await client.get("/movies", params={"page": 1, "page_size": 50})
        items = listing.json()["items"]
        if not items:
            pytest.skip("banco sem filmes (rode scripts/seed.py)")
        for item in items:
            detail = await client.get(f"/movies/{item['id']}")
            assert detail.status_code == 200  # filme existe...
            reviews = await client.get(f"/movies/{item['id']}/reviews")
            if reviews.status_code == 404:
                assert reviews.json()["detail"] == "Filme ainda não possui avaliações"
                return
        pytest.skip("todos os filmes da amostra têm avaliações")


@pytest.fixture
async def review_client(tmp_path):
    """Client com banco temporário (o POST não suja o rocketlab.db)."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/reviews.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with session_factory() as session:
        session.add(DimMovie(sk_movie_id="sk-teste-1", id_filme="filme-teste-1", titulo="F Teste"))
        await session.commit()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


async def test_post_review_cria_e_atualiza_resumo(review_client) -> None:
    first = await review_client.post(
        "/movies/filme-teste-1/reviews",
        json={"nome": "Ada", "nota": 8, "comentario": "Ótimo!"},
    )
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["review"]["nome"] == "Ada" and body["review"]["nota"] == 8.0
    assert body["review"]["data"] is not None
    assert body["qtd_avaliacoes_usuarios"] == 1
    assert body["nota_media_usuarios"] == 8.0

    second = await review_client.post(
        "/movies/filme-teste-1/reviews", json={"nome": "Bob", "nota": 6}
    )
    assert second.status_code == 201
    assert second.json()["qtd_avaliacoes_usuarios"] == 2
    assert second.json()["nota_media_usuarios"] == 7.0  # (8+6)/2

    detail = (await review_client.get("/movies/filme-teste-1")).json()
    assert detail["qtd_avaliacoes"] == 2
    assert detail["nota_media"] == 7.0


async def test_post_review_filme_inexistente(review_client) -> None:
    response = await review_client.post(
        "/movies/nao-existe/reviews", json={"nome": "Ada", "nota": 5}
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"nome": "Ada", "nota": 11},  # acima da escala
        {"nome": "Ada", "nota": -1},  # abaixo da escala
        {"nome": "Ada", "nota": "alta"},  # não é double
        {"nome": "   ", "nota": 5},  # nome vazio
        {"nome": "Ada", "nota": 5, "comentario": "x" * 4001},  # comentário longo
        {"nota": 5},  # sem nome
    ],
)
async def test_post_review_entrada_invalida(review_client, payload: dict) -> None:
    response = await review_client.post("/movies/filme-teste-1/reviews", json=payload)

    assert response.status_code == 422
