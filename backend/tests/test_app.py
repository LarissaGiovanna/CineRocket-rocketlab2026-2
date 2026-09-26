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
