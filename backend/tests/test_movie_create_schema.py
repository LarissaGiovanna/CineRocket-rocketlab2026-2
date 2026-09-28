import pytest
from pydantic import ValidationError

from app.movies.schemas import MovieCreate


def test_movie_create_valido_com_listas() -> None:
    form = MovieCreate(
        titulo="Ainda Estou Aqui",
        diretores=["Walter Salles", "  ", "Walter Salles"],
        ano_lancamento=2024,
        generos=["Drama", "Histórico"],
        sinopse="No Brasil de 1971...",
    )

    assert form.titulo == "Ainda Estou Aqui"
    assert form.diretores == ["Walter Salles"]  # vazios/dup fora
    assert form.generos == ["Drama", "Histórico"]


def test_movie_create_aceita_string_unica() -> None:
    form = MovieCreate(
        titulo="X",
        diretores="Walter Salles",
        ano_lancamento=2024,
        generos="Drama",
        sinopse="Y",
    )

    assert form.diretores == ["Walter Salles"]
    assert form.generos == ["Drama"]


BASE = {
    "titulo": "X",
    "diretores": ["A"],
    "ano_lancamento": 2024,
    "generos": ["Drama"],
    "sinopse": "Y",
}


@pytest.mark.parametrize(
    "field,value",
    [
        ("titulo", ""),
        ("diretores", []),
        ("diretores", ["  "]),
        ("generos", []),
        ("sinopse", ""),
        ("ano_lancamento", 1800),
        ("ano_lancamento", 2100),
    ],
)
def test_movie_create_invalido(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        MovieCreate(**{**BASE, field: value})
