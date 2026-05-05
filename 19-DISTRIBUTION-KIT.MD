# Distribution Kit

## Objetivo

Preparar o PALS para distribuicao real sem exigir credenciais externas nesta
fase. O projeto passa a gerar artefatos publicaveis para site, extensao Chrome e
pacote npm.

## Entregaveis

- `scripts/prepare-release.js`
- `scripts/smoke-public-demo.js`
- `dist/site`
- `dist/chrome-extension`
- `dist/pals-chrome-extension-v0.1.0.zip`
- `dist/pals-site-v0.1.0.tar.gz`
- `dist/chrome-store-assets`
- `extension/icons/icon-16.png`
- `extension/icons/icon-48.png`
- `extension/icons/icon-128.png`
- `.github/workflows/ci.yml`
- `.github/workflows/pages.yml`
- `netlify.toml`
- `vercel.json`

## Comandos

Validar:

```bash
node scripts/build-browser-bundle.js
node test/run-tests.js
node scripts/smoke-public-demo.js
```

Preparar release:

```bash
node scripts/prepare-release.js
```

Saida esperada:

```text
dist/
  RELEASE-MANIFEST.json
  site/
  chrome-extension/
  chrome-store-assets/
  pals-chrome-extension-v0.1.0.zip
  pals-site-v0.1.0.tar.gz
```

## Site Estatico

O site publicavel fica em:

```text
dist/site
```

Rotas principais:

```text
/index.html
/demo.html
/demo.html?autorun=1
/privacy.html
```

Publicacao sem custo relevante:

- GitHub Pages: usar `.github/workflows/pages.yml`;
- Netlify: usar `netlify.toml`;
- Vercel: usar `vercel.json`;
- Cloudflare Pages: build command `node scripts/prepare-release.js`, output `dist/site`.

## Extensao Chrome

Diretorio para teste local:

```text
dist/chrome-extension
```

Arquivo para upload manual:

```text
dist/pals-chrome-extension-v0.1.0.zip
```

O manifest inclui icones 16, 48 e 128 derivados da marca PALS.
O release tambem gera assets iniciais para a primeira submissao manual:

```text
dist/chrome-store-assets/store-icon-128.png
dist/chrome-store-assets/promo-small-440x280.png
dist/chrome-store-assets/screenshot-home-1280x800.png
dist/chrome-store-assets/screenshot-demo-1280x800.png
```

Fluxo:

1. Rodar `node scripts/prepare-release.js`.
2. Abrir `chrome://extensions`.
3. Carregar `dist/chrome-extension` para teste local.
4. Usar o ZIP para submissao quando a conta de publicacao estiver pronta.

Checklist completo:

```text
20-CHROME-WEB-STORE-SUBMISSION.MD
```

## Pacote npm

O `package.json` agora expõe:

```json
{
  ".": "./src/browser/index.js",
  "./browser": "./pals-engine.js",
  "./playwright-export": "./src/report/playwright-export.js"
}
```

O pacote mantém as integrações de browser automation como peer dependencies
opcionais. Isso evita instalar dependencias pesadas por padrao.

Antes de publicar no npm:

1. decidir licenca open-core ou comercial;
2. preencher `repository`, `homepage` e `bugs`;
3. criar conta/organizacao npm;
4. rodar `npm pack --dry-run`;
5. publicar apenas depois de revisar o conteudo do pacote.

## CI

O workflow de CI roda:

- build do bundle;
- checks de sintaxe;
- testes unitarios;
- smoke test da demo publica com Chromium/CDP.

## Criterios De Pronto

- `node scripts/prepare-release.js` gera `dist/`.
- O ZIP da extensao e criado.
- O site estatico e copiado para `dist/site`.
- A pagina publica de privacidade esta incluida.
- Os assets basicos da Chrome Web Store sao gerados quando as ferramentas locais existem.
- O smoke test da demo publica passa.
- O pacote npm fica leve e com dependencias opcionais.
