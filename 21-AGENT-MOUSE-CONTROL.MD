# Agent Mouse Control

## Objetivo

Adicionar uma camada operacional onde o usuario conversa com um agente local e
o agente move o ponteiro real de acordo com instrucoes explicitas.

Isso exige dois componentes:

- **PALS Agent Overlay**: janela flutuante dentro da aba ativa;
- **PALS Mouse Bridge**: processo local autorizado que recebe comandos e usa
  uma ferramenta do sistema para mover/clicar/digitar.

## Por Que Existe Um Bridge

Uma extensao Chrome comum nao deve controlar o ponteiro real do sistema
operacional sozinha. O controle real do mouse precisa sair do navegador e passar
por um processo local iniciado conscientemente pelo operador.

No Linux atual do projeto, o bridge usa:

```text
xdotool
```

## Como Rodar

Modo real:

```bash
node bin/pals.js mouse-bridge
```

Modo de teste sem mover o ponteiro:

```bash
node bin/pals.js mouse-bridge --dry-run
```

O comando imprime:

```text
Endpoint: http://127.0.0.1:17381
Token: <token-da-sessao>
```

Cole esse token no **PALS Agent Overlay** antes de executar comandos.

## Como Abrir O Overlay

1. Carregar a extensao em `chrome://extensions`.
2. Abrir uma pagina `http` ou `https` autorizada.
3. Clicar no icone do PALS.
4. Clicar em **Open Agent Overlay**.

## Calibracao

Antes de usar comandos por alvo, rode a calibracao:

1. Clique em **Calibrate** no overlay.
2. Coloque o ponteiro real exatamente sobre o marcador `1`.
3. Clique em **Capture**.
4. Repita no marcador `2`.

O PALS salva a conversao entre coordenadas da viewport e coordenadas reais da
tela para aquele origin. Isso melhora a precisao de `mova para o botao login`,
`clique no campo email` e varreduras pelo ponteiro.

## Comandos Suportados

Exemplos:

```text
mova o mouse para x=300 y=420
```

```text
clique no botao login
```

```text
mova o ponteiro para o campo email
```

```text
varra a tela com o ponteiro
```

```text
escaneie esta pagina
```

```text
digite "teste@example.com"
```

## Fluxo De Conversa

O overlay sempre separa duas etapas:

1. **Plan instruction**: interpreta a instrucao e mostra a acao planejada.
2. **Execute action**: envia a acao ao bridge local.

Isso permite conversar com o agente sem disparar cliques ou digitacao
acidentalmente.

## Modelo De Seguranca

- O bridge escuta apenas em `127.0.0.1` por padrao.
- Toda acao de mouse exige token `x-pals-token`.
- O overlay exige confirmacao via botao **Execute action**.
- A calibracao e salva por origin no `localStorage` da pagina.
- O uso correto e limitado a paginas que o operador possui, controla ou esta
  autorizado a testar.
- O bridge possui `--dry-run` para validar comandos sem mover o mouse real.

## Limites Atuais

- A resolucao de alvo por texto e heuristica: usa nomes acessiveis, labels,
  roles, tags e seletores coletados pelo scan.
- A conversao de coordenadas da viewport para coordenadas da tela depende das
  medidas expostas pelo navegador; pode variar por tema, barra superior e
  escala do sistema.
- O agente atual e local e deterministico. Uma API de IA pode ser adicionada
  depois como camada de interpretacao, mantendo o executor seguro.

## Proxima Evolucao

- Calibracao visual: pedir ao operador para confirmar um ponto de referencia da
  viewport e melhorar a precisao tela/viewport.
- Historico de conversa persistente por aba.
- Modo de confirmacao por politica: permitir auto-execucao apenas para `move`,
  mas sempre confirmar `click`, `type` e `submit`.
- Adaptadores para macOS e Windows.
- Integracao com provedor de IA para transformar tarefas maiores em sequencias
  de passos auditaveis.
