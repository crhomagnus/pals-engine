# Safety Legal Compliance

## Posicionamento

PALS deve ser uma ferramenta para automacao autorizada, QA, acessibilidade e
analise de interfaces proprias ou permitidas.

Nao deve ser comercializado como mecanismo para burlar protecoes, captchas,
controles anti-bot, paywalls, autenticacao ou termos de uso.

## Politicas De Uso Permitido

Permitido:

- Testar aplicacoes proprias.
- Testar ambientes de staging.
- Auditar acessibilidade.
- Automatizar sistemas internos com autorizacao.
- Gerar relatorios de UX e QA.

Nao permitido:

- Contornar sistemas anti-bot.
- Automatizar acoes proibidas por terceiros.
- Coletar dados sem permissao.
- Executar compras, exclusoes ou envios sem confirmacao.
- Usar em sistemas sensiveis sem supervisao.

## Controles Tecnicos

### Allowlist

Clientes devem declarar dominios autorizados.

### Action Policy

Separar acoes:

- `read`
- `hover`
- `focus`
- `click`
- `type`
- `submit`
- `download`
- `delete`
- `purchase`

Por padrao, MVP deve permitir apenas `read`, `hover` e `focus`.

### Human In The Loop

Obrigatorio para:

- Login.
- Pagamento.
- Envio de formulario.
- Exclusao.
- Alteracao de dados.
- Acesso a area sensivel.

### Audit Log

Registrar:

- Quem iniciou.
- Qual URL.
- Qual politica.
- Quais acoes.
- Quais resultados.
- Quais erros.

## Referenciais

- OWASP Top 10 for LLM Applications.
- NIST AI Risk Management Framework.
- OpenAI Computer Use safety guidance.
- GDPR/LGPD para dados pessoais.
- EU AI Act quando aplicavel.

## Regra De Produto

O PALS deve sempre conseguir explicar:

- O que viu.
- Como viu.
- O que fez.
- Por que fez.
- Quem autorizou.

