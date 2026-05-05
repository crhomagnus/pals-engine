# Project Foundation

## Nome

**Pointer-Adaptive Layout Scanner Engine**

Sigla: **PALS Engine**

## Definicao

PALS Engine e uma camada de percepcao ativa para interfaces web. Ele usa o
ponteiro como sensor: move o cursor por coordenadas da viewport, coleta sinais
do navegador em cada ponto e monta um mapa operacional da pagina.

## Ideia Base Inviolavel

A tecnologia nasce da varredura da pagina por escaneamento via ponteiro do
mouse. Essa varredura e o eixo central de todo o projeto.

Qualquer modulo futuro deve respeitar esta hierarquia:

1. O ponteiro explora a tela.
2. O navegador revela o que existe naquele ponto.
3. O PALS registra geometria, semantica, estilo, eventos e mudancas.
4. O sistema aprende quais regioes importam.
5. Automacao, QA, acessibilidade e agentes usam esse mapa.

## O Que O PALS Nao Deve Ser

PALS nao deve ser apresentado como ferramenta para burlar protecoes, explorar
sites de terceiros sem permissao ou contornar sistemas anti-bot.

O posicionamento correto e:

- QA de interfaces proprias.
- Auditoria de acessibilidade.
- Automacao consentida de sistemas internos.
- Mapeamento de sistemas legados autorizados.
- Geracao de dados para agentes web em ambientes permitidos.

## Proposta De Valor

Ferramentas comuns falham por dependerem de seletores frageis, XPaths longos,
prints, OCR ou coordenadas fixas. PALS combina posicao, semantica, estilo,
acessibilidade, eventos e memoria para criar uma leitura mais resiliente da
interface.

## Premissas Tecnicas

- O navegador e a fonte primaria da verdade quando a pagina e HTML/CSS/DOM.
- Screenshots podem ser plugin opcional, mas nao sao a base do produto.
- A varredura deve ser adaptativa, nao apenas uma grade burra.
- Toda acao automatizada deve ser auditavel.
- Acoes sensiveis devem exigir confirmacao humana.

