# Cost Strategy

## Objetivo

Construir o PALS com custo financeiro minimo ate haver receita.

## Stack Sem Custo Relevante

### Desenvolvimento

- Node.js.
- TypeScript.
- Playwright.
- SQLite.
- GitHub.
- GitHub Actions em repositorio publico.

### Site E Documentacao

- GitHub Pages.
- Cloudflare Pages.
- Markdown.

### API Inicial

- Cloudflare Workers Free.
- Supabase Free.
- SQLite local para versao self-host.

### Distribuicao

- npm.
- GitHub Releases.
- Chrome Extension empacotada manualmente no inicio.

### Billing

- Stripe apenas quando houver produto pago.
- Antes disso, pagamento manual por invoice/link.

## Evitar No Inicio

- Browser cloud pago.
- Kubernetes.
- Banco vetorial gerenciado pago.
- Modelos LLM caros em fluxo obrigatorio.
- Time de vendas formal.
- Infra multi-tenant complexa.

## Quando Aceitar Custo

Somente apos receita ou cliente piloto:

- Browser pool cloud.
- Storage de artefatos.
- Postgres gerenciado.
- Stripe billing completo.
- Observabilidade comercial.

## Principio

O MVP deve provar valor usando maquina local e infraestrutura gratuita. A nuvem
entra para conveniencia comercial, nao como dependencia tecnica inicial.

