# Automação: compras do cartão direto do celular para o painel

> **Status (2026-11-08): planejado, ainda não implementado.** Este documento registra a ideia, o desenho e o que falta para montar.

## Objetivo

Toda compra com o cartão XP pelo **Google Carteira** gera uma notificação no celular. A ideia é capturar essa notificação, gravar a compra no **Supabase** e o site **https://meytsu.github.io/financas/** se atualizar sozinho, sem esperar a fatura em CSV.

## Como vai funcionar

```
compra no cartão XP (Google Carteira)
        │  notificação "Você pagou R$ 35,99 em GOOGLE ONE"
        ▼
MacroDroid no celular (Henrique e, se quiser, Beatriz)
        │  extrai valor + loja + data/hora; envia por HTTP (POST)
        ▼
Supabase — tabela nova `lancamentos_celular` (só aceita INSERIR)
        │  a cada compra nova (ou de hora em hora)
        ▼
GitHub Actions roda o script de dados e republica o site
        ▼
meytsu.github.io/financas atualizado (~2 a 5 min depois da compra)
```

### 1. Captura no celular — MacroDroid (Android, versão gratuita)

- **Gatilho:** notificação recebida do app **Google Carteira**.
- **Ação:** extrair do texto o **valor** e o **estabelecimento** (expressão regular — o formato exato será acertado com um print de uma notificação real).
- **Ação:** **requisição HTTP POST** para a API do Supabase (`/rest/v1/lancamentos_celular`) com a **chave pública** (publishable), enviando `portador`, `estabelecimento`, `valor` e o texto original da notificação.
- A Beatriz precisa do mesmo app no celular dela para as compras dela entrarem (com `portador = BEATRIZ WERNECK`).

### 2. Banco — tabela `lancamentos_celular` com proteção ligada

O RLS (Row Level Security) das tabelas antigas está desligado (decisão do Henrique de tratar depois). **Esta tabela nova nasce protegida:** o celular só consegue **inserir**; ninguém com a chave pública consegue ler, alterar ou apagar.

```sql
create table public.lancamentos_celular (
  id uuid primary key default gen_random_uuid(),
  recebido_em timestamptz not null default now(),
  portador text not null check (portador in ('HENRIQUE ALVES', 'BEATRIZ WERNECK')),
  estabelecimento text not null,
  valor numeric(10, 2) not null,
  texto_original text,
  origem text not null default 'google-carteira'
);

alter table public.lancamentos_celular enable row level security;

-- o celular (chave pública) só pode inserir
create policy "celular pode inserir"
  on public.lancamentos_celular for insert to anon
  with check (true);

-- sem regra de select/update/delete para a chave pública:
-- quem lê é só o GitHub Actions, com a chave secreta (service_role) guardada nos Secrets do repositório
```

### 3. Site atualizado sozinho — GitHub Actions

Hoje o site só muda quando o script roda e há um `git push`. A automação escolhida é a **reconstrução automática** (opção A):

- Um workflow novo (ex.: `.github/workflows/atualizar-dados.yml`) roda **de hora em hora** e também pode ser **disparado pelo Supabase a cada compra nova** (webhook do banco → `repository_dispatch` do GitHub).
- Ele roda o script de dados (lendo `lancamentos_celular` com a chave secreta), regera `data/henrique.json` e `data/beatriz.json` e republica o site.
- Para isso o script precisa morar **dentro do repositório** (hoje fica em `~/Documentos/Finanças/scripts/`; há cópia em `backup/scripts/`) junto com os CSVs das faturas (já copiados em `backup/faturas/`).

Opção descartada (B): o site ler o Supabase direto no navegador — deixaria a chave do banco dentro do site público.

### 4. Provisório × oficial

- A compra que chega pelo celular entra no painel como **provisória**: sem categoria certa (o script tenta pelo histórico da loja), sem saber se foi parcelada e sem estornos.
- Quando a **fatura oficial (CSV da XP)** daquele mês chega, ela continua sendo a fonte oficial: o script **troca o provisório pelo oficial**, casando por **data + valor + portador**, sem duplicar.

## O que falta para implementar

1. **Print de uma notificação real** do Google Carteira (para acertar o formato do texto).
2. **Escrita no Supabase:** criar a tabela acima — ou o Henrique roda o SQL no painel (SQL Editor), ou o Claude ganha acesso de escrita (reconfigurar o MCP do Supabase sem `read_only` e fazer login de novo).
3. **Segredos no GitHub:** guardar a chave secreta do Supabase em *Settings → Secrets and variables → Actions* do repositório (o Claude pode fazer pelo `gh` se o Henrique fizer `gh auth login`).
4. **MacroDroid** instalado no celular; o Claude passa a configuração passo a passo (gatilho, extração, envio).
5. Levar o script e os CSVs para dentro do repositório e criar o workflow de atualização.

## Riscos e cuidados

- Notificação muda de texto se o Google atualizar o app → a extração pode falhar; o texto original fica gravado para conferência.
- Compra cancelada ou estornada não gera "desfazer" pela notificação — a fatura oficial corrige.
- O repositório e o site são **públicos** (decisão do Henrique): as compras capturadas aparecem no site como as demais. A chave secreta do Supabase **nunca** vai para o código nem para o celular.
