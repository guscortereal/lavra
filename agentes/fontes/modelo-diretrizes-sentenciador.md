<!-- ═══════════════════════════════════════════════════════════════════
     COMANDO DO SENTENCIADOR v13 — Template de uso
     
     COMO USAR:
     1. O Sentenciador v13 já está como system prompt do agente.
     2. No chat do agente, cole este template preenchido + a Fact Sheet.
     3. Preencha os campos entre [ ]. Apague seções não aplicáveis.
     ═══════════════════════════════════════════════════════════════════ -->


<diretrizes_do_magistrado>

  <!-- ─────────────────────────────────────────────
       BLOCO 1 — RESULTADO DO JULGAMENTO (obrigatório)
       ───────────────────────────────────────────── -->

  <resultado>
    [ESCOLHA UM]:
    - PROCEDÊNCIA total dos pedidos
    - IMPROCEDÊNCIA total dos pedidos
    - PROCEDÊNCIA PARCIAL: [especificar quais pedidos acolher e quais rejeitar]
    - EXTINÇÃO SEM MÉRITO: [especificar fundamento — art. 485, [inciso], CPC]
  </resultado>


  <!-- ─────────────────────────────────────────────
       BLOCO 2 — PRELIMINARES (se houver)
       ───────────────────────────────────────────── -->

  <preliminares>
    [Para cada preliminar arguida, indicar:]
    - Falta de interesse de agir: [REJEITAR / ACOLHER / já decidida em saneadora]
    - Inépcia da inicial: [REJEITAR / ACOLHER]
    - Prescrição: [REJEITAR / ACOLHER — prazo aplicável]
    - Impugnação à gratuidade: [REJEITAR / ACOLHER]
    - [Outras]: [REJEITAR / ACOLHER]
    [Se não houver preliminares, apagar esta seção.]
  </preliminares>


  <!-- ─────────────────────────────────────────────
       BLOCO 3 — TUTELA PROVISÓRIA (se houver)
       ───────────────────────────────────────────── -->

  <tutela>
    [ESCOLHA UM]:
    - CONFIRMAR a tutela de urgência anteriormente deferida
    - REVOGAR a tutela de urgência anteriormente deferida
    - Não houve tutela [apagar esta seção]
  </tutela>


  <!-- ─────────────────────────────────────────────
       BLOCO 4 — LITIGÂNCIA DE MÁ-FÉ
       ───────────────────────────────────────────── -->

  <ma_fe>
    [ESCOLHA UM]:
    - SIM — multa de [X]% sobre o valor atualizado da causa
    - NÃO — sem condenação em má-fé
  </ma_fe>


  <!-- ─────────────────────────────────────────────
       BLOCO 5 — CRITÉRIOS DE CONDENAÇÃO
       (preencher se PROCEDENTE ou PARCIALMENTE PROCEDENTE)
       ───────────────────────────────────────────── -->

  <condenacao>

    <dano_moral>
      [ESCOLHA UM]:
      - SIM — valor de R$ [valor]
        Critério: condenar a parte ré a pagar à parte autora indenização
        por danos morais, no valor de R$ 8.000,00 (oito mil reais),
        aplicada, desde a citação, na forma da Lei n. 14.905/24, a título
        de juros moratórios, a SELIC, descontado o IPCA (§1º, do artigo
        406, do CC), e, a título de correção, contado do arbitramento,
        o IPCA (parágrafo único, do artigo 389, do CC).
      - NÃO — rejeitar pedido de dano moral
      - DANO MORAL IN RE IPSA — [sim/não + fundamento]
    </dano_moral>

    <repeticao_indebito>
      [ESCOLHA UM]:
      - REPETIÇÃO EM DOBRO (art. 42, par. único, CDC)
      - REPETIÇÃO SIMPLES (art. 876, CC)
      - SEM REPETIÇÃO (descontos lícitos)
      Critério de correção: valores corrigidos monetariamente pelo IPCA
      desde cada desconto. A contar da citação, incidirá unicamente a
      SELIC, conforme Tema 1.368, do STJ, e artigos 389, parágrafo único,
      e 406, 1º, ambos do CPC, vedada a cumulação com qualquer outro
      encargo, sob pena de bis in idem, por abranger juros moratórios
      e correção monetária.
    </repeticao_indebito>

    <cessacao_descontos>
      [ESCOLHA UM]:
      - SIM — determinar cessação em [X] dias, sob pena de multa diária de R$ [valor]
      - NÃO — descontos mantidos (contrato válido)
    </cessacao_descontos>

    <compensacao>
      [Se a defesa pediu compensação dos valores creditados:]
      - ACOLHER compensação (art. 368, CC)
      - REJEITAR compensação
      - Não houve pedido [apagar]
    </compensacao>

  </condenacao>


  <!-- ─────────────────────────────────────────────
       BLOCO 6 — SUCUMBÊNCIA
       ───────────────────────────────────────────── -->

  <sucumbencia>
    Honorários: [10]% sobre o valor [da condenação / atualizado da causa].
    [Se sucumbência recíproca: distribuir proporcionalmente.]
  </sucumbencia>


  <!-- ─────────────────────────────────────────────
       BLOCO 7 — OBSERVAÇÕES ADICIONAIS (opcional)
       ───────────────────────────────────────────── -->

  <observacoes>
    [Qualquer instrução adicional: teses a adotar, fundamentos específicos,
     pontos de atenção, depósito judicial a liberar, ofício ao INSS, etc.]
  </observacoes>

</diretrizes_do_magistrado>


<!-- ═══════════════════════════════════════════════════════════════════
     FACT SHEET (colar abaixo a Fact Sheet gerada pelo Extrator)
     ═══════════════════════════════════════════════════════════════════ -->

<fact_sheet>

[COLAR AQUI A FACT SHEET COMPLETA]

</fact_sheet>
