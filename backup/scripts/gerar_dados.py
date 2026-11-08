#!/usr/bin/env python3
"""Gera os dados das páginas: dashboard/data/henrique.json e dashboard/data/beatriz.json.

Fontes de cada fatura do cartão (separadas pelo titular — HENRIQUE ALVES / BEATRIZ WERNECK):
  - até 2026-08 e de 2027-01 em diante: dashboard/public/data.json (histórico antigo; XP e Nubank)
  - 2026-09 e 2026-10: Supabase (transacoes_variaveis) — mais completo que o data.json
  - 2026-11 e 2026-12: CSVs da XP (Fatura2026-11-10.csv, Fatura2026-12-10.csv)
Fixas e parcelas/boletos vêm do Supabase (com as correções confirmadas abaixo).
Renda, teto, reserva e contas variáveis ficam em PESSOAS.

Se o Supabase não responder, usa o backup em dashboard/backup/supabase/ (e avisa).

Uso: python3 scripts/gerar_dados.py   (a partir da pasta Finanças)
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
PASTA_SAIDA = RAIZ / "dashboard" / "data"
HOJE = date.today().isoformat()

# ===================== Configuração de cada pessoa =====================
PESSOAS = {
    "henrique": {
        "nome": "Henrique",
        "portador": "HENRIQUE ALVES",
        "responsavel": "Henrique",  # como aparece no Supabase
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
        "teto_cartao": 1200.0,  # XP, inclui as parcelas
        "reserva": {"contas": [{"nome": "Caixinha Nubank", "valor": 5000.0}], "meta_meses": 6, "atualizado": "2026-11-05"},
        "variaveis_fora_cartao": [
            # conta de R$ 153,88; a Beatriz paga R$ 120 e o saldo fica com o Henrique
            {"nome": "Energia", "mes": "2026-11", "dia": 10, "valor": 33.88, "obs": "conta R$ 153,88 − R$ 120,00 da Beatriz"},
        ],
        "dias_fixas": {"Aluguel": 20, "Dados móveis": 20},  # recarga do celular: última em 20/10
        "fixas_valor": {},
    },
    "beatriz": {
        "nome": "Beatriz",
        "portador": "BEATRIZ WERNECK",
        "responsavel": "Beatriz",
        "renda": {
            "liquida_mensal": 1665.75,
            "estimado": False,
            # pago no 5º dia útil do mês (contando seg–sex)
            "entradas": [{"nome": "Salário", "dia_util": 5, "valor": 1665.75}],
            "realizados": [],
        },
        "teto_cartao": 800.0,  # XP (cartão adicional no nome dela)
        "reserva": {"contas": [], "meta_meses": 6, "atualizado": "2026-11-08"},  # ainda sem reserva
        "variaveis_fora_cartao": [],
        "dias_fixas": {"Energia": 10},
        # a Beatriz paga R$ 120 da conta de energia (o resto fica com o Henrique)
        "fixas_valor": {"Energia": 120.0},
    },
}
COMUM = {"limite_comprometimento": 0.30, "fatura_vencimento_dia": 10, "fatura_vencimento_dia_nubank": 22}
PORTADORES = {p["portador"]: chave for chave, p in PESSOAS.items()}

# ===================== Correções confirmadas pelo Henrique =====================
# Dia de vencimento dos boletos/financiamentos fora do cartão
DIAS_BOLETOS = {"Seguro Suhai": 10}  # última parcela em 10/11/26
# Suhai: a última parcela é em nov/26 (o banco tinha out–dez) -> recua 1 mês
RECUAR_UM_MES = {"Seguro Suhai"}
# Kabum: eram só 2 parcelas (set–out/26), já quitado; o banco tinha 3
TOTAL_PARCELAS = {"Kabum (Mercado Pago)": 2}
# Compras divididas 50/50 (data, loja, valor cheio na fatura). O titular fica com a metade
# arredondada para cima e a outra pessoa com o resto. Ex.: a feira grande do mês no Bongi.
DIVIDIR_50_50 = {
    ("2026-10-03", "ATACAREJO BONGI", 275.91),  # fatura nov/26; confirmado em 2026-11-07 (só a de maior valor)
    ("2026-11-04", "ATACAREJO BONGI", 798.99),  # fatura dez/26; divide DEPOIS do ajuste abaixo (R$ 648,99)
}
# Ajustes no valor de um lançamento (data, loja, valor na fatura): (ajuste, motivo). Aplicado antes da divisão 50/50.
AJUSTES = {
    ("2026-11-04", "ATACAREJO BONGI", 798.99): (
        -150.00,
        "estorno de R$ 150: 44 macarrões passados por engano no caixa (antecipação de R$ 150 quando o valor for depositado)",
    ),
}

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
    (r"IFD\*|99FOOD|PASTEL", "ALIMENTAÇÃO"),     # iFood, 99Food, pastelaria
    (r"FARMACIA", "FARMÁCIA"),
    (r"UBER|99 ?RIDE", "TRANSPORTE"),
    (r"GOOGLE ONE", "ASSINATURA"),
    (r"PADARIA NOVA PARI", "MERCADO"),
    (r"BRAZ PETRO", "COMBUSTÍVEL"),
]


def soma_mes(mes, n):
    a, m = map(int, mes.split("-"))
    total = a * 12 + (m - 1) + n
    return f"{total // 12}-{total % 12 + 1:02d}"


# ===================== Supabase + backup =====================
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


_cache = {}


def supabase(tabela):
    """Tabela inteira do Supabase. Se o banco não responder (pausado, sem rede, sem chave),
    usa o backup. Quando responde, atualiza o backup."""
    if tabela in _cache:
        return _cache[tabela]
    try:
        e = env()
        req = urllib.request.Request(
            f"{e['SUPABASE_URL']}/rest/v1/{tabela}?select=*",
            headers={"apikey": e["SUPABASE_KEY"], "Authorization": f"Bearer {e['SUPABASE_KEY']}"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            linhas = json.load(r)
        salvar_backup(tabela, linhas)
    except Exception as erro:  # noqa: BLE001 — qualquer falha cai no backup
        arq = BACKUP / f"{tabela}.json"
        print(f"AVISO: Supabase indisponível para '{tabela}' ({erro}); usando o backup {arq.name}")
        linhas = json.loads(arq.read_text())
    _cache[tabela] = linhas
    return linhas


def copiar_para_backup():
    """Copia para dashboard/backup/ o que fica fora do repositório git: os scripts,
    o CLAUDE.md da pasta e os CSVs das faturas. Nunca copia o .env nem holerites/PDFs."""
    destino = RAIZ / "dashboard" / "backup"
    (destino / "faturas").mkdir(parents=True, exist_ok=True)
    (destino / "scripts").mkdir(parents=True, exist_ok=True)
    for script in (RAIZ / "scripts").glob("gerar_*.py"):
        shutil.copy2(script, destino / "scripts" / script.name)
    shutil.copy2(RAIZ / "CLAUDE.md", destino / "CLAUDE-pasta-financas.md")
    for arq in sorted(RAIZ.glob("*.csv")):
        if arq.name.startswith(("Fatura", "Nubank_")):
            shutil.copy2(arq, destino / "faturas" / arq.name)


def brl(txt):
    return float(txt.replace("R$", "").replace(".", "").replace(",", ".").replace("\xa0", "").strip())


# ===================== Montagem =====================
def main():
    antigo = json.loads((RAIZ / "dashboard" / "public" / "data.json").read_text())["transacoes"]

    hist = collections.defaultdict(collections.Counter)  # loja -> categoria mais usada no histórico
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

    tx = {chave: [] for chave in PESSOAS}
    projecoes = []

    def add(portador, data_iso, mes_fatura, estab, valor, parcela, original_cat=None, fonte="", banco="XP"):
        dono = PORTADORES.get(portador)  # portador exato: exclui o teste "Henrique Alves" do Supabase
        if not dono:
            return
        cat, confirmar = categoria(estab, original_cat)
        item = {
            "data": data_iso, "mes_fatura": mes_fatura, "banco": banco,
            "estabelecimento": estab.strip(), "categoria": cat,
            "parcela": (parcela or "-").strip(), "valor": round(valor, 2), "fonte": fonte,
        }
        if confirmar:
            item["a_confirmar"] = True
        chave = (data_iso, estab.strip().upper(), round(valor, 2))
        if chave in AJUSTES:
            ajuste, motivo = AJUSTES[chave]
            item.update({"valor_fatura": round(valor, 2), "ajuste": ajuste, "obs": motivo})
            valor = round(valor + ajuste, 2)
            item["valor"] = valor
        if chave in DIVIDIR_50_50:
            metade = round(valor / 2 + 0.001, 2)
            item.update({"valor_bruto": round(valor, 2), "valor": metade, "split": "50/50"})
            outro = next(k for k in PESSOAS if k != dono)
            tx[outro].append({**item, "valor": round(valor - metade, 2), "fonte": f"{fonte} (metade de {PESSOAS[dono]['nome']})"})
        tx[dono].append(item)

    # 1) histórico antigo: XP (meses sem outra fonte) + Nubank
    for t in antigo:
        if t["banco"] not in ("XP", "NUBANK"):
            continue
        if t["banco"] == "XP" and (t["mes_fatura"] in MESES_SUPABASE or t["mes_fatura"] in CSV_POR_MES):
            continue
        add(t["portador"], t["data"], t["mes_fatura"], t["estabelecimento"], t["valor"], t["parcela"], t["categoria"], "historico", t["banco"])

    # 2) Supabase set–out/26 (XP)
    for t in supabase("transacoes_variaveis"):
        if t["banco"] != "XP" or t["mes_fatura"] not in MESES_SUPABASE:
            continue
        add(t["portador"], t["data"], t["mes_fatura"], t["estabelecimento"], t["valor"], t["parcela"], t["categoria"], "supabase")

    # 3) CSVs da XP nov–dez/26
    for mes, arq in CSV_POR_MES.items():
        for r in csv.DictReader(open(RAIZ / arq, encoding="utf-8-sig"), delimiter=";"):
            if "Pagamento de fatura" in r["Estabelecimento"]:
                continue
            d, m, a = r["Data"].split("/")
            add(r["Portador"].strip().upper(), f"{a}-{m}-{d}", mes, r["Estabelecimento"], brl(r["Valor"]), r["Parcela"], fonte=arq)
            # parcelas seguintes ainda sem fatura: projeta "k de m" nos meses à frente
            pm = re.match(r"^(\d+)\s*de\s*(\d+)$", (r["Parcela"] or "").strip())
            if pm and int(pm.group(1)) < int(pm.group(2)):
                n, total = int(pm.group(1)), int(pm.group(2))
                for k in range(n + 1, total + 1):
                    projecoes.append((r["Portador"].strip().upper(), f"{a}-{m}-{d}", soma_mes(mes, k - n), r["Estabelecimento"], brl(r["Valor"]), f"{k} de {total}"))

    # 4) parcelas projetadas: só meses sem fatura própria e sem o mesmo lançamento já vindo de outra fonte
    def chave_tx(t):
        return (t["data"], t["estabelecimento"].upper().strip(), round(t["valor"], 2), t["parcela"].replace(" ", ""))

    existentes = {chave_tx(t) for lista in tx.values() for t in lista}
    for portador, data_iso, mes_f, estab, valor, parcela in projecoes:
        if mes_f in CSV_POR_MES or mes_f in MESES_SUPABASE:
            continue
        k = (data_iso, estab.upper().strip(), round(valor, 2), parcela.replace(" ", ""))
        if k in existentes:
            continue
        existentes.add(k)
        add(portador, data_iso, mes_f, estab, valor, parcela, fonte="projeção (parcela futura)")

    for chave, p in PESSOAS.items():
        lista = sorted(tx[chave], key=lambda t: (t["mes_fatura"], t["data"]))

        # Fixas (sem a Feira, que agora é gasta no cartão)
        fixas = []
        for f in supabase("despesas_fixas"):
            if f["Responsavel"] != p["responsavel"] or f["Despesa"] == "Feira":
                continue
            nome = f["Despesa"]
            item = {"nome": nome, "valor": float(p["fixas_valor"].get(nome, f["Valor"]))}
            if nome in p["dias_fixas"]:
                item["dia"] = p["dias_fixas"][nome]
            fixas.append(item)

        # Parcelas e boletos fora do cartão
        parcelas = []
        for o in supabase("outras_despesas"):
            if o["Responsavel"] != p["responsavel"]:
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
                a, mm = map(int, mes.split("-"))
                a, mm = (a - 1, 12) if mm == 1 else (a, mm - 1)
                mes = f"{a}-{mm:02d}"
            parcelas.append({
                "nome": nome, "parcela": f"{n}/{total}" if n else "-", "valor": o["Valor"], "mes": mes,
                **({"dia": DIAS_BOLETOS[nome]} if nome in DIAS_BOLETOS else {}),
            })
        parcelas.sort(key=lambda x: (x["mes"], x["nome"]))

        saida = {
            "gerado_em": HOJE,
            "pessoa": chave,
            "nome": p["nome"],
            "portador": p["portador"],
            "renda": p["renda"],
            "teto_cartao": p["teto_cartao"],
            **COMUM,
            "reserva": p["reserva"],
            "variaveis_fora_cartao": p["variaveis_fora_cartao"],
            "despesas_fixas": fixas,
            "parcelas_boletos": parcelas,
            "transacoes": lista,
        }
        arq = PASTA_SAIDA / f"{chave}.json"
        arq.write_text(json.dumps(saida, ensure_ascii=False, indent=1))

        por_mes = collections.defaultdict(float)
        for t in lista:
            por_mes[t["mes_fatura"]] += t["valor"]
        print(f"[{p['nome']}] {len(lista)} transações -> {arq.relative_to(RAIZ)}")
        for mm in sorted(por_mes)[-5:]:
            print(f"    fatura {mm}: R$ {por_mes[mm]:.2f}")
        print("    fixas:", [(f["nome"], f["valor"]) for f in fixas])
        confirmar = [(t["data"], t["estabelecimento"], t["valor"]) for t in lista if t.get("a_confirmar")]
        if confirmar:
            print("    a confirmar:", confirmar)

    copiar_para_backup()


if __name__ == "__main__":
    main()
