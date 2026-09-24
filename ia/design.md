# CineRocket — Design Specification

## Visão Geral

Aplicação web de avaliação e catalogação de filmes, inspirada no Letterboxd. Interface escura e cinematográfica, com tipografia expressiva e sistema de avaliação temático por foguete. Responsiva para desktop e mobile.

---

## Identidade Visual

### Nome e Logo
- **Nome:** CineRocket
- **Ícone:** Quadrado arredondado vermelho com foguete SVG — corpo com vigia circular (referência à lente de câmera), perfurações de película nos flancos, aletas delta simétricas e chama dupla âmbar/amarela na base
- **Tagline:** "Dê a nota. Lance o filme." (itálico, muted)
- **Tipografia do logotipo:** Fraunces (serif display), peso semibold

### Filosofia de Design
- Dark-first: fundo escuro profundo como tela de cinema apagada
- Hierarquia visual clara: títulos em serif expressivo, corpo em sans limpo
- Acento único e saturado (vermelho) sobre paleta totalmente neutra
- Densidade moderada — respira, mas não desperdiça espaço

---

## Paleta de Cores

| Token | Hex | Uso |
|---|---|---|
| `background` | `#0b0e14` | Fundo principal de todas as telas |
| `card` | `#12161f` | Cards, modais, formulários |
| `secondary` | `#1a1f2e` | Hover de cards, inputs ativos, fundo de chips |
| `border` | `#232838` | Bordas de cards, separadores, inputs |
| `border-hover` | `#3a4054` | Bordas em hover |
| `foreground` | `#e8e6e0` | Texto principal |
| `foreground-muted` | `#b0aaa0` | Texto secundário (sinopses, descrições) |
| `muted-foreground` | `#7a8394` | Labels, metadados, placeholders |
| `primary` | `#e03535` | Cor de ação principal — botões, destaques, foco |
| `primary-hover` | `#c42626` | Hover do primary |
| `imdb-yellow` | `#f5c518` | Exclusivo para nota e badge do IMDb |

### Cores do Sistema Rocket (avaliação)
Cada faixa de nota tem cor própria usada em badges e barras:

| Faixa | Label | Cor | Emoji |
|---|---|---|---|
| 0–2 | Nem decolou | `#ef4444` | 💥 |
| 3–4 | Decolagem acidentada | `#f97316` | 🔥 |
| 5–6 | Na atmosfera | `#eab308` | 🚀 |
| 7–8 | Em órbita | `#3b82f6` | 🛸 |
| 9 | Chegou à lua | `#a855f7` | 🌕 |
| 10 | Além das estrelas | `#e03535` | ⭐ |

---

## Tipografia

| Papel | Família | Pesos | Uso |
|---|---|---|---|
| Display | Fraunces (serif) | 300, 400, 600, 700 | Títulos de filmes, headings de página, logo, notas em destaque |
| Body | Outfit (sans) | 300, 400, 500, 600, 700 | Todo texto de interface, labels, botões, parágrafos |
| Mono | JetBrains Mono | 400, 500 | Anos, datas, notas numéricas, contadores, labels `uppercase` |

**Hierarquia de tamanhos:**
- Hero title: `text-3xl` → `text-5xl` (responsivo)
- Page title: `text-2xl` → `text-3xl`
- Section heading: `text-xl`
- Card title: `text-base` (grid) / `text-base` (lista)
- Body: `text-sm` → `text-base`
- Labels / meta: `text-xs` uppercase com `tracking-wider`

---

## Espaçamento e Layout

- **Largura máxima do conteúdo:** `max-w-7xl` (home, busca) · `max-w-5xl` (detalhes) · `max-w-2xl` (formulários)
- **Padding horizontal:** `px-4` mobile · `px-6` desktop
- **Radius padrão:** `rounded-lg` (cards menores) · `rounded-xl` (cards, inputs) · `rounded-2xl` (cards de rating, modais) · `rounded-full` (chips, pills)
- **Gap de grid:** `gap-3` mobile · `gap-4` desktop
- **Navbar height:** `h-14` mobile · `h-16` desktop

---

## Componentes Globais

### Navbar
- Sticky, com blur de fundo (`backdrop-blur-sm`) e borda inferior sutil
- **Esquerda:** Logo (ícone + nome "CineRocket") — clicável, navega para Home
- **Centro:** Campo de busca com ícone de lupa (oculto em mobile)
- **Direita:** Botão "Adicionar" (oculto em mobile) + avatar do usuário com dropdown
- **Mobile:** Ícone de lupa abre campo de busca expansível abaixo da navbar
- **Dropdown do usuário:** Nome, e-mail, link "Adicionar Filme" (só mobile), "Sair"

### MovieCard — modo grid
- Proporção `2:3` (poster de cinema)
- Hover: `scale-105` na imagem + overlay gradiente + nota numérica aparece
- Abaixo: título truncado, ano e diretor em muted

### MovieCard — modo lista
- Linha horizontal: poster `64×96px` + bloco de info
- Info: título, diretor, nota colorida `/10`, contagem de avaliações, badge IMDb, chips de gênero

### RatingPicker (seletor de nota)
- 11 botões (0–10) em grid flexível
- Botão ativo: cor da faixa rocket, sombra colorida, `scale-110`
- Badge de preview abaixo: emoji + label + sublabel, cor de fundo translúcida

### Chips de gênero
- Fundo `#1a1f2e`, borda `#232838`, texto muted
- Selecionado: fundo `#e03535`, texto branco

---

## Telas

---

### 1. Login / Cadastro (`/auth`)

**Layout:** Centralizado verticalmente, largura máxima `max-w-sm`. Fundo decorativo com tiras de filme nos lados (opacidade 3%).

**Elementos:**
- Logo centralizado (ícone 56px + nome + tagline "Dê a nota. Lance o filme.")
- Toggle tab "Entrar / Cadastrar" com estado ativo realçado
- **Formulário de login:** e-mail + senha (com toggle mostrar/ocultar)
- **Formulário de cadastro:** nome + e-mail + senha
- Botão primário vermelho de submit
- Seção "Demo rápida": botão secundário com avatar de usuário pré-definido
- Validação inline: mínimo 6 caracteres na senha, campos obrigatórios, erro em destaque vermelho suave

**Mobile:** Idêntico ao desktop — layout já é de coluna única.

---

### 2. Home (`/home`)

**Layout:** Navbar + hero banner + área de filtragem + grade/lista de filmes.

**Hero Banner:**
- Mosaico dos primeiros 5 pôsteres em colunas, opacidade 30%
- Gradientes laterais e inferior sobrepõem as imagens (`from-background`)
- Texto: label monospace vermelho com nome do usuário, título display grande, contadores de filmes e avaliações
- Botão "Adicionar Filme" em destaque

**Filtros:**
- Chips de gênero horizontais com scroll: Todos, Drama, Thriller, Romance, Sci-Fi, Comédia, Mistério, Histórico
- Select de ordenação: Mais recentes, Mais antigos, A–Z, Z–A, Melhor avaliados
- Toggle grid/lista (ícones)

**Grade de filmes:**
- **Desktop:** 6–7 colunas
- **Tablet:** 4–5 colunas
- **Mobile:** 3 colunas

**Estado vazio:** Ícone de película + mensagem + link para limpar filtro.

---

### 3. Detalhes do Filme (`/movie/:id`)

**Layout:** Navbar + hero backdrop + seção de poster/info + seção de ratings + lista de avaliações.

**Hero Backdrop:**
- Pôster em fullwidth com blur e escala 105%, opacidade 35%
- Gradiente de fade para o fundo
- Altura `h-64` mobile · `h-80` desktop

**Bloco de poster + info (sobreposição ao hero):**
- Poster: `128px` mobile · `176px` desktop, borda sutil
- Título em display grande, diretor e ano em muted
- Botões "Editar" e "Excluir" (usuário logado)
- Chips de gênero + metadados (duração, país, idioma)
- Sinopse em corpo muted

**Seção de Ratings (2 colunas em desktop, 1 em mobile):**

**Card — Nota da Plataforma:**
- Nota média em display 48px, colorida pela faixa rocket
- Badge de classificação rocket (emoji + label + sublabel) com fundo colorido translúcido
- Distribuição de notas: barras de 0 a 10, cor variando por faixa, contagem à direita

**Card — Nota IMDb:**
- Badge SVG "IMDb" amarelo oficial
- Nota em display 48px amarelo (`#f5c518`)
- Contagem de votos
- Barra de progresso proporcional

**Card — Comparativo** (aparece quando ambas as notas existem):
- 3 colunas: Plataforma / IMDb / Diferença
- Diferença positiva em vermelho, negativa em azul

**Seção de Avaliações dos Usuários:**
- Cabeçalho com contagem + botão "Avaliar" / "Editar avaliação"
- **Formulário de avaliação inline:**
  - Avatar + nome do usuário
  - RatingPicker (0–10)
  - Textarea opcional para crítica
  - Botões Cancelar / Publicar
- **Card de cada avaliação:**
  - Avatar circular + nome em bold
  - Badge colorido: `emoji · nota/10 · label rocket`
  - Data no formato `YYYY-MM-DD` em monospace
  - Texto da crítica em muted (quando presente)
- **Estado vazio:** Ícone de foguete + mensagem incentivando primeira avaliação

**Modal de exclusão:**
- Overlay blur + card centralizado
- Confirmação com nome do filme em bold
- Botões Cancelar (neutro) / Excluir (vermelho)

---

### 4. Adicionar Filme (`/add`)

**Layout:** Navbar + container `max-w-2xl` centralizado.

**Cabeçalho:** Botão voltar (←) + título "Adicionar Filme" + subtítulo.

**Campos do formulário:**

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| Título | text | Sim | Não vazio |
| Ano | number | Sim | 1888–ano atual+2 |
| Diretor(a) | text | Sim | Não vazio |
| Gêneros | chips multi-select | Sim | ≥ 1 selecionado |
| Sinopse | textarea (5 linhas) | Sim | Não vazio |
| URL do pôster | url | Não | — |
| Duração (min) | number | Não | — |
| País | text | Não | — |
| Idioma | text | Não | — |

**Pré-visualização do pôster:** aparece quando URL preenchida, com botão "Remover".

**Ações:** Cancelar (volta para Home) · Cadastrar Filme (vermelho, submit).

**Erros:** Validação exibida inline abaixo de cada campo em `text-red-400`.

**Mobile:** Campos em coluna única; grid de 3 colunas colapsa.

---

### 5. Editar Filme (`/edit/:id`)

**Layout:** Idêntico ao de Adicionar, com diferenças:

- Título da página: "Editar Filme" + nome do filme atual em subtítulo truncado
- **Card de preview ao topo:** pôster atual + título/diretor/ano/gêneros refletindo mudanças em tempo real
- Todos os campos pré-preenchidos com valores existentes
- Ação de submit: "Salvar Alterações"
- Botão voltar navega para a página de detalhes do filme (não para Home)

---

### 6. Resultados de Busca (`/search?q=...`)

**Layout:** Navbar (com query pré-preenchida no campo de busca) + container `max-w-5xl`.

**Cabeçalho:**
- Breadcrumb: ← + label "Resultados da busca" em monospace
- Query em display entre aspas
- Contagem de resultados

**Toggle:** Grid / Lista (mesmo padrão da Home).

**Estado com resultados:**
- Lista padrão (default) ou grade
- Mesmo componente MovieCard dos dois modos

**Estado vazio:**
- Ícone de lupa estilizado
- Mensagem com a query em display
- Dois CTAs: "Ver todos os filmes" (vermelho) e "Adicionar este filme" (neutro)
- Seção "Talvez você queira ver" com os 5 primeiros filmes da plataforma em grade

---

## Sistema de Avaliação Rocket

### Escala
- Notas de **0 a 10** (inteiros)
- Média da plataforma exibida com **1 casa decimal**

### Classificações

| Nota | Classificação | Sublabel | Cor | Emoji |
|---|---|---|---|---|
| 0–2 | Nem decolou | Esse filme nem saiu do chão | `#ef4444` | 💥 |
| 3–4 | Decolagem acidentada | Subiu um pouco, mas caiu rápido | `#f97316` | 🔥 |
| 5–6 | Na atmosfera | Chegou lá, mas não brilhou | `#eab308` | 🚀 |
| 7–8 | Em órbita | Sólido e admirável | `#3b82f6` | 🛸 |
| 9 | Chegou à lua | Quase perfeito, inesquecível | `#a855f7` | 🌕 |
| 10 | Além das estrelas | Obra-prima absoluta | `#e03535` | ⭐ |

### Exibição de cada avaliação
```
[avatar] Nome do Usuário   [emoji · nota/10 · label]   YYYY-MM-DD
         Texto da crítica (opcional)
```

---

## Responsividade

| Breakpoint | Tailwind | Comportamento |
|---|---|---|
| Mobile | `< 640px` | Navbar compacta, busca colapsável, grade 3 colunas, layouts em coluna única |
| Tablet | `sm: 640px+` | Busca visível, botão "Adicionar" aparece, grade 4–5 colunas |
| Desktop | `md: 768px+` | Nome do usuário aparece na navbar |
| Desktop grande | `lg: 1024px+` | Grade 6 colunas, layouts side-by-side completos |
| Extra largo | `xl: 1280px+` | Grade 7 colunas |

---

## Estados de Interface

| Estado | Tratamento |
|---|---|
| Loading de imagem | Fundo `#1a1f2e` como placeholder |
| Sem avaliações | Ícone + mensagem contextual, sem elementos quebrados |
| Lista vazia (filtro) | Ícone + mensagem + ação para limpar filtro |
| Busca sem resultado | Ícone + query em destaque + 2 CTAs + sugestões |
| Erro de formulário | Borda vermelha no campo + mensagem `text-red-400` abaixo |
| Hover de card | Scale na imagem + overlay + nota aparece (grid) / highlight de fundo (lista) |
| Modal aberto | Overlay `bg-black/60 backdrop-blur-sm` + card centralizado |
