/* Ligação com a API do Claude (Messages API, resposta em fluxo).
   HTTP direto com fetch: o site é uma página estática, sem etapa de build,
   por isso não usa o SDK. Dois caminhos: chamada direta do navegador com a
   chave do usuário, ou pela ponte (ponte/worker.js), que guarda a chave. */
(function () {
  'use strict';
  const Lavra = (window.Lavra = window.Lavra || {});

  const ENDERECO_API = 'https://api.anthropic.com';
  const VERSAO_API = '2026-10-21';
  const BETA_REDE_DE_SEGURANCA = 'server-side-fallback-2026-07-01';
  const MAX_TOKENS = 64000;

  const MODELOS = [
    { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5', nota: 'padrão: equilíbrio entre qualidade e custo', reserva: true },
    { id: 'claude-fable-5-2', nome: 'Claude Fable 5.2', nota: 'o mais capaz; mais caro e mais lento', reserva: true },
    { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5', nota: 'mais rápido e mais barato', reserva: true },
    { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5', nota: 'o mais barato; para testes', reserva: false },
  ];

  const ESFORCOS = [
    { id: 'low', nome: 'Baixo' },
    { id: 'medium', nome: 'Médio' },
    { id: 'high', nome: 'Alto (recomendado)' },
    { id: 'xhigh', nome: 'Muito alto' },
  ];

  class ErroApi extends Error {
    constructor(mensagem, detalhes) {
      super(mensagem);
      this.name = 'ErroApi';
      Object.assign(this, detalhes || {});
    }
  }

  function limparUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function destino(config) {
    if (config.modo === 'ponte') {
      return {
        url: limparUrl(config.ponteUrl) + '/v1/messages',
        cabecalhos: { 'x-codigo-acesso': config.ponteCodigo },
      };
    }
    return {
      url: ENDERECO_API + '/v1/messages',
      cabecalhos: {
        'x-api-key': config.chave,
        'anthropic-version': VERSAO_API,
        // Exigido pela API para chamadas feitas diretamente de um navegador.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    };
  }

  function montarCorpo(config, system, conteudo, comReserva) {
    const corpo = {
      model: config.modelo,
      max_tokens: MAX_TOKENS,
      stream: true,
      thinking: { type: 'adaptive' },
      output_config: { effort: config.esforco },
      // As instruções do agente não mudam entre chamadas: ficam em cache.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: conteudo }],
    };
    // Se um filtro de segurança recusar o pedido, a própria API tenta de novo
    // em um modelo de reserva, dentro da mesma chamada.
    if (comReserva) corpo.fallbacks = 'default';
    return corpo;
  }

  function mensagemDeErro(status, texto, config) {
    let detalhe = '';
    try {
      const json = JSON.parse(texto);
      detalhe = (json.error && json.error.message) || json.erro || '';
    } catch (e) {
      detalhe = String(texto || '').slice(0, 300);
    }
    const porStatus = {
      400: 'O pedido foi recusado por estar malformado ou grande demais.',
      401: config.modo === 'ponte' ? 'Código de acesso da ponte incorreto.' : 'Chave da API inválida ou revogada.',
      403: config.modo === 'ponte' ? 'A ponte recusou este site (origem não autorizada) ou a chave não tem permissão.' : 'A chave não tem permissão para este recurso.',
      404: config.modo === 'ponte' ? 'Endereço da ponte não encontrado. Confira a URL em Configurações.' : 'Modelo ou endereço não encontrado.',
      413: 'O pedido passou do tamanho máximo (32 MB). Reduza os anexos.',
      429: 'Limite de uso atingido. Aguarde um pouco e tente de novo.',
      500: 'Erro interno do serviço de IA. Tente de novo em instantes.',
      529: 'O serviço de IA está sobrecarregado. Tente de novo em instantes.',
    };
    const base = porStatus[status] || 'A chamada falhou (HTTP ' + status + ').';
    return detalhe ? base + ' Detalhe: ' + detalhe : base;
  }

  async function chamar(config, system, conteudo, sinal, comReserva) {
    const alvo = destino(config);
    const cabecalhos = Object.assign({ 'content-type': 'application/json' }, alvo.cabecalhos);
    if (comReserva) cabecalhos['anthropic-beta'] = BETA_REDE_DE_SEGURANCA;
    let resposta;
    try {
      resposta = await fetch(alvo.url, {
        method: 'POST',
        headers: cabecalhos,
        body: JSON.stringify(montarCorpo(config, system, conteudo, comReserva)),
        signal: sinal,
      });
    } catch (erro) {
      if (erro.name === 'AbortError') throw erro;
      throw new ErroApi(
        config.modo === 'ponte'
          ? 'Não foi possível alcançar a ponte. Confira a URL e se este site está entre as origens permitidas da ponte.'
          : 'Não foi possível alcançar a API. Algumas redes e antivírus bloqueiam api.anthropic.com; nesse caso use o modo ponte ou o modo sem chave.',
        { rede: true });
    }
    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => '');
      throw new ErroApi(mensagemDeErro(resposta.status, texto, config), { status: resposta.status, bruto: texto });
    }
    return resposta;
  }

  /**
   * Gera a resposta em fluxo.
   * @param {object} p
   * @param {object} p.config    configurações (modo, chave ou ponte, modelo, esforço)
   * @param {string} p.system    instruções do agente
   * @param {Array}  p.conteudo  blocos de conteúdo da mensagem do usuário
   * @param {function(string)} p.aoTexto  recebe cada trecho de texto
   * @param {AbortSignal} [p.sinal]
   * @returns {Promise<{parada: string|null, uso: object, modelo: string}>}
   */
  async function gerar({ config, system, conteudo, aoTexto, sinal }) {
    const modelo = MODELOS.find((m) => m.id === config.modelo);
    let comReserva = !modelo || modelo.reserva;
    let resposta;
    try {
      resposta = await chamar(config, system, conteudo, sinal, comReserva);
    } catch (erro) {
      // Conta ou ponte sem o recurso de reserva: repete sem ele.
      if (comReserva && erro.status === 400 && /fallback|anthropic-beta|beta/i.test(erro.bruto || '')) {
        comReserva = false;
        resposta = await chamar(config, system, conteudo, sinal, false);
      } else {
        throw erro;
      }
    }

    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    const resultado = { parada: null, uso: { entrada: 0, saida: 0, cache: 0 }, modelo: config.modelo };
    let pendente = '';

    function tratar(evento) {
      switch (evento.type) {
        case 'message_start': {
          const m = evento.message || {};
          if (m.model) resultado.modelo = m.model;
          const u = m.usage || {};
          resultado.uso.entrada = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
          resultado.uso.cache = u.cache_read_input_tokens || 0;
          break;
        }
        case 'content_block_delta':
          if (evento.delta && evento.delta.type === 'text_delta' && evento.delta.text) aoTexto(evento.delta.text);
          break;
        case 'message_delta':
          if (evento.delta && evento.delta.stop_reason) resultado.parada = evento.delta.stop_reason;
          if (evento.usage && evento.usage.output_tokens != null) resultado.uso.saida = evento.usage.output_tokens;
          break;
        case 'error':
          throw new ErroApi('O serviço de IA interrompeu a resposta: ' + ((evento.error && evento.error.message) || 'erro não informado') + '.');
        default:
          break; // ping, início e fim de bloco, raciocínio: nada a fazer
      }
    }

    function consumir(bloco) {
      for (const linha of bloco.split('\n')) {
        if (!linha.startsWith('data:')) continue;
        const dado = linha.slice(5).trim();
        if (!dado || dado === '[DONE]') continue;
        let evento;
        try { evento = JSON.parse(dado); } catch (e) { continue; }
        tratar(evento);
      }
    }

    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      pendente += decodificador.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let corte;
      while ((corte = pendente.indexOf('\n\n')) !== -1) {
        consumir(pendente.slice(0, corte));
        pendente = pendente.slice(corte + 2);
      }
    }
    if (pendente.trim()) consumir(pendente);
    return resultado;
  }

  /** Confere se a ponte responde e aceita o código de acesso. */
  async function testarPonte(config) {
    const base = limparUrl(config.ponteUrl);
    if (!/^https?:\/\//i.test(base)) throw new ErroApi('Informe a URL completa da ponte, começando por https://');
    let resposta;
    try {
      resposta = await fetch(base + '/saude', { headers: { 'x-codigo-acesso': config.ponteCodigo } });
    } catch (e) {
      throw new ErroApi('A ponte não respondeu. Confira a URL e as origens permitidas.', { rede: true });
    }
    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => '');
      throw new ErroApi(mensagemDeErro(resposta.status, texto, Object.assign({}, config, { modo: 'ponte' })), { status: resposta.status });
    }
    return true;
  }

  Lavra.api = { gerar, testarPonte, ErroApi, MODELOS, ESFORCOS };
})();
