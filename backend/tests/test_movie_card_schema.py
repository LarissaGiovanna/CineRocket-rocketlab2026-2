import pytest
from pydantic import ValidationError

from app.movies.schemas import MovieCard


def test_movie_card_minimo_valido() -> None:
    card = MovieCard(id="14564", titulo="Rings")

    assert card.id == "14564"
    assert card.id_filme == "14564"
    assert card.url_poster is None
    assert card.nota_media is None
    assert card.model_dump(by_alias=True) == {
        "id": "14564",
        "titulo": "Rings",
        "url_poster": None,
        "nota_media": None,
    }


def test_movie_card_aceita_id_filme_do_banco() -> None:
    card = MovieCard(id_filme="14564", titulo="Rings", nota_media=7.06)

    assert card.id == "14564"
    assert card.nota_media == 7.1  # 1 casa decimal


def test_movie_card_poster_vazio_vira_none() -> None:
    assert MovieCard(id="1", titulo="X", url_poster="  ").url_poster is None


@pytest.mark.parametrize("nota", [-0.1, 10.1])
def test_movie_card_nota_fora_da_escala_rejeitada(nota: float) -> None:
    with pytest.raises(ValidationError):
        MovieCard(id="1", titulo="X", nota_media=nota)


@pytest.mark.parametrize("payload", [{"id": "  ", "titulo": "X"}, {"id": "1", "titulo": ""}])
def test_movie_card_campos_obrigatorios(payload: dict) -> None:
    with pytest.raises(ValidationError):
        MovieCard(**payload)
