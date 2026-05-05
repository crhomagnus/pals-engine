# Product Scope And MVP

## Produto Inicial

**PALS QA/A11y Auditor**

Esse deve ser o primeiro produto vendavel.

## Por Que Este MVP

- Tem uso legal claro.
- Empresas ja pagam por QA e acessibilidade.
- Nao exige agente autonomo completo.
- Pode rodar localmente.
- Pode gerar relatorio vendavel rapidamente.
- Demonstra o diferencial da varredura por ponteiro.

## Publico Inicial

- Times pequenos de frontend.
- Agencias web.
- Consultorias de QA.
- Consultorias de acessibilidade.
- Empresas com sistemas internos web.
- Startups que precisam testar fluxos sem manter suites E2E complexas.

## Funcionalidades Do MVP

### Fixo

- Escanear viewport com ponteiro.
- Detectar elementos sob coordenadas.
- Detectar regioes interativas.
- Detectar textos, botoes, inputs, links.
- Detectar hover states.
- Detectar overlays e modais.
- Gerar JSON.
- Gerar relatorio Markdown.
- Rodar localmente via CLI.
- Rodar demo via browser.

### Variavel

- Export PDF.
- Export Playwright test.
- Integracao GitHub Actions.
- Comparacao entre duas versoes.
- Painel visual em browser.

## Fora Do MVP

- Agente autonomo geral.
- Automacao em sites sem autorizacao.
- Suporte completo a desktop apps.
- Browser cloud em escala.
- Billing automatico completo.

## Criterios De Pronto

- Rodar em uma URL local.
- Rodar em uma URL de staging autorizada.
- Gerar mapa com elementos explicitos e implicitos.
- Detectar mudancas de hover.
- Exportar relatorio.
- Retornar codigo de erro em CI quando encontrar problema critico.

## Primeira Oferta Comercial

Servico + ferramenta:

- Auditoria inicial de ate 10 paginas.
- Relatorio PALS.
- Lista de problemas.
- Recomendacoes de correcao.
- Re-scan apos ajustes.

Esse formato permite vender antes de ter SaaS completo.

