/* Lavra — aplicação. Monta as páginas Oficina, Agentes e Configurações,
   guarda os casos no navegador e conduz a geração das minutas. */
(function () {
  'use strict';

  const Lavra = window.Lavra;
  const DADOS = window.LAVRA_DADOS;
  const e = Lavra.markdown.escapar;
  const $ = (seletor, raiz) => (raiz || document).querySelector(seletor);

  const LIMITE_ANEXOS = 30 * 1024 * 1024; // o pedido inteiro não pode passar de 32 MB
  const PENDENCIA = /\[(?:PREENCHER|ESCOLHA UM|COLAR)[^\]]*\]/gi;

  const estado = {
    config: Lavra.dados.config.ler(),
    extras: Lavra.dados.agentes.ler(),
    casos: [],
    caso: null,
    agenteId: 'extrator',
    anexos: {},     // casoId -> campo -> [{ nome, tamanho, base64 }]; só na memória da aba
    geracao: null,  // { agenteId, bruto, controlador, mascara }
    colar: null,    // modo sem chave: { agenteId, prompt, mascara }
    visao: 'ver',
    avisos: null,   // { tipo, titulo, itens }
  };

  // ======================================================================
  // Agentes
  // ======================================================================

  function agentes() {
    const editados = estado.extras.editados;
    const comEdicao = (a) => (editados[a.id] != null ? Object.assign({}, a, { prompt: editados[a.id], editado: true }) : a);
    return DADOS.agentes.map(comEdicao).concat(estado.extras.importados.map((a) => comEdicao(Object.assign({ importado: true }, a))));
  }

  function agenteAtual() {
    const lista = agentes();
    return lista.find((a) => a.id === estado.agenteId) || lista[0];
  }

  function novoAgenteImportado(nome, prompt) {
    return {
      id: 'imp-' + Date.now().toString(36),
      nome,
      versao: '',
      papel: 'Agente importado',
      descricao: 'Instruções importadas por você. Usa os insumos que estiverem preenchidos.',
      prompt,
      verbo: 'Gerar',
      entradas: ['autos', 'fact_sheet', 'diretrizes', 'minuta', 'base_conhecimento'].map((campo) => ({ campo })),
      instrucao: 'Execute a tarefa conforme as suas instruções, com os insumos acima.',
    };
  }

  // ======================================================================
  // Casos
  // ======================================================================

  function novoCaso() {
    const agora = new Date().toISOString();
    return { id: Lavra.dados.novoId(), titulo: '', campos: {}, saidas: {}, nomes: '', criado: agora, atualizado: agora };
  }

  let gravacaoPendente = null;
  function gravarCaso(imediato) {
    clearTimeout(gravacaoPendente);
    const gravar = () => Lavra.dados.casos.gravar(estado.caso);
    if (imediato) return gravar();
    gravacaoPendente = setTimeout(gravar, 500);
  }

  function rotuloCaso(caso) {
    return caso.titulo.trim() || 'Caso sem título';
  }

  function anexosDe(campo) {
    const doCaso = estado.anexos[estado.caso.id] || {};
    return doCaso[campo] || [];
  }

  // ======================================================================
  // Utilidades
  // ======================================================================

  function torrada(texto) {
    const el = $('#torrada');
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(torrada.t);
    torrada.t = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function milhar(n) {
    return Number(n || 0).toLocaleString('pt-BR');
  }

  function tokensAprox(caracteres) {
    const t = Math.round(caracteres / 3.2);
    return t >= 1000 ? Math.round(t / 1000) + ' mil' : String(t);
  }

  function tamanhoLegivel(bytes) {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function nomeArquivo(sufixo, extensao) {
    const base = (rotuloCaso(estado.caso) + '-' + sufixo)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return (base || 'minuta') + '.' + extensao;
  }

  function baixar(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob(conteudo, { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** Rejeita se a promessa não se resolver no prazo (o navegador pode deixá-la pendente). */
  function comPrazo(promessa, ms) {
    return Promise.race([promessa, new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('prazo')), ms))]);
  }

  async function copiar(texto, html) {
    try {
      if (html && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await comPrazo(navigator.clipboard.write([new ClipboardItem({
          'text/plain': new Blob([texto], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        })]), 2000);
        return true;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await comPrazo(navigator.clipboard.writeText(texto), 2000);
        return true;
      }
    } catch (erro) { /* cai na alternativa abaixo */ }
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (erro) { ok = false; }
    area.remove();
    return ok;
  }

  function lerArquivo(arquivo, comoBase64) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(leitor.error);
      leitor.onload = () => resolve(comoBase64 ? String(leitor.result).split(',')[1] : String(leitor.result));
      if (comoBase64) leitor.readAsDataURL(arquivo); else leitor.readAsText(arquivo);
    });
  }

  function escolherArquivo(aceita, multiplo) {
    return new Promise((resolve) => {
      const entrada = document.createElement('input');
      entrada.type = 'file';
      entrada.accept = aceita;
      entrada.multiple = !!multiplo;
      entrada.onchange = () => resolve(Array.from(entrada.files || []));
      entrada.click();
    });
  }

  function classificacaoDoLaudo(texto) {
    const blocos = texto.match(/```json[\s\S]*?```/g);
    const alvo = blocos ? blocos[blocos.length - 1] : texto.slice(-2500);
    const m = alvo.match(/REJEITADA|INADEQUADA|APROVADA COM RESSALVAS|APROVADA/i);
    if (!m) return null;
    const rotulo = m[0].toUpperCase();
    const classe = { 'REJEITADA': 'rejeitada', 'INADEQUADA': 'inadequada', 'APROVADA COM RESSALVAS': 'ressalvas', 'APROVADA': 'aprovada' }[rotulo];
    return { rotulo, classe };
  }

  // ======================================================================
  // Montagem do pedido
  // ======================================================================

  function embrulhar(tag, texto) {
    const inicio = texto.trimStart();
    if (inicio.startsWith('<' + tag + '>') || inicio.startsWith('<#' + tag + '>')) return texto.trim();
    return '<' + tag + '>\n' + texto.trim() + '\n</' + tag + '>';
  }

  /** Reúne os insumos do agente. Devolve faltas, pendências, texto e anexos. */
  function montarEntrada(agente, mascara) {
    const faltas = [];
    const pendencias = new Set();
    const blocos = [];
    const documentos = [];
    let preenchidos = 0;

    for (const entrada of agente.entradas) {
      const def = DADOS.campos[entrada.campo];
      let texto = (estado.caso.campos[entrada.campo] || '').trim();
      const anexos = def.pdf ? anexosDe(entrada.campo) : [];
      if (!texto && !anexos.length) {
        if (entrada.obrigatorio) faltas.push(def.rotulo);
        continue;
      }
      preenchidos++;
      if (entrada.campo === 'diretrizes') {
        // "[PREENCHER …]" sozinho é a menção genérica que o próprio protocolo das diretrizes faz; não é campo pendente.
        (texto.match(PENDENCIA) || [])
          .filter((p) => !/^\[\w+(?: UM)?\s*(?:…|\.{3})\s*\]$/i.test(p))
          .forEach((p) => pendencias.add(p));
      }
      if (mascara) texto = mascara.aplicar(texto);
      if (anexos.length) {
        const nomes = anexos.map((a) => a.nome).join(', ');
        const nota = '(' + def.rotulo + ' em PDF anexado a esta mensagem: ' + nomes + '.)';
        texto = texto ? nota + '\n\n' + texto : nota;
        anexos.forEach((a) => documentos.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: a.base64 },
          title: a.nome,
        }));
      }
      blocos.push(embrulhar(def.tag, texto));
    }
    if (!preenchidos && !faltas.length) faltas.push('pelo menos um insumo');

    const textoUsuario = blocos.join('\n\n') + '\n\n' + agente.instrucao;
    let system = agente.prompt + '\n\n' + DADOS.notaExecucao;
    if (mascara && mascara.total) system += '\n\n' + DADOS.notaMascara;
    return { faltas, pendencias: Array.from(pendencias), textoUsuario, documentos, system };
  }

  function promptParaColar(pedido) {
    return '<instrucoes_do_agente>\n' + pedido.system + '\n</instrucoes_do_agente>\n\n' + pedido.textoUsuario;
  }

  // ======================================================================
  // Geração
  // ======================================================================

  function registrarSaida(agente, texto, extra) {
    estado.caso.saidas[agente.id] = Object.assign({ texto, data: new Date().toISOString() }, extra || {});
    if (agente.saidaPara) estado.caso.campos[agente.saidaPara] = texto;
    return gravarCaso(true);
  }

  async function gerar() {
    if (estado.geracao) return;
    const agente = agenteAtual();
    const config = estado.config;
    estado.avisos = null;

    const mascara = config.mascara ? Lavra.mascara.criar(estado.caso.nomes) : null;
    const pedido = montarEntrada(agente, mascara);

    if (pedido.faltas.length) {
      estado.avisos = { tipo: 'erro', titulo: 'Falta preencher:', itens: pedido.faltas };
      return renderOficina();
    }
    if (pedido.pendencias.length) {
      estado.avisos = { tipo: 'erro', titulo: 'As diretrizes ainda têm campos pendentes. Resolva-os antes de gerar:', itens: pedido.pendencias };
      return renderOficina();
    }

    if (config.modo === 'prompt') {
      const prompt = promptParaColar(pedido);
      // A cópia começa ainda dentro do clique; o painel aparece sem esperar por ela,
      // para o caso de o navegador demorar ou pedir permissão.
      const copia = copiar(prompt);
      estado.colar = { agenteId: agente.id, prompt, mascara, temPdf: pedido.documentos.length > 0 };
      renderOficina();
      torrada((await copia) ? 'Prompt copiado. Cole no Claude.' : 'Não consegui copiar sozinho: use o botão "Copiar de novo".');
      return;
    }
    if (config.modo === 'direta' && !config.chave.trim()) {
      estado.avisos = { tipo: 'erro', titulo: 'Falta a chave da API. Informe-a em Configurações ou escolha outro modo de ligação.', itens: [] };
      return renderOficina();
    }
    if (config.modo === 'ponte' && (!config.ponteUrl.trim() || !config.ponteCodigo.trim())) {
      estado.avisos = { tipo: 'erro', titulo: 'Falta a URL ou o código de acesso da ponte. Informe-os em Configurações.', itens: [] };
      return renderOficina();
    }

    const conteudo = pedido.documentos.concat([{ type: 'text', text: pedido.textoUsuario }]);
    const geracao = { agenteId: agente.id, casoId: estado.caso.id, bruto: '', controlador: new AbortController(), mascara };
    estado.geracao = geracao;
    estado.colar = null;
    estado.visao = 'ver';
    renderOficina();

    let quadro = null;
    const pintar = () => {
      quadro = null;
      if (estado.geracao !== geracao) return;
      const folha = $('#folha');
      if (!folha) return;
      const noFim = folha.scrollHeight - folha.scrollTop - folha.clientHeight < 90;
      const visivel = mascara ? mascara.restaurar(geracao.bruto) : geracao.bruto;
      folha.innerHTML = Lavra.markdown.paraHtml(visivel) || '<p class="dica">Lendo os insumos e preparando a resposta…</p>';
      if (noFim) folha.scrollTop = folha.scrollHeight;
      const conta = $('#conta-saida');
      if (conta) conta.textContent = milhar(visivel.length) + ' caracteres';
    };

    let resultado = null;
    let falha = null;
    try {
      resultado = await Lavra.api.gerar({
        config,
        system: pedido.system,
        conteudo,
        sinal: geracao.controlador.signal,
        aoTexto(trecho) {
          geracao.bruto += trecho;
          if (!quadro) quadro = setTimeout(pintar, 120);
        },
      });
    } catch (erro) {
      falha = erro;
    }
    clearTimeout(quadro);

    const texto = mascara ? mascara.restaurar(geracao.bruto) : geracao.bruto;
    const interrompida = falha && falha.name === 'AbortError';
    estado.geracao = null;

    // Se o usuário trocou de caso durante a geração, grava no caso de origem.
    const casoOrigem = estado.casos.find((c) => c.id === geracao.casoId) || estado.caso;
    const casoVisivel = estado.caso;
    estado.caso = casoOrigem;
    if (texto.trim()) {
      await registrarSaida(agente, texto, {
        modelo: resultado ? resultado.modelo : config.modelo,
        uso: resultado ? resultado.uso : null,
        parada: interrompida ? 'interrompida' : falha ? 'erro' : resultado.parada,
        mascarados: mascara ? mascara.total : 0,
      });
    }
    estado.caso = casoVisivel;

    if (falha && !interrompida) {
      estado.avisos = { tipo: 'erro', titulo: falha.message || 'A geração falhou.', itens: [] };
    } else if (resultado && resultado.parada === 'refusal') {
      estado.avisos = { tipo: 'alerta', titulo: 'O modelo recusou este pedido. Reveja os insumos ou tente outro modelo em Configurações.', itens: [] };
    } else if (resultado && resultado.parada === 'max_tokens') {
      estado.avisos = { tipo: 'alerta', titulo: 'A resposta atingiu o tamanho máximo e pode estar incompleta. Confira o final do texto.', itens: [] };
    } else if (interrompida) {
      estado.avisos = { tipo: 'alerta', titulo: 'Geração interrompida. O texto parcial foi mantido.', itens: [] };
    }
    renderOficina();
    if (!falha && texto.trim()) torrada(agente.nome + ': resultado pronto.');
  }

  // ======================================================================
  // Página: Oficina
  // ======================================================================

  function htmlCampo(agente, entrada) {
    const def = DADOS.campos[entrada.campo];
    const valor = estado.caso.campos[entrada.campo] || '';
    const anexos = def.pdf ? anexosDe(entrada.campo) : [];
    const ferramentas = [];
    ferramentas.push('<button class="elo" type="button" data-acao="abrir-texto" data-campo="' + entrada.campo + '">Abrir arquivo de texto</button>');
    if (def.pdf) ferramentas.push('<button class="elo" type="button" data-acao="anexar-pdf" data-campo="' + entrada.campo + '">Anexar PDF</button>');
    if (def.biblioteca) {
      ferramentas.push('<button class="elo" type="button" data-acao="biblioteca">Biblioteca de diretrizes</button>');
      if (agente.modeloDiretrizes && DADOS.modelosDiretrizes[agente.modeloDiretrizes]) {
        ferramentas.push('<button class="elo" type="button" data-acao="modelo-branco">Modelo em branco</button>');
      }
    }
    if (valor) ferramentas.push('<button class="elo" type="button" data-acao="limpar-campo" data-campo="' + entrada.campo + '">Limpar</button>');
    return (
      '<div class="campo">' +
        '<div class="cabeca"><label for="campo-' + entrada.campo + '">' + e(def.rotulo) + '</label>' +
          (entrada.obrigatorio ? '<span class="obrig">necessário</span>' : '<span class="opc">opcional</span>') + '</div>' +
        '<textarea id="campo-' + entrada.campo + '" data-campo="' + entrada.campo + '" rows="' + (def.linhas || 6) + '" spellcheck="false" placeholder="' + e(def.dica) + '">' + e(valor) + '</textarea>' +
        (anexos.length ? '<div class="anexos">' + anexos.map((a, i) =>
          '<span class="anexo">' + e(a.nome) + ' · ' + tamanhoLegivel(a.tamanho) +
          '<button type="button" data-acao="tirar-anexo" data-campo="' + entrada.campo + '" data-indice="' + i + '" aria-label="Remover anexo ' + e(a.nome) + '">×</button></span>').join('') + '</div>' : '') +
        '<div class="ferramentas">' + ferramentas.join('') +
          '<span class="conta" data-conta="' + entrada.campo + '">' + (valor ? milhar(valor.length) + ' caracteres' : '') + '</span></div>' +
      '</div>'
    );
  }

  function htmlAvisos() {
    const a = estado.avisos;
    if (!a) return '';
    return '<div class="aviso ' + a.tipo + '" role="alert">' + e(a.titulo) +
      (a.itens && a.itens.length ? '<ul>' + a.itens.map((i) => '<li>' + e(i) + '</li>').join('') + '</ul>' : '') + '</div>';
  }

  function descricaoModo() {
    const c = estado.config;
    const modelo = Lavra.api.MODELOS.find((m) => m.id === c.modelo);
    if (c.modo === 'prompt') return 'Modo sem chave: copiar e colar';
    return (c.modo === 'ponte' ? 'Pela ponte' : 'Chave própria') + ' · ' + (modelo ? modelo.nome : c.modelo);
  }

  function htmlInsumos(agente) {
    const gerando = !!estado.geracao;
    const semChave = estado.config.modo === 'prompt';
    const temAnexo = agente.entradas.some((en) => DADOS.campos[en.campo].pdf && anexosDe(en.campo).length);
    const tamanho = agente.prompt.length + agente.entradas.reduce((s, en) => s + (estado.caso.campos[en.campo] || '').length, 0);
    return (
      '<section class="painel insumos">' +
        '<header><h2>' + e(agente.nome) + (agente.versao ? ' <span class="dica">' + e(agente.versao) + '</span>' : '') + '</h2><p>' + e(agente.descricao) + '</p></header>' +
        '<div class="corpo">' +
          agente.entradas.map((en) => htmlCampo(agente, en)).join('') +
          '<details class="sigilo"' + (estado.caso.nomes ? ' open' : '') + '>' +
            '<summary>Máscara local: ' + (estado.config.mascara ? 'ligada' : 'desligada') + '</summary>' +
            '<label class="chave"><input type="checkbox" id="mascara-ligada"' + (estado.config.mascara ? ' checked' : '') + '>' +
              '<span>Trocar CPF, CNPJ, e-mail, telefone, CEP, RG e os nomes abaixo por marcadores antes do envio, e restaurar na volta.</span></label>' +
            '<label for="nomes">Nomes a ocultar <span class="dica">(um por linha)</span></label>' +
            '<textarea id="nomes" rows="3" spellcheck="false" placeholder="Maria Aparecida de Souza&#10;João Carlos Pereira">' + e(estado.caso.nomes || '') + '</textarea>' +
            '<div class="ferramentas"><button class="elo" type="button" data-acao="sugerir-nomes">Sugerir nomes a partir dos insumos</button></div>' +
            (temAnexo && estado.config.mascara ? '<p class="aviso alerta">A máscara não alcança o conteúdo de PDF anexado: ele segue como está.</p>' : '') +
          '</details>' +
          htmlAvisos() +
        '</div>' +
        '<div class="acao">' +
          (gerando
            ? '<button class="botao perigo" type="button" data-acao="parar">Parar</button><span class="dica">Gerando…</span>'
            : '<button class="botao primario" type="button" data-acao="gerar">' + e(semChave ? 'Montar e copiar prompt' : agente.verbo) + '</button>') +
          '<span class="modo">' + e(descricaoModo()) + ' · <a href="#/config">alterar</a><br>≈ ' + tokensAprox(tamanho) + ' tokens de entrada' + (temAnexo ? ' + PDF' : '') + '</span>' +
        '</div>' +
      '</section>'
    );
  }

  function htmlResultado(agente) {
    const saida = estado.caso.saidas[agente.id];
    const gerando = estado.geracao && estado.geracao.agenteId === agente.id && estado.geracao.casoId === estado.caso.id;
    const colar = estado.colar && estado.colar.agenteId === agente.id ? estado.colar : null;
    const tituloSaida = agente.laudo ? 'Laudo' : agente.saidaPara === 'fact_sheet' ? 'Fact Sheet' : 'Minuta';

    if (gerando) {
      return (
        '<section class="painel resultado" aria-live="polite">' +
          '<div class="barra"><span class="titulo">' + tituloSaida + ' em redação</span></div>' +
          '<div class="folha-peca cursor" id="folha"><p class="dica">Lendo os insumos e preparando a resposta…</p></div>' +
          '<div class="pe-resultado"><span class="cresce" id="conta-saida"></span><span>O texto aparece aqui enquanto é escrito.</span></div>' +
        '</section>'
      );
    }

    if (colar) {
      return (
        '<section class="painel resultado">' +
          '<div class="barra"><span class="titulo">Modo sem chave</span>' +
            '<button class="botao pequeno" type="button" data-acao="cancelar-colar">Cancelar</button></div>' +
          '<div class="colar">' +
            '<ol>' +
              '<li><strong>O prompt está na área de transferência</strong> (' + milhar(colar.prompt.length) + ' caracteres). ' +
                '<button class="elo" type="button" data-acao="copiar-prompt">Copiar de novo</button></li>' +
              '<li><strong>Cole em uma conversa nova do Claude</strong> e envie. ' +
                '<a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Abrir o Claude</a>' +
                (colar.temPdf ? ' — anexe também o PDF dos autos na conversa.' : '') + '</li>' +
              '<li><strong>Traga a resposta</strong>: copie o texto que o Claude devolver e cole abaixo.</li>' +
            '</ol>' +
            '<textarea id="resposta-colada" rows="12" spellcheck="false" placeholder="Cole aqui a resposta do Claude"></textarea>' +
            '<div class="linha-botoes"><button class="botao primario" type="button" data-acao="usar-resposta">Usar esta resposta</button>' +
              (colar.mascara && colar.mascara.total ? '<span class="dica">' + colar.mascara.total + ' dado(s) mascarado(s) serão restaurados aqui.</span>' : '') + '</div>' +
          '</div>' +
        '</section>'
      );
    }

    if (!saida) {
      return (
        '<section class="painel resultado">' +
          '<div class="vazio"><h3>' + tituloSaida + ' aparece aqui</h3>' +
          '<p>Preencha os insumos ao lado e acione o ' + e(agente.nome) + '. O resultado fica guardado neste caso e alimenta a etapa seguinte.</p></div>' +
        '</section>'
      );
    }

    const lista = agentes();
    const proximo = agente.proximo && lista.find((a) => a.id === agente.proximo);
    const selo = agente.laudo ? classificacaoDoLaudo(saida.texto) : null;
    const editar = estado.visao === 'editar';
    const quando = new Date(saida.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const pe = [quando];
    if (saida.modelo) pe.push(saida.modelo === 'colado' ? 'resposta colada' : saida.modelo);
    if (saida.uso && saida.uso.saida) pe.push(milhar(saida.uso.entrada) + ' tokens de entrada · ' + milhar(saida.uso.saida) + ' de saída');
    if (saida.mascarados) pe.push(saida.mascarados + ' dado(s) mascarado(s) no envio');

    return (
      '<section class="painel resultado">' +
        '<div class="barra">' +
          '<span class="titulo">' + tituloSaida + (selo ? ' <span class="selo-laudo ' + selo.classe + '">' + selo.rotulo + '</span>' : '') + '</span>' +
          '<span class="alterna" role="group" aria-label="Modo de exibição">' +
            '<button type="button" data-acao="visao" data-visao="ver" aria-pressed="' + !editar + '">Ler</button>' +
            '<button type="button" data-acao="visao" data-visao="editar" aria-pressed="' + editar + '">Editar</button></span>' +
          '<button class="botao pequeno" type="button" data-acao="copiar-saida">Copiar</button>' +
          '<button class="botao pequeno" type="button" data-acao="baixar-word">Word</button>' +
          '<button class="botao pequeno" type="button" data-acao="baixar-md">Texto</button>' +
          '<button class="botao pequeno" type="button" data-acao="imprimir">Imprimir</button>' +
        '</div>' +
        (editar
          ? '<textarea class="editor-peca" id="editor-peca" spellcheck="true" aria-label="Texto do resultado">' + e(saida.texto) + '</textarea>'
          : '<div class="folha-peca" id="folha">' + Lavra.markdown.paraHtml(saida.texto) + '</div>') +
        '<div class="pe-resultado"><span class="cresce">' + e(pe.join(' · ')) + '</span>' +
          (proximo ? '<button class="botao primario pequeno" type="button" data-acao="seguir" data-para="' + proximo.id + '">' +
            (proximo.id === 'sentinela' ? 'Conferir no Sentinela' : 'Seguir para o ' + e(proximo.nome)) + ' →</button>' : '') +
        '</div>' +
      '</section>'
    );
  }

  function renderOficina() {
    const agente = agenteAtual();
    estado.agenteId = agente.id;
    const lista = agentes();
    $('#oficina').innerHTML =
      '<div class="caso-barra">' +
        '<div class="grupo"><label for="caso-sel">Caso</label><select id="caso-sel">' +
          estado.casos.map((c) => '<option value="' + c.id + '"' + (c.id === estado.caso.id ? ' selected' : '') + '>' + e(rotuloCaso(c)) + '</option>').join('') +
        '</select></div>' +
        '<div class="grupo cresce"><label for="caso-titulo">Número do processo ou rótulo</label>' +
          '<input type="text" id="caso-titulo" value="' + e(estado.caso.titulo) + '" placeholder="Ex.: 5001234-56.2025.8.13.0024 — revisional" autocomplete="off"></div>' +
        '<button class="botao" type="button" data-acao="novo-caso">Novo caso</button>' +
        '<button class="botao perigo" type="button" data-acao="apagar-caso">Apagar caso</button>' +
      '</div>' +
      (Lavra.dados.casos.persistente ? '' : '<p class="aviso alerta" style="margin-bottom:14px">Este navegador não permitiu guardar dados. Os casos existem só enquanto esta aba estiver aberta.</p>') +
      '<nav class="trilha" aria-label="Agentes">' +
        lista.map((a) =>
          '<button type="button" data-acao="agente" data-id="' + a.id + '" aria-pressed="' + (a.id === agente.id) + '">' +
            '<span class="nome">' + (estado.caso.saidas[a.id] ? '<span class="feito" title="Já tem resultado neste caso"></span>' : '') + e(a.nome) +
              (a.versao ? '<span class="versao">' + e(a.versao) + '</span>' : '') + '</span>' +
            '<span class="papel">' + e(a.papel) + '</span></button>').join('') +
      '</nav>' +
      '<div class="bancada">' + htmlInsumos(agente) + htmlResultado(agente) + '</div>';
  }

  // ======================================================================
  // Página: Agentes
  // ======================================================================

  function renderAgentes() {
    const lista = agentes();
    $('#agentes').innerHTML =
      '<h1>Agentes</h1>' +
      '<p class="entrada">São as instruções do gabinete, do jeito que você as mantém. Ao gerar, o site acrescenta ao final apenas uma nota de execução, que explica ao agente que ele está rodando aqui, sem busca na web nem base anexada. ' +
        '<button class="elo" type="button" data-acao="ver-nota">Ver a nota</button></p>' +
      '<div class="lista-agentes">' +
        lista.map((a) =>
          '<article class="cartao agente">' +
            '<div class="linha1"><h3>' + e(a.nome) + '</h3>' +
              (a.versao ? '<span class="etiqueta">' + e(a.versao) + '</span>' : '') +
              (a.editado ? '<span class="etiqueta editado">editado aqui</span>' : '') +
              (a.importado ? '<span class="etiqueta">importado</span>' : '') + '</div>' +
            '<p>' + e(a.descricao) + '</p>' +
            '<p class="entradas">Insumos: ' + a.entradas.map((en) => e(DADOS.campos[en.campo].rotulo) + (en.obrigatorio ? '' : ' (opcional)')).join(', ') +
              '. Instruções: ' + milhar(a.prompt.length) + ' caracteres.</p>' +
            '<div class="botoes">' +
              '<button class="botao pequeno" type="button" data-acao="ver-agente" data-id="' + a.id + '">Ver instruções</button>' +
              '<button class="botao pequeno" type="button" data-acao="editar-agente" data-id="' + a.id + '">Editar</button>' +
              (a.editado ? '<button class="botao pequeno" type="button" data-acao="restaurar-agente" data-id="' + a.id + '">Restaurar original</button>' : '') +
              (a.importado ? '<button class="botao pequeno perigo" type="button" data-acao="remover-agente" data-id="' + a.id + '">Remover</button>' : '') +
              '<a class="botao pequeno" href="#/oficina" data-acao="usar-agente" data-id="' + a.id + '">Usar na oficina</a>' +
            '</div>' +
          '</article>').join('') +
      '</div>' +
      '<div class="linha-botoes" style="margin-top:22px">' +
        '<button class="botao" type="button" data-acao="importar-agente">Importar agente de um arquivo</button>' +
        '<span class="dica">Arquivo .txt ou .md com as instruções. Fica guardado só neste navegador.</span></div>';
  }

  function abrirDialogo(html) {
    const d = $('#dialogo');
    d.innerHTML = html;
    if (!d.open) d.showModal();
    d.scrollTop = 0;
  }

  function fecharDialogo() {
    const d = $('#dialogo');
    if (d.open) d.close();
    d.innerHTML = '';
  }

  function cabecaDialogo(titulo) {
    return '<div class="cabeca-dialogo"><h2>' + e(titulo) + '</h2><button class="botao pequeno" type="button" data-acao="fechar-dialogo">Fechar</button></div>';
  }

  function dialogoBiblioteca() {
    const bib = DADOS.biblioteca;
    abrirDialogo(
      cabecaDialogo('Biblioteca de diretrizes') +
      '<div class="miolo">' +
        (bib.fonte ? '<p class="dica">' + e(bib.fonte) + '</p>' : '') +
        bib.grupos.map((g, gi) =>
          '<section class="grupo-bib"><h3>' + e(g.nome) + '</h3><p>' + e(g.descricao) + '</p>' +
            g.itens.map((it, ii) =>
              '<div class="item-bib"><strong>' + e(it.titulo) + '</strong>' +
              '<span>' + e(it.resumo) + (it.nota ? ' — ' + e(it.nota) : '') + '</span>' +
              '<button class="botao pequeno" type="button" data-acao="usar-diretriz" data-g="' + gi + '" data-i="' + ii + '">Usar</button></div>').join('') +
          '</section>').join('') +
      '</div>');
  }

  // ======================================================================
  // Página: Configurações
  // ======================================================================

  function renderConfig() {
    const c = estado.config;
    const opcao = (valor, titulo, texto) =>
      '<label class="opcao"><input type="radio" name="modo" value="' + valor + '"' + (c.modo === valor ? ' checked' : '') + '>' +
      '<span><strong>' + titulo + '</strong><span>' + texto + '</span></span></label>';
    $('#config').innerHTML =
      '<h1>Configurações</h1>' +
      '<p class="entrada">Tudo o que está aqui fica guardado só neste navegador. Em outro computador, é preciso configurar de novo.</p>' +
      '<div class="config">' +

        '<section class="painel"><header><h2>Ligação com a IA</h2></header><div class="corpo">' +
          '<div class="opcoes">' +
            opcao('prompt', 'Sem chave (copiar e colar)', 'O site monta o prompt, você cola no Claude e traz a resposta. Não precisa de conta de API.') +
            opcao('direta', 'Chave própria', 'Sua chave da API da Anthropic fica neste navegador e a chamada sai direto dele.') +
            opcao('ponte', 'Ponte', 'Um serviço seu guarda a chave e repassa as chamadas (pasta ponte/ do projeto). Protegido por código de acesso.') +
          '</div>' +
          '<div id="bloco-direta"' + (c.modo === 'direta' ? '' : ' hidden') + ' class="campo">' +
            '<label for="cfg-chave">Chave da API</label>' +
            '<input type="password" id="cfg-chave" value="' + e(c.chave) + '" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">' +
            '<p class="dica">Criada no Console da Anthropic (platform.claude.com). Qualquer pessoa com acesso a este navegador pode usá-la: prefira este modo no seu computador pessoal. Se a rede bloquear api.anthropic.com, use a ponte.</p></div>' +
          '<div id="bloco-ponte"' + (c.modo === 'ponte' ? '' : ' hidden') + ' class="campo">' +
            '<div class="par">' +
              '<div class="campo"><label for="cfg-ponte-url">URL da ponte</label><input type="url" id="cfg-ponte-url" value="' + e(c.ponteUrl) + '" placeholder="https://lavra-ponte.seu-usuario.workers.dev" autocomplete="off" spellcheck="false"></div>' +
              '<div class="campo"><label for="cfg-ponte-codigo">Código de acesso</label><input type="password" id="cfg-ponte-codigo" value="' + e(c.ponteCodigo) + '" autocomplete="off" spellcheck="false"></div>' +
            '</div>' +
            '<div class="linha-botoes"><button class="botao pequeno" type="button" data-acao="testar-ponte">Testar ligação</button><span class="dica" id="teste-ponte"></span></div></div>' +
          '<div id="bloco-modelo"' + (c.modo === 'prompt' ? ' hidden' : '') + ' class="par">' +
            '<div class="campo"><label for="cfg-modelo">Modelo</label><select id="cfg-modelo">' +
              Lavra.api.MODELOS.map((m) => '<option value="' + m.id + '"' + (m.id === c.modelo ? ' selected' : '') + '>' + e(m.nome + ' — ' + m.nota) + '</option>').join('') + '</select></div>' +
            '<div class="campo"><label for="cfg-esforco">Profundidade do raciocínio</label><select id="cfg-esforco">' +
              Lavra.api.ESFORCOS.map((x) => '<option value="' + x.id + '"' + (x.id === c.esforco ? ' selected' : '') + '>' + e(x.nome) + '</option>').join('') + '</select></div>' +
          '</div>' +
        '</div></section>' +

        '<section class="painel"><header><h2>Sigilo</h2></header><div class="corpo">' +
          '<label class="opcao"><input type="checkbox" id="cfg-mascara"' + (c.mascara ? ' checked' : '') + '>' +
          '<span><strong>Máscara local ligada por padrão</strong><span>CPF, CNPJ, e-mail, telefone, CEP, RG e os nomes indicados em cada caso viram marcadores antes do envio e são restaurados na volta. Valores, datas e número do processo não são alterados.</span></span></label>' +
        '</div></section>' +

        '<section class="painel"><header><h2>Dados guardados</h2></header><div class="corpo">' +
          '<p class="dica">' + estado.casos.length + ' caso(s) neste navegador. A cópia de segurança leva os casos (sem os PDFs anexados) e não inclui chave nem código de acesso.</p>' +
          '<div class="linha-botoes">' +
            '<button class="botao pequeno" type="button" data-acao="exportar">Baixar cópia de segurança</button>' +
            '<button class="botao pequeno" type="button" data-acao="importar">Restaurar de uma cópia</button>' +
            '<button class="botao pequeno perigo" type="button" data-acao="apagar-tudo">Apagar tudo deste navegador</button>' +
          '</div>' +
        '</div></section>' +
      '</div>';
  }

  function gravarConfig() {
    Lavra.dados.config.gravar(estado.config);
  }

  // ======================================================================
  // Rotas
  // ======================================================================

  const ROTAS = { '': 'inicio', oficina: 'oficina', agentes: 'agentes', config: 'config' };

  function rotear() {
    const nome = ROTAS[location.hash.replace(/^#\/?/, '').split('/')[0]] || 'inicio';
    document.querySelectorAll('.pagina').forEach((p) => p.classList.toggle('ativa', p.id === 'pagina-' + nome));
    document.querySelectorAll('.menu a').forEach((a) => {
      if (a.dataset.rota === nome) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (nome === 'oficina') renderOficina();
    if (nome === 'agentes') renderAgentes();
    if (nome === 'config') renderConfig();
    document.title = { inicio: 'Lavra — oficina de minutas do gabinete', oficina: 'Oficina — Lavra', agentes: 'Agentes — Lavra', config: 'Configurações — Lavra' }[nome];
    window.scrollTo(0, 0);
  }

  // ======================================================================
  // Ações
  // ======================================================================

  const acoes = {
    gerar,
    parar() { if (estado.geracao) estado.geracao.controlador.abort(); },

    agente(el) {
      estado.agenteId = el.dataset.id;
      estado.avisos = null;
      estado.visao = 'ver';
      renderOficina();
    },
    seguir(el) {
      estado.agenteId = el.dataset.para;
      estado.avisos = null;
      estado.visao = 'ver';
      renderOficina();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    'usar-agente'(el) { estado.agenteId = el.dataset.id; },

    async 'novo-caso'() {
      const caso = novoCaso();
      estado.casos.unshift(caso);
      estado.caso = caso;
      estado.avisos = null;
      estado.colar = null;
      await gravarCaso(true);
      renderOficina();
      $('#caso-titulo').focus();
    },
    async 'apagar-caso'() {
      if (!confirm('Apagar o caso "' + rotuloCaso(estado.caso) + '" e tudo o que foi gerado nele? Não há como desfazer.')) return;
      await Lavra.dados.casos.apagar(estado.caso.id);
      delete estado.anexos[estado.caso.id];
      estado.casos = estado.casos.filter((c) => c.id !== estado.caso.id);
      if (!estado.casos.length) estado.casos.push(novoCaso());
      estado.caso = estado.casos[0];
      estado.colar = null;
      await gravarCaso(true);
      renderOficina();
    },

    async 'abrir-texto'(el) {
      const [arquivo] = await escolherArquivo('.txt,.md,.text,.xml,.json,text/plain');
      if (!arquivo) return;
      if (arquivo.size > 8 * 1024 * 1024) return torrada('Arquivo de texto grande demais (máximo 8 MB).');
      estado.caso.campos[el.dataset.campo] = (await lerArquivo(arquivo)).replace(/^﻿/, '');
      gravarCaso(true);
      renderOficina();
    },
    async 'anexar-pdf'(el) {
      const arquivos = await escolherArquivo('application/pdf,.pdf', true);
      if (!arquivos.length) return;
      const doCaso = (estado.anexos[estado.caso.id] = estado.anexos[estado.caso.id] || {});
      const lista = (doCaso[el.dataset.campo] = doCaso[el.dataset.campo] || []);
      let total = lista.reduce((s, a) => s + a.tamanho, 0);
      for (const arquivo of arquivos) {
        if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== 'application/pdf') { torrada(arquivo.name + ' não é PDF.'); continue; }
        // base64 ocupa cerca de 4/3 do tamanho original
        if ((total + arquivo.size) * 4 / 3 > LIMITE_ANEXOS) { torrada('Os PDFs passam do limite de envio (cerca de 22 MB no total).'); break; }
        lista.push({ nome: arquivo.name, tamanho: arquivo.size, base64: await lerArquivo(arquivo, true) });
        total += arquivo.size;
      }
      renderOficina();
    },
    'tirar-anexo'(el) {
      anexosDe(el.dataset.campo).splice(Number(el.dataset.indice), 1);
      renderOficina();
    },
    'limpar-campo'(el) {
      estado.caso.campos[el.dataset.campo] = '';
      gravarCaso(true);
      renderOficina();
    },
    biblioteca: dialogoBiblioteca,
    'usar-diretriz'(el) {
      const item = DADOS.biblioteca.grupos[Number(el.dataset.g)].itens[Number(el.dataset.i)];
      const atual = (estado.caso.campos.diretrizes || '').trim();
      if (atual && !confirm('Substituir as diretrizes já escritas neste caso?')) return;
      estado.caso.campos.diretrizes = item.texto;
      gravarCaso(true);
      fecharDialogo();
      renderOficina();
      torrada('Diretriz carregada. Confira os campos [PREENCHER].');
    },
    'modelo-branco'() {
      const modelo = DADOS.modelosDiretrizes[agenteAtual().modeloDiretrizes];
      const atual = (estado.caso.campos.diretrizes || '').trim();
      if (atual && !confirm('Substituir as diretrizes já escritas neste caso?')) return;
      estado.caso.campos.diretrizes = modelo;
      gravarCaso(true);
      renderOficina();
    },
    'sugerir-nomes'() {
      const texto = Object.values(estado.caso.campos).join('\n');
      const atuais = new Set((estado.caso.nomes || '').split('\n').map((n) => n.trim().toLowerCase()).filter(Boolean));
      const novos = Lavra.mascara.sugerirNomes(texto).filter((n) => !atuais.has(n.toLowerCase()));
      if (!novos.length) return torrada('Não encontrei nomes novos após indicações como "Autor:" ou "Réu:". Acrescente à mão.');
      estado.caso.nomes = ((estado.caso.nomes || '').trim() + '\n' + novos.join('\n')).trim();
      gravarCaso(true);
      renderOficina();
      $('.sigilo').open = true;
      torrada(novos.length + ' nome(s) sugerido(s). Revise a lista.');
    },

    visao(el) { estado.visao = el.dataset.visao; renderOficina(); },
    async 'copiar-saida'() {
      const texto = estado.caso.saidas[estado.agenteId].texto;
      const ok = await copiar(texto, Lavra.markdown.paraHtml(texto));
      torrada(ok ? 'Copiado com formatação.' : 'Não foi possível copiar.');
    },
    'baixar-word'() {
      const agente = agenteAtual();
      const texto = estado.caso.saidas[agente.id].texto;
      const html =
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta charset="utf-8"><title>' + e(rotuloCaso(estado.caso)) + '</title><style>' +
        'body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.5}p{text-align:justify;margin:0 0 8pt}' +
        'h1{font-size:14pt}h2{font-size:13pt}h3,h4{font-size:12pt}table{border-collapse:collapse}' +
        'td,th{border:1px solid #000;padding:3pt 5pt;font-size:10pt;vertical-align:top}pre{font-family:Consolas,monospace;font-size:9pt}' +
        '</style></head><body>' + Lavra.markdown.paraHtml(texto) + '</body></html>';
      baixar(nomeArquivo(agente.id, 'doc'), ['﻿', html], 'application/msword');
    },
    'baixar-md'() {
      const agente = agenteAtual();
      baixar(nomeArquivo(agente.id, 'md'), [estado.caso.saidas[agente.id].texto], 'text/markdown;charset=utf-8');
    },
    imprimir() {
      if (estado.visao !== 'ver') { estado.visao = 'ver'; renderOficina(); }
      window.print();
    },

    'cancelar-colar'() { estado.colar = null; renderOficina(); },
    async 'copiar-prompt'() {
      torrada((await copiar(estado.colar.prompt)) ? 'Prompt copiado.' : 'Não foi possível copiar.');
    },
    async 'usar-resposta'() {
      const bruto = $('#resposta-colada').value.trim();
      if (!bruto) return torrada('Cole a resposta do Claude no campo.');
      const colar = estado.colar;
      const agente = agentes().find((a) => a.id === colar.agenteId);
      const texto = colar.mascara ? colar.mascara.restaurar(bruto) : bruto;
      estado.colar = null;
      estado.avisos = null;
      await registrarSaida(agente, texto, { modelo: 'colado', mascarados: colar.mascara ? colar.mascara.total : 0 });
      renderOficina();
    },

    // ----- Agentes
    'ver-nota'() {
      abrirDialogo(cabecaDialogo('Nota de execução') + '<div class="miolo">' +
        '<p class="dica">Acrescentada ao final das instruções de todo agente:</p><pre class="instrucoes">' + e(DADOS.notaExecucao) + '</pre>' +
        '<p class="dica">Acrescentada apenas quando a máscara local substituiu algum dado:</p><pre class="instrucoes">' + e(DADOS.notaMascara) + '</pre></div>');
    },
    'ver-agente'(el) {
      const a = agentes().find((x) => x.id === el.dataset.id);
      abrirDialogo(cabecaDialogo(a.nome + (a.versao ? ' ' + a.versao : '')) + '<div class="miolo"><pre class="instrucoes">' + e(a.prompt) + '</pre></div>');
    },
    'editar-agente'(el) {
      const a = agentes().find((x) => x.id === el.dataset.id);
      abrirDialogo(cabecaDialogo('Editar ' + a.nome) + '<div class="miolo">' +
        '<p class="dica">A edição vale só neste navegador. Para mudar o agente para todos, troque o arquivo em agentes/fontes/ e rode ferramentas/atualizar_agentes.py.</p>' +
        '<textarea class="instrucoes" id="texto-agente" spellcheck="false">' + e(a.prompt) + '</textarea>' +
        '<div class="linha-botoes"><button class="botao primario" type="button" data-acao="salvar-agente" data-id="' + a.id + '">Salvar</button>' +
        '<button class="botao" type="button" data-acao="fechar-dialogo">Cancelar</button></div></div>');
    },
    'salvar-agente'(el) {
      const texto = $('#texto-agente').value.trim();
      if (!texto) return torrada('As instruções não podem ficar vazias.');
      const importado = estado.extras.importados.find((a) => a.id === el.dataset.id);
      if (importado) importado.prompt = texto; else estado.extras.editados[el.dataset.id] = texto;
      Lavra.dados.agentes.gravar(estado.extras);
      fecharDialogo();
      renderAgentes();
      torrada('Instruções salvas neste navegador.');
    },
    'restaurar-agente'(el) {
      if (!confirm('Descartar a edição e voltar às instruções originais?')) return;
      delete estado.extras.editados[el.dataset.id];
      Lavra.dados.agentes.gravar(estado.extras);
      renderAgentes();
    },
    'remover-agente'(el) {
      if (!confirm('Remover este agente importado?')) return;
      estado.extras.importados = estado.extras.importados.filter((a) => a.id !== el.dataset.id);
      Lavra.dados.agentes.gravar(estado.extras);
      if (estado.agenteId === el.dataset.id) estado.agenteId = 'extrator';
      renderAgentes();
    },
    async 'importar-agente'() {
      const [arquivo] = await escolherArquivo('.txt,.md,.xml,text/plain');
      if (!arquivo) return;
      const texto = (await lerArquivo(arquivo)).replace(/^﻿/, '').trim();
      if (!texto) return torrada('O arquivo está vazio.');
      const nome = (prompt('Nome do agente:', arquivo.name.replace(/\.[^.]+$/, '')) || '').trim();
      if (!nome) return;
      estado.extras.importados.push(novoAgenteImportado(nome, texto));
      Lavra.dados.agentes.gravar(estado.extras);
      renderAgentes();
      torrada('Agente importado.');
    },

    // ----- Configurações
    async 'testar-ponte'() {
      const saida = $('#teste-ponte');
      saida.textContent = 'Testando…';
      try {
        await Lavra.api.testarPonte(estado.config);
        saida.textContent = 'Ponte respondeu e aceitou o código.';
      } catch (erro) {
        saida.textContent = erro.message;
      }
    },
    exportar() {
      const copia = { lavra: 1, exportadoEm: new Date().toISOString(), casos: estado.casos, agentes: estado.extras };
      baixar('lavra-copia-' + new Date().toISOString().slice(0, 10) + '.json', [JSON.stringify(copia, null, 1)], 'application/json');
    },
    async importar() {
      const [arquivo] = await escolherArquivo('.json,application/json');
      if (!arquivo) return;
      let copia;
      try { copia = JSON.parse(await lerArquivo(arquivo)); } catch (erro) { return torrada('Arquivo inválido.'); }
      if (!copia || copia.lavra !== 1 || !Array.isArray(copia.casos)) return torrada('Este arquivo não é uma cópia de segurança da Lavra.');
      let novos = 0;
      for (const bruto of copia.casos) {
        if (!bruto || typeof bruto.id !== 'string') continue;
        const caso = Object.assign(novoCaso(), bruto);
        const i = estado.casos.findIndex((c) => c.id === caso.id);
        if (i >= 0) estado.casos[i] = caso; else { estado.casos.push(caso); novos++; }
        await Lavra.dados.casos.gravar(caso);
      }
      estado.caso = estado.casos.find((c) => c.id === estado.caso.id) || estado.casos[0];
      renderConfig();
      torrada(copia.casos.length + ' caso(s) restaurado(s), ' + novos + ' novo(s).');
    },
    async 'apagar-tudo'() {
      if (!confirm('Apagar todos os casos, as edições de agentes e as configurações deste navegador, inclusive chave e código de acesso? Não há como desfazer.')) return;
      await Lavra.dados.casos.apagarTudo();
      try { localStorage.removeItem('lavra.config'); localStorage.removeItem('lavra.agentes'); } catch (erro) { /* sem acesso */ }
      location.hash = '#/';
      location.reload();
    },

    'fechar-dialogo': fecharDialogo,
  };

  // ======================================================================
  // Eventos
  // ======================================================================

  document.addEventListener('click', (evento) => {
    const el = evento.target.closest('[data-acao]');
    if (!el) return;
    const acao = acoes[el.dataset.acao];
    if (!acao) return;
    if (el.tagName !== 'A') evento.preventDefault();
    Promise.resolve(acao(el)).catch((erro) => {
      console.error(erro);
      torrada('Algo deu errado: ' + (erro && erro.message ? erro.message : 'erro inesperado'));
    });
  });

  $('#dialogo').addEventListener('click', (evento) => {
    if (evento.target === evento.currentTarget) fecharDialogo(); // clique fora do conteúdo
  });

  document.addEventListener('input', (evento) => {
    const el = evento.target;
    if (el.matches('textarea[data-campo]')) {
      estado.caso.campos[el.dataset.campo] = el.value;
      const conta = $('[data-conta="' + el.dataset.campo + '"]');
      if (conta) conta.textContent = el.value ? milhar(el.value.length) + ' caracteres' : '';
      gravarCaso();
    } else if (el.id === 'caso-titulo') {
      estado.caso.titulo = el.value;
      const opcao = $('#caso-sel option[value="' + estado.caso.id + '"]');
      if (opcao) opcao.textContent = rotuloCaso(estado.caso);
      gravarCaso();
    } else if (el.id === 'nomes') {
      estado.caso.nomes = el.value;
      gravarCaso();
    } else if (el.id === 'editor-peca') {
      const agente = agenteAtual();
      estado.caso.saidas[agente.id].texto = el.value;
      if (agente.saidaPara) estado.caso.campos[agente.saidaPara] = el.value;
      gravarCaso();
    } else if (el.id === 'cfg-chave') {
      estado.config.chave = el.value.trim(); gravarConfig();
    } else if (el.id === 'cfg-ponte-url') {
      estado.config.ponteUrl = el.value.trim(); gravarConfig();
    } else if (el.id === 'cfg-ponte-codigo') {
      estado.config.ponteCodigo = el.value; gravarConfig();
    }
  });

  document.addEventListener('change', (evento) => {
    const el = evento.target;
    if (el.id === 'caso-sel') {
      gravarCaso(true);
      estado.caso = estado.casos.find((c) => c.id === el.value);
      estado.avisos = null;
      estado.colar = null;
      estado.visao = 'ver';
      renderOficina();
    } else if (el.id === 'mascara-ligada' || el.id === 'cfg-mascara') {
      estado.config.mascara = el.checked;
      gravarConfig();
      if (el.id === 'mascara-ligada') { renderOficina(); $('.sigilo').open = true; }
    } else if (el.name === 'modo') {
      estado.config.modo = el.value;
      gravarConfig();
      renderConfig();
    } else if (el.id === 'cfg-modelo') {
      estado.config.modelo = el.value; gravarConfig();
    } else if (el.id === 'cfg-esforco') {
      estado.config.esforco = el.value; gravarConfig();
    }
  });

  $('#alternar-tema').addEventListener('click', () => {
    const novo = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    estado.config.tema = novo;
    gravarConfig();
  });

  window.addEventListener('hashchange', rotear);
  window.addEventListener('beforeunload', (evento) => {
    if (estado.geracao) { evento.preventDefault(); evento.returnValue = ''; }
  });

  // ======================================================================
  // Partida
  // ======================================================================

  Lavra.dados.casos.listar().then((lista) => {
    estado.casos = lista;
    if (!estado.casos.length) {
      estado.casos.push(novoCaso());
      Lavra.dados.casos.gravar(estado.casos[0]);
    }
    estado.caso = estado.casos[0];
    rotear();
  });
})();
