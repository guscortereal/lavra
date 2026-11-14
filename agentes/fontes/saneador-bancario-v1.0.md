---
name: saneador-bancario
description: >
  Constrói decisão de saneamento e organização do processo (CPC, art. 357) para
  vara cível especializada em direito bancário do TJMG, a partir dos dados extraídos
  pelo Agente Extrator Processual v3.2 e das diretrizes fornecidas pelo magistrado
  sobre preliminares (acolher / rejeitar / parcial) e provas (deferir / indeferir).
  Aplica os elementos obrigatórios do art. 357 (preliminares, prejudiciais, pontos
  controvertidos, questões de direito, ônus da prova, provas a produzir, designação
  de AIJ) e blinda a decisão contra fundamentação genérica (art. 489, § 1º) e
  alucinação fática ou jurisprudencial. Use SEMPRE que o usuário mencionar:
  saneamento, decisão saneadora, decidir preliminares, deferir ou indeferir provas,
  pontos controvertidos, ônus da prova, distribuição dinâmica, art. 357 do CPC,
  ou pedir para preparar / minutar / redigir saneamento de processo bancário —
  mesmo sem mencionar "skill" ou "agente saneador".
---

# Saneador Bancário

Skill para redação de decisão de saneamento e organização do processo (CPC, art. 357)
em vara cível especializada em direito bancário do TJMG, integrada ao pipeline
multi-agente Extrator → Saneador → Sentenciador.

---

## Quando ativar

Ative esta skill quando ocorrer **qualquer** das seguintes condições:

- O usuário cola dados de um processo extraído pelo Extrator v3.2 com expressões
  como "preparar saneamento", "decidir preliminares", "minutar saneador",
  "rejeitar preliminar X", "deferir perícia", "fixar pontos controvertidos".
- O usuário fornece um arquivo `.txt` ou `.docx` com peças processuais em fase
  posterior à réplica e pede análise de saneamento.
- O usuário cola uma diretriz estruturada (ainda que parcial) sobre preliminares
  e provas, mesmo sem usar o vocabulário canônico.
- O usuário menciona art. 357, art. 373, § 1º, art. 1.015, XI, ou art. 489, § 1º,
  associados a um processo concreto.

### Quando NÃO ativar

- Pedido de sentença direta → ativar `sentenciador-bancario` em seu lugar.
- Pedido de tutela de urgência → decisão interlocutória de urgência tem prompt
  próprio, não saneadora.
- Processo ainda em fase postulatória (sem contestação juntada, ou com preliminares
  arguidas e sem réplica) → devolver ao gabinete para saneamento prévio.

---

## Fluxo de trabalho

### Etapa 1 — Auditoria de inputs

Antes de redigir, verificar:

1. Existem dados estruturados do processo (Extrator v3.2 ou texto colado)?
2. Existe contestação com preliminares ou requerimentos de prova?
3. Há réplica (quando arguidas preliminares ou juntados documentos novos)?
4. O usuário forneceu o **template de diretrizes** preenchido (arquivo
   `template-diretrizes.md`)?

Se 1 ou 2 ausentes → solicitar os dados.
Se 3 ausente quando obrigatório → alertar e devolver à fase anterior.
Se 4 ausente → enviar o template e solicitar preenchimento.

### Etapa 2 — Detecção de prescrição/decadência não suscitada

Antes de seguir as diretrizes, varrer cronologia:

- Data da contratação ou do evento danoso
- Data do ajuizamento
- Prazos prescricionais aplicáveis (CC, art. 206; CDC, art. 27)

Se identificada possível prescrição/decadência ainda não arguida →
**INTERROMPER e alertar o magistrado**, oferecendo a cronologia extraída dos autos.
Esta é a única exceção à regra de não solicitar confirmações intermediárias.

### Etapa 3 — Aplicação das diretrizes

Receber o template preenchido e mapear cada diretriz para a seção correspondente
do agente Saneador Bancário v1.0:

- Preliminares → Seção I do output
- Prejudiciais → Seção II
- Pontos controvertidos → Seção III (extraídos da análise da causa de pedir × defesa)
- Questões de direito → Seção IV
- Distribuição do ônus → Seção V
- Provas → Seção VI
- AIJ → Seção VII (condicional à existência de prova oral deferida)

### Etapa 4 — Redação

Seguir rigorosamente o `<#OUTPUT>` do prompt do agente Saneador Bancário v1.0,
em texto corrido, com os negritos reservados aos verbos decisórios
(ACOLHO, REJEITO, DEFIRO, INDEFIRO) e às determinações imperativas finais.

### Etapa 5 — Bloco de metadados de auditoria

Anexar bloco final destacado contendo:

- Preliminares analisadas: `[n]` — acolhidas: `[n]` / rejeitadas: `[n]` / parciais: `[n]`
- Pontos controvertidos delimitados: `[n]`
- Provas deferidas: `[tipo]` | indeferidas: `[tipo]`
- Distribuição do ônus: `[estática / dinâmica / inversão CDC]`
- Recorribilidade (CPC, art. 1.015, XI): `[SIM / NÃO]`
- Lacunas sinalizadas: `[lista de DADO NÃO ENCONTRADO NOS AUTOS]`
- Alertas ao magistrado: `[lista]`

---

## Catálogo de preliminares bancárias típicas

| Preliminar | Fundamento típico de acolhimento | Fundamento típico de rejeição |
|------------|----------------------------------|-------------------------------|
| Ilegitimidade passiva (cessão de crédito) | Réu não é mais titular do crédito; cessão averbada anteriormente; legitimidade migra ao cessionário. | Cessão não notificada (CC, art. 290) ou solidariedade mantida; banco originário responde até o cumprimento integral. |
| Inépcia da inicial | Ausência absoluta de causa de pedir, pedido juridicamente impossível, ou inicial que não permita defesa (CPC, art. 330, § 1º). | Inicial atende ao art. 319 do CPC; a juntada do contrato pode ser exigida do réu na fase instrutória (CDC, art. 6º, VIII). |
| Falta de interesse de agir | Necessidade de prévia exibição administrativa configurada apenas em pretensões puramente declaratórias quando há recusa documentada. | Resistência à pretensão evidenciada pela contestação; lesão ou ameaça atual (CPC, art. 17). |
| Conexão / Prevenção | Causa de pedir ou pedido idênticos a processo anterior na mesma comarca (CPC, art. 55); risco de decisões conflitantes. | Conexão impugnada apenas formalmente; a identidade fática não se confirma na análise. |
| Litispendência / Coisa julgada | Tríplice identidade — mesmas partes, causa de pedir e pedido (CPC, art. 337, §§ 2º e 4º). | Identidade não verificada; ações com mesmo contrato mas pedidos distintos não geram litispendência. |
| Impugnação ao valor da causa | Valor não corresponde ao proveito econômico pretendido (CPC, art. 292, V). | Valor está em conformidade com o pedido principal; impugnação meramente especulativa. |
| Impugnação à gratuidade | Elementos concretos (renda, patrimônio, bens) afastam a presunção (CPC, art. 99, § 2º). | Declaração de hipossuficiência mantém presunção; impugnação genérica não a afasta. |

---

## Catálogo probatório bancário

| Prova | Quando deferir | Quando indeferir |
|-------|----------------|------------------|
| Pericial grafotécnica | Autor nega especificamente a autoria de assinatura em contrato físico juntado pelo banco. | Autor não impugnou especificamente a assinatura; contrato firmado por assinatura digital ou eletrônica (objeto de outra perícia). |
| Pericial em sistemas (assinatura eletrônica) | Autor nega contratação digital; logs de IP, geolocalização, dispositivo e CPF estão disputados. | Banco juntou trilha de auditoria robusta e não impugnada especificamente; questão é meramente jurídica. |
| Pericial contábil / matemática financeira | Discussão concreta sobre capitalização, *spread*, encargos ou recálculo do débito com cláusulas tidas por abusivas. | Pedido genérico de revisão sem indicação concreta de cláusula impugnada (Súmula 381/STJ). |
| Depoimento pessoal | Esclarecer fato controvertido pessoal (ex.: como ocorreu suposta fraude por terceiro). | Mero pretexto para repetir argumentos da inicial ou da contestação. |
| Prova testemunhal | Fraude por terceiro com testemunhas presenciais; circunstâncias da contratação presencial em agência. | Fato exclusivamente documental; não há fato concreto a ser testemunhado (CPC, art. 443). |

---

## Checklist de validação antes da entrega

- [ ] Toda preliminar arguida foi enfrentada em parágrafo autônomo?
- [ ] Cada ponto controvertido está formulado como frase declarativa específica
      (vinculada a documento, valor, número de contrato ou ID)?
- [ ] O ônus da prova está fixado de forma clara, ponto a ponto?
- [ ] Houve advertência sobre o art. 1.015, XI, do CPC, se houve redistribuição?
- [ ] Cada prova requerida tem deferimento ou indeferimento individualizado e
      fundamentado (vedação ao art. 489, § 1º)?
- [ ] Em caso de pericial deferida: prazo de 15 dias para quesitos e assistente,
      especialidade indicada e determinação de nomeação de perito?
- [ ] Em caso de prova oral deferida: AIJ designada (ou determinada à secretaria)
      e prazo de 15 dias para rol de testemunhas?
- [ ] Foi invocado o art. 357, § 1º, com prazo de cinco dias para esclarecimentos?
- [ ] O bloco de metadados de auditoria foi gerado integralmente?
- [ ] Nenhuma fundamentação genérica do tipo "presentes os pressupostos, dou o
      feito por saneado"?
- [ ] Nenhuma jurisprudência citada sem fonte verificável (autos, lista de temas
      ou fornecimento explícito do magistrado)?
- [ ] Nenhum juízo de mérito antecipado ("evidente a fraude", "patente a abusividade")?

---

## Anti-padrões críticos

1. **Antecipação do mérito** — vedadas expressões como "evidente a fraude" ou
   "patente a abusividade" antes da instrução. A decisão saneadora *organiza*; não
   *julga*.

2. **Saneamento por adesão** — vedado "presentes os pressupostos processuais e as
   condições da ação, dou o feito por saneado". Cada preliminar e cada prova exige
   enfrentamento individualizado e fundamentado.

3. **Inversão do ônus por reflexo** — não inverter o ônus da prova apenas porque
   há relação de consumo. A inversão exige verossimilhança ou hipossuficiência
   probatória (CDC, art. 6º, VIII), aferidas em concreto.

4. **Perícia *catch-all*** — não deferir perícia sem especialidade indicada e sem
   delimitar o objeto. Perícia genérica viola o art. 489, § 1º, e gera nulidade
   por cerceamento.

5. **Pontos controvertidos genéricos** — vedadas formulações como "a regularidade
   do contrato" ou "os encargos cobrados". Especificar cláusula, valor, número de
   contrato e ID.

6. **Decisão de prova oral sem AIJ** — havendo prova oral deferida, há audiência.
   Vedado deferir e não designar (gera retrabalho processual).

7. **Saneamento de matéria suspensa** — antes de redigir, verificar se a tese
   nuclear da causa coincide com Tema afetado em sobrestamento (STF/STJ/TJMG).
   Em caso positivo, devolver ao gabinete para sobrestamento (art. 1.037, II).

---

## Integração com o pipeline

```
   [Extrator Processual v3.2]
            │
            ▼ (texto estruturado dos autos)
   [+ Diretrizes do magistrado via template-diretrizes.md]
            │
            ▼
   [Saneador Bancário v1.0]  ◄── ESTA SKILL
            │
            ▼ (decisão saneadora estabilizada)
   [Fase instrutória: perícia / AIJ]
            │
            ▼
   [Sentenciador v13.3-Claude]
```

A decisão saneadora produzida por esta skill é estabilizada após cinco dias
(CPC, art. 357, § 1º) e passa a integrar a base de inputs do Sentenciador na fase
de julgamento, como insumo de delimitação fática (pontos controvertidos) e
jurídica (questões de direito relevantes).

---

## Referências cruzadas no ecossistema

- **Prompt do agente:** Saneador Bancário v1.0 (XML canônico, 6 seções —
  PERSONA, TAREFA, CONTEXTO, OUTPUT, RESTRIÇÕES, FORMATO).
- **Template de input:** `template-diretrizes.md` (neste mesmo diretório).
- **Skill irmã:** `prompt-engineer-xml` — para iterar versões do agente.
- **Skill irmã:** `guia-judicial-ia` — para conteúdo educacional sobre saneamento
  voltado a magistrados.
- **Agentes upstream:** Extrator Processual v3.2.
- **Agentes downstream:** Sentenciador v13.3-Claude, Embargos v3.0.

---

## Versionamento

- **v1.0 — 2026-05-08:** Versão inicial. Cobertura completa do art. 357 do CPC,
  catálogo bancário fechado de preliminares e provas, integração com pipeline
  Extrator → Sentenciador.
