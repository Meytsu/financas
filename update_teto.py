import json

with open('public/data.json', 'r') as f:
    data = json.load(f)

data['teto_total_henrique'] = 1200.0
data['resumo_financeiro_henrique']['caixinha_bmw'] = 0.0

with open('public/data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated teto to 1200 and added caixinha_bmw")
