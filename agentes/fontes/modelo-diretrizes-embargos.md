<!-- ═══════════════════════════════════════════════════════════════════
     COMANDO DO AGENTE EMBARGOS v1 — Template de uso
     
     1. O prompt EMBARGOS v1 já está como system prompt do agente.
     2. Preencha os campos abaixo e cole no chat do agente.
     ═══════════════════════════════════════════════════════════════════ -->


<decisao_embargada>
  [Colar aqui o texto integral da sentença/decisão embargada,
   ou um resumo dos fundamentos principais]
</decisao_embargada>


<razoes_dos_embargos>
  [Resumir as razões do embargante:]
  - Vício alegado: [omissão / contradição / obscuridade / erro material]
  - Ponto específico: [qual trecho/questão da decisão]
  - Fundamento do embargante: [o que alega — ex: "o juízo não analisou
    o pedido de compensação", "há contradição entre o parágrafo X e o
    dispositivo", "nome do autor está errado"]
</razoes_dos_embargos>


<manifestacao_contraria>
  [Se houve intimação para efeitos infringentes e a parte se manifestou,
   resumir. Se não houve, apagar esta seção ou deixar "Não houve."]
</manifestacao_contraria>


<diretrizes_do_magistrado>
  - Resultado: [REJEITAR / ACOLHER / ACOLHER COM EFEITOS INFRINGENTES]
  - Fundamento: [ex: "a decisão já enfrentou a questão no parágrafo X",
    "há omissão real quanto ao pedido de compensação", "erro no nome do réu"]
  - Multa protelatória: [NÃO / SIM — percentual: 1% ou 2%]
  - Observações: [qualquer instrução adicional]
</diretrizes_do_magistrado>


<!-- ═══════════════════════════════════════════════════════════════════
     VARIANTES RÁPIDAS (preencher apenas as diretrizes, colar decisão)
     ═══════════════════════════════════════════════════════════════════ -->


<!-- VARIANTE A — REJEIÇÃO SIMPLES (rediscussão de mérito) -->

<diretrizes_do_magistrado>
  - Resultado: REJEITAR
  - Fundamento: a decisão enfrentou todos os pontos. O embargante busca
    rediscutir o mérito.
  - Multa: NÃO
</diretrizes_do_magistrado>


<!-- VARIANTE B — REJEIÇÃO COM MULTA PROTELATÓRIA -->

<diretrizes_do_magistrado>
  - Resultado: REJEITAR
  - Fundamento: embargos protelatórios. A parte repete os mesmos
    argumentos já apreciados e rejeitados.
  - Multa: SIM — 1% sobre o valor atualizado da causa.
</diretrizes_do_magistrado>


<!-- VARIANTE C — ACOLHIMENTO POR OMISSÃO -->

<diretrizes_do_magistrado>
  - Resultado: ACOLHER
  - Fundamento: há omissão real quanto a [especificar o ponto omitido].
    Suprir a omissão para consignar que [especificar o conteúdo].
  - Multa: NÃO
</diretrizes_do_magistrado>


<!-- VARIANTE D — ACOLHIMENTO POR ERRO MATERIAL -->

<diretrizes_do_magistrado>
  - Resultado: ACOLHER
  - Fundamento: erro material em [especificar: nome, valor, data].
    Onde se lê "[errado]", leia-se "[correto]".
  - Multa: NÃO
</diretrizes_do_magistrado>


<!-- VARIANTE E — ACOLHIMENTO COM EFEITOS INFRINGENTES -->

<diretrizes_do_magistrado>
  - Resultado: ACOLHER COM EFEITOS INFRINGENTES
  - Fundamento: [especificar o vício e por que sua correção altera
    a conclusão do julgado]
  - Novo comando dispositivo: [especificar]
  - Contraditório: [houve / será intimada a parte contrária]
  - Multa: NÃO
</diretrizes_do_magistrado>
