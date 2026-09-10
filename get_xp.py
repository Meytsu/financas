import json

with open('public/data.json', 'r') as f:
    data = json.load(f)

xp_set = sum(t['valor'] for t in data['transacoes'] if t['portador'] == 'HENRIQUE ALVES' and t['banco'] == 'XP' and t['mes_fatura'] == '2026-09')
print(f"XP September (Henrique): R$ {xp_set:.2f}")
