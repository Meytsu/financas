# Painel de finanças — Henrique e Beatriz

Painel financeiro pessoal em **Next.js 16**, com **CSS puro** (sem Tailwind) e **gráficos em SVG próprio** (sem biblioteca). Refeito do zero em 2026-11-05.

- **Site:** https://meytsu.github.io/financas/ — GitHub Pages, **público** (decisão do Henrique em 2026-11-08). Cada push na `main` republica em ~2 min (GitHub Actions).
- **Repositório:** https://github.com/Meytsu/financas (público)
- **Parâmetros financeiros e decisões:** [MEMORIES.md](MEMORIES.md)
- **Planos:** [docs/automacao-cartao.md](docs/automacao-cartao.md) — compras do celular direto para o painel (planejado)

---

## 1. As duas pessoas

Ao abrir o site aparece **"Quem está acessando?"** (Henrique / Beatriz). A página entra já com o filtro daquela pessoa; dá para trocar no painel de **Filtros**. As duas páginas têm exatamente a mesma mecânica.

| | Henrique | Beatriz |
|---|---|---|
| Renda líquida | R$ 4.390,80 — adiantamento no **dia 20** + fechamento no **dia 5** (antecipa para a sexta se cair no fim de semana) | R$ 1.665,75 no **5º dia útil** do mês (seg–sex; feriados ainda não contam) |
| Teto do cartão XP (inclui parcelas) | **R$ 1.200** | **R$ 800** |
| Fixas fora do cartão | aluguel R$ 800 (dia 20), recarga do celular R$ 30 (dia 20) | ração R$ 40, energia R$ 120 (dia 10), celular R$ 42, internet R$ 80 |
| Boletos / financiamentos | Suhai (set–nov/26), Kabum (set–out/26, quitado), **BMW 12 × R$ 1.395,93 em 2027** | — |
| Reserva de emergência | R$ 5.000 (Caixinha Nubank) | ainda não tem |
| Cartões | XP (e Nubank no histórico, abr–ago/26) | XP adicional **no nome dela** (e Nubank no histórico, até set/26) |

**Regras combinadas**
- **Feira grande do mês no Atacarejo Bongi** (feita no início do mês, quando a fatura XP vira) é **dividida 50/50**: cada metade aparece na página de cada um. As compras menores no Bongi não são divididas.
- **Energia:** a Beatriz paga R$ 120 da conta; o resto fica com o Henrique.
- **Teto vale só para a XP.** O Nubank está sendo eliminado.

---

## 2. Como rodar e atualizar

```bash
cd ~/Documentos/Finanças/dashboard
npm run dev                                  # http://localhost:3000/financas
npx tsc --noEmit -p . && npm run lint        # checagem antes de dar por pronto
npm run build                                # o mesmo build que o GitHub Actions roda
```

### Fluxo "baixei a fatura nova"

1. O CSV da XP chega em `~/Downloads/` (às vezes repetido — comparar por `md5sum`). O mesmo CSV traz as compras das duas pessoas.
2. Copiar para `~/Documentos/Finanças/FaturaAAAA-MM-10.csv` — o mês é o do **vencimento** (dia 10). Antes de sobrescrever uma versão anterior, guardar uma cópia.
3. Registrar o arquivo em `CSV_POR_MES` no script `scripts/gerar_dados.py`.
4. Rodar `python3 scripts/gerar_dados.py` (na pasta `Finanças`). Ele gera `data/henrique.json` e `data/beatriz.json`, imprime o total por fatura de cada pessoa e lista as lojas **sem categoria** ("a confirmar").
5. Perguntar ao Henrique a categoria das lojas novas; as confirmadas viram regra em `REGRAS`.
6. Conferir no `npm run dev`, fazer commit e **push na `main`** para publicar.

### O que se ajusta no script (`scripts/gerar_dados.py`)

| O quê | Onde |
|---|---|
| Renda, teto, reserva, fixas e contas variáveis de cada pessoa | `PESSOAS` |
| Salário que de fato caiu na conta (substitui a estimativa do mês) | `PESSOAS[...]["renda"]["realizados"]` |
| Conta variável fora do cartão (ex.: energia do Henrique) | `variaveis_fora_cartao` (`valor: None` enquanto não chega) |
| Dia de vencimento das fixas | `dias_fixas` de cada pessoa |
| Dia de vencimento dos boletos | `DIAS_BOLETOS` |
| Compra dividida 50/50 | `DIVIDIR_50_50` (data, loja, valor cheio) — o titular fica com a metade arredondada para cima |
| Ajuste no valor de um lançamento (estorno, erro na nota) | `AJUSTES` (data, loja, valor) = (ajuste, motivo) — aplicado **antes** da divisão |
| Correções sobre o Supabase | `RECUAR_UM_MES`, `TOTAL_PARCELAS` |
| Categoria de uma loja | `REGRAS` |

**Parcelas futuras:** o script projeta sozinho as parcelas seguintes de cada compra parcelada dos CSVs (sem duplicar); quando a fatura daquele mês chega, ela substitui a projeção.

> O script e os CSVs ficam no PC, em `~/Documentos/Finanças/` (fora do repositório), com cópia automática em [backup/](backup/) a cada execução. O guia da pasta (`CLAUDE.md`) também está copiado em [backup/CLAUDE-pasta-financas.md](backup/CLAUDE-pasta-financas.md).

---

## 3. De onde vêm os dados

| Dado | Fonte |
|---|---|
| Faturas XP até ago/26 + Nubank (histórico) | `public/data.json` (dados do painel antigo, só leitura) |
| Faturas XP set e out/26 | Supabase, `transacoes_variaveis` (mais completo que o histórico) |
| Faturas XP de nov/26 em diante | CSVs oficiais da XP (`FaturaAAAA-MM-10.csv`): nov/26, dez/26 (parcial, compras até 05/11), jan/27 e fev/27 (só parcelas) |
| Despesas fixas | Supabase, `despesas_fixas` (sem a Feira — agora é gasta no cartão) |
| Boletos e financiamentos | Supabase, `outras_despesas` |
| Renda, teto, reserva, energia | `PESSOAS` no script |

### Supabase — como o Claude acessou as informações

Para montar o painel, o Claude (Claude Code) **acessou o banco Supabase do projeto "Finanças"** (`epmlwrfumrjsrcpeudoj`, criado em 25/09/2026, que estava pausado no plano gratuito até o Henrique reativá-lo em 05/11/2026).

- **Como:** servidor MCP oficial do Supabase (`https://mcp.supabase.com/mcp?read_only=true`), autorizado pelo Henrique com login no navegador, **somente leitura** — nada foi alterado no banco. O script lê as mesmas tabelas pela API REST com a chave pública (em `Finanças/.env`, fora do git).
- **O que foi lido:** `transacoes_variaveis` (515 lançamentos de cartão), `despesas_fixas` (fixas das duas pessoas) e `outras_despesas` (BMW, Suhai, Kabum).
- **Correções aplicadas no script** (o banco continua com os valores antigos): Suhai **set–nov/26** (o banco tem out–dez); Kabum **só 2 parcelas** (o banco tem 3); lançamento de teste "Supermercado Extra R$ 85 / Henrique Alves" **excluído**.
- **Segurança:** as 3 tabelas estão com **RLS desligado** — quem tiver a chave pública lê e altera tudo. O Henrique sabe e decidiu tratar depois. Para fechar: `ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;`. A tabela nova planejada para o celular já nasce protegida (ver [docs/automacao-cartao.md](docs/automacao-cartao.md)).
- **Reconectar o acesso do Claude:** `/mcp` → supabase → Authenticate.

### Backup (para não depender do Supabase)

| Pasta | O que tem |
|---|---|
| [backup/supabase/](backup/supabase/) | as 3 tabelas em **JSON** (cópia exata) e **CSV** (separador `;`, abre em planilha) |
| [backup/faturas/](backup/faturas/) | os CSVs das faturas XP e Nubank |
| [backup/scripts/](backup/scripts/) | cópia dos scripts (`gerar_dados.py`; `gerar_henrique.py` é o nome antigo e só chama o novo) |
| [backup/CLAUDE-pasta-financas.md](backup/CLAUDE-pasta-financas.md) | cópia do guia da pasta |

- **Atualiza sozinho** a cada execução do script (quando o Supabase responde).
- **Plano B:** se o Supabase não responder (pausado, sem internet, sem `.env`), o script **usa o backup** e avisa ("AVISO: Supabase indisponível… usando o backup"). Testado: a saída sai idêntica.
- **Nunca vão para o backup:** o `.env` (chave), holerites e PDFs.
- **Restaurar num PC novo:** clonar o repo; copiar `backup/scripts/*.py` para `Finanças/scripts/`, `backup/faturas/*.csv` para `Finanças/` e `backup/CLAUDE-pasta-financas.md` para `Finanças/CLAUDE.md`; criar o `.env` com `SUPABASE_URL` e `SUPABASE_KEY` (ou rodar sem ele, usando o backup).

---

## 4. A página

```
            "Quem está acessando?"  [Henrique] [Beatriz]
                              │
┌ HENRIQUE ............. FINANÇAS ............. [☰] [⚙] ┐   ☰ Lançamentos · ⚙ Filtros
├ Sobra ┬ Poupança ┬ Comprometida ┬ Cartão × teto ┬ Reserva ┤   bloco 1 (indicadores)
├──────── Do salário à sobra ───────┬──── Calendário ────┤
├──────── Para onde foi o dinheiro ─┬──── Categorias ────┤
├──────── Evolução 12 meses ────────┬─ Compromissos ─────┤
```

- **Tela cheia** (sem largura máxima).
- **Cabeçalho:** nome da pessoa à esquerda, **"FINANÇAS"** no centro (os dois em maiúsculas); à direita dois botões só com ícone SVG — **Lançamentos** e **Filtros** — que, ao passar o mouse, se abrem mostrando o nome.

### Filtros (painel lateral)

Surge da direita; fecha com ✕ (com borda), Esc ou clique fora; a página atrás não rola.
- **Mês:** calendário de 12 meses com troca de ano (substituiu o antigo seletor ‹ › do topo) e "Voltar para o mês atual".
- **Usuário:** Henrique / Beatriz (troca de página).
- **Cartão:** Todos / XP / Nubank.
- **Categoria:** lista de categorias.
- Cartão e categoria valem para a página toda; quando ativos aparece a faixa **"Filtrando: … limpar"** no topo e um número no botão de filtros.
- **Rodapé:** "Última atualização" — data dos dados e da reserva por extenso (ex.: 05 de Novembro de 2026).

### Lançamentos (janela)

- **Duas tabelas:** *Contas fora do cartão* (fixas, boletos e contas variáveis, com observação) e *Cartões* (a fatura do mês, com a coluna Cartão XP/Nubank).
- **Total do mês** (contas + cartões) no **canto superior direito**, ao lado do ✕ (com borda); o detalhe aparece ao passar o mouse.
- **Clicar no cabeçalho ordena** (1º clique crescente ▲, 2º decrescente ▼).
- **Cada tabela tem a própria rolagem**, cabeçalho fixo no topo e **linha de total fixa no fim**; com a janela aberta, a página de fundo não rola.
- Compra dividida: marca **50/50** e só a metade da pessoa; com ajuste, marca **ajuste** — a conta inteira e o motivo ficam na dica.
- Fecha com ✕, Esc ou clique fora. `/financas#lancamentos` abre a janela direto.

### Como cada número do mês é calculado

O mês **M** junta:
- **Receitas:** as entradas de M (valor real quando lançado em `realizados`; senão a estimativa).
- **Fixas:** as fixas da pessoa.
- **Boletos:** parcelas fora do cartão com mês M.
- **Cartões:** a fatura XP que **vence** em M (dia 10) + a Nubank (dia 22). Parcelada = "n de m" com m > 1.
- **Fora do cartão:** contas variáveis de M.
- **Saídas** = fixas + boletos + cartões + fora do cartão. **Sobra** = receitas − saídas.

Código: [lib/financas.ts](lib/financas.ts) (`resumoMes`, `entradasDoMes`, `compromissosFuturos`, `nDiaUtil`).

### Bloco 1 — indicadores

Cada card: título à esquerda, **selo de status no canto superior direito** (ícone + texto, nunca só cor), **só o valor principal** e, logo abaixo, o **delta contra o mês anterior** (seta + valor, sem "vs. mês"; verde = melhorou, vermelho = piorou; taxas em pontos percentuais, "p.p."). A reserva, sem histórico, mostra o **% da meta**. Gráfico à direita.

| Card | Fórmula | Status | Gráfico |
|---|---|---|---|
| **Sobra do mês** (número herói) | receitas − saídas | — | sparkline 6 meses |
| **Taxa de poupança** | sobra ÷ receitas | ≥ 20% Saudável · ≥ 10% Atenção · ≥ 0 Alto · < 0 Crítico | sparkline 6 meses |
| **Renda comprometida** | (parcelas do cartão + boletos) ÷ receitas | ≤ 24% Saudável · ≤ 30% Atenção · ≤ 45% Alto · acima Crítico | sparkline 6 meses |
| **Cartão × teto** | fatura **XP** ÷ teto da pessoa | ≤ 85% Saudável · ≤ 100% Atenção · ≤ 130% Alto · acima Crítico | medidor de **0 a 200%**: azul até o teto, vermelho no que passar, traço = teto |
| **Reserva de emergência** | reserva ÷ média das saídas dos 6 meses anteriores | ≥ 6 meses Saudável · ≥ 3 Atenção · ≥ 1 Alto · < 1 Crítico | medidor até a meta (6 × gasto médio) |

**Popover de detalhes** — passar o mouse no card (ou tocar, no celular; ou Tab) abre com animação um painel com o máximo de informação:
- *Sobra:* cada entrada (estimada ou real), cada tipo de saída, sobra do mês anterior e média de 6 meses.
- *Poupança:* a conta (sobra ÷ receitas), quanto falta/sobra para a meta de 20%, as faixas, mês anterior e média.
- *Renda comprometida:* parcelas do cartão e cada boleto, limite de 30% em reais e a folga/excesso, os 3 próximos meses.
- *Cartão × teto:* à vista × parcelas, fatura XP, Nubank (fora do teto), teto e diferença, 4 maiores categorias, fatura do mês anterior.
- *Reserva:* **Onde está** (contas e total); **Meta** (gasto médio por mês, meta de 6 meses, quanto já tem e %, quanto falta); **Previsão** (sobra média, em que mês a meta é atingida guardando a sobra, quanto guardar por mês para chegar em 12 e em 24 meses). Valores com centavos.

**Sparklines:** últimos **6 meses**; linha azul com uma bolinha por mês (o atual maior) e área preenchida em azul claro.

Referências (pesquisa de 2026-11-05): taxa de poupança 10–20% "bom começo", 20–30% "sólida"; comprometimento até ~30% da renda líquida (convenção de educação financeira, não norma do BC); reserva de 6 meses para assalariado CLT.

### Os gráficos

| Gráfico | O que mostra | Detalhes |
|---|---|---|
| **Do salário à sobra** (cascata) | receitas → fixas → boletos → cartão à vista → parcelas do cartão → energia → sobra | **verde** = entra/sobra, **vermelho** = saída (e sobra negativa); rótulos sem centavos; sem legenda; mesma altura do calendário |
| **Calendário** | grade do mês com entradas (+) e vencimentos (−) | saídas do dia **somadas num valor só**; passar o mouse num dia mostra cada lançamento; linhas de altura igual; "Sem dia definido" só se houver conta sem dia |
| **Para onde foi o dinheiro** (Sankey) | receitas → contas da casa / boletos / cartões / sobra → 5 maiores categorias + "Demais" | nó "Faltou" se faltar dinheiro; sem legenda |
| **Categorias do cartão** | barra = este mês, traço = média dos 6 meses anteriores, variação em % | **mesma altura do Sankey**: mostra as que cabem; o excedente vira **Outros** (valor e média somados) |
| **Evolução** | 12 meses: receitas e saídas (colunas) + sobra (linha) | legenda centralizada |
| **Compromissos já assumidos** | próximos 12 meses: parcelas do cartão + boletos + BMW (empilhadas) | linha vermelha = 30% da renda; séries sem valor saem da legenda |

Em todos: dica no hover **e** no foco do teclado (Tab), que se reposiciona para não cortar na borda. **Nenhum gráfico tem "Ver como tabela"** e **números sempre cheios** (4.000, 1.894 — nunca "mil"); valores exatos com centavos ficam na dica.

### Regras de design (guia de dataviz)

- **Paleta validada** (`validate_palette.js`, claro e escuro): série 1 azul `#2a78d6`, 2 laranja `#eb6834`, 3 verde-água `#1baf7a`, 4 amarelo `#eda100`, sempre nessa ordem; modo escuro com os mesmos tons ajustados.
- **Cores de status** (bom `#0ca30c`, atenção `#fab219`, alto `#ec835a`, crítico `#d03b3b`) só para estado.
- Barras ≤ 24px com ponta arredondada e base reta; linhas de 2px; grade em linha fina sólida; 2px de respiro entre segmentos empilhados.
- Texto nunca usa a cor da série; um único eixo Y por gráfico; `tabular-nums` só em colunas.
- Tokens de cor em `:root` (`--superficie`, `--tinta`, `--s1`…), modo escuro por `prefers-color-scheme` e `data-theme`.

---

## 5. Estrutura dos arquivos

```
dashboard/                       (este repositório)
├── README.md                    este manual
├── MEMORIES.md                  parâmetros e decisões financeiras (Henrique e Beatriz)
├── docs/automacao-cartao.md     plano: compras do celular direto para o painel
├── data/henrique.json           dados do Henrique (gerado pelo script)
├── data/beatriz.json            dados da Beatriz (gerado pelo script)
├── lib/financas.ts              cálculos (mês, indicadores, dia útil, compromissos)
├── app/
│   ├── page.tsx                 tela de escolha + a página da pessoa
│   ├── graficos.tsx             gráficos em SVG + dica (tooltip) + categorias ajustadas
│   ├── tabela.tsx               tabela com cabeçalhos ordenáveis
│   ├── layout.tsx
│   └── globals.css              todo o estilo (CSS puro)
├── backup/                      cópia das tabelas do Supabase, faturas, scripts e guia
├── public/data.json             dados do painel antigo (histórico, só leitura)
└── .github/workflows/deploy.yml build + publicação no GitHub Pages a cada push na main

~/Documentos/Finanças/           (fora do repositório)
├── CLAUDE.md                    guia da pasta (cópia em backup/)
├── .env                         URL + chave pública do Supabase (nunca versionar)
├── FaturaAAAA-MM-10.csv         faturas XP;  Nubank_AAAA-MM-22.csv = Nubank antigas
└── scripts/gerar_dados.py       gera data/{henrique,beatriz}.json
```

---

## 6. Histórico de decisões

**2026-11-05 — refazer do zero (Henrique)**
- Painel antigo (Tailwind, dados do casal misturados) substituído; o antigo está no git (commit `de20e64`).
- Next.js atualizado para 16.4.5 (`npm audit`); Tailwind removido; tudo em CSS puro. Recharts continua instalado, mas não é usado.
- Dados importados de `data/henrique.json` (fora de `public/`).
- Valores revisados com o Henrique: renda líquida R$ 4.390,80; teto R$ 1.200 com parcelas; reserva real R$ 5 mil; BMW 12 × R$ 1.395,93 em 2027; feira passou para o cartão; Spotify cancelado.
- Supabase reativado e lido pelo Claude (só leitura); Suhai e Kabum corrigidos; backup dos dados no repositório.
- Indicadores e gráficos escolhidos por pesquisa (taxa de poupança, comprometimento de renda, reserva em meses, cascata, Sankey, bullet, sparklines).

**2026-11-07 — ajustes de design**
- Bloco 1: só valor + delta; selos no canto superior direito; detalhes em popover animado; sparklines de 6 meses com bolinhas e área; cartão × teto como medidor de 0 a 200%.
- Cascata em verde/vermelho, sem "mil" e sem centavos; calendário com saídas somadas por dia e dica; cascata/calendário e Sankey/categorias com alturas iguais; categorias com linha "Outros".
- Removidos todos os "Ver como tabela", o rodapé "Dados gerados em…" e as legendas da cascata e do Sankey.
- Janela de lançamentos com 2 tabelas ordenáveis, rolagem própria e total fixo.
- Cabeçalho centralizado em maiúsculas com botões de ícone animados; painel lateral de filtros (mês, usuário, cartão, categoria); Nubank do Henrique (abr–ago/26) incluído — teto só na XP.
- Bongi de 03/10 dividido 50/50 (R$ 137,96 / R$ 137,95) — só o de maior valor.
- Vencimentos: Suhai e energia no dia 10; aluguel e recarga do celular no dia 20.

**2026-11-08 — Beatriz e publicação**
- Página da Beatriz com a mesma mecânica; tela "Quem está acessando?"; script `gerar_dados.py` gera um arquivo por pessoa (dados do Henrique idênticos aos de antes).
- Publicação no **GitHub Pages, público** (decisão do Henrique).
- Fatura de dez/26 parcial: Bongi 04/11 R$ 798,99 − R$ 150 (estorno de 44 macarrões passados por engano) = R$ 648,99, dividido 50/50 (R$ 324,50 / R$ 324,49). Mecanismo `AJUSTES` criado.
- Parcelas futuras passam a ser projetadas pelo script; faturas de jan/27 e fev/27 (só parcelas) baixadas — SAEL 2/3 e 3/3 = R$ 326,66; a parcela Figueiras R$ 6,99 da Beatriz não está nas faturas oficiais e saiu.
- Janela de lançamentos: só o total do mês no canto superior direito; ✕ com borda.
- Plano da automação das compras pelo celular documentado ([docs/automacao-cartao.md](docs/automacao-cartao.md)).

---

## 7. Pendências

1. **Automação das compras pelo celular** (Google Carteira → MacroDroid → Supabase → site atualizado sozinho) — falta o print de uma notificação real; ver [docs/automacao-cartao.md](docs/automacao-cartao.md).
2. **Categorias a confirmar:** LMSERVICELTDA (Henrique, R$ 35,26); SAN PEIXE e ALINESILVEIRADA (Beatriz).
3. **Adiantamento real** do Henrique (hoje estimado em R$ 2.158,32).
4. **Feriados** no 5º dia útil da Beatriz (hoje só pula sábado e domingo).
5. **Textos dentro dos gráficos** crescem em tela cheia (os SVG escalam com a largura) — principalmente Sankey e cascata.
6. **RLS do Supabase** nas tabelas antigas.
7. **Fatura de dez/26** ainda parcial — baixar de novo quando fechar (dia 02/12).

## 8. Para continuar

1. `cd ~/Documentos/Finanças/dashboard && npm run dev` → http://localhost:3000/financas
2. Fatura nova: seguir a seção 2 (Fluxo "baixei a fatura nova").
3. Publicar: commit + `git push origin main` (o site atualiza em ~2 min).
4. Supabase pelo Claude: `/mcp` → supabase → Authenticate.
5. Retomar pelas **Pendências**.
