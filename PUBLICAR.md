# Como colocar a Lavra no ar

A Lavra é um site estático: uma pasta de arquivos, sem banco de dados e sem etapa de build. Qualquer hospedagem de arquivos serve. Este guia cobre o GitHub Pages, o Cloudflare Pages, o Netlify e a Vercel, e depois a ligação com a IA.

## 0. Antes de publicar

### Uma decisão: as instruções dos agentes podem ser públicas?

O arquivo `agentes/agentes.js` contém o texto integral do Extrator, do Saneador, do Sentenciador, do Embargos e do Sentinela, mais a biblioteca de diretrizes do NUJUC. Em um site aberto, quem tiver o endereço consegue ler esse arquivo. O próprio Sentinela traz a instrução de não revelar as suas instruções, por serem de operação interna.

| Se a resposta for | Use |
| --- | --- |
| Podem ser públicas | **Caminho A**, GitHub Pages. É o mais simples. |
| Não podem | **Caminho B**, Cloudflare Pages com acesso restrito por e-mail. |

**Decidido em 14/11/2026: as instruções podem ser públicas. O caminho é o A, GitHub Pages.** O caminho B fica como alternativa, caso a decisão mude.

Observação sobre o GitHub: no plano gratuito o Pages exige repositório público, e mesmo no plano pago o site publicado continua aberto a quem tiver o endereço. Repositório privado no GitHub não torna o site privado.

Os autos, as minutas, a chave da API e o código de acesso nunca vão para o repositório: ficam no navegador de quem usa.

### Teste no seu computador

Na pasta do site:

```bash
python dev/servidor_local.py
```

Abra `http://localhost:8765`. Esse servidor também simula a ponte, para experimentar a geração sem gastar nada: em Configurações, escolha **Ponte**, URL `http://localhost:8765`, código `teste-local`. A resposta é fictícia e só confirma que o pedido chegou inteiro.

## 1. Caminho A: GitHub Pages

1. **Crie o repositório.** Em github.com, botão **New repository**. Nome: `lavra`. Visibilidade: **Public**. Não marque README nem .gitignore. **Create repository**.
2. **Envie os arquivos.** No terminal, dentro da pasta do site:

   ```bash
   git init
   ```
   ```bash
   git add .
   ```
   ```bash
   git commit -m "Lavra: primeira versão"
   ```
   ```bash
   git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/guscortereal/lavra.git
   ```
   ```bash
   git push -u origin main
   ```

   Sem terminal: na página do repositório, **uploading an existing file**, arraste todo o conteúdo da pasta (as subpastas vão junto) e confirme em **Commit changes**.
3. **Ative o Pages.** No repositório: **Settings → Pages**. Em *Build and deployment*, **Source: Deploy from a branch**; **Branch: main**, pasta **/ (root)**; **Save**.
4. **Abra o site.** Em um ou dois minutos ele responde em `https://guscortereal.github.io/lavra/`. O endereço também aparece no topo de **Settings → Pages**.

Para atualizar depois: `git add .`, `git commit -m "..."`, `git push`. O Pages republica sozinho.

## 2. Caminho B: Cloudflare Pages com acesso restrito

1. **Crie o projeto.** No painel do Cloudflare: **Workers & Pages → Create → Pages**.
   - *Sem Git*: **Upload assets**, nome `lavra`, arraste a pasta do site, **Deploy site**.
   - *Com Git*: **Connect to Git**, escolha o repositório (pode ser **privado**). Em *Build settings*, deixe o comando de build vazio e o diretório de saída como `/`. **Save and Deploy**.
2. **Anote o endereço**, algo como `https://lavra.pages.dev`.
3. **Restrinja o acesso.** No painel: **Zero Trust → Access → Applications → Add an application → Self-hosted**. Domínio: `lavra.pages.dev`. Crie uma política **Allow** com a regra **Emails** e liste os e-mails autorizados. A partir daí o site pede um código enviado ao e-mail antes de abrir. O plano gratuito cobre até 50 pessoas.
4. Na política, proteja também os endereços de prévia: acrescente o domínio `*.lavra.pages.dev`.

Os nomes dos menus do Cloudflare mudam de tempos em tempos; a sequência é essa.

## 3. Outras hospedagens

| Hospedagem | Como publicar | Repositório privado | Restringir quem abre |
| --- | --- | --- | --- |
| **Netlify** | Arraste a pasta em `app.netlify.com/drop`, ou conecte o repositório (sem comando de build, diretório `.`) | Sim | Só em plano pago |
| **Vercel** | **Add New → Project**, importe o repositório, *Framework Preset: Other*, sem comando de build | Sim | Só em plano pago |
| **Cloudflare Pages** | Seção 2 | Sim | Sim, no plano gratuito |
| **GitHub Pages** | Seção 1 | Não no plano gratuito | Não |

Em todas, o endereço próprio (por exemplo `lavra.seudominio.org`) é configurado na área de domínios do projeto, com um registro CNAME no seu DNS.

## 4. Ligar a IA

O site funciona de três formas. A escolha é feita em **Configurações**, por navegador.

### 4.1 Sem chave

Não precisa de nada. A oficina monta o prompt e copia; você cola em uma conversa do Claude e traz a resposta de volta. Bom para começar e para quem já tem assinatura do Claude.

### 4.2 Chave própria

1. Crie uma chave no Console da Anthropic (`platform.claude.com`), em **API keys**. A API é cobrada por uso, separada da assinatura do Claude.
2. Em Configurações, escolha **Chave própria** e cole a chave.

A chave fica guardada naquele navegador. Use em computador pessoal. Se a rede bloquear `api.anthropic.com` (já aconteceu neste computador), a chamada falha e o site avisa; nesse caso use a ponte.

### 4.3 Ponte (recomendada para rede restrita ou uso em equipe)

A ponte é um Cloudflare Worker que guarda a chave e repassa as chamadas. O código está em `ponte/worker.js`.

1. No painel do Cloudflare: **Workers & Pages → Create → Worker**. Nome: `lavra-ponte`. **Deploy** (com o modelo "Hello World" mesmo).
2. **Edit code**. Apague o conteúdo, cole o de `ponte/worker.js`, **Deploy**.
3. Em **Settings → Variables and Secrets**, adicione:

   | Nome | Tipo | Valor |
   | --- | --- | --- |
   | `ANTHROPIC_API_KEY` | Secret | a chave da API |
   | `CODIGO_ACESSO` | Secret | uma senha longa que você inventa |
   | `ORIGENS_PERMITIDAS` | Text | o endereço do site, sem barra no fim. Ex.: `https://guscortereal.github.io` |

   Para mais de um endereço, separe por vírgula. Atenção: no GitHub Pages a origem é só `https://guscortereal.github.io`, sem o `/lavra`.
4. Copie o endereço do Worker (`https://lavra-ponte.SEU-SUBDOMINIO.workers.dev`).
5. No site, em Configurações: **Ponte**, cole a URL e o código, e clique em **Testar ligação**.

Pelo terminal, se preferir (exige `wrangler login`):

```bash
cd ponte
```
```bash
wrangler deploy
```
```bash
wrangler secret put ANTHROPIC_API_KEY
```
```bash
wrangler secret put CODIGO_ACESSO
```

A variável `ORIGENS_PERMITIDAS` fica em `ponte/wrangler.jsonc`.

O que a ponte faz e não faz: só atende as origens listadas, exige o código em toda chamada, aceita apenas os modelos da lista e não grava o conteúdo dos pedidos. Quem tiver o código gasta da sua chave, então trate-o como senha e defina um limite de gasto mensal no Console da Anthropic.

### 4.4 Custo e modelo

O padrão é o Claude Opus 5.5 (US$ 4 por milhão de tokens de entrada e US$ 20 por milhão de saída, na tabela consultada em 03/11/2026). Uma sentença com 15 mil tokens de entrada e 6 mil de saída fica na casa de US$ 0,20, mais o raciocínio do modelo, que é cobrado como saída. As instruções do agente são enviadas com cache, o que barateia chamadas repetidas em sequência. O modelo e a profundidade do raciocínio são trocados em Configurações.

## 5. Manter os agentes em dia

Os textos originais estão em `agentes/fontes/`. Para trocar a versão de um agente:

1. Substitua o arquivo em `agentes/fontes/` (ou aponte para o novo nome em `agentes/manifesto.json`, atualizando o campo `versao`).
2. Gere o pacote de novo:

   ```bash
   python ferramentas/atualizar_agentes.py
   ```
3. Publique: `git add .`, `git commit`, `git push`, ou arraste a pasta de novo na hospedagem.

Na página **Agentes** do site também dá para editar ou importar instruções, mas essa alteração vale só para o navegador em que foi feita.

## 6. Conferência final

- [ ] Decidido se as instruções dos agentes podem ficar públicas (seção 0).
- [ ] Site abre no endereço publicado e a oficina carrega os cinco agentes.
- [ ] Modo de ligação escolhido e testado com um caso fictício.
- [ ] Se usar a ponte: `ORIGENS_PERMITIDAS` preenchida, código forte, limite de gasto definido no Console.
- [ ] Máscara local ligada e nomes das partes informados antes de enviar um caso real.
- [ ] Uso com processos reais avaliado à luz das normas do tribunal e da Resolução CNJ 615/2025, em especial para feitos sob sigilo.
