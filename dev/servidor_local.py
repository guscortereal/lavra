#!/usr/bin/env python3
"""Servidor local para experimentar a Lavra sem publicar nada.

Serve os arquivos do site em http://localhost:8765 e, no mesmo endereco,
simula a ponte (rotas /saude e /v1/messages) com uma resposta ficticia em
fluxo. Serve para conferir a interface sem chave de API e sem gastar nada.

Uso (na pasta do site):
    python dev/servidor_local.py

Na oficina, em Configuracoes > Ponte:
    URL da ponte:      http://localhost:8765
    Codigo de acesso:  teste-local

So a biblioteca padrao do Python 3. Nao use isto como hospedagem.
"""
import json
import sys
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
CODIGO = "teste-local"


def texto_ficticio(pedido: dict) -> str:
    """Monta uma resposta de teste que devolve o que recebeu, para conferencia."""
    system = "".join(b.get("text", "") for b in pedido.get("system", []) if isinstance(b, dict))
    partes = pedido["messages"][-1]["content"]
    usuario = "".join(p.get("text", "") for p in partes if p.get("type") == "text")
    pdfs = [p.get("title", "sem nome") for p in partes if p.get("type") == "document"]
    laudo = "Sentinela Judicial" in system
    linhas = [
        "## Resposta de teste",
        "",
        "Este texto vem do **simulador local**, nao de um modelo. Ele confirma que o pedido chegou inteiro.",
        "",
        "| Item | Valor |",
        "| --- | --- |",
        f"| Modelo pedido | {pedido.get('model')} |",
        f"| Instrucoes do agente | {len(system)} caracteres |",
        f"| Insumos | {len(usuario)} caracteres |",
        f"| PDFs anexados | {', '.join(pdfs) if pdfs else 'nenhum'} |",
        "",
        "### Inicio dos insumos, como chegaram",
        "",
        "```",
        usuario[:900],
        "```",
        "",
        "1. Primeiro item de uma lista numerada.",
        "2. Segundo item, com *italico* e `codigo`.",
    ]
    if laudo:
        linhas += ["", "## Conclusao", "", "Classificacao final de teste.", "", "```json",
                   json.dumps({"classificacao": "APROVADA COM RESSALVAS", "achados": 2}), "```"]
    return "\n".join(linhas)


class Manipulador(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, formato, *args):  # silencioso, exceto erros
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(formato, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, status, corpo):
        dados = json.dumps(corpo).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def _codigo_confere(self):
        return self.headers.get("x-codigo-acesso") == CODIGO

    def do_GET(self):
        if self.path == "/saude":
            if not self._codigo_confere():
                return self._json(401, {"erro": "Codigo de acesso incorreto."})
            return self._json(200, {"ok": True})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/v1/messages":
            return self._json(404, {"erro": "Rota inexistente."})
        if not self._codigo_confere():
            return self._json(401, {"erro": "Codigo de acesso incorreto."})
        tamanho = int(self.headers.get("Content-Length") or 0)
        try:
            pedido = json.loads(self.rfile.read(tamanho))
            texto = texto_ficticio(pedido)
        except (ValueError, KeyError, IndexError, TypeError):
            return self._json(400, {"error": {"message": "pedido invalido"}})

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

        def evento(nome, dado):
            self.wfile.write(f"event: {nome}\ndata: {json.dumps(dado)}\n\n".encode("utf-8"))
            self.wfile.flush()

        try:
            evento("message_start", {"type": "message_start", "message": {
                "id": "msg_teste", "type": "message", "model": pedido.get("model"),
                "usage": {"input_tokens": len(json.dumps(pedido)) // 4, "output_tokens": 0}}})
            evento("content_block_start", {"type": "content_block_start", "index": 0,
                                           "content_block": {"type": "text", "text": ""}})
            for i in range(0, len(texto), 24):
                evento("content_block_delta", {"type": "content_block_delta", "index": 0,
                                               "delta": {"type": "text_delta", "text": texto[i:i + 24]}})
                time.sleep(0.02)
            evento("content_block_stop", {"type": "content_block_stop", "index": 0})
            evento("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn"},
                                     "usage": {"output_tokens": len(texto) // 4}})
            evento("message_stop", {"type": "message_stop"})
        except (BrokenPipeError, ConnectionResetError):
            pass  # o navegador interrompeu a geracao


if __name__ == "__main__":
    servidor = ThreadingHTTPServer(("127.0.0.1", PORTA), partial(Manipulador, directory=str(RAIZ)))
    print(f"Lavra em http://localhost:{PORTA}  (ponte simulada, codigo: {CODIGO})  Ctrl+C para sair")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
