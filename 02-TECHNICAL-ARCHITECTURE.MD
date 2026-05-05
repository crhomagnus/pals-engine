# Technical Architecture

## Camadas Do PALS Engine

### 1. Pointer Scanner

Responsavel pela varredura ativa da viewport.

Funcoes:

- Mover ponteiro em grade inicial.
- Refinar regioes com alta densidade de interacao.
- Coletar `elementsFromPoint`.
- Medir caixas e relacoes locais.
- Acionar hover e foco quando permitido.

### 2. Layout Collector

Responsavel por DOM, caixas, texto e estilos.

Sinais:

- DOM elements.
- Text fragments.
- Client rects.
- Computed styles.
- Cursor CSS.
- Pointer events.
- Visibility.
- Z-index aproximado.

### 3. Dynamic Sensors

Responsavel por eventos durante a varredura.

Sensores:

- `MutationObserver`.
- `ResizeObserver`.
- `IntersectionObserver`.
- Network events via Playwright/CDP.
- Console events.
- Style changes.

### 4. Accessibility Fusion

Combina mapa espacial com Accessibility Tree.

Campos:

- Role.
- Accessible name.
- State.
- Focusability.
- ARIA labels.
- Form labels.
- Keyboard navigation.

### 5. Hover State Graph

Grafo de estados descobertos por interacao leve.

Exemplos:

- Menu aparece ao hover.
- Tooltip aparece ao hover.
- Botao secundario aparece dentro de card.
- Popover abre ao foco.

### 6. Semantic Classifier

Classifica regioes e componentes.

Classes iniciais:

- Button.
- Link.
- Input.
- Table.
- Card.
- Menu.
- Modal.
- Tooltip.
- Banner.
- Form.
- Repeated list item.

### 7. Memory Layer

Guarda padroes e fingerprints.

MVP:

- SQLite local.
- JSONL para datasets.

Fase comercial:

- Postgres.
- pgvector.
- Object storage para artefatos.

### 8. Policy Engine

Impede usos indevidos e controla risco.

Recursos:

- Allowlist de dominios.
- Blocklist de acoes.
- Human-in-the-loop.
- Logs imutaveis.
- Modo somente leitura.
- Confirmacao para envio de formularios.

### 9. API Gateway

Exposicao comercial.

Endpoints:

- Criar scan.
- Obter mapa.
- Obter relatorio.
- Comparar scans.
- Gerar locator.
- Exportar Playwright.

### 10. Dashboard

Interface para clientes.

Funcoes:

- Visualizar mapa.
- Ver problemas.
- Baixar relatorios.
- Revisar estados.
- Aprovar acoes.
- Gerenciar API keys.

## Stack Recomendada

MVP:

- TypeScript.
- Playwright.
- Node.js.
- SQLite.
- Vite/React ou HTML simples.
- GitHub Actions.

Baixo custo SaaS:

- Cloudflare Pages/Workers.
- Supabase Free ou Postgres local.
- Stripe.
- OpenTelemetry opcional.

Escala:

- Postgres + pgvector.
- Workers Queues ou filas locais.
- Containers sob demanda.
- Browser pool proprio ou provedor pago quando houver receita.

