# Playwright Export

## Objetivo

Transformar um scan PALS autorizado em um teste Playwright inicial, usando os
sinais descobertos pela varredura ativa por ponteiro.

O exportador nao substitui revisao humana. Ele cria um ponto de partida
executavel para QA, regressao visual indireta, acessibilidade e verificacao de
controles principais.

## Comando

```bash
node bin/pals.js scan http://localhost:3000 --adaptive --out report.MD --json scan.json
node bin/pals.js export-playwright scan.json --out pals.generated.spec.js
```

Opcoes:

```bash
--max-targets 20
--max-fields 12
--max-hover-regions 8
--max-findings 20
```

## O Que E Exportado

- `page.goto()` para a URL escaneada.
- Asserts de visibilidade para controles semanticos.
- Asserts de visibilidade para campos.
- Passos de hover em regioes onde o ponteiro revelou mudancas.
- Comentarios `TODO` para findings QA/A11y.

## Como O Locator E Escolhido

Prioridade:

1. `getByRole()` quando existe role e nome acessivel.
2. `getByLabel()` para campos com label ou nome acessivel.
3. `getByPlaceholder()` para campos com placeholder.
4. `locator(css)` usando o seletor descoberto pelo PALS.

Essa ordem incentiva testes mais resistentes, mas ainda preserva o seletor bruto
quando a pagina nao expoe semantica suficiente.

## Limitacoes Do MVP

- O arquivo gerado precisa de revisao antes de entrar em CI bloqueante.
- Estados de hover sao registrados como passos e comentarios, porque o ponto
central de uma regiao pode nao ser o melhor alvo final.
- O exportador nao executa acoes destrutivas, submits, compras ou deletions.
- O projeto que vai rodar o spec precisa ter `@playwright/test` instalado.

## Valor Comercial

Esse recurso transforma um relatorio PALS em artefato reutilizavel de engenharia.
Ele reduz o tempo entre auditoria e automacao, melhora o argumento de venda para
times de QA e cria uma ponte direta para planos pagos baseados em scans,
relatorios e geracao de testes.
