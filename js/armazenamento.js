/* Armazenamento local: configurações no localStorage, casos no IndexedDB.
   Se o navegador negar o acesso (janela anônima, política da rede), o site
   continua funcionando com os dados só na memória da aba. */
(function () {
  'use strict';
  const Lavra = (window.Lavra = window.Lavra || {});

  const PADRAO_CONFIG = {
    modo: 'prompt',            // 'prompt' | 'direta' | 'ponte'
    chave: '',
    ponteUrl: '',
    ponteCodigo: '',
    modelo: 'claude-opus-5-5',
    esforco: 'high',
    mascara: true,
    tema: null,
  };

  function lerJson(chave, padrao) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (e) {
      return padrao;
    }
  }

  function gravarJson(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  const config = {
    ler() { return Object.assign({}, PADRAO_CONFIG, lerJson('lavra.config', {})); },
    gravar(valor) { return gravarJson('lavra.config', valor); },
  };

  // Instruções editadas e agentes importados pelo usuário.
  const agentes = {
    ler() { return Object.assign({ editados: {}, importados: [] }, lerJson('lavra.agentes', {})); },
    gravar(valor) { return gravarJson('lavra.agentes', valor); },
  };

  // ---------- Casos (IndexedDB, com reserva em memória) ----------

  const memoria = new Map();
  let bancoPromessa = null;
  let persistente = true;

  function abrirBanco() {
    if (bancoPromessa) return bancoPromessa;
    bancoPromessa = new Promise((resolve) => {
      let pedido;
      try {
        pedido = indexedDB.open('lavra', 1);
      } catch (e) {
        persistente = false;
        return resolve(null);
      }
      pedido.onupgradeneeded = () => {
        pedido.result.createObjectStore('casos', { keyPath: 'id' });
      };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => { persistente = false; resolve(null); };
      pedido.onblocked = () => { persistente = false; resolve(null); };
    });
    return bancoPromessa;
  }

  function operar(modo, acao) {
    return abrirBanco().then((banco) => {
      if (!banco) return acao(null);
      return new Promise((resolve, reject) => {
        const transacao = banco.transaction('casos', modo);
        const pedido = acao(transacao.objectStore('casos'));
        transacao.oncomplete = () => resolve(pedido && pedido.result);
        transacao.onerror = () => reject(transacao.error);
        transacao.onabort = () => reject(transacao.error);
      });
    });
  }

  const casos = {
    listar() {
      return operar('readonly', (loja) => (loja ? loja.getAll() : null)).then((lista) => {
        const todos = lista || Array.from(memoria.values());
        return todos.sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || ''));
      });
    },
    gravar(caso) {
      caso.atualizado = new Date().toISOString();
      memoria.set(caso.id, caso);
      return operar('readwrite', (loja) => (loja ? loja.put(caso) : null)).catch(() => { persistente = false; });
    },
    apagar(id) {
      memoria.delete(id);
      return operar('readwrite', (loja) => (loja ? loja.delete(id) : null)).catch(() => {});
    },
    apagarTudo() {
      memoria.clear();
      return operar('readwrite', (loja) => (loja ? loja.clear() : null)).catch(() => {});
    },
    get persistente() { return persistente; },
  };

  function novoId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  Lavra.dados = { config, agentes, casos, novoId, PADRAO_CONFIG };
})();
