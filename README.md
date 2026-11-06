# Painel de finanças — Henrique

Página única, em Next.js 16, **CSS puro** (sem Tailwind) e **gráficos em SVG próprio** (sem biblioteca). Refeita do zero em 2026-11-05.

```bash
npm run dev     # http://localhost:3000/financas
npx tsc --noEmit -p . && npm run lint   # checagem antes de dar por pronto
```

Os dados vêm de `data/henrique.json`, gerado por `../scripts/gerar_henrique.py` (ver o [CLAUDE.md da pasta Finanças](../CLAUDE.md)).

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
└ rodapé: data de geração dos dados ┘
```

- **Seletor de mês** (‹ ›, "Hoje"): tudo na página segue o mês escolhido. Abre no mês do calendário de hoje.
- **Lançamentos**: botão no topo abre uma janela (`<dialog>` nativo) com a tabela da fatura do mês. Fecha com ✕, Esc ou clique fora. O endereço `/financas#lancamentos` abre a janela direto.
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

Cada card: **título à esquerda, selo de status no canto superior direito**, número + referência à esquerda, gráfico à direita. O selo sempre tem ícone **e** texto (nunca só cor).

| Card | Fórmula | Status | Gráfico |
|---|---|---|---|
| **Sobra do mês** (número herói) | receitas − saídas; variação vs. mês anterior | — | sparkline 6 meses |
| **Taxa de poupança** | sobra ÷ receitas | ≥ 20% Saudável · ≥ 10% Atenção · ≥ 0 Alto · < 0 Crítico | sparkline 6 meses |
| **Renda comprometida** | (parcelas do cartão + boletos) ÷ receitas | ≤ 24% Saudável · ≤ 30% Atenção · ≤ 45% Alto · acima Crítico | sparkline 6 meses |
| **Cartão × teto** | fatura ÷ R$ 1.200 (inclui parcelas) | ≤ 85% Saudável · ≤ 100% Atenção · ≤ 130% Alto · acima Crítico | bullet (barra = fatura, traço vermelho = teto, faixas cinza) |
| **Reserva de emergência** | reserva ÷ média das saídas dos 6 meses anteriores | ≥ 6 meses Saudável · ≥ 3 Atenção · ≥ 1 Alto · < 1 Crítico | medidor até a meta (6 × custo mensal) |

Referências (pesquisa de 2026-11-05): taxa de poupança 10–20% "bom começo", 20–30% "sólida"; comprometimento até ~30% da renda líquida (convenção de educação financeira, não norma do BC); reserva de 6 meses para assalariado CLT.

**Sparklines**: **últimos 6 meses** até o mês escolhido; linha azul (série 1) com **uma bolinha por mês** (raio 3,5; o mês atual 4,5) e **área preenchida** em azul ~13% até o zero. Hover mostra mês e valor. (Os gráficos de Evolução continuam com 12 meses.)

## Os gráficos

| Gráfico | O que mostra | Detalhes |
|---|---|---|
| **Do salário à sobra** (cascata) | receitas → fixas → boletos → cartão à vista → parcelas do cartão → energia → sobra | **verde** = receitas e sobra, **vermelho** = saídas (e sobra negativa); rótulos em reais **sem centavos** (R$ 4.252, −R$ 830); **sem legenda e sem "ver como tabela"** (decisão do Henrique: a cor já explica) |
| **Calendário** | grade do mês com entradas (+) e vencimentos (−) | **sem lista embaixo**: passar o mouse (ou Tab) num dia mostra cada lançamento com nome e valor exato; todas as linhas com a mesma altura; "Sem dia definido" só aparece se houver conta sem dia |
| **Para onde foi o dinheiro** (Sankey) | receitas → contas da casa / boletos / cartão / sobra → 5 maiores categorias do cartão + "Demais" | se faltar dinheiro, aparece o nó "Faltou" à esquerda; **sem legenda e sem tabela** (os nós já têm nome e valor) |
| **Categorias do cartão** | barra = este mês, traço = média dos 6 meses anteriores, variação em % | mostra as 8 maiores; o resto fica na tabela |
| **Evolução** | 12 meses até o mês escolhido: receitas e saídas (colunas) + sobra (linha) | hover na faixa do mês mostra os três valores |
| **Compromissos já assumidos** | próximos 12 meses: parcelas do cartão + boletos + BMW (colunas empilhadas) | linha vermelha = 30% da renda |

Todos os gráficos: dica no hover **e** no foco do teclado (Tab), legenda para ≥ 2 séries e um "Ver como tabela" com os mesmos números — **exceto a cascata e o Sankey**, que ficaram só com o gráfico (decisão do Henrique).

**Números nos gráficos: sempre cheios, nunca "mil"** — eixos e rótulos curtos em inteiro com ponto de milhar (4.000, 1.894); valores exatos com centavos ficam na dica e na tabela.

## Regras de design (guia de dataviz)

- **Paleta validada** (`validate_palette.js`, claro e escuro): série 1 azul `#2a78d6`, 2 laranja `#eb6834`, 3 verde-água `#1baf7a`, 4 amarelo `#eda100` — sempre nessa ordem. Modo escuro com os mesmos tons ajustados.
- **Cores de status reservadas** (bom `#0ca30c`, atenção `#fab219`, alto `#ec835a`, crítico `#d03b3b`): só para estado, nunca para série.
- Barras ≤ 24px com ponta arredondada (4px) e base reta; linhas de 2px; grade em linha fina sólida (nunca tracejada); 2px de respiro entre segmentos empilhados.
- Texto nunca usa a cor da série; a identidade vem da marca colorida ao lado.
- Um único eixo Y por gráfico. Números grandes em fonte proporcional; `tabular-nums` só em colunas.
- Tokens de cor em `:root` (`--superficie`, `--tinta`, `--s1`…), com modo escuro por `prefers-color-scheme` e `data-theme`.

## Histórico de decisões

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
- Dica (tooltip) se reposiciona para não cortar na borda da tela; Sankey sem legenda e sem tabela.
- Vencimentos: Suhai e energia no dia 10; aluguel e recarga do celular no dia 20. Calendário trocou a lista por dica nos dias.
- Kabum (Mercado Pago) corrigido: 2 parcelas (set–out/26), já quitado; a parcela de nov/26 saiu.

## Pendências

- Categoria da LMSERVICELTDA.
- Valores reais do adiantamento (hoje estimado).
- (resolvido) Dados móveis = recarga do celular, R$ 30 no dia 20.
- Textos dentro dos gráficos crescem demais em tela cheia (os SVG escalam com a largura) — principalmente Sankey e cascata. Próximo passo de design.
- Legenda/tabela da Evolução e dos Compromissos: o Henrique tirou das outras; confirmar se tira destas também.
- Decidir onde a página vai morar: o repositório e o site `meytsu.github.io/financas` são **públicos**.
- RLS do Supabase (ver acima).
- Página da Beatriz.

## Para continuar (estado em 2026-11-05, fim do dia)

1. `cd ~/Documentos/Finanças/dashboard && npm run dev` → http://localhost:3000/financas
2. Se baixar fatura nova: seguir o fluxo do `~/Documentos/Finanças/CLAUDE.md` e rodar `python3 ../scripts/gerar_henrique.py`.
3. Para o Claude acessar o Supabase de novo: o MCP `supabase` já está configurado no Claude Code (`~/.claude.json`); se pedir login, `/mcp` → supabase → Authenticate.
4. Retomar pelas **Pendências** acima — a próxima é o ajuste de design dos textos dos gráficos.
