# Public Demo

## Objetivo

Criar uma demo publica vendavel que mostre o PALS funcionando no navegador sem
instalacao, backend ou custo de infraestrutura.

Entregavel:

- `site/demo.html`;
- `site/demo.css`;
- `site/demo.js`;
- `site/vendor/pals-engine.js` gerado pelo build;
- CTA para reservar auditoria piloto.

## O Que A Demo Mostra

A pagina-alvo sintetica contem:

- menu oculto revelado por hover;
- tooltip revelado por hover;
- input sem label;
- botoes ambiguos sem nome acessivel;
- regioes dinamicas que mudam quando o ponteiro passa.

O painel PALS mostra ao vivo:

- pontos escaneados;
- elementos descobertos;
- regioes de hover;
- findings QA/A11y;
- resumo JSON da execucao.

## Como Rodar Localmente

```bash
node scripts/build-browser-bundle.js
python3 -m http.server 8080
```

Abrir:

```text
http://127.0.0.1:8080/site/demo.html
```

Modo de captura automatica:

```text
http://127.0.0.1:8080/site/demo.html?autorun=1
```

## Publicacao Estatica

O diretorio `site/` foi preparado para deploy estatico. Ele referencia o bundle
em:

```text
site/vendor/pals-engine.js
```

Antes de publicar, sempre rodar:

```bash
node scripts/build-browser-bundle.js
```

Opcoes sem custo relevante:

- GitHub Pages com a pasta `site/` publicada via Action;
- Cloudflare Pages apontando para `site/`;
- Netlify apontando para `site/`;
- Vercel servindo `site/` como static output.

## Posicionamento Comercial

Mensagem de venda da demo:

```text
Open the live demo, run the scan, and watch PALS discover hover UI,
unlabeled fields, ambiguous controls, and a browser-side audit summary.
```

## Criterios De Pronto

- A demo abre em desktop e mobile.
- O botao `Run live scan` executa a varredura.
- O cursor visual se move sobre a pagina-alvo.
- Os pontos escaneados aparecem no alvo.
- O painel mostra elementos, findings e resumo.
- A landing aponta para `site/demo.html`.
- O site nao depende de CDN, backend, login ou build frontend.
