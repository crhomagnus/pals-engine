# Data Model And Learning

## Objetivo

Permitir que o PALS aprenda padroes de interface sem abandonar o alicerce de
varredura por ponteiro.

## Entidades

### Project

Representa cliente, app ou ambiente.

Campos:

- `id`
- `name`
- `allowed_domains`
- `policy`
- `created_at`

### Scan

Uma execucao de varredura.

Campos:

- `id`
- `project_id`
- `url`
- `viewport`
- `started_at`
- `finished_at`
- `status`
- `summary`

### PointSample

Amostra em uma coordenada da viewport.

Campos:

- `scan_id`
- `x`
- `y`
- `elements_stack`
- `cursor`
- `hover_delta`
- `timestamp`

### Region

Regiao inferida pelo scanner.

Campos:

- `id`
- `scan_id`
- `bounds`
- `type`
- `confidence`
- `interactive`
- `text`
- `role`

### ComponentFingerprint

Representacao de um componente.

Campos:

- `id`
- `kind`
- `selector_signature`
- `role`
- `text_pattern`
- `style_signature`
- `geometry_signature`
- `embedding`

### Finding

Problema ou observacao.

Campos:

- `id`
- `scan_id`
- `severity`
- `category`
- `message`
- `region_id`
- `evidence`

## Armazenamento

MVP:

- JSON.
- JSONL.
- SQLite.

Comercial:

- Postgres.
- pgvector.
- Object storage.

## Aprendizado Inicial Sem LLM

Antes de usar modelos caros, implementar:

- Heuristicas por role.
- Similaridade por texto.
- Similaridade por geometria.
- Similaridade por estilo.
- Agrupamento por repeticao.
- Diff entre scans.

## Aprendizado Com Vetores

Usar embeddings quando houver necessidade real:

- Componentes parecidos entre paginas.
- Locators resilientes.
- Classificacao semantica.
- Recuperacao de exemplos revisados.

## Active Learning

Fluxo:

1. PALS classifica componente.
2. Quando confianca baixa, pede revisao humana.
3. Revisao vira exemplo.
4. Exemplo melhora futuras classificacoes.

## Self-Healing Locator

Gerar candidatos por prioridade:

1. Role + accessible name.
2. Label/placeholder/text.
3. Test id.
4. Selector CSS curto.
5. Posicao relativa dentro de componente.
6. Similaridade com fingerprint anterior.

