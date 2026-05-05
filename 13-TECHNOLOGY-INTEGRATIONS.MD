# Technology Integrations

## Playwright

Uso:

- Browser control.
- Mouse movement.
- Network events.
- Console events.
- Export de testes.

PALS deve usar Playwright como infraestrutura de execucao, mantendo seu motor de
percepcao separado.

## WebDriver BiDi

Uso futuro:

- Cross-browser automation.
- Eventos bidirecionais.
- Padronizacao.

Importante para nao ficar preso ao Chromium/CDP.

## Chrome DevTools Protocol

Uso:

- DOMSnapshot.
- Accessibility.
- Runtime evaluation.
- Network.
- Performance.

CDP e poderoso, mas especifico de Chromium. Deve ser adaptador, nao nucleo.

## axe-core

Uso:

- Regras WCAG.
- Relatorios de acessibilidade.
- Validacao automatica.

PALS adiciona o que axe-core sozinho nao cobre bem: estados dinamicos de hover,
foco e mapa espacial ativo.

## OpenTelemetry

Uso:

- Traces de scan.
- Latencia.
- Eventos de DOM.
- Timeline de acoes.

Pode ser opcional no MVP.

## pgvector

Uso:

- Memoria de componentes.
- Similaridade de regioes.
- Self-healing locators.

MVP pode comecar sem vetores.

## Browser Extension

Uso:

- Injetar PALS em paginas autorizadas.
- Painel local.
- Exportar mapas.
- Modo gravador.

Distribuicao:

- Pacote manual no inicio.
- Chrome Web Store depois.

## Desktop Automation Futuro

Windows:

- Microsoft UI Automation.

macOS:

- Accessibility API.

Mobile:

- Appium.

Esses modulos devem ser enterprise/futuro. O foco inicial continua sendo web.

