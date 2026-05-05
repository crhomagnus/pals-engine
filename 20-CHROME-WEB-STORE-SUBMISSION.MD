# Chrome Web Store Submission Pack

## Objetivo

Preparar a primeira submissao manual da extensao **PALS Engine QA Auditor** no
Chrome Web Store Developer Dashboard.

O posicionamento deve permanecer estreito e verificavel: auditoria local de
QA/acessibilidade em paginas autorizadas por varredura ativa do ponteiro.

## Artefatos

Depois de rodar `node scripts/prepare-release.js`, usar:

- ZIP da extensao: `dist/pals-chrome-extension-v0.1.0.zip`
- Diretorio de teste local: `dist/chrome-extension`
- Assets de loja: `dist/chrome-store-assets`
- Icone 128x128: `dist/chrome-store-assets/store-icon-128.png`
- Promo pequeno 440x280: `dist/chrome-store-assets/promo-small-440x280.png`
- Screenshots 1280x800:
  - `dist/chrome-store-assets/screenshot-home-1280x800.png`
  - `dist/chrome-store-assets/screenshot-demo-1280x800.png`

URLs publicas:

- Homepage: `https://crhomagnus.github.io/pals-engine/`
- Demo: `https://crhomagnus.github.io/pals-engine/demo.html`
- Privacy policy: `https://crhomagnus.github.io/pals-engine/privacy.html`

## Listing

Nome:

```text
PALS Engine QA Auditor
```

Resumo curto:

```text
Local pointer-scanning audits for authorized QA and accessibility reviews.
```

Descricao:

```text
PALS Engine QA Auditor helps engineering and QA teams inspect authorized web
pages from inside the browser.

It samples the visible interface, maps elements under the pointer, highlights
dynamic and hover-sensitive regions, and generates local Markdown/JSON reports
with QA and accessibility findings.

Core use cases:
- audit authorized staging or production pages;
- identify unlabeled fields and ambiguous controls;
- capture hover-sensitive UI evidence;
- export local scan artifacts for engineering review;
- support manual QA, accessibility triage, and regression review.

PALS runs locally in the browser. Reports are generated on the user's machine
and downloaded only when the user requests them.
```

Categoria recomendada:

```text
Developer Tools
```

Idioma inicial:

```text
English
```

Visibilidade inicial recomendada:

```text
Unlisted
```

Use `Unlisted` para a primeira revisao/pilotos. Depois de validar feedback,
alterar para `Public`.

## Single Purpose

Texto para o campo de proposito unico:

```text
PALS Engine QA Auditor performs local QA and accessibility audits on authorized
web pages by sampling visible layout and pointer positions, then generating
local Markdown/JSON reports for engineering review.
```

## Permission Justifications

`activeTab`

```text
Required so the user can run an audit on the currently active tab after an
explicit click in the extension popup. PALS does not access other tabs.
```

`scripting`

```text
Required to inject the packaged PALS scanner into the active tab only when the
user starts a Quick Audit or Live Capture. The extension does not load or
execute remotely hosted code.
```

`downloads`

```text
Required to save generated Markdown and JSON audit reports locally when the
user clicks the download buttons.
```

## Data Practices

Declare that the extension processes page/content data locally for its single
purpose, but does not sell, transfer, or remotely collect it.

Recommended disclosure language:

```text
PALS processes the active page URL, title, visible layout metadata, DOM element
metadata, pointer coordinates, hover changes, field labels, control names, and
QA/accessibility findings locally in the browser to generate audit artifacts.
The extension does not transmit scanned page content to PALS servers, does not
sell user data, does not use data for advertising, and does not load remote
code.
```

Privacy policy URL:

```text
https://crhomagnus.github.io/pals-engine/privacy.html
```

Remote code answer:

```text
No, the extension does not use remote code.
```

## Test Instructions For Review

```text
1. Install the extension.
2. Open https://crhomagnus.github.io/pals-engine/demo.html
3. Click the PALS Engine extension icon.
4. Click Quick Audit.
5. Confirm that metrics update and the Markdown/JSON download buttons become enabled.
6. Click Live Capture, move the pointer over the demo page, then click Stop Live Capture.
7. Download the local Markdown or JSON report.

No account, login, payment, or external service is required.
```

## Manual Submission Checklist

1. Rodar `node scripts/prepare-release.js`.
2. Testar `dist/chrome-extension` em `chrome://extensions` com Developer Mode.
3. Abrir o Chrome Web Store Developer Dashboard.
4. Clicar em **Add new item** e enviar `dist/pals-chrome-extension-v0.1.0.zip`.
5. Preencher Store Listing com os textos acima.
6. Enviar `store-icon-128.png`, `promo-small-440x280.png` e screenshots.
7. Preencher Privacy com proposito unico, justificativas e data practices.
8. Configurar Distribution como `Unlisted` na primeira submissao.
9. Adicionar as instrucoes de teste.
10. Enviar para revisao.

## Riscos De Revisao

- Qualquer mencao ou comportamento ligado a captura nao autorizada deve ficar
  fora da listing e fora da extensao.
- O escopo deve continuar limitado a QA/acessibilidade local em paginas
  autorizadas.
- A politica de privacidade deve continuar consistente com o manifest e com o
  comportamento real da extensao.
- Se no futuro o produto enviar relatorios para uma API, a politica de
  privacidade e as declaracoes de dados precisam ser atualizadas antes da
  publicacao.

## Referencias Oficiais

- Publicacao: https://developer.chrome.google.cn/docs/webstore/publish?hl=en
- Privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/
- Program policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Imagens: https://developer.chrome.com/docs/webstore/images
