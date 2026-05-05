# Research And References

Este documento consolida as principais tecnologias pesquisadas para suportar o
PALS Engine.

## Browser Automation

- Playwright locators e auto-waiting: https://playwright.dev/docs/locators
- WebDriver e WebDriver BiDi: https://developer.mozilla.org/en-US/docs/Web/WebDriver
- W3C WebDriver BiDi: https://www.w3.org/TR/webdriver-bidi/
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/
- CDP DOMSnapshot: https://chromedevtools.github.io/devtools-protocol/tot/DOMSnapshot/

Relevancia:

Essas tecnologias fornecem controle de navegador, eventos, inspecao DOM, rede e
execucao de JavaScript. PALS deve usa-las como infraestrutura, nao como conceito
central. O conceito central continua sendo a varredura por ponteiro.

## Web Platform APIs

- `getComputedStyle`: https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle
- `MutationObserver`: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- `IntersectionObserver`: https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver
- `ResizeObserver`: https://mdn2.netlify.app/en-US/docs/Web/API/ResizeObserver

Relevancia:

Permitem capturar mudancas de DOM, tamanho, visibilidade e estilo enquanto a
varredura acontece.

## Accessibility

- Chrome full accessibility tree: https://developer.chrome.com/blog/full-accessibility-tree/
- CDP Accessibility: https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/
- axe-core: https://www.deque.com/axe/axe-core/
- WCAG 2.2: https://www.w3.org/TR/wcag/

Relevancia:

PALS deve combinar geometria do ponteiro com semantica acessivel para reduzir
ambiguidade e gerar relatorios vendaveis de acessibilidade.

## Memory And Learning

- pgvector: https://github.com/pgvector/pgvector
- Qdrant: https://qdrant.tech/documentation/overview/what-is-qdrant/

Relevancia:

Permitem criar memoria de componentes e similaridade entre interfaces.

## RPA And Desktop Automation

- UiPath AI Computer Vision: https://www.uipath.com/product/platform/ai-computer-vision-for-rpa
- Microsoft UI Automation: https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-uiautomationoverview
- Appium: https://appium.io/docs/en/latest/
- Power Automate desktop flows: https://learn.microsoft.com/en-us/power-automate/desktop-flows/introduction

Relevancia:

Mostram demanda de mercado por automacao resiliente e caminhos futuros fora do
browser.

## AI Agents And Safety

- OpenAI Computer Use: https://platform.openai.com/docs/guides/tools-computer-use
- OpenAI CUA: https://openai.com/index/computer-using-agent/
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework

Relevancia:

PALS pode ser uma camada de percepcao para agentes, desde que tenha limites de
acao, logs e supervisao humana.

## Low Cost Infrastructure

- GitHub Actions billing: https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Supabase billing/free plan: https://supabase.com/docs/guides/platform/billing-on-supabase
- Chrome extension content scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- npm docs: https://docs.npmjs.org/

Relevancia:

Permite iniciar sem custo relevante: repositorio publico, site estatico,
extensao, CLI e API leve.

## Market Research

- Grand View Research RPA market: https://www.grandviewresearch.com/industry-analysis/robotic-process-automation-rpa-market
- Gartner RPA market reference: https://www.gartner.com/en/documents/6842834
- UiPath AI Computer Vision market positioning: https://www.uipath.com/product/platform/ai-computer-vision-for-rpa

Relevancia:

O mercado ja paga por automacao, QA, RPA e visao de interface. O diferencial do
PALS e ser uma abordagem estruturada por ponteiro, menos dependente de prints e
seletores frageis.

