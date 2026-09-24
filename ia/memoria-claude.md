name: avaliador-filmes description: Atividade DEV do RocketLab 2026.2 — avaliador de filmes (React + TS, FastAPI, SQLite): decisões de projeto, prazo segunda 18h; ler ao trabalhar nele sources: [chat] aliases: [Avaliador de filmes, atividade DEV, RocketLab DEV, ROCKET avaliador]
- Está criando uma aplicação web de avaliador de filmes em React + TypeScript (atividade DEV do RocketLab 2026.2); em 24/09/2026 ainda estava na etapa de ideação
- Stack do enunciado: Vite + React + TS (front), FastAPI (back), SQLite; parte de um repositório base com modelos SQLAlchemy e Alembic, e CSVs de dados iniciais
- Prazo de entrega: segunda-feira 28/09/2026 às 18h; quer distribuir as etapas pelos dias a partir de 24/09 (quinta)
- Disponibilidade na semana da entrega: quinta (24/09) tem tempo livre até as 18h (dá para adiantar bastante); sábado é o dia com menos tempo para trabalhar
- Neste projeto: não quer código pronto a menos que peça; quer ajuda para construir o raciocínio de cada problema
Decisões
- Escala das notas: 0 a 10, conforme os orientadores da atividade; o usuário avalia com nota de 0 a 10 (pode usar decimais, no máximo 2 casas), sem estrelas
- Exibição no front: ideia parecida com o Rotten Tomatoes; a partir da nota é atribuída uma classificação temática de foguetes (ex.: 2/10 - "nem decolou"); faixas e classificações (incluindo filme sem avaliações) serão definidas mais tarde, no desenvolvimento dessa parte
- Diretor: ao cadastrar, verificar se já existe; se existir, reaproveitar/atualizar o registro dele (sem criar outro); ao atualizar o diretor, a mudança também deve valer nos filmes relacionados a ele
- Gênero: escolha entre os gêneros já registrados na tabela (sem texto livre)
- Média: usar a coluna de média das notas dos usuários em dim_reviews; prioriza a nota dos usuários da plataforma (aparece na prévia do filme) e também mostra as médias das outras fontes
- dim_reviews: filme novo não ganha linha ao ser cadastrado; a linha só é criada quando um usuário faz a primeira avaliação; a média é atualizada de forma incremental, com verificação da quantidade de avaliações, preservando os dados anteriores
- id do filme: usar uuid do Python e verificar que não haja ids repetidos; observou que os ids dos filmes no CSV vão até 99999
- Não vai alterar os CSVs: filmes novos são salvos apenas no banco SQLite
- Dados fora do Git: tudo bem; quem clonar precisa ter os CSVs dos filmes e adicioná-los por conta própria
- asked to remember: lembrá-la de subir ao GitHub apenas os arquivos necessários para o mínimo funcionamento do site (ex.: o CSV dos gêneros dos filmes)
- asked to remember: quando chegar na parte dos dados base, ajudá-la a configurar e selecionar as tabelas necessárias para o mínimo funcionamento da aplicação