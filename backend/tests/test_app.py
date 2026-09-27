import httpx
import pytest

from app.main import app


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
