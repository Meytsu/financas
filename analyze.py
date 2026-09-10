import json

with open('public/data.json', 'r') as f:
    data = json.load(f)

txs = [t for t in data['transacoes'] if t['portador'] == 'HENRIQUE ALVES']
future_xp = [t for t in txs if t['banco'] == 'XP' and t['mes_fatura'] > '2026-09']
future_total = sum(t['valor'] for t in future_xp)
print(f"Divida XP Futura real (Out/26 em diante): R$ {future_total:.2f}")

for mes in ['2026-10', '2026-11', '2026-12', '2027-01']:
    tot = sum(t['valor'] for t in future_xp if t['mes_fatura'] == mes)
    print(f"{mes}: R$ {tot:.2f}")

