# API And SDK Design

## Objetivo

Transformar o PALS em uma tecnologia consumivel por CLI, SDK, extensao e API.

## Modulos Publicos

### JavaScript Browser SDK

```js
const scan = await PALS.scanViewport({
  grid: "adaptive",
  hover: true,
  text: true,
  accessibility: true
});
```

### Node CLI

```bash
pals scan http://localhost:3000 --out report.md
pals compare before.json after.json --out diff.md
pals export-playwright scan.json --out flow.spec.ts
```

### REST API

```http
POST /v1/scans
GET /v1/scans/{id}
GET /v1/scans/{id}/report
POST /v1/compare
POST /v1/locators/generate
```

## Modelo De Scan Job

```json
{
  "url": "https://app.example.com",
  "mode": "qa_audit",
  "viewport": { "width": 1365, "height": 768 },
  "scan": {
    "pointer": true,
    "hover": true,
    "scroll": true,
    "accessibility": true
  },
  "policy": {
    "allowActions": ["hover", "focus", "read"],
    "blockActions": ["submit", "purchase", "delete"]
  }
}
```

## Resposta De Scan

```json
{
  "id": "scan_123",
  "status": "completed",
  "summary": {
    "regions": 120,
    "interactive": 31,
    "hoverStates": 8,
    "accessibilityIssues": 6
  },
  "artifacts": {
    "map": "/v1/scans/scan_123/map",
    "report": "/v1/scans/scan_123/report"
  }
}
```

## SDKs

Prioridade:

1. TypeScript.
2. Python.
3. REST puro.

## Autenticacao

MVP:

- API key estatica por cliente.

Comercial:

- API key com escopos.
- Quotas.
- Rotacao.
- Logs por chave.

## Billing

Unidades possiveis:

- Scan.
- Pagina.
- Minuto de browser.
- Relatorio.
- Comparacao.

Modelo inicial recomendado:

- Plano mensal com limite de scans.
- Excedente manual no inicio.
- Stripe metered billing apenas depois de demanda real.

