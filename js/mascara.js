/* Máscara local: troca dados pessoais por marcadores «TIPO_0001» antes do envio
   e devolve os dados reais ao texto que volta. Tudo acontece no navegador. */
(function () {
  'use strict';
  const Lavra = (window.Lavra = window.Lavra || {});

  // A ordem importa: padrões mais específicos primeiro.
  const PADROES = [
    { tipo: 'CNPJ', re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g },
    { tipo: 'CPF', re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
    { tipo: 'CPF', re: /(?<=\bCPF(?:\/MF)?[^\d\n]{0,12})\d{11}\b/gi },
    { tipo: 'CNPJ', re: /(?<=\bCNPJ(?:\/MF)?[^\d\n]{0,12})\d{14}\b/gi },
    { tipo: 'EMAIL', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
    { tipo: 'TELEFONE', re: /(?:\+55\s?)?\(\d{2}\)\s?9?\d{4}[-.\s]?\d{4}\b/g },
    { tipo: 'TELEFONE', re: /\b\d{2}\s9\d{4}[-\s]\d{4}\b/g },
    { tipo: 'CEP', re: /\b\d{5}-\d{3}\b/g },
    { tipo: 'RG', re: /(?<=\b(?:RG|identidade)[^\d\n]{0,15})(?:[A-Z]{2}-?)?\d{1,2}\.?\d{3}\.?\d{3}(?:-?[\dxX])?\b/gi },
  ];

  // Número único do processo (CNJ): nunca é mascarado.
  const CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g;

  const MARCADOR = /«([A-Z]+)_(\d{4})»/g;

  const PAPEIS = '(?:autor|autora|réu|ré|requerente|requerid[oa]|embargante|embargad[oa]|exequente|executad[oa]|apelante|apelad[oa]|agravante|agravad[oa]|reclamante|reclamad[oa]|advogad[oa]|procurador|procuradora|testemunha|perit[oa])';
  // O papel é procurado sem diferenciar maiúsculas; o nome exige iniciais maiúsculas
  // e não atravessa a quebra de linha.
  const PAPEL = new RegExp('(?<![\\wÀ-ÿ])' + PAPEIS + '(?:[ \\t]*\\(a\\))?[ \\t]*[:\\-–][ \\t]*(?:(?:Dra?|Sra?)\\.?[ \\t]+)?', 'gi');
  const NOME = /[A-ZÀ-Ý][\wÀ-ÿ'.]*(?:[ \t]+(?:d[aeo]s?|e|[A-ZÀ-Ý][\wÀ-ÿ'.]*)){1,7}/y;

  function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function listaDeNomes(bruto) {
    return String(bruto || '')
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter((n) => n.length >= 3)
      .sort((a, b) => b.length - a.length); // nomes compostos antes das partes
  }

  /** Cria uma sessão de máscara: o mesmo dado recebe sempre o mesmo marcador. */
  function criar(nomesBrutos) {
    const nomes = listaDeNomes(nomesBrutos);
    const paraMarcador = new Map(); // "TIPO|valor normalizado" -> marcador
    const paraOriginal = new Map(); // marcador -> valor como apareceu primeiro
    const contagem = {};

    function marcador(tipo, valor) {
      const chave = tipo + '|' + valor.toLowerCase().replace(/\s+/g, ' ');
      let m = paraMarcador.get(chave);
      if (!m) {
        contagem[tipo] = (contagem[tipo] || 0) + 1;
        m = '«' + tipo + '_' + String(contagem[tipo]).padStart(4, '0') + '»';
        paraMarcador.set(chave, m);
        paraOriginal.set(m, valor);
      }
      return m;
    }

    function aplicar(texto) {
      if (!texto) return texto;
      // Guarda os números CNJ para que nenhum padrão os alcance.
      const guardados = [];
      let saida = texto.replace(CNJ, (achado) => {
        guardados.push(achado);
        return '\u0000' + (guardados.length - 1) + '\u0000';
      });
      for (const nome of nomes) {
        const re = new RegExp('(?<![\\wÀ-ÿ])' + escaparRegex(nome).replace(/\s+/g, '\\s+') + '(?![\\wÀ-ÿ])', 'gi');
        saida = saida.replace(re, (achado) => marcador('NOME', achado));
      }
      for (const padrao of PADROES) {
        saida = saida.replace(padrao.re, (achado) => marcador(padrao.tipo, achado));
      }
      return saida.replace(/\u0000(\d+)\u0000/g, (_, i) => guardados[Number(i)]);
    }

    function restaurar(texto) {
      if (!texto || paraOriginal.size === 0) return texto;
      return texto.replace(MARCADOR, (achado) => (paraOriginal.has(achado) ? paraOriginal.get(achado) : achado));
    }

    return {
      aplicar,
      restaurar,
      get total() { return paraOriginal.size; },
      get resumo() {
        return Object.keys(contagem).map((tipo) => contagem[tipo] + ' ' + tipo).join(', ');
      },
    };
  }

  /** Procura nomes logo após a indicação de papel ("Autor: Fulano de Tal"). */
  function sugerirNomes(texto) {
    const achados = new Map();
    const fonte = texto || '';
    let m;
    PAPEL.lastIndex = 0;
    while ((m = PAPEL.exec(fonte))) {
      NOME.lastIndex = PAPEL.lastIndex;
      const n = NOME.exec(fonte);
      if (!n) continue;
      const nome = n[0]
        .replace(/(?:[ \t]+(?:d[aeo]s?|e))+$/, '') // conectivo solto no fim
        .replace(/[.,;:]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (nome.split(' ').length >= 2 && nome.length <= 80) achados.set(nome.toLowerCase(), nome);
    }
    return Array.from(achados.values());
  }

  Lavra.mascara = { criar, sugerirNomes, MARCADOR };
})();
