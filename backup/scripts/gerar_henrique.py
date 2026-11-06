#!/usr/bin/env python3
"""Gera dashboard/data/henrique.json — os dados da página do Henrique.

Fontes de cada fatura do cartão (só HENRIQUE ALVES):
  - até 2026-08 e de 2027-01 em diante: dashboard/public/data.json (histórico antigo)
  - 2026-09 e 2026-10: Supabase (transacoes_variaveis) — mais completo que o data.json
  - 2026-11 e 2026-12: CSVs da XP (Fatura2026-11-10.csv, Fatura2026-12-10.csv)
Fixas e parcelas/boletos (Suhai, Kabum, BMW) vêm do Supabase.
Renda, teto e energia ficam em CONFIG abaixo.

Uso: python3 scripts/gerar_henrique.py   (a partir da pasta Finanças)
"""
import collections
import csv
import json
import re
import shutil
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "dashboard" / "data" / "henrique.json"
PORTADOR = "HENRIQUE ALVES"

CONFIG = {
    "renda": {
        "liquida_mensal": 4390.80,
        "estimado": True,
        "entradas": [
            # dia útil: se cair no sábado/domingo, o pagamento vem antes (na sexta)
            {"nome": "Salário (fechamento)", "dia": 5, "valor": 2232.48},
            {"nome": "Adiantamento", "dia": 20, "valor": 2158.32},
        ],
        # valores que de fato caíram na conta (substituem a estimativa daquele mês)
        "realizados": [
            {"mes": "2026-11", "nome": "Salário (fechamento)", "valor": 2094.00, "obs": "saldo do salário de outubro"},
        ],
    },
    "teto_cartao": 1200.0,  # inclui as parcelas
    "limite_comprometimento": 0.30,  # parcelas + boletos ÷ renda (referência de educação financeira)
    "fatura_vencimento_dia": 10,
    "reserva": {
        "contas": [{"nome": "Caixinha Nubank", "valor": 5000.0}],
        "meta_meses": 6,  # meses de custo (referência para assalariado)
        "atualizado": "2026-11-05",
    },
    "variaveis_fora_cartao": [
        # conta de R$ 153,88; a Beatriz paga R$ 120 e o saldo fica com o Henrique
        {"nome": "Energia", "mes": "2026-11", "dia": 10, "valor": 33.88, "obs": "conta R$ 153,88 − R$ 120,00 da Beatriz"},
    ],
}

# Dia de vencimento das fixas (o Supabase não guarda o dia)
DIAS_FIXAS = {"Aluguel": 20, "Dados móveis": 20}  # recarga do celular: última em 20/10, próxima ~20/11
# Dia de vencimento dos boletos/financiamentos fora do cartão
DIAS_BOLETOS = {"Seguro Suhai": 10}  # última parcela em 10/11/26

# Correções sobre o Supabase confirmadas pelo Henrique
# Suhai: a última parcela é em nov/26 (o banco tinha out–dez) -> recua 1 mês
RECUAR_UM_MES = {"Seguro Suhai"}
# Total real de parcelas quando o banco está errado. Kabum: eram só 2 (set–out/26), já quitado;
# o banco tinha 3 -> a 3/3 de nov/26 é descartada e as outras viram 1/2 e 2/2.
TOTAL_PARCELAS = {"Kabum (Mercado Pago)": 2}

MESES_SUPABASE = {"2026-09", "2026-10"}
CSV_POR_MES = {"2026-11": "Fatura2026-11-10.csv", "2026-12": "Fatura2026-12-10.csv"}

# Regras de categoria que vencem o histórico (o histórico tinha erros nesses casos)
REGRAS = [
    (r"KINGSH|CABAL", "LAZER"),            # jogos na Google Play
    (r"GOOGLE GOOGLE", "ASSINATURA"),      # Google One / YouTube Premium
    (r"NETFLIX|SPOTIFY", "ASSINATURA"),
    (r"LOTERIA", "LOTERIA"),
    (r"DROGASIL|DROG ", "FARMÁCIA"),
    (r"STRONGROCK", "COMPRAS ONLINE"),
    (r"ANTECIPA", "OUTROS"),
    (r"ARRETADO|ALEXANDROALVES", "ALIMENTAÇÃO"),  # confirmado pelo Henrique
]


def env():
    out = {}
    for linha in (RAIZ / ".env").read_text().splitlines():
        if "=" in linha and not linha.startswith("#"):
            k, v = linha.split("=", 1)
            out[k.strip()] = v.strip()
    return out


BACKUP = RAIZ / "dashboard" / "backup" / "supabase"


def salvar_backup(tabela, linhas):
    """Cópia de cada tabela em JSON (exata, usada pelo script) e CSV (para abrir em planilha)."""
    BACKUP.mkdir(parents=True, exist_ok=True)
    (BACKUP / f"{tabela}.json").write_text(json.dumps(linhas, ensure_ascii=False, indent=1))
    colunas = list(dict.fromkeys(k for l in linhas for k in l))
    with open(BACKUP / f"{tabela}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=colunas, delimiter=";")
        w.writeheader()
        for l in linhas:
            w.writerow({k: ("" if v is None else str(v).replace("\r", "")) for k, v in l.items()})


def supabase(tabela):
    """Tabela inteira do Supabase. Se o banco não responder (pausado, sem rede, sem chave),
    usa o backup em dashboard/backup/supabase/. Quando responde, atualiza o backup."""
    try:
        e = env()
        req = urllib.request.Request(
            f"{e['SUPABASE_URL']}/rest/v1/{tabela}?select=*",
            headers={"apikey": e["SUPABASE_KEY"], "Authorization": f"Bearer {e['SUPABASE_KEY']}"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            linhas = json.load(r)
        salvar_backup(tabela, linhas)
        return linhas
    except Exception as erro:  # noqa: BLE001 — qualquer falha cai no backup
        arq = BACKUP / f"{tabela}.json"
        print(f"AVISO: Supabase indisponível para '{tabela}' ({erro}); usando o backup {arq.name}")
        return json.loads(arq.read_text())


def copiar_para_backup():
    """Copia para dashboard/backup/ o que fica fora do repositório git:
    este script, o CLAUDE.md da pasta e os CSVs das faturas (XP e Nubank).
    Nunca copia o .env (chave) nem holerites/PDFs."""
    destino = RAIZ / "dashboard" / "backup"
    (destino / "faturas").mkdir(parents=True, exist_ok=True)
    (destino / "scripts").mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path(__file__).resolve(), destino / "scripts" / "gerar_henrique.py")
    shutil.copy2(RAIZ / "CLAUDE.md", destino / "CLAUDE-pasta-financas.md")
    for arq in sorted(RAIZ.glob("*.csv")):
        if arq.name.startswith(("Fatura", "Nubank_")):
            shutil.copy2(arq, destino / "faturas" / arq.name)


def brl(txt):
    return float(txt.replace("R$", "").replace(".", "").replace(",", ".").replace("\xa0", "").strip())


def main():
    antigo = json.loads((RAIZ / "dashboard" / "public" / "data.json").read_text())["transacoes"]

    # mapa loja -> categoria mais usada no histórico
    hist = collections.defaultdict(collections.Counter)
    for t in antigo:
        hist[t["estabelecimento"].upper().strip()][t["categoria"]] += 1

    def categoria(estab, original=None):
        e = estab.upper().strip()
        for padrao, cat in REGRAS:
            if re.search(padrao, e):
                return cat, False
        if e in hist:
            return hist[e].most_common(1)[0][0], False
        if original:
            return original.upper(), False
        return "OUTROS", True  # a confirmar

    tx = []

    def add(data_iso, mes_fatura, estab, valor, parcela, original_cat=None, fonte=""):
        cat, confirmar = categoria(estab, original_cat)
        item = {
            "data": data_iso, "mes_fatura": mes_fatura, "banco": "XP",
            "estabelecimento": estab.strip(), "categoria": cat,
            "parcela": (parcela or "-").strip(), "valor": round(valor, 2), "fonte": fonte,
        }
        if confirmar:
            item["a_confirmar"] = True
        tx.append(item)

    # 1) histórico antigo
    for t in antigo:
        if t["portador"] != PORTADOR or t["banco"] != "XP":
            continue
        if t["mes_fatura"] in MESES_SUPABASE or t["mes_fatura"] in CSV_POR_MES:
            continue
        add(t["data"], t["mes_fatura"], t["estabelecimento"], t["valor"], t["parcela"], t["categoria"], "historico")

    # 2) Supabase set–out/26 (só XP e só o portador padrão — exclui o lançamento de teste "Henrique Alves")
    for t in supabase("transacoes_variaveis"):
        if t["portador"] != PORTADOR or t["banco"] != "XP" or t["mes_fatura"] not in MESES_SUPABASE:
            continue
        add(t["data"], t["mes_fatura"], t["estabelecimento"], t["valor"], t["parcela"], t["categoria"], "supabase")

    # 3) CSVs da XP nov–dez/26
    for mes, arq in CSV_POR_MES.items():
        for r in csv.DictReader(open(RAIZ / arq, encoding="utf-8-sig"), delimiter=";"):
            if not r["Portador"].startswith("HENRIQUE") or "Pagamento de fatura" in r["Estabelecimento"]:
                continue
            d, m, a = r["Data"].split("/")
            add(f"{a}-{m}-{d}", mes, r["Estabelecimento"], brl(r["Valor"]), r["Parcela"], fonte=arq)

    tx.sort(key=lambda t: (t["mes_fatura"], t["data"]))

    # Fixas (sem a Feira, que agora é gasta no cartão)
    fixas = [
        {"nome": f["Despesa"], "valor": float(f["Valor"]), **({"dia": DIAS_FIXAS[f["Despesa"]]} if f["Despesa"] in DIAS_FIXAS else {})}
        for f in supabase("despesas_fixas")
        if f["Responsavel"] == "Henrique" and f["Despesa"] != "Feira"
    ]

    # Parcelas e boletos fora do cartão
    parcelas = []
    for o in supabase("outras_despesas"):
        if o["Responsavel"] != "Henrique":
            continue
        m = re.match(r"(.*?)\s*\((?:Boleto\s*)?(\d+)/(\d+)\)", o["Despesa"])
        nome, n, total = (m.group(1), int(m.group(2)), int(m.group(3))) if m else (o["Despesa"], None, None)
        nome = nome.replace("SUHAI SEGURO", "Seguro Suhai").replace("Financiamento Mercado Pago - Kit i3", "Kabum (Mercado Pago)")
        mes = o["Mes_Fatura"]
        if nome in TOTAL_PARCELAS and n:
            if n > TOTAL_PARCELAS[nome]:
                continue
            total = TOTAL_PARCELAS[nome]
        if nome in RECUAR_UM_MES:
            a, m = map(int, mes.split("-"))
            a, m = (a - 1, 12) if m == 1 else (a, m - 1)
            mes = f"{a}-{m:02d}"
        parcelas.append({
            "nome": nome, "parcela": f"{n}/{total}" if n else "-", "valor": o["Valor"], "mes": mes,
            **({"dia": DIAS_BOLETOS[nome]} if nome in DIAS_BOLETOS else {}),
        })
    parcelas.sort(key=lambda p: (p["mes"], p["nome"]))

    saida = {
        "gerado_em": date.today().isoformat(),
        "portador": PORTADOR,
        **CONFIG,
        "despesas_fixas": fixas,
        "parcelas_boletos": parcelas,
        "transacoes": tx,
    }
    SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=1))
    copiar_para_backup()

    # resumo
    por_mes = collections.defaultdict(float)
    for t in tx:
        por_mes[t["mes_fatura"]] += t["valor"]
    print(f"{len(tx)} transações -> {SAIDA}")
    for m in sorted(por_mes)[-8:]:
        print(f"  fatura {m}: R$ {por_mes[m]:.2f}")
    print("Fixas:", fixas)
    print("A confirmar:", [(t["data"], t["estabelecimento"], t["valor"]) for t in tx if t.get("a_confirmar")])


if __name__ == "__main__":
    main()
