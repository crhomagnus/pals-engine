# Operating Playbook

## Fluxo Local De Desenvolvimento

1. Rodar demo local.
2. Executar scan manual.
3. Validar JSON.
4. Rodar testes Playwright.
5. Atualizar relatorio.

Comandos esperados:

```bash
python3 -m http.server 8000
node scripts/build-browser-bundle.js
node --check pals-engine.js
node --check extension/content.js
node --check extension/popup.js
node --check src/report/playwright-export.js
node --check site/app.js
node --check site/demo.js
node test/run-tests.js
node scripts/smoke-public-demo.js
node scripts/prepare-release.js
```

## Fluxo De Scan Futuro

```bash
node bin/pals.js scan http://localhost:3000 --adaptive --out report.MD --json scan.json
node bin/pals.js compare baseline.json scan.json --out diff.MD --json diff.json
node bin/pals.js export-playwright scan.json --out pals.generated.spec.js
```

## Fluxo De Cliente Piloto

1. Cliente fornece dominio autorizado.
2. Definir paginas.
3. Rodar PALS em modo somente leitura.
4. Gerar relatorio.
5. Exportar spec Playwright inicial quando o cliente quiser automacao.
6. Revisar problemas com cliente.
7. Fazer re-scan.
8. Converter para plano mensal.

## Fluxo Comercial Do Site

1. Rodar `python3 -m http.server 8080`.
2. Abrir `http://127.0.0.1:8080/site/`.
3. Abrir `http://127.0.0.1:8080/site/demo.html`.
4. Rodar a demo publica ao vivo.
5. Apresentar Pilot Audit, Team Monthly ou CI Setup.
6. Receber lead pelo formulario.
7. Cobrar manualmente por invoice, Stripe Payment Link, PayPal ou transferencia.
8. Executar a auditoria com CLI/extensao.
9. Entregar artefatos e propor recorrencia.

## Fluxo De Publicacao Estatica

1. Rodar `node scripts/build-browser-bundle.js`.
2. Rodar `node scripts/prepare-release.js`.
3. Confirmar que `dist/site` e `dist/chrome-extension` existem.
4. Publicar `dist/site` em GitHub Pages, Cloudflare Pages, Netlify ou Vercel.
5. Testar `/index.html` e `/demo.html`.

## Fluxo De Release

1. Rodar `node test/run-tests.js`.
2. Rodar `node scripts/smoke-public-demo.js`.
3. Rodar `node scripts/prepare-release.js`.
4. Revisar `dist/RELEASE-MANIFEST.json`.
5. Testar extensao carregando `dist/chrome-extension`.
6. Usar `dist/pals-chrome-extension-v0.1.0.zip` para distribuicao manual.

## Fluxo Da Extensao Chrome

1. Rodar `node scripts/build-browser-bundle.js`.
2. Abrir `chrome://extensions`.
3. Ativar Developer mode.
4. Carregar a pasta `extension/`.
5. Abrir pagina autorizada.
6. Executar Quick Audit ou Live Capture.
7. Baixar `.MD` e `.json`.

## Severidade De Findings

### Critical

Fluxo principal impossivel, botao essencial inacessivel, modal bloqueando tudo.

### High

Acao importante oculta, formulario quebrado, foco preso, elemento clicavel sem
nome acessivel.

### Medium

Tooltip inconsistente, hover instavel, layout sobreposto, regioes ambigues.

### Low

Melhorias de semantica, texto auxiliar, pequenas inconsistencias.

## Regras Operacionais

- Nunca executar submit por padrao.
- Nunca manipular dados sensiveis sem confirmacao.
- Sempre salvar mapa bruto.
- Sempre salvar resumo humano.
- Sempre registrar limites encontrados.
