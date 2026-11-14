/**
 * Ponte da Lavra — Cloudflare Worker.
 *
 * Guarda a chave da API da Anthropic fora do navegador e repassa as chamadas
 * do site para a Messages API. Não grava nem registra o conteúdo dos pedidos.
 *
 * Variáveis do Worker (Settings > Variables and Secrets):
 *   ANTHROPIC_API_KEY   (Secret)  chave da API, começa com sk-ant-
 *   CODIGO_ACESSO       (Secret)  senha longa que você inventa; o site a envia em cada pedido
 *   ORIGENS_PERMITIDAS  (Text)    endereços do site, separados por vírgula, sem barra no fim
 *                                 ex.: https://seu-usuario.github.io,http://localhost:8765
 *
 * Rotas:
 *   GET  /saude         confere se a ponte está no ar e se o código confere
 *   POST /v1/messages   repassa o pedido à Anthropic e devolve a resposta em fluxo
 */

const API = 'https://api.anthropic.com/v1/messages';
const VERSAO_API = '2026-10-21';
const TAMANHO_MAXIMO = 33 * 1024 * 1024;

const MODELOS_PERMITIDOS = new Set([
  'claude-opus-5-5',
  'claude-fable-5-2',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
]);

// Só estes recursos em teste podem ser pedidos pelo site.
const BETAS_PERMITIDOS = new Set(['server-side-fallback-2026-07-01']);

function origensPermitidas(env) {
  return String(env.ORIGENS_PERMITIDAS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function cabecalhosCors(origem) {
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-codigo-acesso, anthropic-beta',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function responder(status, corpo, cors) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, cors),
  });
}

/** Compara dois textos sem revelar, pelo tempo de resposta, onde diferem. */
async function iguais(a, b) {
  const codificador = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', codificador.encode(String(a))),
    crypto.subtle.digest('SHA-256', codificador.encode(String(b))),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diferenca = 0;
  for (let i = 0; i < va.length; i++) diferenca |= va[i] ^ vb[i];
  return diferenca === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origem = (request.headers.get('Origin') || '').replace(/\/+$/, '');
    const permitidas = origensPermitidas(env);

    // Sem a lista de origens configurada, a ponte não atende ninguém.
    if (!origem || !permitidas.includes(origem)) {
      return responder(403, { erro: 'Origem não autorizada nesta ponte.' }, {});
    }
    const cors = cabecalhosCors(origem);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!env.ANTHROPIC_API_KEY || !env.CODIGO_ACESSO) {
      return responder(500, { erro: 'Ponte sem configuração: defina ANTHROPIC_API_KEY e CODIGO_ACESSO.' }, cors);
    }

    const codigo = request.headers.get('x-codigo-acesso') || '';
    if (!codigo || !(await iguais(codigo, env.CODIGO_ACESSO))) {
      return responder(401, { erro: 'Código de acesso incorreto.' }, cors);
    }

    if (request.method === 'GET' && url.pathname === '/saude') {
      return responder(200, { ok: true }, cors);
    }

    if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
      return responder(404, { erro: 'Rota inexistente.' }, cors);
    }

    const tamanho = Number(request.headers.get('content-length') || 0);
    if (tamanho > TAMANHO_MAXIMO) {
      return responder(413, { erro: 'Pedido grande demais.' }, cors);
    }

    let corpo;
    try {
      corpo = await request.json();
    } catch (erro) {
      return responder(400, { erro: 'O corpo do pedido não é JSON válido.' }, cors);
    }
    if (!corpo || !MODELOS_PERMITIDOS.has(corpo.model)) {
      return responder(400, { erro: 'Modelo não permitido nesta ponte.' }, cors);
    }

    const cabecalhos = {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': VERSAO_API,
    };
    const betas = (request.headers.get('anthropic-beta') || '')
      .split(',')
      .map((b) => b.trim())
      .filter((b) => BETAS_PERMITIDOS.has(b));
    if (betas.length) cabecalhos['anthropic-beta'] = betas.join(',');

    let resposta;
    try {
      resposta = await fetch(API, { method: 'POST', headers: cabecalhos, body: JSON.stringify(corpo) });
    } catch (erro) {
      return responder(502, { erro: 'A ponte não conseguiu falar com a API.' }, cors);
    }

    // Devolve a resposta como veio (inclusive em fluxo), só com os cabeçalhos de CORS.
    const saida = new Headers(cors);
    saida.set('content-type', resposta.headers.get('content-type') || 'application/json');
    saida.set('cache-control', 'no-store');
    return new Response(resposta.body, { status: resposta.status, headers: saida });
  },
};
