#!/usr/bin/env python3
"""Empacota os agentes em agentes/agentes.js.

Leia agentes/manifesto.json, junta o texto de cada arquivo de agentes/fontes/
e grava agentes/agentes.js, que o site carrega com uma tag <script>.

Uso (na pasta do site):
    python ferramentas/atualizar_agentes.py

Sem dependencias: so a biblioteca padrao do Python 3.
"""
import io
import json
import re
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
AGENTES = RAIZ / "agentes"
FONTES = AGENTES / "fontes"


def ler(caminho: Path) -> str:
    texto = io.open(caminho, encoding="utf-8-sig").read()
    return texto.replace("\r\n", "\n").replace("\r", "\n")


def sem_cabecalho_yaml(texto: str) -> str:
    achado = re.match(r"^---\n.*?\n---\n", texto, flags=re.S)
    return texto[achado.end():].lstrip("\n") if achado else texto


def bloco(texto: str, tag: str) -> str:
    """Primeiro bloco <tag>...</tag> do texto, sem os comentarios HTML."""
    achado = re.search(rf"<{tag}>.*?</{tag}>", texto, flags=re.S)
    if not achado:
        return texto.strip()
    trecho = re.sub(r"<!--.*?-->", "", achado.group(0), flags=re.S)
    return re.sub(r"\n{3,}", "\n\n", trecho).strip()


def main() -> int:
    manifesto = json.loads(ler(AGENTES / "manifesto.json"))
    erros = []

    agentes = []
    for item in manifesto["agentes"]:
        origem = FONTES / item["arquivo"]
        if not origem.exists():
            erros.append(f"arquivo ausente: {origem.relative_to(RAIZ)}")
            continue
        texto = ler(origem)
        if item.get("removerCabecalhoYaml"):
            texto = sem_cabecalho_yaml(texto)
        for entrada in item["entradas"]:
            if entrada["campo"] not in manifesto["campos"]:
                erros.append(f"{item['id']}: campo desconhecido '{entrada['campo']}'")
        agente = {k: v for k, v in item.items() if k != "removerCabecalhoYaml"}
        agente["prompt"] = texto.strip()
        agentes.append(agente)

    modelos = {}
    for chave, conf in manifesto.get("modelosDiretrizes", {}).items():
        origem = FONTES / conf["arquivo"]
        if origem.exists():
            modelos[chave] = bloco(ler(origem), conf["bloco"])
        else:
            erros.append(f"arquivo ausente: {origem.relative_to(RAIZ)}")

    biblioteca = {"fonte": "", "grupos": []}
    nome_bib = manifesto.get("bibliotecaDiretrizes")
    if nome_bib and (FONTES / nome_bib).exists():
        bruto = json.loads(ler(FONTES / nome_bib))
        biblioteca["fonte"] = bruto.get("_fonte", "")
        for grupo in bruto.get("grupos", []):
            biblioteca["grupos"].append({
                "nome": grupo.get("g", ""),
                "descricao": grupo.get("d", ""),
                "itens": [{
                    "titulo": it.get("t", ""),
                    "resumo": it.get("s", ""),
                    "nota": it.get("n", ""),
                    "texto": "\n".join(it.get("b", [])),
                } for it in grupo.get("itens", [])],
            })

    if erros:
        for erro in erros:
            print("ERRO:", erro, file=sys.stderr)
        return 1

    dados = {
        "geradoEm": date.today().isoformat(),
        "notaExecucao": manifesto["notaExecucao"],
        "notaMascara": manifesto["notaMascara"],
        "campos": manifesto["campos"],
        "agentes": agentes,
        "modelosDiretrizes": modelos,
        "biblioteca": biblioteca,
    }
    # </script> dentro de um prompt fecharia a tag; "<\/" e JSON valido e inofensivo.
    corpo = json.dumps(dados, ensure_ascii=False, indent=1).replace("</", "<\\/")
    saida = AGENTES / "agentes.js"
    saida.write_text(
        "// Arquivo gerado por ferramentas/atualizar_agentes.py. Nao edite a mao.\n"
        "window.LAVRA_DADOS = " + corpo + ";\n",
        encoding="utf-8",
        newline="\n",
    )
    total = f"{sum(len(a['prompt']) for a in agentes):,}".replace(",", ".")
    print(f"agentes/agentes.js gravado: {len(agentes)} agentes, "
          f"{sum(len(g['itens']) for g in biblioteca['grupos'])} diretrizes, "
          f"{total} caracteres de instrucoes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
