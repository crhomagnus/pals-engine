# Vision And Principles

## Visao

Criar uma API e plataforma capaz de transformar interfaces web em mapas
operacionais estruturados, usando uma varredura ativa por ponteiro como sensor
principal.

O objetivo final e permitir que sistemas de QA, acessibilidade, RPA e agentes
computacionais entendam interfaces dinamicas sem depender apenas de screenshots,
OCR ou seletores frageis.

## Principios

### 1. Ponteiro Como Sensor

O ponteiro nao e apenas meio de clicar. Ele e um instrumento de percepcao. Ao
passar por uma coordenada, ele revela elementos, estados, cursores, hovers,
tooltips, popovers e mudancas de DOM.

### 2. Percepcao Antes De Acao

O sistema deve mapear antes de agir. Acoes sem mapa devem ser excecao.

### 3. Estrutura Antes De Pixel

Quando a pagina oferece DOM, Accessibility Tree, CSSOM e eventos, esses sinais
devem ser priorizados. Visao computacional deve complementar, nao substituir.

### 4. Aprendizado Incremental

Cada pagina varrida pode ensinar padroes: botoes, cards, tabelas, menus,
modais, formularios, regioes importantes e regioes decorativas.

### 5. Legalidade E Consentimento

O produto deve ser desenhado para ambientes autorizados. A automacao deve
respeitar limites do cliente, termos de uso e politicas de seguranca.

### 6. Baixo Custo Operacional

O MVP deve rodar localmente ou em infraestrutura gratuita/barata: Node,
Playwright, SQLite, Postgres, pgvector, GitHub Actions, Cloudflare e Supabase.

### 7. Produto Vendavel Desde Cedo

O caminho inicial de receita deve ser QA e acessibilidade, nao automacao geral.
Isso reduz risco, custo e complexidade comercial.

