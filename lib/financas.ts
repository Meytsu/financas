/* Cálculos do painel do Henrique. Tudo deriva de data/henrique.json
   (gerado por ../scripts/gerar_henrique.py). */

export interface Transacao {
  data: string;
  mes_fatura: string;
  banco: string;
  estabelecimento: string;
  categoria: string;
  parcela: string;
  valor: number;
  a_confirmar?: boolean;
  /** compra dividida com a Beatriz: `valor` é a parte do Henrique, `valor_bruto` o total da fatura */
  split?: string;
  valor_bruto?: number;
}

export interface Dados {
  gerado_em: string;
  pessoa: string;
  nome: string;
  renda: {
    liquida_mensal: number;
    estimado: boolean;
    /** `dia`: dia do mês (antecipa para sexta se cair no fim de semana); `dia_util`: n-ésimo dia útil do mês */
    entradas: { nome: string; dia?: number; dia_util?: number; valor: number }[];
    realizados?: { mes: string; nome: string; valor: number; obs?: string }[];
  };
  teto_cartao: number;
  limite_comprometimento: number;
  fatura_vencimento_dia: number;
  fatura_vencimento_dia_nubank?: number;
  reserva: { contas: { nome: string; valor: number }[]; meta_meses: number; atualizado: string };
  variaveis_fora_cartao: { nome: string; mes: string; valor: number | null; obs?: string; dia?: number }[];
  despesas_fixas: { nome: string; valor: number; dia?: number }[];
  parcelas_boletos: { nome: string; parcela: string; valor: number; mes: string; dia?: number }[];
  transacoes: Transacao[];
}

/* ===== Formatação ===== */
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brlInteiro = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Número cheio, sem centavos e sem "mil" (ex.: 4.252, −830) — para eixos e rótulos curtos. */
export const brlCompacto = (v: number) => `${v < 0 ? "−" : ""}${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`;
export const pct = (v: number, casas = 0) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;
export const rotuloMes = (m: string) => `${MESES[parseInt(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
export const mesCurto = (m: string) => MESES[parseInt(m.slice(5)) - 1];
export const mesLongo = (m: string) => `${MESES_LONGOS[parseInt(m.slice(5)) - 1]} de ${m.slice(0, 4)}`;
export const mesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const somaMes = (m: string, n: number) => {
  const [a, mm] = m.split("-").map(Number);
  return mesDe(new Date(a, mm - 1 + n, 1));
};
export const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
/** "2026-11-05" -> "05 de Novembro de 2026" */
export const dataLonga = (iso: string) => {
  const m = MESES_LONGOS[parseInt(iso.slice(5, 7)) - 1];
  return `${iso.slice(8, 10)} de ${m.charAt(0).toUpperCase() + m.slice(1)} de ${iso.slice(0, 4)}`;
};
export const isoParaBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
export const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Dia de pagamento: se cair no sábado ou domingo, antecipa para a sexta. */
export function diaUtilAntes(mes: string, dia: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1, dia);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

/** n-ésimo dia útil do mês (seg–sex; não considera feriados). */
export function nDiaUtil(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1, 1);
  let conta = 0;
  while (true) {
    if (d.getDay() !== 0 && d.getDay() !== 6) conta++;
    if (conta === n) return d;
    d.setDate(d.getDate() + 1);
  }
}

/** Data em que uma entrada cai no mês. */
export const dataEntrada = (mes: string, e: { dia?: number; dia_util?: number }) => (e.dia_util ? nDiaUtil(mes, e.dia_util) : diaUtilAntes(mes, e.dia ?? 1));

/** "3 de 5" com total > 1 = compra parcelada. */
export function ehParcelado(t: Transacao) {
  const m = t.parcela.match(/^(\d+)\s*de\s*(\d+)$/);
  return !!m && Number(m[2]) > 1;
}

export const ehBMW = (nome: string) => /bmw/i.test(nome);

/** Entradas do mês: o valor que caiu na conta, quando lançado; senão a estimativa. */
export function entradasDoMes(d: Dados, mes: string) {
  return d.renda.entradas.map((e) => {
    const real = d.renda.realizados?.find((r) => r.mes === mes && r.nome === e.nome);
    return { nome: e.nome, dia: e.dia, dia_util: e.dia_util, valor: real ? real.valor : e.valor, real: !!real, obs: real?.obs };
  });
}

/* ===== Resumo de um mês ===== */
export function resumoMes(d: Dados, mes: string) {
  const entradas = entradasDoMes(d, mes);
  const receitas = soma(entradas.map((e) => e.valor));
  const fixas = soma(d.despesas_fixas.map((f) => f.valor));
  const boletos = d.parcelas_boletos.filter((p) => p.mes === mes);
  const totalBoletos = soma(boletos.map((p) => p.valor));
  const bmw = soma(boletos.filter((p) => ehBMW(p.nome)).map((p) => p.valor));
  const cartao = d.transacoes.filter((t) => t.mes_fatura === mes);
  const totalCartao = soma(cartao.map((t) => t.valor));
  const cartaoParcelado = soma(cartao.filter(ehParcelado).map((t) => t.valor));
  const cartaoXP = soma(cartao.filter((t) => t.banco === "XP").map((t) => t.valor));
  const cartaoNubank = soma(cartao.filter((t) => t.banco === "NUBANK").map((t) => t.valor));
  const foraCartao = d.variaveis_fora_cartao.filter((v) => v.mes === mes);
  const totalForaCartao = soma(foraCartao.map((v) => v.valor ?? 0));
  const pendentes = foraCartao.filter((v) => v.valor === null).map((v) => v.nome);
  const saidas = fixas + totalBoletos + totalCartao + totalForaCartao;
  const sobra = receitas - saidas;

  const porCat: Record<string, number> = {};
  for (const t of cartao) porCat[t.categoria] = (porCat[t.categoria] || 0) + t.valor;
  const categorias = Object.entries(porCat)
    .map(([nome, valor]) => ({ nome, valor }))
    .filter((c) => c.valor > 0.005)
    .sort((a, b) => b.valor - a.valor);

  return {
    mes,
    entradas,
    receitas,
    fixas,
    boletos,
    totalBoletos,
    bmw,
    cartao,
    totalCartao,
    cartaoXP,
    cartaoNubank,
    cartaoParcelado,
    cartaoAVista: totalCartao - cartaoParcelado,
    foraCartao,
    totalForaCartao,
    pendentes,
    saidas,
    sobra,
    taxaPoupanca: receitas > 0 ? sobra / receitas : 0,
    comprometido: cartaoParcelado + totalBoletos,
    comprometimento: receitas > 0 ? (cartaoParcelado + totalBoletos) / receitas : 0,
    usoTeto: d.teto_cartao > 0 ? cartaoXP / d.teto_cartao : 0, // o teto vale só para a XP
    categorias,
  };
}
export type Resumo = ReturnType<typeof resumoMes>;

/** Meses (inclusive) de `ate` para trás, até `n`, sem passar do primeiro mês com dados. */
export function mesesAte(ate: string, n: number, primeiro: string) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = somaMes(ate, -i);
    if (m >= primeiro) out.push(m);
  }
  return out;
}

export function limitesDosDados(d: Dados) {
  const todos = [...d.transacoes.map((t) => t.mes_fatura), ...d.parcelas_boletos.map((p) => p.mes)].sort();
  return { primeiro: todos[0], ultimo: todos[todos.length - 1] };
}

/** Compromissos já assumidos para os próximos meses. */
export function compromissosFuturos(d: Dados, desde: string, n: number) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const mes = somaMes(desde, i);
    const r = resumoMes(d, mes);
    out.push({
      mes,
      parcelasCartao: r.cartaoParcelado,
      boletos: r.totalBoletos - r.bmw,
      bmw: r.bmw,
      total: r.comprometido,
    });
  }
  return out;
}

/** Status de um indicador: sempre com rótulo, nunca só cor. */
export type Status = "bom" | "atencao" | "serio" | "critico";
export const ROTULO_STATUS: Record<Status, string> = { bom: "Saudável", atencao: "Atenção", serio: "Alto", critico: "Crítico" };
export const ICONE_STATUS: Record<Status, string> = { bom: "✓", atencao: "!", serio: "!", critico: "✕" };

export const statusPoupanca = (t: number): Status => (t >= 0.2 ? "bom" : t >= 0.1 ? "atencao" : t >= 0 ? "serio" : "critico");
export const statusComprometimento = (c: number, limite: number): Status => (c <= limite * 0.8 ? "bom" : c <= limite ? "atencao" : c <= limite * 1.5 ? "serio" : "critico");
export const statusTeto = (u: number): Status => (u <= 0.85 ? "bom" : u <= 1 ? "atencao" : u <= 1.3 ? "serio" : "critico");
export const statusReserva = (meses: number, meta: number): Status => (meses >= meta ? "bom" : meses >= meta / 2 ? "atencao" : meses >= 1 ? "serio" : "critico");
