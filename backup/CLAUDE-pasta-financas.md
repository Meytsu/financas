# Projeto Finanças — Henrique (e depois Beatriz)

Painel financeiro pessoal. **Refeito do zero em 2026-11-05.** Primeiro a página do Henrique; depois uma página separada para a Beatriz (cada um vê só a sua).

- **Manual do painel** (indicadores, gráficos, regras de design): [dashboard/README.md](dashboard/README.md)
- **Parâmetros financeiros e decisões do Henrique:** [dashboard/MEMORIES.md](dashboard/MEMORIES.md)

## Git

O trabalho novo está na branch **`painel-novo`** do repo `Meytsu/financas` (público). A `main` publica o site `meytsu.github.io/financas` a cada push — **não fazer merge/push na `main` sem o Henrique decidir publicar.**

## Como rodar

```bash
cd ~/Documentos/Finanças/dashboard
npm run dev          # http://localhost:3000/financas  (basePath /financas)
```

## Fluxo: "baixei a fatura nova, atualize"

1. O CSV da XP chega em `~/Downloads/` (às vezes repetido: "Documento de Henrique(1).csv"…). Compare por `md5sum` e use só os únicos.
2. Copie para a raiz do projeto com o nome do mês da fatura: `Fatura2026-MM-10.csv` (o mês é o do **vencimento**, dia 10).
   - Para saber o mês: a fatura que tem a linha "Pagamento de fatura" e compras do mês anterior é a fatura que vence agora.
3. Registre o arquivo em `CSV_POR_MES` em [scripts/gerar_henrique.py](scripts/gerar_henrique.py).
4. Rode `python3 scripts/gerar_henrique.py` — ele imprime o total por fatura e as lojas **sem categoria** (marcadas "a confirmar").
5. **Mostre ao Henrique o resumo e pergunte a categoria das lojas novas** antes de considerar pronto. Lojas confirmadas viram regra em `REGRAS` no script.
6. Confira em http://localhost:3000/financas.

Outros lançamentos manuais ficam no `CONFIG` do script:
- **Salário que caiu na conta** → `renda.realizados` (substitui a estimativa daquele mês).
- **Energia e outras contas variáveis fora do cartão** → `variaveis_fora_cartao` (`valor: None` enquanto a conta não chega).
- **Saldo da reserva** → `reserva.contas` (+ `atualizado`).
- **Dia de vencimento** das fixas → `DIAS_FIXAS` (aluguel e recarga do celular: dia 20); dos boletos → `DIAS_BOLETOS` (Suhai: dia 10); das contas variáveis → campo `dia` em `variaveis_fora_cartao` (energia: dia 10).

## De onde vêm os dados

| Dado | Fonte |
|---|---|
| Faturas XP até ago/26 e de jan/27 em diante | `dashboard/public/data.json` (histórico antigo, só leitura) |
| Faturas set–out/26 | Supabase, tabela `transacoes_variaveis` (mais completo que o data.json) |
| Faturas nov–dez/26 | CSVs `Fatura2026-11-10.csv`, `Fatura2026-12-10.csv` |
| Despesas fixas | Supabase `despesas_fixas` (sem a Feira — a feira agora é gasta no cartão) |
| Boletos e financiamentos (Suhai, Kabum, BMW) | Supabase `outras_despesas` |
| Renda, teto, reserva, energia | `CONFIG` em `scripts/gerar_henrique.py` |

Tudo é juntado em **`dashboard/data/henrique.json`** (fora de `public/`), que a página importa direto.

**Supabase (usado pelo Claude para levantar as informações em 2026-11-05):** projeto "Finanças" (`epmlwrfumrjsrcpeudoj`). Detalhes do que foi lido e corrigido: seção "De onde vieram as informações" em [dashboard/README.md](dashboard/README.md). URL e chave pública ficam em `Finanças/.env` (fora do git). Pelo Claude Code, o servidor MCP `supabase` está configurado em **modo só leitura**. O RLS das tabelas está desligado — o Henrique sabe e decidiu deixar para depois.

**Backup:** o script grava uma cópia das tabelas do Supabase (JSON + CSV), das faturas, do próprio script e deste CLAUDE.md em `dashboard/backup/` a cada execução. Se o Supabase cair, o script usa esse backup sozinho. Ver "Backup" em [dashboard/README.md](dashboard/README.md).

**Correções aplicadas sobre o Supabase** (confirmadas pelo Henrique):
- Seguro Suhai: o banco tem out–dez/26; o certo é **set–nov/26** (o script recua 1 mês).
- Kabum (Mercado Pago): o banco tem 3 parcelas; eram **só 2 (set–out/26), já quitado** — a 3/3 de nov é descartada (`TOTAL_PARCELAS`).
- Lançamento "Supermercado Extra R$ 85 / Henrique Alves" de 25/09: parece teste, está **excluído**.

## Regras importantes

- **Confirmar antes de gravar** dados novos (mostrar o resumo e as categorias sugeridas).
- **Nunca apagar dados** sem pedir. Os arquivos antigos (`data/*.xlsx`, `data/dashboard_data.json*`, `public/data.json`) ficam como estão.
- **Teto do cartão (R$ 1.200) inclui as parcelas.**
- O cartão **Nubank está sendo eliminado** — não incentivar compras nele.
- **Privacidade:** o site `meytsu.github.io/financas` é público. `henrique.json` entra no JavaScript do site no build, então **não fazer push/deploy** da página nova sem o Henrique decidir onde ela vai morar (local, com senha, ou público). Holerites (CPF, conta, salário) nunca entram no repositório.
- Responder sempre em português.

## Estrutura

```
Finanças/
├── CLAUDE.md                 este arquivo
├── .env                      URL + chave pública do Supabase (não versionar)
├── Fatura2026-MM-10.csv      faturas XP (separador ;, valor "R$ 1.234,56")
├── Nubank_2026-MM-22.csv     faturas Nubank antigas (separador ,)
├── scripts/
│   └── gerar_henrique.py     junta todas as fontes -> dashboard/data/henrique.json
├── data/                     planilhas e JSONs antigos (histórico, não usados pela página nova)
└── dashboard/                Next.js 16 (repo git: github.com/Meytsu/financas)
    ├── README.md             manual do painel
    ├── MEMORIES.md           parâmetros e decisões financeiras
    ├── data/henrique.json    dados da página (gerado)
    ├── lib/financas.ts       cálculos dos indicadores
    └── app/
        ├── page.tsx          a página
        ├── graficos.tsx      gráficos em SVG puro + dica (tooltip)
        └── globals.css       todo o estilo (CSS puro, sem Tailwind)
```
