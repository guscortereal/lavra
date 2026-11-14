/* Conversor mínimo de Markdown para HTML, suficiente para minutas e laudos:
   títulos, parágrafos, negrito, itálico, listas, citações, tabelas, código e linha.
   Todo o texto é escapado antes de virar HTML. */
(function () {
  'use strict';
  const Lavra = (window.Lavra = window.Lavra || {});

  function escapar(texto) {
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function emLinha(texto) {
    let saida = escapar(texto);
    const codigos = [];
    saida = saida.replace(/`([^`\n]+)`/g, (_, c) => {
      codigos.push('<code>' + c + '</code>');
      return '\u0001' + (codigos.length - 1) + '\u0001';
    });
    saida = saida
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(“"])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?”"]|$)/g, '$1<em>$2</em>')
      .replace(/(^|[\s(“"])_([^_\s][^_\n]*?)_(?=[\s).,;:!?”"]|$)/g, '$1<em>$2</em>');
    return saida.replace(/\u0001(\d+)\u0001/g, (_, i) => codigos[Number(i)]);
  }

  function celulas(linha) {
    return linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  }

  const SEPARADOR_TABELA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const ITEM_UL = /^\s*[-*•]\s+(.*)$/;
  const ITEM_OL = /^\s*(\d+)[.)]\s+(.*)$/;

  function paraHtml(markdown) {
    const linhas = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let i = 0;

    while (i < linhas.length) {
      const linha = linhas[i];

      if (!linha.trim()) { i++; continue; }

      // Bloco de código
      const cerca = linha.match(/^\s*```(\w*)\s*$/);
      if (cerca) {
        const corpo = [];
        i++;
        while (i < linhas.length && !/^\s*```\s*$/.test(linhas[i])) corpo.push(linhas[i++]);
        i++; // fecha a cerca (ou fim do texto, durante a geração)
        html.push('<pre><code>' + escapar(corpo.join('\n')) + '</code></pre>');
        continue;
      }

      // Título
      const titulo = linha.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (titulo) {
        const nivel = Math.min(titulo[1].length, 4);
        html.push('<h' + nivel + '>' + emLinha(titulo[2]) + '</h' + nivel + '>');
        i++;
        continue;
      }

      // Linha horizontal
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linha)) { html.push('<hr>'); i++; continue; }

      // Tabela
      if (linha.includes('|') && i + 1 < linhas.length && SEPARADOR_TABELA.test(linhas[i + 1])) {
        const cabeca = celulas(linha);
        i += 2;
        const corpo = [];
        while (i < linhas.length && linhas[i].includes('|') && linhas[i].trim()) corpo.push(celulas(linhas[i++]));
        html.push(
          '<div class="tabela"><table><thead><tr>' +
          cabeca.map((c) => '<th>' + emLinha(c) + '</th>').join('') +
          '</tr></thead><tbody>' +
          corpo.map((l) => '<tr>' + cabeca.map((_, k) => '<td>' + emLinha(l[k] || '') + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }

      // Citação
      if (/^\s*>/.test(linha)) {
        const corpo = [];
        while (i < linhas.length && /^\s*>/.test(linhas[i])) corpo.push(linhas[i++].replace(/^\s*>\s?/, ''));
        html.push('<blockquote>' + paraHtml(corpo.join('\n')) + '</blockquote>');
        continue;
      }

      // Listas
      if (ITEM_UL.test(linha) || ITEM_OL.test(linha)) {
        const ordenada = ITEM_OL.test(linha) && !ITEM_UL.test(linha);
        const padrao = ordenada ? ITEM_OL : ITEM_UL;
        const inicio = ordenada ? Number(linha.match(ITEM_OL)[1]) : 1;
        const itens = [];
        while (i < linhas.length) {
          const m = linhas[i].match(padrao);
          if (m) { itens.push(ordenada ? m[2] : m[1]); i++; continue; }
          // linha de continuação recuada pertence ao item anterior
          if (itens.length && /^\s{2,}\S/.test(linhas[i]) && !ITEM_UL.test(linhas[i]) && !ITEM_OL.test(linhas[i])) {
            itens[itens.length - 1] += ' ' + linhas[i].trim();
            i++;
            continue;
          }
          break;
        }
        const abre = ordenada ? '<ol' + (inicio !== 1 ? ' start="' + inicio + '"' : '') + '>' : '<ul>';
        html.push(abre + itens.map((t) => '<li>' + emLinha(t) + '</li>').join('') + (ordenada ? '</ol>' : '</ul>'));
        continue;
      }

      // Parágrafo: junta linhas até uma linha em branco ou outro bloco
      const paragrafo = [linha];
      i++;
      while (
        i < linhas.length && linhas[i].trim() &&
        !/^\s*```/.test(linhas[i]) && !/^\s{0,3}#{1,6}\s/.test(linhas[i]) &&
        !/^\s*>/.test(linhas[i]) && !ITEM_UL.test(linhas[i]) && !ITEM_OL.test(linhas[i]) &&
        !(linhas[i].includes('|') && i + 1 < linhas.length && SEPARADOR_TABELA.test(linhas[i + 1]))
      ) paragrafo.push(linhas[i++]);
      html.push('<p>' + paragrafo.map(emLinha).join('<br>') + '</p>');
    }

    return html.join('\n');
  }

  Lavra.markdown = { paraHtml, escapar };
})();
