# Chrome Extension

## Objetivo

A extensao Chrome e o primeiro canal distribuivel do PALS QA/A11y Auditor. Ela
permite rodar auditorias locais em paginas autorizadas sem SaaS, sem custo de
infraestrutura e sem enviar dados para servidor.

## Local

Arquivos:

- `extension/manifest.json`
- `extension/content.js`
- `extension/popup.html`
- `extension/popup.css`
- `extension/popup.js`
- `extension/report.js`
- `extension/vendor/pals-engine.js`

O arquivo `extension/vendor/pals-engine.js` e copiado automaticamente pelo build:

```bash
node scripts/build-browser-bundle.js
```

## Permissoes

A extensao usa injecao sob demanda para reduzir risco de revisao e exposicao:

- `activeTab`: libera acesso apenas ao tab ativo depois de acao explicita do usuario;
- `scripting`: injeta os arquivos empacotados do PALS no tab ativo;
- `downloads`: salva relatorios Markdown/JSON localmente.

Ela nao declara `host_permissions` amplas e nao carrega codigo remoto.

## Como Carregar No Chrome/Chromium

1. Abra `chrome://extensions`.
2. Ative **Developer mode**.
3. Clique **Load unpacked**.
4. Selecione a pasta `extension/`.
5. Abra uma pagina `http` ou `https`.
6. Clique no icone do PALS.

## Modos

### Quick Audit

Executa uma auditoria local por grade da viewport. E util para um resultado
rapido de QA/A11y sem mover manualmente o ponteiro.

### Live Capture

Ativa a lente do PALS e registra amostras reais enquanto o operador move o
ponteiro pela pagina. Esse modo preserva melhor o alicerce do projeto: a tela e
explorada por movimento real do cursor.

## Downloads

A extensao gera:

- Markdown `.MD`.
- JSON bruto.

## Limite Tecnico Importante

Extensoes comuns do Chrome nao devem mover o ponteiro real automaticamente sem
permissoes invasivas como debugger/native host. Por isso:

- use a extensao para auditoria local e captura viva humana;
- use o CLI `pals scan --adaptive` quando precisar de varredura automatizada e
  repetivel em CI/local.

## Posicionamento Comercial

Essa extensao e adequada para:

- demonstracao para clientes;
- auditorias manuais assistidas;
- consultoria QA/A11y;
- coleta local de evidencias;
- fluxo free/local do produto.

## Submissao

O pacote de submissao manual fica documentado em:

- `20-CHROME-WEB-STORE-SUBMISSION.MD`
