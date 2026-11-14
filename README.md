# Lavra — oficina de minutas

Site estático que reúne os agentes do gabinete em uma bancada: **Extrator → Saneador → Sentenciador → Sentinela**, mais **Embargos**. O resultado de um agente alimenta o seguinte, e tudo o que é do caso fica guardado no navegador de quem usa.

Sem dependências e sem etapa de build: HTML, CSS e JavaScript puros.

## Usar no computador

```bash
python dev/servidor_local.py
```

Abra `http://localhost:8765`. O servidor também simula a ponte, para testar a geração sem chave (código `teste-local`).

## Publicar

Passo a passo em [PUBLICAR.md](PUBLICAR.md): GitHub Pages, Cloudflare Pages, Netlify, Vercel e a ligação com a IA.

## O que há na pasta

| Caminho | Para que serve |
| --- | --- |
| `index.html` | Página inicial e moldura da aplicação |
| `css/estilo.css` | Aparência, temas claro e escuro |
| `js/app.js` | Oficina, Agentes e Configurações |
| `js/api.js` | Chamada à API do Claude, direta ou pela ponte |
| `js/mascara.js` | Máscara local de dados pessoais |
| `js/markdown.js` | Exibição da minuta e do laudo |
| `js/armazenamento.js` | Casos e configurações no navegador |
| `agentes/fontes/` | Textos originais dos agentes e a biblioteca de diretrizes |
| `agentes/manifesto.json` | Lista dos agentes, seus insumos e o encadeamento |
| `agentes/agentes.js` | Pacote gerado a partir dos dois itens acima; é o que o site carrega |
| `ferramentas/atualizar_agentes.py` | Gera o `agentes/agentes.js` |
| `ponte/worker.js` | Ponte opcional (Cloudflare Worker) que guarda a chave da API |
| `dev/servidor_local.py` | Servidor de teste com ponte simulada |

## Agentes incluídos

| Agente | Versão | Origem do texto |
| --- | --- | --- |
| Extrator | v3.3 | `_extrator v3.3_.txt` |
| Saneador | v1.0 | skill `saneador-bancario` (SKILL.md) |
| Sentenciador | v13.1 | `SENTENCIADOR_v13.1.txt` |
| Embargos | v1 | `EMBARGOS_v1.txt` |
| Sentinela | v11.1 | `sentinela-v11.1-extraido.md` |

A biblioteca de diretrizes vem de `prompts.json` (Biblioteca de prompts do NUJUC, versão 2).

A minuta é sempre lida, revisada e assinada pelo magistrado.
