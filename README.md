# Painel de finanças — Henrique e Beatriz

Página única, em Next.js 16, **CSS puro** (sem Tailwind) e **gráficos em SVG próprio** (sem biblioteca). Refeita do zero em 2026-11-05. **Publicada em https://meytsu.github.io/financas/** (GitHub Pages, público — decisão do Henrique em 2026-11-08).

**Duas pessoas, mesma mecânica:** ao abrir, a tela **"Quem está acessando?"** (Henrique / Beatriz) escolhe de quem é a página; ela já entra com o filtro de usuário daquela pessoa (e dá para trocar no painel de Filtros).

```bash
npm run dev     # http://localhost:3000/financas
npx tsc --noEmit -p . && npm run lint   # checagem antes de dar por pronto
```

Os dados vêm de `data/henrique.json` e `data/beatriz.json`, gerados por `../scripts/gerar_dados.py` (ver o [CLAUDE.md da pasta Finanças](../CLAUDE.md)).

| | Henrique | Beatriz |
|---|---|---|
| Renda | R$ 4.390,80 (adiantamento dia 20 + fechamento dia 5) | R$ 1.665,75 no **5º dia útil** |
| Teto do cartão XP | R$ 1.200 | R$ 800 |
| Fixas fora do cartão | aluguel R$ 800 (dia 20), recarga R$ 30 (dia 20) | ração R$ 40, energia R$ 120 (dia 10), celular R$ 42, internet R$ 80 |
| Reserva | R$ 5.000 (Caixinha Nubank) | ainda não tem |

> **Fora deste repositório** (ficam só no PC, em `~/Documentos/Finanças/`): o script `scripts/gerar_henrique.py`, o `CLAUDE.md` com o fluxo de atualização, os CSVs das faturas e o `.env` com a chave do Supabase.

## De onde vieram as informações (Supabase)

Para montar esta página, o Claude (Claude Code) **acessou o banco Supabase do projeto "Finanças"** (`epmlwrfumrjsrcpeudoj`), criado em 25/09/2026 e que estava pausado no plano gratuito até o Henrique reativá-lo em 05/11/2026.

- **Como:** pelo servidor MCP oficial do Supabase (`https://mcp.supabase.com/mcp?read_only=true`), autorizado pelo Henrique com login no navegador, **em modo somente leitura** — nada foi alterado no banco. O script de dados lê as mesmas tabelas pela API REST com a chave pública (guardada em `Finanças/.env`, fora do git).
- **O que foi lido:**
  - `transacoes_variaveis` (515 lançamentos de cartão, jan/26–fev/27) → usado para as faturas de **set e out/26**, mais completas que o `public/data.json`.
  - `despesas_fixas` → aluguel e dados móveis do Henrique (a feira foi ignorada: agora é gasta no cartão).
  - `outras_despesas` → **financiamento da BMW (12 × R$ 1.395,93 em 2027)**, seguro Suhai e a compra da Kabum pelo Mercado Pago.
- **Correções feitas sobre o banco** (confirmadas pelo Henrique, aplicadas no script — o banco continua com os valores antigos): Suhai set–nov/26 (o banco tem out–dez); Kabum só 2 parcelas (o banco tem 3); lançamento de teste "Supermercado Extra R$ 85" excluído.
- **Aviso de segurança do Supabase:** as 3 tabelas estão com RLS (Row Level Security) desligado — quem tiver a chave pública lê e altera tudo. O Henrique sabe e decidiu tratar depois. Para fechar: `ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;` nas três.

## Backup (para não depender do Supabase)

Tudo que a página precisa também fica **dentro deste repositório**, em `backup/`:

| Pasta | O que tem |
|---|---|
| `backup/supabase/` | as 3 tabelas do Supabase em **JSON** (cópia exata) e **CSV** (separador `;`, abre em planilha) |
| `backup/faturas/` | os CSVs das faturas XP e Nubank |
| `backup/scripts/gerar_henrique.py` | cópia do script que gera `data/henrique.json` |
| `backup/CLAUDE-pasta-financas.md` | cópia do guia da pasta Finanças (fluxo de atualização) |

- **Atualiza sozinho:** toda vez que o script roda e o Supabase responde, ele regrava `backup/supabase/` e recopia os outros arquivos.
- **Plano B:** se o Supabase não responder (pausado, sem internet, sem `.env`), o script **usa o backup automaticamente** e avisa no terminal ("AVISO: Supabase indisponível… usando o backup"). Testado em 2026-11-05: a saída sai idêntica.
- **Nunca vão para o backup:** o `.env` (chave), holerites e PDFs.
- Para restaurar num PC novo: clonar o repo, copiar `backup/scripts/gerar_henrique.py` para `Finanças/scripts/`, `backup/faturas/*.csv` para `Finanças/` e `backup/CLAUDE-pasta-financas.md` para `Finanças/CLAUDE.md`.

## Layout

```
┌ topo: Finanças · Henrique ............ [☰ Lançamentos 32] [‹ Nov/26 ›] ┐
├ Sobra (herói) ┬ Poupança ┬ Comprometida ┬ Cartão×teto ┬ Reserva ┤  bloco 1 (KPIs)
├────────── Cascata do mês ─────────┬──── Calendário ────┤
├────────── Sankey ─────────────────┬──── Categorias ────┤
├────── Evolução 12 meses ──────────┬─ Compromissos futuros ┤
```

- **Cabeçalho:** usuário (HENRIQUE) à esquerda, **"FINANÇAS" centralizado** (os dois em maiúsculas), e à direita dois botões só com ícone (SVG) — **Lançamentos** e **Filtros** — que, ao passar o mouse, se abrem mostrando o nome.
- **Filtros** (painel lateral que surge da direita; fecha com ✕, Esc ou clique fora; a página atrás não rola): **mês** (calendário de 12 meses com navegação por ano — substituiu o seletor ‹ › do topo), **usuário** (Beatriz "em breve"), **cartão** (Todos / XP / Nubank) e **categoria**. Cartão e categoria valem para a página toda; quando ativos aparece a faixa "Filtrando: … limpar" no topo e um número no botão de filtros. No rodapé do painel: "Última atualização", com a data dos dados e a da reserva por extenso (ex.: 05 de Novembro de 2026).
- **Lançamentos**: botão no topo abre uma janela (`<dialog>` nativo) com **duas tabelas**: *Contas fora do cartão* (fixas, boletos/financiamentos e contas variáveis como a energia) e *Cartão XP* (a fatura do mês). No **canto superior direito** da janela fica só o **total do mês** (contas fora do cartão + cartões; o detalhe aparece ao passar o mouse), ao lado do botão ✕ (com borda). **Clicar no cabeçalho ordena** (1º clique crescente, 2º decrescente). **Cada tabela tem a própria barra de rolagem** (cabeçalho fixo no topo e **linha de total fixa no fim**) e, com a janela aberta, **a página de fundo não rola**. Compras divididas com a Beatriz aparecem com a marca **50/50** e só a metade do Henrique (o total fica na dica). Fecha com ✕, Esc ou clique fora. O endereço `/financas#lancamentos` abre a janela direto.
- Página em **tela cheia** (sem largura máxima).

## O mês (como cada número é calculado)

O mês **M** junta:
- **Receitas**: salário (fechamento) no dia 5 + adiantamento no dia 20 de M. Se cair no sábado/domingo, antecipa para a sexta. Usa o valor real quando lançado em `renda.realizados`; senão a estimativa (`renda.entradas`).
- **Fixas**: aluguel (dia 20) e dados móveis.
- **Boletos**: parcelas fora do cartão com mês M (Suhai, Kabum, BMW).
- **Cartão**: a fatura XP que **vence** em M (dia 10). Parcelada = linha com "n de m", m > 1.
- **Fora do cartão**: contas variáveis de M (energia).
- **Saídas** = fixas + boletos + cartão + fora do cartão. **Sobra** = receitas − saídas.

Código: [lib/financas.ts](lib/financas.ts) (`resumoMes`, `entradasDoMes`, `compromissosFuturos`).

## Bloco 1 — indicadores

Cada card: **título à esquerda, selo de status no canto superior direito**, **só o valor principal** e, logo abaixo, o **delta contra o mês anterior**, sem escrever "vs. mês" (verde = melhorou, vermelho = piorou; taxas em pontos percentuais, "p.p."); gráfico à direita. A reserva, que não tem histórico, mostra o **% da meta** no lugar do delta. O selo sempre tem ícone **e** texto (nunca só cor).

**Popover de detalhes:** passar o mouse no card (ou tocar, no celular; ou Tab) abre, com animação, um painel logo abaixo com o máximo de informação:
- *Sobra*: cada entrada (estimada ou real), cada tipo de saída, sobra do mês anterior e média de 6 meses.
- *Poupança*: a conta (sobra ÷ receitas), quanto falta/sobra para a meta de 20%, as faixas, mês anterior e média.
- *Renda comprometida*: parcelas do cartão e cada boleto, limite de 30% em reais e a folga/excesso, os 3 próximos meses.
- *Cartão × teto*: à vista × parcelas, total, teto e diferença, 4 maiores categorias, fatura do mês anterior.
- *Reserva*: **Onde está** (contas e total); **Meta** — gasto médio por mês, meta (6 meses de gastos), quanto você já tem (e %), quanto falta; **Previsão** — sobra média por mês, em quantos meses e em que mês a meta é atingida guardando a sobra, e quanto guardar por mês para chegar em 12 e em 24 meses. Valores com centavos. (A data de atualização do saldo vai para os filtros.)

| Card | Fórmula | Status | Gráfico |
|---|---|---|---|
| **Sobra do mês** (número herói) | receitas − saídas; variação vs. mês anterior | — | sparkline 6 meses |
| **Taxa de poupança** | sobra ÷ receitas | ≥ 20% Saudável · ≥ 10% Atenção · ≥ 0 Alto · < 0 Crítico | sparkline 6 meses |
| **Renda comprometida** | (parcelas do cartão + boletos) ÷ receitas | ≤ 24% Saudável · ≤ 30% Atenção · ≤ 45% Alto · acima Crítico | sparkline 6 meses |
| **Cartão × teto** | fatura ÷ R$ 1.200 (inclui parcelas) | ≤ 85% Saudável · ≤ 100% Atenção · ≤ 130% Alto · acima Crítico | medidor no estilo da reserva, de **0 a 200%**: azul até o teto, **vermelho no que passar**, traço no meio = teto (100%) |
| **Reserva de emergência** | reserva ÷ média das saídas dos 6 meses anteriores | ≥ 6 meses Saudável · ≥ 3 Atenção · ≥ 1 Alto · < 1 Crítico | medidor até a meta (6 × custo mensal) |

Referências (pesquisa de 2026-11-05): taxa de poupança 10–20% "bom começo", 20–30% "sólida"; comprometimento até ~30% da renda líquida (convenção de educação financeira, não norma do BC); reserva de 6 meses para assalariado CLT.

**Sparklines**: **últimos 6 meses** até o mês escolhido; linha azul (série 1) com **uma bolinha por mês** (raio 3,5; o mês atual 4,5) e **área preenchida** em azul ~13% até o zero. Hover mostra mês e valor. (Os gráficos de Evolução continuam com 12 meses.)

## Os gráficos

| Gráfico | O que mostra | Detalhes |
|---|---|---|
| **Do salário à sobra** (cascata) | receitas → fixas → boletos → cartão à vista → parcelas do cartão → energia → sobra | **verde** = receitas e sobra, **vermelho** = saídas (e sobra negativa); rótulos em reais **sem centavos** (R$ 4.252, −R$ 830); **sem legenda e sem "ver como tabela"** (decisão do Henrique: a cor já explica) |
| **Calendário** | grade do mês com entradas (+) e vencimentos (−) | **saídas do dia somadas num valor só** (ex.: dia 10 = −2.578), entradas uma a uma; **sem lista embaixo**: passar o mouse (ou Tab) num dia mostra cada lançamento com nome e valor exato; todas as linhas com a mesma altura; "Sem dia definido" só aparece se houver conta sem dia |
| **Para onde foi o dinheiro** (Sankey) | receitas → contas da casa / boletos / cartão / sobra → 5 maiores categorias do cartão + "Demais" | se faltar dinheiro, aparece o nó "Faltou" à esquerda; **sem legenda e sem tabela** (os nós já têm nome e valor) |
| **Categorias do cartão** | barra = este mês, traço = média dos 6 meses anteriores, variação em % | **mesma altura do Sankey**: mostra só as linhas que cabem; o excedente (e a categoria "Outros" original) vira uma linha **Outros** com valor e média somados; sem tabela |
| **Evolução** | 12 meses até o mês escolhido: receitas e saídas (colunas) + sobra (linha) | hover na faixa do mês mostra os três valores |
| **Compromissos já assumidos** | próximos 12 meses: parcelas do cartão + boletos + BMW (colunas empilhadas) | linha vermelha = 30% da renda |

Todos os gráficos: dica no hover **e** no foco do teclado (Tab); legenda só na Evolução e nos Compromissos. **Nenhum gráfico tem "Ver como tabela"** (decisão do Henrique em 2026-11-07: o valor exato fica na dica).

**Números nos gráficos: sempre cheios, nunca "mil"** — eixos e rótulos curtos em inteiro com ponto de milhar (4.000, 1.894); valores exatos com centavos ficam na dica e na tabela.

## Regras de design (guia de dataviz)

- **Paleta validada** (`validate_palette.js`, claro e escuro): série 1 azul `#2a78d6`, 2 laranja `#eb6834`, 3 verde-água `#1baf7a`, 4 amarelo `#eda100` — sempre nessa ordem. Modo escuro com os mesmos tons ajustados.
- **Cores de status reservadas** (bom `#0ca30c`, atenção `#fab219`, alto `#ec835a`, crítico `#d03b3b`): só para estado, nunca para série.
- Barras ≤ 24px com ponta arredondada (4px) e base reta; linhas de 2px; grade em linha fina sólida (nunca tracejada); 2px de respiro entre segmentos empilhados.
- Texto nunca usa a cor da série; a identidade vem da marca colorida ao lado.
- Um único eixo Y por gráfico. Números grandes em fonte proporcional; `tabular-nums` só em colunas.
- Tokens de cor em `:root` (`--superficie`, `--tinta`, `--s1`…), com modo escuro por `prefers-color-scheme` e `data-theme`.

## Histórico de decisões

**2026-11-08**
- Faturas de jan/27 e fev/27 (só parcelas) baixadas: substituem as projeções (SAEL 2/3 e 3/3 saem por R$ 326,66). A parcela Figueiras de R$ 6,99 da Beatriz (do histórico antigo) não está nas faturas oficiais — deve ter sido antecipada — e saiu. A partir de mar/27 nenhum dos dois tem parcela no cartão.
- Fatura de dez/26 parcial (compras de 02 a 05/11): Bongi 04/11 com ajuste de −R$ 150 (estorno de 44 macarrões) e dividido 50/50 (R$ 324,50 / R$ 324,49); parcelas futuras passam a ser projetadas pelo script (SAEL 2/3 e 3/3, Ferreira Costa 3/3 da Beatriz).
- Página da Beatriz com a mesma mecânica; tela "Quem está acessando?" antes de entrar; script novo `gerar_dados.py` gera um arquivo por pessoa (os dados do Henrique saíram idênticos).
- Compra dividida 50/50 aparece nas duas páginas (Bongi de 03/10: R$ 137,96 Henrique / R$ 137,95 Beatriz).
- Publicação no GitHub Pages (público), decidida pelo Henrique.

**2026-11-05**
- Painel antigo (Tailwind, dados do casal misturados) substituído por uma página só do Henrique. O antigo está no git (commit `de20e64`).
- Tailwind removido; tudo em CSS puro. Recharts continua instalado, mas não é usado.
- Dados saíram de `public/` e passaram a ser importados (`data/henrique.json`) — a página já vem montada do servidor.
- Feira saiu das fixas (agora é gasta no cartão, categoria Mercado). Spotify cancelado; Google One/YouTube (R$ 35,99) e Netflix caem no cartão.
- Energia: conta de nov/26 R$ 153,88, a Beatriz paga R$ 120, ficam R$ 33,88 com o Henrique.
- Salário de nov/26 (fechamento de outubro): R$ 2.094,00 real. Adiantamento ainda estimado (R$ 2.158,32).
- Categorias confirmadas: Arretado B. e Alexandro = Alimentação. LMSERVICELTDA (R$ 35,26, 02/10) ainda a confirmar.
- Lançamentos saíram da página e foram para uma janela aberta pelo botão do topo.
- Bloco 1 compactado: gráfico à direita, selos no canto superior direito, aviso de "estimado" removido.
- Sparklines: 6 meses, com bolinhas (raio 3,5) e área preenchida.
- Cascata em verde/vermelho; números cheios (sem "mil") em todos os gráficos; cascata sem centavos.
- Calendário com linhas de altura igual.
- 2026-11-07: cabeçalho centralizado com botões de ícone animados; painel lateral de filtros (mês, usuário, cartão, categoria); Nubank do Henrique (abr–ago/26) incluído — o teto de R$ 1.200 vale só para a XP; legendas centralizadas.
- 2026-11-07: bloco 1 sem textos de referência — só valor + delta; detalhes num popover animado (hover/toque).
- 2026-11-07: removidos todos os "Ver como tabela" e o rodapé "Dados gerados em…".
- 2026-11-07: janela de lançamentos com 2 tabelas ordenáveis; Bongi de 03/10 (R$ 275,91) dividido 50/50 — só o de maior valor.
- 2026-11-07: cartão × teto virou medidor 0–200% (azul/vermelho); categorias com a altura do Sankey e linha "Outros"; sem tabela nas categorias.
- 2026-11-07: calendário soma as saídas de cada dia num valor só (detalhe na dica); cascata e calendário com a mesma altura.
- Dica (tooltip) se reposiciona para não cortar na borda da tela; Sankey sem legenda e sem tabela.
- Vencimentos: Suhai e energia no dia 10; aluguel e recarga do celular no dia 20. Calendário trocou a lista por dica nos dias.
- Kabum (Mercado Pago) corrigido: 2 parcelas (set–out/26), já quitado; a parcela de nov/26 saiu.

## Pendências

- Categoria da LMSERVICELTDA.
- Valores reais do adiantamento (hoje estimado).
- (resolvido) Dados móveis = recarga do celular, R$ 30 no dia 20.
- Textos dentro dos gráficos crescem demais em tela cheia (os SVG escalam com a largura) — principalmente Sankey e cascata. Próximo passo de design.
- Legenda da Evolução e dos Compromissos: confirmar se fica (as tabelas já saíram).
- (resolvido 2026-11-08) Publicar: GitHub Pages, público.
- RLS do Supabase (ver acima).
- (feito 2026-11-08) Página da Beatriz. Falta confirmar a categoria de SAN PEIXE e ALINESILVEIRADA (compras dela).

## Para continuar (estado em 2026-11-05, fim do dia)

0. **Git:** o painel novo está na **`main`** (GitHub: `Meytsu/financas`, **público**), que publica o site a cada push. Em outro PC: `git clone git@github.com:Meytsu/financas.git`.
1. `cd ~/Documentos/Finanças/dashboard && npm run dev` → http://localhost:3000/financas
2. Se baixar fatura nova: seguir o fluxo do `~/Documentos/Finanças/CLAUDE.md` e rodar `python3 ../scripts/gerar_henrique.py`.
3. Para o Claude acessar o Supabase de novo: o MCP `supabase` já está configurado no Claude Code (`~/.claude.json`); se pedir login, `/mcp` → supabase → Authenticate.
4. Retomar pelas **Pendências** acima — a próxima é o ajuste de design dos textos dos gráficos.
