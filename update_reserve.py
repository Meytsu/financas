import json

with open('public/data.json', 'r') as f:
    data = json.load(f)

for item in data['resumo_financeiro_henrique']['reservas_investimentos']:
    if item['nome'] == '99Pay':
        item['valor'] = 3200.0

with open('public/data.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated 99Pay balance to 3200.")
