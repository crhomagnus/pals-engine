# Launch Site And Pricing

## Objetivo

Criar uma primeira superficie comercial de baixo custo para vender o PALS antes
de construir SaaS, dashboard, billing completo ou infraestrutura cloud.

Entregavel desta fase:

- site estatico em `site/`;
- hero visual com varredura por ponteiro;
- secoes de auditoria, workflow e pricing;
- formulario de lead que salva a solicitacao localmente e abre email;
- precos iniciais para venda manual.

## Arquivos

```text
site/index.html
site/styles.css
site/app.js
```

## Como Rodar Localmente

```bash
python3 -m http.server 8080
```

Abrir:

```text
http://127.0.0.1:8080/site/
```

Tambem e possivel abrir `site/index.html` diretamente no navegador.

## Precos Iniciais

### Pilot Audit

US$299 uma vez.

Entrega:

- scan de ate 10 paginas autorizadas;
- relatorio Markdown;
- findings QA/A11y;
- evidencias de hover/regioes;
- export Playwright inicial;
- um re-scan apos correcoes.

### Team Monthly

US$99/mes.

Entrega:

- lote mensal de scans;
- comparacao antes/depois;
- extensao Chrome para captura assistida;
- suporte de setup prioritario.

### CI Setup

US$499+.

Entrega:

- fluxo scan-to-spec;
- guia GitHub Actions;
- revisao de seletores;
- handoff com time de QA.

## Checkout Manual

O formulario atual nao depende de backend. Ao enviar:

1. cria um objeto `pals:lastLeadRequest` em `localStorage`;
2. abre um draft de email com os dados do lead;
3. permite cobrar manualmente por invoice, Stripe Payment Link, PayPal ou
   transferencia.

Antes de publicar, trocar em `site/app.js`:

```js
const salesEmail = "sales@example.com";
```

por um email real do projeto.

## Publicacao Sem Custo Relevante

Opcoes praticas:

- GitHub Pages para site estatico;
- Cloudflare Pages free tier;
- Netlify free tier;
- Vercel Hobby para pagina estatica.

No primeiro mes, evitar banco de dados, fila, autenticacao e billing medido.
Usar o site para gerar leads e vender auditorias manuais assistidas por PALS.

## Primeiro Script De Venda

Mensagem curta:

```text
PALS maps authorized web pages with active pointer scanning, finds dynamic hover
UI and accessibility gaps, then exports a Markdown report and starter Playwright
spec. We are selling a US$299 pilot audit for up to 10 pages.
```

## Criterios De Pronto

- O site abre em desktop e mobile.
- O canvas do hero renderiza uma cena nao vazia.
- Os botoes de plano preenchem o formulario.
- O formulario salva o lead no `localStorage`.
- O checklist do MVP marca landing page, pricing e checkout manual.
