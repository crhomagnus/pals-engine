# Pointer-Adaptive Layout Scanner Engine

**PALS Engine** e uma tecnologia de percepcao ativa de interfaces web baseada
em varredura por ponteiro.

O alicerce do projeto e simples e deve permanecer intacto:

> Abrir uma pagina, mover o ponteiro por regioes da tela, coletar o que o
> navegador revela em cada ponto e construir um mapa espacial, sem depender
> primariamente de screenshots.

A partir dessa base surgem os modulos avancados: mapa semantico, grafo de hover,
memoria de componentes, geracao de locators robustos, auditoria de UX,
acessibilidade, QA, automacao assistida e APIs comerciais.

## Documentos Principais

- [00-PROJECT-FOUNDATION.MD](00-PROJECT-FOUNDATION.MD)
- [01-VISION-AND-PRINCIPLES.MD](01-VISION-AND-PRINCIPLES.MD)
- [02-TECHNICAL-ARCHITECTURE.MD](02-TECHNICAL-ARCHITECTURE.MD)
- [03-IMPLEMENTATION-ROADMAP.MD](03-IMPLEMENTATION-ROADMAP.MD)
- [04-RESEARCH-AND-REFERENCES.MD](04-RESEARCH-AND-REFERENCES.MD)
- [05-PRODUCT-SCOPE-AND-MVP.MD](05-PRODUCT-SCOPE-AND-MVP.MD)
- [06-API-AND-SDK-DESIGN.MD](06-API-AND-SDK-DESIGN.MD)
- [07-DATA-MODEL-AND-LEARNING.MD](07-DATA-MODEL-AND-LEARNING.MD)
- [08-SAFETY-LEGAL-COMPLIANCE.MD](08-SAFETY-LEGAL-COMPLIANCE.MD)
- [09-GO-TO-MARKET-AND-REVENUE.MD](09-GO-TO-MARKET-AND-REVENUE.MD)
- [10-COST-STRATEGY.MD](10-COST-STRATEGY.MD)
- [11-RISKS-AND-MITIGATIONS.MD](11-RISKS-AND-MITIGATIONS.MD)
- [12-OPERATING-PLAYBOOK.MD](12-OPERATING-PLAYBOOK.MD)
- [13-TECHNOLOGY-INTEGRATIONS.MD](13-TECHNOLOGY-INTEGRATIONS.MD)
- [14-DELIVERY-CHECKLIST.MD](14-DELIVERY-CHECKLIST.MD)
- [15-CHROME-EXTENSION.MD](15-CHROME-EXTENSION.MD)
- [16-PLAYWRIGHT-EXPORT.MD](16-PLAYWRIGHT-EXPORT.MD)
- [17-LAUNCH-SITE-AND-PRICING.MD](17-LAUNCH-SITE-AND-PRICING.MD)
- [18-PUBLIC-DEMO.MD](18-PUBLIC-DEMO.MD)
- [19-DISTRIBUTION-KIT.MD](19-DISTRIBUTION-KIT.MD)
- [20-CHROME-WEB-STORE-SUBMISSION.MD](20-CHROME-WEB-STORE-SUBMISSION.MD)
- [21-AGENT-MOUSE-CONTROL.MD](21-AGENT-MOUSE-CONTROL.MD)
- [CHANGELOG.MD](CHANGELOG.MD)

## Codigo Existente

- `pals-engine.js`: bundle browser global gerado a partir dos modulos em `src/`.
- `src/browser/`: nucleo modular de scanner, geometria, DOM collector, hover e lens.
- `src/browser/semantic-map.js`: mapa semantico inicial de controles, campos e headings.
- `src/report/`: relatorios Markdown, findings QA/A11y e comparacao entre scans.
- `src/report/playwright-export.js`: geracao de specs Playwright a partir do scan.
- `src/shared/adaptive.js`: planejamento adaptativo, refinamento e regioes.
- `src/shared/agent-command.js`: parser local de comandos conversacionais do agente.
- `src/node/mouse-bridge.js`: bridge local para movimento real do ponteiro via `xdotool`.
- `bin/pals.js`: CLI com `pals scan`, `pals compare` e `pals export-playwright`.
- `extension/`: extensao Chrome MV3 para auditoria local e captura viva.
- `site/`: landing page comercial estatica, demo publica, pricing e lead flow manual.
- `dist/`: artefatos gerados para release, criado por `node scripts/prepare-release.js`.
- `demo.html`: demonstracao local do prototipo.

## Comandos

```bash
node scripts/build-browser-bundle.js
node --check extension/content.js
node test/run-tests.js
node bin/pals.js --help
node bin/pals.js scan http://localhost:3000 --adaptive --out report.MD --json scan.json
node bin/pals.js compare baseline.json scan.json --out diff.MD --json diff.json
node bin/pals.js export-playwright scan.json --out pals.generated.spec.js
node bin/pals.js mouse-bridge
node bin/pals.js mouse-bridge --dry-run
node scripts/smoke-public-demo.js
node scripts/prepare-release.js
python3 -m http.server 8080
```

Demo publica local:

```text
http://127.0.0.1:8080/site/demo.html
```

O comando `pals scan` usa Playwright quando ele estiver instalado. Se Playwright
nao estiver disponivel, o CLI usa Chromium local via Chrome DevTools Protocol.
Isso preserva baixo custo e mantem o primeiro scanner comercialmente util sem
dependencias obrigatorias.

## Produto Inicial Recomendado

O primeiro produto vendavel deve ser:

**PALS QA/A11y Auditor**

Ele varre paginas autorizadas, cria mapas interativos, detecta regioes
clicaveis, estados de hover, modais, tooltips, problemas de acessibilidade e
regressoes de interface. Esse caminho e legalmente defensavel, tem baixo custo,
dor clara e pode gerar receita antes do agente autonomo completo.

## Status Atual Do MVP

O CLI ja gera um relatorio inicial de auditoria com:

- varredura ativa por ponteiro;
- refinamento adaptativo;
- pontos semanticos para controles pequenos;
- mapa de regioes;
- mudancas de hover;
- mapa semantico de UI;
- findings QA/A11y iniciais;
- comparacao entre scans.
- export inicial de testes Playwright.
- landing page comercial com pricing e checkout manual.
- demo publica com scanner vivo no navegador.
- release kit com site estatico, ZIP da extensao e workflows de CI/publicacao.
- pacote de submissao manual para Chrome Web Store.
- overlay de agente com bridge local para mover o ponteiro real em paginas autorizadas.
