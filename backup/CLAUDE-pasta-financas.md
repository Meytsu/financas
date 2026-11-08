# Projeto Finanças — Henrique e Beatriz

Painel financeiro pessoal. **Refeito do zero em 2026-11-05.** Uma página por pessoa, com a mesma mecânica: ao abrir o site, a tela **"Quem está acessando?"** pergunta quem é, e a página já entra filtrada para essa pessoa (dá para trocar no painel de Filtros). Beatriz incluída em 2026-11-08.

- **Manual do painel** (indicadores, gráficos, regras de design): [dashboard/README.md](dashboard/README.md)
- **Parâmetros financeiros e decisões (Henrique e Beatriz):** [dashboard/MEMORIES.md](dashboard/MEMORIES.md)

## Git

Repo `Meytsu/financas` (**público**). **Publicação: GitHub Pages** — decidido pelo Henrique em 2026-11-08 ("não tem problema" o site ser público). Cada push na `main` publica `https://meytsu.github.io/financas/` via GitHub Actions (~1 min). A `painel-novo` foi a branch de trabalho do painel novo.

## Como rodar

```bash
cd ~/Documentos/Finanças/dashboard
npm run dev          # http://localhost:3000/financas  (basePath /financas)
```

## Fluxo: "baixei a fatura nova, atualize"

1. O CSV da XP chega em `~/Downloads/` (às vezes repetido: "Documento de Henrique(1).csv"…). Compare por `md5sum` e use só os únicos.
2. Copie para a raiz do projeto com o nome do mês da fatura: `Fatura2026-MM-10.csv` (o mês é o do **vencimento**, dia 10).
   - Para saber o mês: a fatura que tem a linha "Pagamento de fatura" e compras do mês anterior é a fatura que vence agora.
3. Registre o arquivo em `CSV_POR_MES` em [scripts/gerar_dados.py](scripts/gerar_dados.py). O mesmo CSV traz as compras das duas pessoas (o script separa pelo titular: HENRIQUE ALVES / BEATRIZ WERNECK).
4. Rode `python3 scripts/gerar_dados.py` — gera `henrique.json` e `beatriz.json` e imprime, por pessoa, o total por fatura e as lojas **sem categoria** (marcadas "a confirmar"). (`gerar_henrique.py` ainda funciona: só chama o novo.)
5. **Mostre ao Henrique o resumo e pergunte a categoria das lojas novas** antes de considerar pronto. Lojas confirmadas viram regra em `REGRAS` no script.
6. Confira em http://localhost:3000/financas.

Outros lançamentos manuais ficam em `PESSOAS` no script (um bloco por pessoa):
- **Salário que caiu na conta** → `renda.realizados` (substitui a estimativa daquele mês).
- **Energia e outras contas variáveis fora do cartão** → `variaveis_fora_cartao` (`valor: None` enquanto a conta não chega).
- **Saldo da reserva** → `reserva.contas` (+ `atualizado`).
- **Compra dividida 50/50** → `DIVIDIR_50_50` (data, loja, valor cheio). O titular fica com a metade arredondada para cima e a outra pessoa com o resto — cada metade aparece na página de cada um. Só as que o Henrique confirmar (a feira grande do mês no Bongi, feita no início do mês quando a fatura XP vira; em nov/26 só a de maior valor).
- **Ajuste no valor de um lançamento** (estorno, erro na nota) → `AJUSTES` (data, loja, valor na fatura) = (ajuste, motivo). É aplicado **antes** da divisão 50/50 e aparece na tabela de lançamentos com a marca "ajuste" (o motivo fica na dica). Ex.: Bongi 04/11/26 R$ 798,99 − R$ 150 (44 macarrões passados por engano) = R$ 648,99 → R$ 324,50 Henrique / R$ 324,49 Beatriz.
- **Parcelas futuras:** o script projeta sozinho as parcelas seguintes de cada compra parcelada dos CSVs (ex.: SAEL 1 de 3 em dez → 2/3 em jan e 3/3 em fev), sem duplicar o que já existe; quando a fatura daquele mês chegar, ela substitui a projeção.
- **Dia de vencimento** das fixas → `dias_fixas` de cada pessoa (Henrique: aluguel e recarga do celular no dia 20; Beatriz: energia no dia 10); dos boletos → `DIAS_BOLETOS` (Suhai: dia 10); das contas variáveis → campo `dia` em `variaveis_fora_cartao` (energia: dia 10).

## De onde vêm os dados

| Dado | Fonte |
|---|---|
| Faturas XP até ago/26 e de jan/27 em diante + Nubank (Henrique abr–ago/26, Beatriz até set/26) | `dashboard/public/data.json` (histórico antigo, só leitura) |
| Faturas set–out/26 | Supabase, tabela `transacoes_variaveis` (mais completo que o data.json) |
| Faturas de nov/26 em diante | CSVs `FaturaAAAA-MM-10.csv` (nov/26, dez/26 parcial, jan/27 e fev/27 só com parcelas) — registrados em `CSV_POR_MES`; o CSV da XP é a fonte oficial e substitui o histórico e as projeções daquele mês |
| Despesas fixas | Supabase `despesas_fixas` (sem a Feira — a feira agora é gasta no cartão) |
| Boletos e financiamentos (Suhai, Kabum, BMW) | Supabase `outras_despesas` |
| Renda, teto, reserva, energia | `PESSOAS` em `scripts/gerar_dados.py` |

Tudo é juntado em **`dashboard/data/henrique.json`** e **`dashboard/data/beatriz.json`** (fora de `public/`), que a página importa direto.

**Supabase (usado pelo Claude para levantar as informações em 2026-11-05):** projeto "Finanças" (`epmlwrfumrjsrcpeudoj`). Detalhes do que foi lido e corrigido: seção "De onde vieram as informações" em [dashboard/README.md](dashboard/README.md). URL e chave pública ficam em `Finanças/.env` (fora do git). Pelo Claude Code, o servidor MCP `supabase` está configurado em **modo só leitura**. O RLS das tabelas está desligado — o Henrique sabe e decidiu deixar para depois.

**Backup:** o script grava uma cópia das tabelas do Supabase (JSON + CSV), das faturas, do próprio script e deste CLAUDE.md em `dashboard/backup/` a cada execução. Se o Supabase cair, o script usa esse backup sozinho. Ver "Backup" em [dashboard/README.md](dashboard/README.md).

**Correções aplicadas sobre o Supabase** (confirmadas pelo Henrique):
- Seguro Suhai: o banco tem out–dez/26; o certo é **set–nov/26** (o script recua 1 mês).
- Kabum (Mercado Pago): o banco tem 3 parcelas; eram **só 2 (set–out/26), já quitado** — a 3/3 de nov é descartada (`TOTAL_PARCELAS`).
- Lançamento "Supermercado Extra R$ 85 / Henrique Alves" de 25/09: parece teste, está **excluído**.

## Regras importantes

- **Confirmar antes de gravar** dados novos (mostrar o resumo e as categorias sugeridas).
- **Nunca apagar dados** sem pedir. Os arquivos antigos (`data/*.xlsx`, `data/dashboard_data.json*`, `public/data.json`) ficam como estão.
- **Teto do cartão XP** (inclui as parcelas): Henrique **R$ 1.200**, Beatriz **R$ 800**. O Nubank fica fora do teto.
- O cartão **Nubank está sendo eliminado** — não incentivar compras nele. Hoje os dois usam só a XP; a Beatriz tem o cartão adicional físico no nome dela (a ideia é que tudo dela apareça só no nome dela).
- **Privacidade:** o site `meytsu.github.io/financas` e o repo são **públicos** (decisão do Henrique, 2026-11-08). Holerites (CPF, conta bancária) e o `.env` **nunca** entram no repositório.
- Responder sempre em português.

## Estrutura

```
Finanças/
├── CLAUDE.md                 este arquivo
├── .env                      URL + chave pública do Supabase (não versionar)
├── Fatura2026-MM-10.csv      faturas XP (separador ;, valor "R$ 1.234,56")
├── Nubank_2026-MM-22.csv     faturas Nubank antigas (separador ,)
├── scripts/
│   ├── gerar_dados.py        junta todas as fontes -> dashboard/data/{henrique,beatriz}.json
│   └── gerar_henrique.py     nome antigo (só chama o gerar_dados.py)
├── data/                     planilhas e JSONs antigos (histórico, não usados pela página nova)
└── dashboard/                Next.js 16 (repo git: github.com/Meytsu/financas)
    ├── README.md             manual do painel
    ├── MEMORIES.md           parâmetros e decisões financeiras
    ├── data/henrique.json    dados do Henrique (gerado)
    ├── data/beatriz.json     dados da Beatriz (gerado)
    ├── lib/financas.ts       cálculos dos indicadores
    └── app/
        ├── page.tsx          a página
        ├── graficos.tsx      gráficos em SVG puro + dica (tooltip)
        ├── tabela.tsx        tabela com cabeçalhos ordenáveis (janela de lançamentos)
        └── globals.css       todo o estilo (CSS puro, sem Tailwind)
```
