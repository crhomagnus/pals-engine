# Risks And Mitigations

## Risco 1: Confusao Com Ferramenta Anti-Bot

Problema:

O conceito pode ser mal interpretado como tecnologia de evasao.

Mitigacao:

- Politica clara de uso permitido.
- Allowlist de dominios.
- Modo padrao somente leitura.
- Material comercial focado em QA, acessibilidade e sistemas proprios.

## Risco 2: Performance Da Varredura

Problema:

Varredura ponto a ponto pode ser lenta.

Mitigacao:

- Grid adaptativo.
- Quadtree.
- Cache de regioes.
- Refinar apenas regioes com sinal.
- Amostragem por densidade de interacao.

## Risco 3: Paginas Dinamicas Demais

Problema:

SPAs, lazy-load e virtual lists mudam durante o scan.

Mitigacao:

- Timeline causal.
- MutationObserver.
- Scan por ciclos.
- Estado estavel antes de relatorio.

## Risco 4: Shadow DOM Fechado E Iframes Cross-Origin

Problema:

O navegador nao expoe tudo.

Mitigacao:

- Registrar como bloqueado.
- Usar Accessibility Tree quando disponivel.
- Permitir integracao por script em ambientes proprios.
- Nao inventar precisao.

## Risco 5: Produto Muito Amplo

Problema:

QA, RPA, agentes, acessibilidade e API podem dispersar foco.

Mitigacao:

- MVP unico: QA/A11y Auditor.
- Roadmap modular.
- Agente autonomo apenas depois.

## Risco 6: Baixa Disposicao A Pagar

Problema:

Desenvolvedores podem preferir ferramentas gratuitas.

Mitigacao:

- Vender relatorio e economia de tempo.
- Integrar com Playwright.
- Open-core.
- Cobrar por dashboard, historico, CI e enterprise policy.

## Risco 7: Dados Sens Nao Intencionais

Problema:

Scans podem coletar textos sensiveis.

Mitigacao:

- Redacao de dados.
- Modo local.
- Campos mascarados.
- Controle por dominio.
- Retencao configuravel.

