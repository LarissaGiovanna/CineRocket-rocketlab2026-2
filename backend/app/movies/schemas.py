"""Schemas Pydantic do domínio de filmes (contratos da API).

Regras espelham ``models.py`` de forma enxuta para validar a entrada no
backend. O frontend espelha as mesmas regras com validação em runtime em
``frontend/src/lib/movieCard.ts`` — os dois lados aceitam as mesmas
chaves e aplicam os mesmos limites.
"""

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class MovieCard(BaseModel):
    """Cartão do filme para listagem/busca (design.md: MovieCard).

    ``id`` é o identificador público e vira ``id_filme`` no banco: na
    entrada aceita tanto ``id`` (frontend) quanto ``id_filme`` (banco);
    na saída serializa como ``id``.
    """

    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    id: str = Field(
        validation_alias=AliasChoices("id", "id_filme"),
        serialization_alias="id",
        min_length=1,
        max_length=50,
    )
    titulo: str = Field(min_length=1, max_length=500)
    url_poster: str | None = Field(default=None, max_length=2048)
    nota_media: float | None = Field(default=None, ge=0, le=10)

    @field_validator("url_poster", mode="before")
    @classmethod
    def _blank_poster_to_none(cls, value: object) -> object | None:
        """Pôster vazio (""/branco) vira None (coluna opcional -> NULL)."""
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("nota_media")
    @classmethod
    def _round_media(cls, value: float | None) -> float | None:
        """Média da plataforma com 1 casa decimal (decisão do design)."""
        if value is None:
            return None
        return round(value, 1)

    @property
    def id_filme(self) -> str:
        """Valor pronto para a coluna ``dim_movies.id_filme``."""
        return self.id


class MovieListResponse(BaseModel):
    """Envelope de listagem paginada (Home/Busca do design.md)."""

    model_config = ConfigDict(populate_by_name=True)

    items: list[MovieCard] = Field(default_factory=list)
    total: int = Field(ge=0, description="Quantos filmes há no total")
    page: int = Field(default=1, ge=1, description="Página pedida (1-based)")
    page_size: int = Field(default=20, ge=1, le=100, description="Itens por página")

    @property
    def total_pages(self) -> int:
        """Quantidade de páginas (teto de total/page_size)."""
        if self.page_size <= 0:
            return 0
        return (self.total + self.page_size - 1) // self.page_size
