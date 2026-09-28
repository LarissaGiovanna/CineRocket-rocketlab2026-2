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


async def test_get_movie_reviews_not_found_retorna_lista_vazia() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/movies/id-que-nao-existe/reviews")

    assert response.status_code == 200
    assert response.json() == []


async def test_get_movie_reviews_shape() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        listing = await client.get("/movies", params={"page": 1, "page_size": 50})
        items = listing.json()["items"]
        if not items:
            pytest.skip("banco sem filmes (rode scripts/seed.py)")
        for item in items:
            response = await client.get(f"/movies/{item['id']}/reviews")
            assert response.status_code == 200
            if response.json():
                break
        else:
            pytest.skip("nenhum filme da amostra tem avaliações")

    body = response.json()
    assert isinstance(body, list) and len(body) > 0
    for review in body:
        assert {"nome", "nota", "comentario", "data"} <= set(review)


async def test_get_movie_reviews_vazias_retorna_lista_vazia() -> None:
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
            assert reviews.status_code == 200
            if reviews.json() == []:
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
        {"nome": "Ada", "nota": "alta"},  # não é double
        {"nome": "   ", "nota": 5},  # nome vazio
        {"nome": "Ada", "nota": 5, "comentario": "x" * 4001},  # comentário longo
        {"nota": 5},  # sem nome
    ],
)
async def test_post_review_entrada_invalida(review_client, payload: dict) -> None:
    response = await review_client.post("/movies/filme-teste-1/reviews", json=payload)

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("nota_enviada", "nota_salva"),
    [(11, 10.0), (15.5, 10.0), (-1, 0.0), (-20, 0.0)],
)
async def test_post_review_nota_fora_da_escala_e_trazida_para_dentro(
    review_client, nota_enviada: float, nota_salva: float
) -> None:
    response = await review_client.post(
        "/movies/filme-teste-1/reviews", json={"nome": "Ada", "nota": nota_enviada}
    )

    assert response.status_code == 201
    assert response.json()["review"]["nota"] == nota_salva


@pytest.fixture
async def movie_client(tmp_path):
    """Client com banco temporário + generos e 1 diretora (POST /movies não suja o real)."""
    from app.movies.models import DimGenre, DimPerson

    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/movies.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with session_factory() as session:
        session.add(DimGenre(sk_genre_id="g1", nome_genero="Drama"))
        session.add(DimGenre(sk_genre_id="g2", nome_genero="Comédia"))
        session.add(
            DimPerson(sk_person_id="p1", nome_pessoa="Diretora Existente", tipo_pessoa="Diretor")
        )
        await session.commit()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, session_factory
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


async def test_post_movie_ok(movie_client) -> None:
    import re

    from sqlalchemy import func, select

    from app.movies.models import DimMovie, DimPerson

    client, session_factory = movie_client
    response = await client.post(
        "/movies",
        json={
            "titulo": "Filme Novo",
            "diretores": ["Diretora Existente", "Diretor Novo", "Diretor Novo "],
            "ano_lancamento": 2024,
            "generos": ["Drama", "Comédia"],
            "sinopse": "Uma sinopse.",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert re.fullmatch(r"\d{6}", body["id"])
    assert body["titulo"] == "Filme Novo"
    assert body["diretores"] == ["Diretora Existente", "Diretor Novo"]
    assert body["generos"] == ["Drama", "Comédia"]

    detail = await client.get(f"/movies/{body['id']}")
    assert detail.status_code == 200
    assert detail.json()["titulo"] == "Filme Novo"

    async with session_factory() as session:
        directors = (
            await session.execute(
                select(DimPerson).where(
                    DimPerson.tipo_pessoa == "Diretor",
                    DimPerson.nome_pessoa == "Diretor Novo",
                )
            )
        ).scalars()
        assert len(directors.all()) == 1  # criado 1x, sem duplicar
        movies = (await session.execute(select(func.count()).select_from(DimMovie))).scalar()
        assert movies == 1


async def test_post_movie_genero_inexistente_400(movie_client) -> None:
    from sqlalchemy import func, select

    from app.movies.models import DimMovie, DimPerson

    client, session_factory = movie_client
    before_movies = before_people = None
    async with session_factory() as session:
        before_movies = (
            await session.execute(select(func.count()).select_from(DimMovie))
        ).scalar()
        before_people = (
            await session.execute(select(func.count()).select_from(DimPerson))
        ).scalar()

    response = await client.post(
        "/movies",
        json={
            "titulo": "Filme X",
            "diretores": ["Alguém Novo"],
            "ano_lancamento": 2024,
            "generos": ["Drama", "Inventado"],
            "sinopse": "Y.",
        },
    )

    assert response.status_code == 400
    assert "Inventado" in response.json()["detail"]

    async with session_factory() as session:
        after_movies = (await session.execute(select(func.count()).select_from(DimMovie))).scalar()
        after_people = (await session.execute(select(func.count()).select_from(DimPerson))).scalar()
    assert after_movies == before_movies  # nada escrito: nem filme...
    assert after_people == before_people  # ...nem diretor novo


async def test_post_movie_ids_unicos(movie_client) -> None:
    client, _ = movie_client
    ids = set()
    for i in range(3):
        response = await client.post(
            "/movies",
            json={
                "titulo": f"F {i}",
                "diretores": ["Diretora Existente"],
                "ano_lancamento": 2024,
                "generos": ["Drama"],
                "sinopse": "Y.",
            },
        )
        assert response.status_code == 201
        ids.add(response.json()["id"])

    assert len(ids) == 3


async def _post_filme(client, titulo="F Base", diretores=None, generos=None):
    response = await client.post(
        "/movies",
        json={
            "titulo": titulo,
            "diretores": diretores or ["Diretora Existente"],
            "ano_lancamento": 2024,
            "generos": generos or ["Drama"],
            "sinopse": "Base.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_put_movie_ok(movie_client) -> None:
    client, _ = movie_client
    created = await _post_filme(client, titulo="Antes")

    response = await client.put(
        f"/movies/{created['id']}",
        json={
            "titulo": "Depois",
            "diretores": ["Diretora Existente"],
            "ano_lancamento": 2025,
            "generos": ["Comédia"],
            "sinopse": "Nova sinopse.",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == created["id"]
    assert body["titulo"] == "Depois"
    assert body["ano_lancamento"] == 2025
    assert body["generos"] == ["Comédia"]
    assert body["diretores"] == ["Diretora Existente"]

    detail = (await client.get(f"/movies/{created['id']}")).json()
    assert detail["titulo"] == "Depois" and detail["generos"] == ["Comédia"]


async def test_put_movie_diretor_novo_renomeia_mesma_linha(movie_client) -> None:
    from sqlalchemy import select

    from app.movies.models import DimPerson

    client, session_factory = movie_client
    created = await _post_filme(client)
    async with session_factory() as session:
        old_sk = (
            await session.execute(
                select(DimPerson.sk_person_id).where(
                    DimPerson.nome_pessoa == "Diretora Existente",
                    DimPerson.tipo_pessoa == "Diretor",
                )
            )
        ).scalar_one()

    response = await client.put(
        f"/movies/{created['id']}",
        json={
            "titulo": "F Base",
            "diretores": ["Estreante Total"],
            "ano_lancamento": 2024,
            "generos": ["Drama"],
            "sinopse": "Base.",
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["diretores"] == ["Estreante Total"]
    async with session_factory() as session:
        row = (
            await session.execute(
                select(DimPerson).where(DimPerson.sk_person_id == old_sk)
            )
        ).scalar_one()
        assert row.nome_pessoa == "Estreante Total"  # mesma linha, renomeada
        old = (
            await session.execute(
                select(DimPerson).where(DimPerson.nome_pessoa == "Diretora Existente")
            )
        ).scalars()
        assert old.all() == []


async def test_put_movie_diretor_de_outro_filme_400(movie_client) -> None:
    client, _ = movie_client
    filme_a = await _post_filme(client, titulo="Filme A", diretores=["Dona A"])
    filme_b = await _post_filme(client, titulo="Filme B")

    response = await client.put(
        f"/movies/{filme_b['id']}",
        json={
            "titulo": "Filme B Alterado",
            "diretores": ["Dona A"],
            "ano_lancamento": 2024,
            "generos": ["Drama"],
            "sinopse": "Base.",
        },
    )

    assert response.status_code == 400
    assert "Dona A" in response.json()["detail"]

    detail_b = (await client.get(f"/movies/{filme_b['id']}")).json()
    assert detail_b["titulo"] == "Filme B"  # nada foi alterado
    assert detail_b["diretores"] == ["Diretora Existente"]
    detail_a = (await client.get(f"/movies/{filme_a['id']}")).json()
    assert detail_a["diretores"] == ["Dona A"]


async def test_put_movie_genero_inexistente_400(movie_client) -> None:
    client, _ = movie_client
    created = await _post_filme(client, titulo="Intocado")

    response = await client.put(
        f"/movies/{created['id']}",
        json={
            "titulo": "Mudado",
            "diretores": ["Diretora Existente"],
            "ano_lancamento": 2024,
            "generos": ["Inventado"],
            "sinopse": "Base.",
        },
    )

    assert response.status_code == 400
    detail = (await client.get(f"/movies/{created['id']}")).json()
    assert detail["titulo"] == "Intocado" and detail["generos"] == ["Drama"]


async def test_put_movie_not_found(movie_client) -> None:
    client, _ = movie_client
    response = await client.put(
        "/movies/00000",
        json={
            "titulo": "X",
            "diretores": ["Diretora Existente"],
            "ano_lancamento": 2024,
            "generos": ["Drama"],
            "sinopse": "Y.",
        },
    )

    assert response.status_code == 404


async def test_put_movie_sem_diretor_segue_logica_do_post(movie_client) -> None:
    from sqlalchemy import func, select

    from app.movies.models import DimMovie, DimPerson

    client, session_factory = movie_client
    async with session_factory() as session:
        session.add(DimMovie(sk_movie_id="sk-sem-dir", id_filme="semdir", titulo="Sem Dir"))
        await session.commit()

    first = await client.put(
        "/movies/semdir",
        json={
            "titulo": "Sem Dir",
            "diretores": ["Novato"],
            "ano_lancamento": 2024,
            "generos": ["Drama"],
            "sinopse": "Base.",
        },
    )
    assert first.status_code == 200, first.text
    assert first.json()["diretores"] == ["Novato"]

    async with session_factory() as session:
        session.add(DimMovie(sk_movie_id="sk-sem-dir2", id_filme="semdir2", titulo="Sem Dir 2"))
        await session.commit()

    second = await client.put(
        "/movies/semdir2",
        json={
            "titulo": "Sem Dir 2",
            "diretores": ["Novato"],
            "ano_lancamento": 2024,
            "generos": ["Drama"],
            "sinopse": "Base.",
        },
    )
    assert second.status_code == 200

    async with session_factory() as session:
        count = (
            await session.execute(
                select(func.count())
                .select_from(DimPerson)
                .where(DimPerson.nome_pessoa == "Novato")
            )
        ).scalar()
    assert count == 1  # reaproveitado, não duplicado
