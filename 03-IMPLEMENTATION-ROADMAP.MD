# Implementation Roadmap

## Estagio 1: Fundacao Teorica

Fixo:

- Nome oficial do projeto.
- Definicao do alicerce: varredura via ponteiro.
- Politica de uso permitido.
- Casos de uso iniciais.

Variavel:

- Revisao juridica.
- Escolha de nicho inicial por cliente real.

Entregavel:

- Documentacao base e prototipo existente organizado.

## Estagio 2: PALS Core 1.0

Fixo:

- API `scanViewport`.
- API `scanPoint`.
- API `scanHover`.
- Coleta de elementos, texto, estilos e caixas.

Variavel:

- Otimizacao por grid adaptativo.
- Suporte a shadow DOM aberto.
- Suporte parcial a iframes same-origin.

Entregavel:

- Biblioteca JS importavel.

## Estagio 3: Scanner Adaptativo

Fixo:

- Grade inicial de baixa resolucao.
- Refinamento em regioes clicaveis.
- Refinamento em regioes com mudanca de hover.

Variavel:

- Amostragem por quadtree.
- Priorizacao por densidade semantica.
- Cache de regioes estaveis.

Entregavel:

- Motor de varredura completo da viewport.

Status atual:

- Implementado no CLI com `--adaptive`.
- Primeira passada: grade grossa.
- Passada semantica: controles e campos visiveis viram sementes de ponteiro.
- Segunda passada: refinamento em torno de amostras com sinais relevantes.
- Saida: amostras, regioes, hover changes e relatorio Markdown.

## Estagio 4: Sensores Dinamicos

Fixo:

- MutationObserver.
- ResizeObserver.
- IntersectionObserver.
- Registro de eventos de rede e console.

Variavel:

- Telemetria OpenTelemetry.
- Registro de performance.
- Deteccao de SPA route changes.

Entregavel:

- Timeline causal da varredura.

## Estagio 5: Hover State Graph

Fixo:

- Descobrir elementos que aparecem no hover.
- Criar grafo de estado inicial -> hover -> mudancas.

Variavel:

- Estados por foco.
- Estados por teclado.
- Estados por scroll interno.

Entregavel:

- Relatorio de estados interativos ocultos.

Status atual:

- Primeira versao implementada via assinatura de pagina antes/depois do movimento
  do ponteiro.
- O relatorio ja lista seletores adicionados/removidos por hover.

## Estagio 6: Mapa Semantico

Fixo:

- Classificacao basica de componentes.
- Uniao de DOM + estilo + accessibility.
- Export JSON.

Variavel:

- Heuristicas especificas por framework.
- Detector de componentes repetidos.
- Detector de tabelas complexas.

Entregavel:

- Semantic UI Map.

Status atual:

- Primeira versao implementada em `src/browser/semantic-map.js`.
- O scan coleta controles, campos, headings, nomes acessiveis, labels, bounds e
  contagens.
- O relatorio gera findings QA/A11y iniciais a partir desse mapa.

## Estagio 7: Produto MVP Vendavel

Fixo:

- PALS QA/A11y Auditor.
- Relatorio local.
- CLI.
- Extensao Chrome basica.

Variavel:

- Export PDF.
- Export Playwright.
- Integracao GitHub Actions.

Entregavel:

- Produto utilizavel por primeiros clientes.

## Estagio 8: API Comercial

Fixo:

- API keys.
- Quotas.
- Scan jobs.
- Relatorios.
- Billing manual inicial.

Variavel:

- Stripe metered billing.
- Webhooks.
- Multi-tenant completo.

Entregavel:

- API privada para clientes piloto.

## Estagio 9: Memoria E Aprendizado

Fixo:

- Fingerprints de componentes.
- Historico de scans.
- Comparacao entre versoes.

Variavel:

- pgvector.
- Embeddings locais.
- Active learning com revisao humana.

Entregavel:

- Self-healing e aprendizado incremental.

## Estagio 10: Integracoes Profissionais

Fixo:

- Playwright export.
- GitHub Actions.
- Slack/Discord webhook.

Variavel:

- Jira/Linear.
- Datadog/Grafana.
- Power Automate bridge.

Entregavel:

- Workflow de time real.

## Estagio 11: Enterprise Pack

Fixo:

- Policy Engine.
- Logs auditaveis.
- Human approvals.
- Modo on-prem/local.

Variavel:

- Windows UI Automation.
- macOS Accessibility.
- Appium.

Entregavel:

- Oferta enterprise para sistemas internos.

## Estagio 12: Escala E Marketplace

Fixo:

- Templates.
- Plugins.
- Documentacao publica.
- Casos de uso demonstraveis.

Variavel:

- Marketplace de scanners.
- Parceiros de QA/RPA.
- Certificacoes.

Entregavel:

- Produto escalavel e distribuivel.
