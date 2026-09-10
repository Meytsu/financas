"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Transacao {
  data: string;
  mes: string;
  mes_fatura: string;
  banco: string;
  estabelecimento: string;
  portador: string;
  valor: number;
  categoria: string;
  parcela: string;
  split?: string;
  abatido?: boolean;
  valor_bruto?: number;
}

interface DashboardData {
  total_registros: number;
  transacoes: Transacao[];
  tetos_henrique: Record<string, number>;
  teto_total_henrique: number;
  limites: Record<string, number>;
  resumo_financeiro_henrique?: {
    renda_liquida_estimada: number;
    despesas_fixas: { nome: string; valor: number }[];
    reservas_investimentos: { nome: string; valor: number }[];
  };
  resumo_financeiro_beatriz?: {
    despesas_fixas: { nome: string; valor: number }[];
    reservas_investimentos?: { nome: string; valor: number }[];
  };
}

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#db2777", "#0d9488", "#ea580c", "#4f46e5", "#65a30d",
  "#0891b2", "#be123c", "#9333ea", "#059669", "#ca8a04",
  "#0284c7", "#c026d3", "#475569", "#e11d48",
];

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatMonth = (m: string) => {
  const [y, mo] = m.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(mo) - 1]}/${y.slice(2)}`;
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #B3B3B3",
  borderRadius: "5px",
  boxShadow: "0 0 8px 1px rgba(37, 36, 35, 0.25)",
  animation: "fadeIn 0.5s ease-out forwards",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300" style={cardStyle}>
      <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wide text-center">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ label, value, color = "text-slate-800" }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300" style={cardStyle}>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [filtroPortador, setFiltroPortador] = useState("TODOS");
  const [filtroMes, setFiltroMes] = useState("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODOS");
  const [filtroBanco, setFiltroBanco] = useState("TODOS");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalTransacoesOpen, setModalTransacoesOpen] = useState(false);
  const [anoCalendario, setAnoCalendario] = useState(2026);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data.json`)
      .then((r) => r.json())
      .then(setData);
  }, []);

  // Abre já marcado na fatura atual (automático): XP fecha dia 02, então após o dia 02
  // o mês corrente cai na fatura do mês seguinte. Clampa ao que existe nos dados.
  useEffect(() => {
    if (!data) return;
    const meses = [...new Set(data.transacoes.map((t) => t.mes_fatura))].sort();
    if (!meses.length) return;
    const hoje = new Date();
    const m = hoje.getMonth() + (hoje.getDate() > 2 ? 1 : 0);
    const cur = `${hoje.getFullYear() + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
    const alvo = meses.includes(cur) ? cur : meses[meses.length - 1];
    setFiltroMes(alvo);
    setAnoCalendario(parseInt(alvo.split("-")[0]));
  }, [data]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalTransacoesOpen(false);
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);

    if (modalTransacoesOpen || sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [modalTransacoesOpen, sidebarOpen]);

  // Todos os cálculos derivados dos filtros
  const computed = useMemo(() => {
    if (!data) return null;

    const todas = data.transacoes;

    // Meses e categorias disponíveis (por mês de fatura)
    const mesesDisponiveis = [...new Set(todas.map((t) => t.mes_fatura))].sort();
    const categoriasDisponiveis = [...new Set(todas.map((t) => t.categoria))].sort();

    // Aplicar filtros (usando mes_fatura)
    const filtradas = todas.filter((t) => {
      if (filtroPortador !== "TODOS" && t.portador !== filtroPortador) return false;
      if (filtroMes !== "TODOS" && t.mes_fatura !== filtroMes) return false;
      if (filtroCategoria !== "TODOS" && t.categoria !== filtroCategoria) return false;
      if (filtroBanco !== "TODOS" && t.banco !== filtroBanco) return false;
      return true;
    });

    // Transações com filtros de portador e banco (para gráficos mensais)
    const filtradasPortador = todas.filter((t) => {
      if (filtroPortador !== "TODOS" && t.portador !== filtroPortador) return false;
      if (filtroBanco !== "TODOS" && t.banco !== filtroBanco) return false;
      return true;
    });

    const ultimos12 = mesesDisponiveis.slice(-12);

    // Função para calcular despesas fixas ajustadas (deduzindo Feira consumida no cartão)
    const getFixasAjustadas = (mes_fatura: string, portador: string) => {
      const originais = portador === "HENRIQUE ALVES" 
        ? data.resumo_financeiro_henrique?.despesas_fixas || []
        : data.resumo_financeiro_beatriz?.despesas_fixas || [];
      
      const ccMercado = todas.filter(t => t.mes_fatura === mes_fatura && t.portador === portador && t.categoria === "MERCADO").reduce((a, t) => a + t.valor, 0);
      let saldoMercadoCC = ccMercado;
      
      return originais.map((df: any) => {
        if (df.nome === "Feira" && saldoMercadoCC > 0) {
           const descontado = Math.min(df.valor, saldoMercadoCC);
           saldoMercadoCC -= descontado;
           return { ...df, valor: df.valor - descontado, original: df.valor, descontado };
        }
        return { ...df, original: df.valor, descontado: 0 };
      });
    };

    // O mês atual selecionado (ou o último)
    const mesAtual = filtroMes !== "TODOS" ? filtroMes : ultimos12[ultimos12.length - 1];

    // Despesas fixas ajustadas do mês ATUAL (para cards e modais)
    const fixasH_mesAtual = getFixasAjustadas(mesAtual, "HENRIQUE ALVES");
    const fixasB_mesAtual = getFixasAjustadas(mesAtual, "BEATRIZ WERNECK");
    const rawDespesasFixasH = fixasH_mesAtual.reduce((a, item) => a + item.valor, 0);
    const rawDespesasFixasB = fixasB_mesAtual.reduce((a, item) => a + item.valor, 0);

    const baseDespesasFixasH = (filtroPortador === "TODOS" || filtroPortador === "HENRIQUE ALVES") ? rawDespesasFixasH : 0;
    const baseDespesasFixasB = (filtroPortador === "TODOS" || filtroPortador === "BEATRIZ WERNECK") ? rawDespesasFixasB : 0;
    
    // As despesas fixas não devem aparecer se filtrarmos por categoria ou banco específico (pois elas não tem banco/categoria)
    const applyDespesas = filtroCategoria === "TODOS" && filtroBanco === "TODOS";
    const despesasFixasH = applyDespesas ? baseDespesasFixasH : 0;
    const despesasFixasB = applyDespesas ? baseDespesasFixasB : 0;
    const despesasFixasTotal = despesasFixasH + despesasFixasB;
    
    // Para manter a variável exportada p/ o card "Despesas Fixas" intocada pelos filtros de categoria/banco:
    const cardDespesasFixasH = baseDespesasFixasH;
    const cardDespesasFixasB = baseDespesasFixasB;
    const cardDespesasFixasTotal = baseDespesasFixasH + baseDespesasFixasB;

    // Listas detalhadas para o modal (já ajustadas)
    const listaDespesasFixasH = (filtroPortador === "TODOS" || filtroPortador === "HENRIQUE ALVES") 
      ? fixasH_mesAtual.map(i => ({ ...i, portador: "HENRIQUE ALVES" })) 
      : [];
    const listaDespesasFixasB = (filtroPortador === "TODOS" || filtroPortador === "BEATRIZ WERNECK") 
      ? fixasB_mesAtual.map(i => ({ ...i, portador: "BEATRIZ WERNECK" })) 
      : [];
    const listaDespesasFixas = applyDespesas ? [...listaDespesasFixasH, ...listaDespesasFixasB] : [];

    // Dados mensais por fatura (respeitam filtro de portador e deduzem fixas dinamicamente mês a mês)
    const dadosMensais = ultimos12.map((mes) => {
      const doMes = filtradasPortador.filter((t) => t.mes_fatura === mes);
      
      const fixasH_mes = applyDespesas && (filtroPortador === "TODOS" || filtroPortador === "HENRIQUE ALVES")
        ? getFixasAjustadas(mes, "HENRIQUE ALVES").reduce((a, item) => a + item.valor, 0) : 0;
      const fixasB_mes = applyDespesas && (filtroPortador === "TODOS" || filtroPortador === "BEATRIZ WERNECK")
        ? getFixasAjustadas(mes, "BEATRIZ WERNECK").reduce((a, item) => a + item.valor, 0) : 0;

      const henrique = doMes.filter((t) => t.portador === "HENRIQUE ALVES").reduce((a, t) => a + t.valor, 0) + fixasH_mes;
      const beatriz = doMes.filter((t) => t.portador === "BEATRIZ WERNECK").reduce((a, t) => a + t.valor, 0) + fixasB_mes;
      return {
        mes: formatMonth(mes),
        mesKey: mes,
        Henrique: Math.round(henrique * 100) / 100,
        Beatriz: Math.round(beatriz * 100) / 100,
        Total: Math.round((henrique + beatriz) * 100) / 100,
      };
    });

    // Evolução (respeitam filtro de portador, por fatura)
    const evolucaoData = ultimos12.map((mes) => {
      const doMes = filtradasPortador.filter((t) => t.mes_fatura === mes);
      const fixasH_mes = applyDespesas && (filtroPortador === "TODOS" || filtroPortador === "HENRIQUE ALVES")
        ? getFixasAjustadas(mes, "HENRIQUE ALVES").reduce((a, item) => a + item.valor, 0) : 0;
      const fixasB_mes = applyDespesas && (filtroPortador === "TODOS" || filtroPortador === "BEATRIZ WERNECK")
        ? getFixasAjustadas(mes, "BEATRIZ WERNECK").reduce((a, item) => a + item.valor, 0) : 0;
      
      return {
        mes: formatMonth(mes),
        Henrique: Math.round((doMes.filter((t) => t.portador === "HENRIQUE ALVES").reduce((a, t) => a + t.valor, 0) + fixasH_mes) * 100) / 100,
        Beatriz: Math.round((doMes.filter((t) => t.portador === "BEATRIZ WERNECK").reduce((a, t) => a + t.valor, 0) + fixasB_mes) * 100) / 100,
      };
    });

    // Banco mensal (respeitam filtro de portador, por fatura)
    const dadosBanco = ultimos12.map((mes) => {
      const doMes = filtradasPortador.filter((t) => t.mes_fatura === mes);
      const xp = Math.round(doMes.filter((t) => t.banco === "XP").reduce((a, t) => a + t.valor, 0) * 100) / 100;
      const nu = Math.round(doMes.filter((t) => t.banco === "NUBANK").reduce((a, t) => a + t.valor, 0) * 100) / 100;
      return { mes: formatMonth(mes), XP: xp, Nubank: nu, TotalBanco: Math.round((xp + nu) * 100) / 100 };
    });

    // Categorias (respeitam TODOS os filtros)
    const catMap: Record<string, number> = {};
    for (const t of filtradas) {
      catMap[t.categoria] = (catMap[t.categoria] || 0) + t.valor;
    }
    const categorias = Object.entries(catMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    // Stats (respeitam TODOS os filtros)
    const totalFiltrado = filtradas.reduce((a, t) => a + t.valor, 0) + despesasFixasTotal;
    
    // Usa o mês do filtro ou o último mês disponível (já definido acima)
    
    // Localiza os dados do mês atual no array de dadosMensais (que já tem despesas fixas embutidas)
    const mesAtualIdx = dadosMensais.findIndex(d => d.mesKey === mesAtual);
    const mesAtualData = mesAtualIdx >= 0 ? dadosMensais[mesAtualIdx] : { Total: 0, Henrique: 0, Beatriz: 0 };
    const mesAnteriorData = mesAtualIdx > 0 ? dadosMensais[mesAtualIdx - 1] : { Total: 0, Henrique: 0, Beatriz: 0 };

    // Gasto mês atual (total + por pessoa)
    const gastoMesAtual = mesAtualData?.Total || 0;
    const gastoMesAtualH = mesAtualData?.Henrique || 0;
    const gastoMesAtualB = mesAtualData?.Beatriz || 0;

    // Gasto mês anterior (total + por pessoa)
    const gastoMesAnterior = mesAnteriorData?.Total || 0;
    const gastoMesAnteriorH = mesAnteriorData?.Henrique || 0;
    const gastoMesAnteriorB = mesAnteriorData?.Beatriz || 0;

    // Variação mensal (total + por pessoa)
    const variacao = gastoMesAnterior > 0 ? ((gastoMesAtual - gastoMesAnterior) / gastoMesAnterior) * 100 : 0;
    const variacaoH = gastoMesAnteriorH > 0 ? ((gastoMesAtualH - gastoMesAnteriorH) / gastoMesAnteriorH) * 100 : 0;
    const variacaoB = gastoMesAnteriorB > 0 ? ((gastoMesAtualB - gastoMesAnteriorB) / gastoMesAnteriorB) * 100 : 0;

    // Média mensal (total + por pessoa)
    const ultimos6 = dadosMensais.slice(-6);
    const mediaMensal = ultimos6.length > 0 ? ultimos6.reduce((a, b) => a + b.Total, 0) / ultimos6.length : 0;
    const mediaMensalH = ultimos6.length > 0 ? ultimos6.reduce((a, b) => a + b.Henrique, 0) / ultimos6.length : 0;
    const mediaMensalB = ultimos6.length > 0 ? ultimos6.reduce((a, b) => a + b.Beatriz, 0) / ultimos6.length : 0;

    // Contagem de transações por pessoa
    const txTotal = filtradas.length;
    const txH = filtradas.filter((t) => t.portador === "HENRIQUE ALVES").length;
    const txB = filtradas.filter((t) => t.portador === "BEATRIZ WERNECK").length;

    // Últimas transações (respeitam TODOS os filtros)
    const ultimasTx = [...filtradas].sort((a, b) => b.data.localeCompare(a.data));

    // Tetos: respeitam filtro de portador
    // Se filtro = Beatriz, esconde tetos (ela não tem teto definido ainda)
    const mostrarTetos = filtroPortador !== "BEATRIZ WERNECK";
    const mesTeto = filtroMes !== "TODOS" ? filtroMes : mesAtual;
    const tetosGasto: Record<string, number> = {};
    let hTetoFilter = todas.filter((t) => t.portador === "HENRIQUE ALVES" && t.mes_fatura === mesTeto);
    if (filtroBanco !== "TODOS") {
      hTetoFilter = hTetoFilter.filter((t) => t.banco === filtroBanco);
    }
    if (filtroCategoria !== "TODOS") {
      hTetoFilter = hTetoFilter.filter((t) => t.categoria === filtroCategoria);
    }
    for (const t of hTetoFilter) {
      tetosGasto[t.categoria] = (tetosGasto[t.categoria] || 0) + t.valor;
    }
    const tetoTotalGasto = hTetoFilter.reduce((a, t) => a + t.valor, 0);
    const mesTetoLabel = formatMonth(mesTeto);

    // Limite dos cartões (Mês atual + todas as parcelas/dívidas futuras)
    const mesLimite = filtroMes !== "TODOS" ? filtroMes : mesAtual;
    const gastoXPMes = todas.filter((t) => t.mes_fatura >= mesLimite && t.banco === "XP").reduce((a, t) => a + t.valor, 0);
    const gastoNuMes = todas.filter((t) => t.mes_fatura >= mesLimite && t.banco === "NUBANK").reduce((a, t) => a + t.valor, 0);

    // Parcelas ativas (futuras, após mês atual)
    const parcelasAtivas: { estab: string; parcela: string; valor: number; mesFatura: string; portador: string; banco: string }[] = [];
    const mesesFuturos = mesesDisponiveis.filter((m) => m > mesAtual);
    for (const t of todas) {
      if (t.mes_fatura > mesAtual && t.parcela !== "-") {
        parcelasAtivas.push({
          estab: t.estabelecimento,
          parcela: t.parcela,
          valor: t.valor,
          mesFatura: t.mes_fatura,
          portador: t.portador,
          banco: t.banco,
        });
      }
    }
    parcelasAtivas.sort((a, b) => a.mesFatura.localeCompare(b.mesFatura));

    // Comprometido por mês futuro
    const comprometidoPorMes: Record<string, number> = {};
    for (const p of parcelasAtivas) {
      comprometidoPorMes[p.mesFatura] = (comprometidoPorMes[p.mesFatura] || 0) + p.valor;
    }

    // Top 5 estabelecimentos (respeitam filtros)
    const estabMap: Record<string, number> = {};
    for (const t of filtradas) {
      estabMap[t.estabelecimento] = (estabMap[t.estabelecimento] || 0) + t.valor;
    }
    const topEstabelecimentos = Object.entries(estabMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);


    return {
      mesesDisponiveis,
      categoriasDisponiveis,
      ultimos12,
      dadosMensais,
      evolucaoData,
      dadosBanco,
      categorias,
      totalFiltrado,
      mesAtual,
      gastoMesAtual, gastoMesAtualH, gastoMesAtualB, gastoMesAnteriorB,
      variacao, variacaoH, variacaoB,
      mediaMensal, mediaMensalH, mediaMensalB,
      ultimasTx,
      totalRegistros: filtradas.length,
      txH, txB,
      tetosGasto, tetoTotalGasto, mesTetoLabel, mostrarTetos,
      gastoXPMes, gastoNuMes, mesLimite,
      parcelasAtivas, comprometidoPorMes,
      topEstabelecimentos,
      cardDespesasFixasH, cardDespesasFixasB, cardDespesasFixasTotal,
      despesasFixasH, despesasFixasB, despesasFixasTotal,
      listaDespesasFixas,
    };
  }, [data, filtroPortador, filtroMes, filtroCategoria, filtroBanco]);

  if (!data || !computed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400 text-lg">Carregando...</p>
      </div>
    );
  }

  const { mesesDisponiveis, categoriasDisponiveis, dadosMensais, evolucaoData, dadosBanco, categorias, mesAtual, gastoMesAtual, gastoMesAtualH, gastoMesAtualB, gastoMesAnteriorB, variacao, variacaoH, variacaoB, mediaMensal, mediaMensalH, mediaMensalB, ultimasTx, totalRegistros, txH, txB, tetosGasto, tetoTotalGasto, mesTetoLabel, mostrarTetos, gastoXPMes, mesLimite, parcelasAtivas, comprometidoPorMes, topEstabelecimentos, cardDespesasFixasH, cardDespesasFixasB, cardDespesasFixasTotal, despesasFixasH, despesasFixasB, despesasFixasTotal, listaDespesasFixas } = computed;

  const pieData = categorias.slice(0, 5);
  const filtrosAtivos = [filtroPortador, filtroMes, filtroCategoria, filtroBanco].filter((f) => f !== "TODOS").length;

  // Calendário
  const anosDisponiveis = [...new Set(mesesDisponiveis.map((m) => m.split("-")[0]))].sort();
  const anoAtualIdx = anosDisponiveis.indexOf(anoCalendario.toString());
  const mesesAbrev = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Filtros Modal */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen w-80 bg-white border-r border-slate-200 shadow-2xl
        flex flex-col overflow-y-auto transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Filtros</h2>
            <p className="text-xs text-slate-400 mt-0.5">Henrique & Beatriz</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 flex-1">
          {/* Filtro Portador */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">
              Quem comprou
            </label>
            <div className="flex flex-col gap-1">
              {["TODOS", "HENRIQUE ALVES", "BEATRIZ WERNECK"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFiltroPortador(opt)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    filtroPortador === opt
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt === "TODOS" ? "Todos" : opt === "HENRIQUE ALVES" ? "Henrique" : "Beatriz"}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro Mês - Calendário */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">
              Mes
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    if (anoAtualIdx > 0) setAnoCalendario(parseInt(anosDisponiveis[anoAtualIdx - 1]));
                  }}
                  disabled={anoAtualIdx <= 0}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-bold text-slate-700">{anoCalendario}</span>
                <button
                  onClick={() => {
                    if (anoAtualIdx < anosDisponiveis.length - 1) setAnoCalendario(parseInt(anosDisponiveis[anoAtualIdx + 1]));
                  }}
                  disabled={anoAtualIdx >= anosDisponiveis.length - 1}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {mesesAbrev.map((nomeM, i) => {
                  const mesKey = `${anoCalendario}-${String(i + 1).padStart(2, "0")}`;
                  const existe = mesesDisponiveis.includes(mesKey);
                  const selecionado = filtroMes === mesKey;
                  return (
                    <button
                      key={mesKey}
                      onClick={() => {
                        if (!existe) return;
                        setFiltroMes(selecionado ? "TODOS" : mesKey);
                      }}
                      disabled={!existe}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selecionado
                          ? "bg-blue-600 text-white"
                          : existe
                          ? "text-slate-600 hover:bg-slate-200"
                          : "text-slate-300 cursor-not-allowed"
                      }`}
                    >
                      {nomeM}
                    </button>
                  );
                })}
              </div>
              {filtroMes !== "TODOS" && (
                <button
                  onClick={() => setFiltroMes("TODOS")}
                  className="w-full mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Ver todos os meses
                </button>
              )}
            </div>
          </div>

          {/* Filtro Banco */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">
              Banco
            </label>
            <div className="flex flex-col gap-1">
              {["TODOS", "XP", "NUBANK"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFiltroBanco(opt)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    filtroBanco === opt
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt === "TODOS" ? "Todos" : opt === "XP" ? "XP Investimentos" : "Nubank"}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro Categoria */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">
              Categoria
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
            >
              <option value="TODOS">Todas as categorias</option>
              {categoriasDisponiveis.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {filtrosAtivos > 0 && (
            <button
              onClick={() => { setFiltroPortador("TODOS"); setFiltroMes("TODOS"); setFiltroCategoria("TODOS"); setFiltroBanco("TODOS"); }}
              className="text-sm text-red-500 hover:text-red-600 font-medium mt-2"
            >
              Limpar filtros ({filtrosAtivos})
            </button>
          )}
        </div>

        <div className="p-6 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {totalRegistros} transacoes
            {filtrosAtivos > 0 ? " (filtrado)" : ""}
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 lg:px-6 py-4 relative flex items-center">
          <div className="flex-1 flex justify-start gap-2">
            <button onClick={() => setSidebarOpen(true)} className="group cursor-pointer flex items-center bg-white border border-slate-300 hover:border-slate-400 active:scale-95 active:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-all duration-300 overflow-hidden h-9 lg:h-10 px-3">
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {filtrosAtivos > 0 && (
                  <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-blue-600 border border-white group-hover:opacity-0 transition-opacity duration-300"></span>
                )}
              </div>
              <span className="max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden flex items-center">
                Filtros
                {filtrosAtivos > 0 && <span className="ml-1.5 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{filtrosAtivos}</span>}
              </span>
            </button>
            <button onClick={() => setModalTransacoesOpen(true)} className="group cursor-pointer flex items-center bg-white border border-slate-300 hover:border-slate-400 active:scale-95 active:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-all duration-300 overflow-hidden h-9 lg:h-10 px-3">
              <div className="relative flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <span className="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden flex items-center">
                Transações
              </span>
            </button>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-800 absolute left-1/2 -translate-x-1/2 tracking-tight">Finanças</h1>
          <div className="flex-1"></div>
        </div>

        <div className="p-3 lg:p-5">


          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
            {/* Gasto mês atual */}
            <div className="p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300" style={cardStyle}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide text-center">
                {filtroMes !== "TODOS" ? `Gasto ${formatMonth(filtroMes)}` : `Gasto ${formatMonth(mesAtual)}`}
              </p>
              <p className="text-2xl font-bold mt-1 text-center" style={{ color: "#1a1a1a" }}>
                {filtroMes !== "TODOS" ? formatBRL(computed.totalFiltrado) : formatBRL(gastoMesAtual)}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Henrique</p>
                  <p className="text-sm font-semibold" style={{ color: "#9E9E80" }}>{formatBRL(gastoMesAtualH)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Beatriz</p>
                  <p className="text-sm font-semibold" style={{ color: "#CD3278" }}>{formatBRL(gastoMesAtualB)}</p>
                </div>
              </div>
            </div>


            {/* Despesas Variáveis */}
            <div className="p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300" style={cardStyle}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide text-center">Despesas Variáveis</p>
              <p className="text-2xl font-bold mt-1 text-center" style={{ color: "#1a1a1a" }}>
                {formatBRL(Math.max(0, (filtroMes !== "TODOS" ? computed.totalFiltrado : gastoMesAtual) - despesasFixasTotal))}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Henrique</p>
                  <p className="text-sm font-semibold" style={{ color: "#9E9E80" }}>
                    {formatBRL(Math.max(0, gastoMesAtualH - despesasFixasH))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Beatriz</p>
                  <p className="text-sm font-semibold" style={{ color: "#CD3278" }}>
                    {formatBRL(Math.max(0, gastoMesAtualB - despesasFixasB))}
                  </p>
                </div>
              </div>
            </div>

            {/* Despesas Fixas */}
            <div className="p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300" style={cardStyle}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide text-center">Despesas Fixas</p>
              <p className="text-2xl font-bold mt-1 text-center text-slate-700">{formatBRL(cardDespesasFixasTotal)}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Henrique</p>
                  <p className="text-sm font-semibold" style={{ color: "#9E9E80" }}>{formatBRL(cardDespesasFixasH)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Beatriz</p>
                  <p className="text-sm font-semibold" style={{ color: "#CD3278" }}>{formatBRL(cardDespesasFixasB)}</p>
                </div>
              </div>
            </div>

            {/* Transações */}
            <div className="p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300" style={cardStyle}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide text-center">Transacoes</p>
              <p className="text-2xl font-bold mt-1 text-violet-600 text-center">{totalRegistros}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Henrique</p>
                  <p className="text-sm font-semibold" style={{ color: "#9E9E80" }}>{txH}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Beatriz</p>
                  <p className="text-sm font-semibold" style={{ color: "#CD3278" }}>{txB}</p>
                </div>
              </div>
            </div>
            
            {/* Média mensal */}
            <div className="p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300" style={cardStyle}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide text-center">Media mensal (6m)</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600 text-center">{formatBRL(mediaMensal)}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Henrique</p>
                  <p className="text-sm font-semibold" style={{ color: "#9E9E80" }}>{formatBRL(mediaMensalH)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Beatriz</p>
                  <p className="text-sm font-semibold" style={{ color: "#CD3278" }}>{formatBRL(mediaMensalB)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 1 - Tetos mensais (Henrique) + Limites */}
          {mostrarTetos && (
          <div className="grid grid-cols-1 gap-3 mb-3">
            <Card title={`Teto mensal — Henrique (${mesTetoLabel})`}>
              {(() => {
                const tetos = data.tetos_henrique;
                const tetoMeta = data.teto_total_henrique; // R$ 1.390
                const tetoLimite = 1500; // limite máximo
                const pctMeta = tetoMeta > 0 ? (tetoTotalGasto / tetoMeta) * 100 : 0;
                const pctLimite = tetoLimite > 0 ? (tetoTotalGasto / tetoLimite) * 100 : 0;
                const corBarra = tetoTotalGasto > tetoLimite ? "#DC2626" : tetoTotalGasto > tetoMeta ? "#D97706" : "#059669";
                const marcaMeta = (tetoMeta / tetoLimite) * 100; // posição da marca na barra

                return (
                  <div>
                    {/* Barra total com meta + limite */}
                    <div className="mb-5 pb-4 border-b border-slate-100">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold" style={{ color: "#1A1A2E" }}>TOTAL</span>
                        <span className="font-semibold" style={{ color: corBarra }}>
                          {formatBRL(tetoTotalGasto)}
                        </span>
                      </div>
                      {/* Barra com duas marcações */}
                      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                        {/* Preenchimento */}
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pctLimite, 100)}%`, backgroundColor: corBarra }} />
                        {/* Marca da meta (R$ 1.390) */}
                        <div className="absolute top-0 h-full" style={{ left: `${marcaMeta}%`, width: 2, backgroundColor: "#1A1A2E" }} />
                      </div>
                      {/* Labels embaixo da barra */}
                      <div className="relative mt-1" style={{ height: 16 }}>
                        <span className="absolute text-[10px] text-slate-500" style={{ left: `${marcaMeta}%`, transform: "translateX(-50%)" }}>
                          Meta {formatBRL(tetoMeta)}
                        </span>
                        <span className="absolute text-[10px] text-slate-500 right-0">
                          Limite {formatBRL(tetoLimite)}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: corBarra }}>
                        {tetoTotalGasto > tetoLimite
                          ? `ESTOUROU o limite! ${formatBRL(tetoTotalGasto - tetoLimite)} acima`
                          : tetoTotalGasto > tetoMeta
                          ? `Passou a meta em ${formatBRL(tetoTotalGasto - tetoMeta)} — ainda tem ${formatBRL(tetoLimite - tetoTotalGasto)} ate o limite`
                          : `Dentro da meta — restam ${formatBRL(tetoMeta - tetoTotalGasto)}`
                        }
                      </p>
                    </div>

                    {/* Grid de categorias */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {Object.entries(tetos)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, teto]) => {
                          const gasto = Math.round((tetosGasto[cat] || 0) * 100) / 100;
                          const pct = teto > 0 ? (gasto / teto) * 100 : 0;
                          const cor = pct > 100 ? "#DC2626" : pct > 80 ? "#D97706" : "#059669";
                          return (
                            <div key={cat} className="p-3 rounded-lg bg-slate-50">
                              <p className="text-xs font-semibold text-slate-500 truncate mb-1" title={cat}>{cat}</p>
                              <div className="flex justify-between items-baseline mb-1">
                                <span className="text-sm font-bold" style={{ color: cor }}>{formatBRL(gasto)}</span>
                                <span className="text-[10px] text-slate-400">/ {formatBRL(teto)}</span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cor }} />
                              </div>
                              <p className="text-[10px] mt-0.5" style={{ color: cor }}>
                                {pct > 100 ? `+${formatBRL(gasto - teto)}` : `${formatBRL(teto - gasto)} restam`}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
          )}

          {/* Row 2 - Limites dos cartões */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            {/* XP */}
            {(() => {
              const limite = data.limites.XP;
              const gasto = Math.round(gastoXPMes * 100) / 100;
              const pct = limite > 0 ? (gasto / limite) * 100 : 0;
              const cor = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#059669";
              return (
                <Card title={`Limite XP — ${formatMonth(mesLimite)}`}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-2xl font-bold" style={{ color: cor }}>{formatBRL(gasto)}</span>
                    <span className="text-sm text-slate-400">de {formatBRL(limite)}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cor }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: cor }}>{pct.toFixed(1)}% usado</span>
                    <span className="text-slate-500">Restam {formatBRL(Math.max(limite - gasto, 0))}</span>
                  </div>
                </Card>
              );
            })()}

            {/* Reserva de Emergência */}
            <Card title={`Reserva de Emergência ${filtroPortador === "TODOS" ? "(Casal)" : filtroPortador === "HENRIQUE ALVES" ? "(Henrique)" : "(Beatriz)"}`}>
              {(() => {
                const hRes = data.resumo_financeiro_henrique?.reservas_investimentos?.filter((i: any) => i.nome !== "XP Investimentos").reduce((a: any, i: any) => a + i.valor, 0) || 0;
                const bRes = data.resumo_financeiro_beatriz?.reservas_investimentos?.reduce((a: any, i: any) => a + i.valor, 0) || 0;
                
                let atual = 0;
                let meta = 0;
                if (filtroPortador === "HENRIQUE ALVES") {
                  atual = hRes;
                  meta = 30000;
                } else if (filtroPortador === "BEATRIZ WERNECK") {
                  atual = bRes;
                  meta = 10000;
                } else {
                  atual = hRes + bRes;
                  meta = 40000;
                }
                
                const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
                const color = filtroPortador === "BEATRIZ WERNECK" ? "#CD3278" : filtroPortador === "HENRIQUE ALVES" ? "#9E9E80" : "#1E40AF";
                
                return (<div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-2xl font-bold" style={{ color }}>{formatBRL(atual)}</span>
                    <span className="text-sm text-slate-400">meta {formatBRL(meta)}</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <p className="text-xs text-slate-500">{pct.toFixed(0)}% concluído — faltam {formatBRL(Math.max(meta - atual, 0))}</p>
                </div>);
              })()}
            </Card>

            {/* Caixinha BMW */}
            <Card title={`Provisão 2027 — Caixinha BMW`}>
              {(() => {
                const atual = data.resumo_financeiro_henrique?.caixinha_bmw || 0;
                const meta = 5000; // Meta sugerida até dez/2026
                const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
                const color = "#D97706"; // Cor de atenção/foco
                
                return (<div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-2xl font-bold" style={{ color }}>{formatBRL(atual)}</span>
                    <span className="text-sm text-slate-400">meta {formatBRL(meta)}</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <p className="text-xs text-slate-500">{pct.toFixed(0)}% concluído — faltam {formatBRL(Math.max(meta - atual, 0))}</p>
                </div>);
              })()}
            </Card>
          </div>


          {/* Row 3 - Pra onde vai o dinheiro (Categorias + Top 5) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <Card title="Top 5 categorias">
              {(() => {
                const PIE_COLORS_STRONG = ["#2d6a4f", "#b5451b", "#5a3d8a", "#1a6b8a", "#8a6d3b"];
                const PIE_COLORS_SOFT = ["#74c69d", "#e8a87c", "#b39ddb", "#81d4fa", "#d4b896"];
                const maxVal = pieData[0]?.value || 1;
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value"
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                          const RADIAN = Math.PI / 180;
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
                        }} labelLine={false}>
                        {pieData.map((entry, i) => {
                          const ratio = entry.value / maxVal;
                          return <Cell key={i} fill={ratio > 0.6 ? PIE_COLORS_STRONG[i % 5] : PIE_COLORS_SOFT[i % 5]} />;
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }} formatter={(v: any) => formatBRL(v)} />
                      <Legend align="center" formatter={(value: string, entry: any) => <span style={{ color: entry.color, fontSize: 11 }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </Card>

            <Card title="Gastos por categoria">
              {(() => {
                const BAR_STRONG = ["#2d6a4f", "#b5451b", "#5a3d8a", "#1a6b8a", "#8a6d3b", "#6b2d5b", "#2d4a6b", "#6b4a2d", "#3d6b5a", "#5a2d3d"];
                const BAR_SOFT = ["#74c69d", "#e8a87c", "#b39ddb", "#81d4fa", "#d4b896", "#d4a0c4", "#a0c4d4", "#c4b8a0", "#a0d4c0", "#c4a0b0"];
                const maxVal = categorias[0]?.value || 1;
                return (
                  <div className="h-[280px] overflow-y-auto pr-2">
                    {categorias.map((item, i) => {
                      const pct = (item.value / maxVal) * 100;
                      const ratio = item.value / maxVal;
                      const color = ratio > 0.5 ? BAR_STRONG[i % 10] : BAR_SOFT[i % 10];
                      return (
                        <div key={item.name} className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-700 font-medium">{item.name}</span>
                            <span className="text-slate-500">{formatBRL(item.value)}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>

            <Card title="Top 5 estabelecimentos">
              <div className="space-y-3">
                {topEstabelecimentos.map((item, i) => {
                  const max = topEstabelecimentos[0]?.value || 1;
                  const pct = (item.value / max) * 100;
                  const cores = ["#1E40AF", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD"];
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium truncate max-w-[180px]" title={item.name}>
                          <span className="text-slate-400 mr-1">{i + 1}.</span>{item.name}
                        </span>
                        <span className="text-slate-500 whitespace-nowrap ml-2">{formatBRL(item.value)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cores[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Row 4 - Como evoluímos (Gráficos) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <Card title="Evolucao mensal">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosMensais} margin={{ top: 25 }}>
                  <XAxis dataKey="mes" tick={{ fill: "#1e1e1e", fontSize: 12, fontWeight: 600 }} />
                  <YAxis tick={{ fill: "#1e1e1e", fontSize: 12, fontWeight: 600 }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const item = dadosMensais.find((d) => d.mes === label);
                    return (
                      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, minWidth: 180 }}>
                        <p style={{ fontWeight: 700, textAlign: "center", marginBottom: 6 }}>{label}</p>
                        {payload.map((p: any) => (
                          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, margin: "3px 0" }}>
                            <span style={{ color: p.color }}>{p.name}</span>
                            <span style={{ color: p.color, fontWeight: 500 }}>{formatBRL(p.value)}</span>
                          </div>
                        ))}
                        {item && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontWeight: 600, marginTop: 6, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
                            <span>Total</span><span>{formatBRL(item.Total)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }} />
                  <Legend align="center" />
                  <Bar dataKey="Henrique" stackId="a" fill="#9E9E80" />
                  <Bar dataKey="Beatriz" stackId="a" fill="#CD3278" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="XP vs Nubank">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosBanco} margin={{ top: 25 }}>
                  <XAxis dataKey="mes" tick={{ fill: "#1e1e1e", fontSize: 12, fontWeight: 600 }} />
                  <YAxis tick={{ fill: "#1e1e1e", fontSize: 12, fontWeight: 600 }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const item = dadosBanco.find((d) => d.mes === label);
                    return (
                      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, minWidth: 180 }}>
                        <p style={{ fontWeight: 700, textAlign: "center", marginBottom: 6 }}>{label}</p>
                        {payload.map((p: any) => (
                          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, margin: "3px 0" }}>
                            <span style={{ color: p.color }}>{p.name}</span>
                            <span style={{ color: p.color, fontWeight: 500 }}>{formatBRL(p.value)}</span>
                          </div>
                        ))}
                        {item && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontWeight: 600, marginTop: 6, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
                            <span>Total</span><span>{formatBRL(item.TotalBanco)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }} />
                  <Legend align="center" />
                  <Bar dataKey="XP" stackId="a" fill="#d97706" />
                  <Bar dataKey="Nubank" stackId="a" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>


          <p className="text-center text-slate-400 text-xs mt-8 pb-4">
            Atualizado em {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        {/* Modal de Transações */}
        <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-8 transition-opacity duration-500 ease-out ${modalTransacoesOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setModalTransacoesOpen(false)}>
          <div className={`w-full max-w-[95%] lg:max-w-[1600px] xl:max-w-[1800px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-500 ease-out max-h-[90vh] ${modalTransacoesOpen ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-12 opacity-0"}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Detalhamento Financeiro</h2>
              <button onClick={() => setModalTransacoesOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden p-6 bg-slate-50/50 min-h-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
                
                {/* Lado Esquerdo: Despesas Variáveis */}
                <div className="lg:col-span-8 lg:relative min-h-[400px] lg:min-h-0">
                  <div className="flex flex-col h-full min-h-0 lg:absolute lg:inset-0">
                    <h3 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      Despesas Variáveis
                    </h3>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                      <div className="overflow-y-auto flex-1">
                        <table className="w-full text-sm">
                          <thead className="text-slate-400 sticky top-0 bg-white/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                          <tr>
                            <th className="text-left py-3 px-4 font-medium border-b border-slate-100">Data</th>
                            <th className="text-left py-3 px-4 font-medium border-b border-slate-100">Resp.</th>
                            <th className="text-left py-3 px-4 font-medium border-b border-slate-100">Banco</th>
                            <th className="text-left py-3 px-4 font-medium border-b border-slate-100">Local</th>
                            <th className="text-left py-3 px-4 font-medium border-b border-slate-100">Categoria</th>
                            <th className="text-center py-3 px-4 font-medium border-b border-slate-100">Parc.</th>
                            <th className="text-right py-3 px-4 font-medium border-b border-slate-100">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ultimasTx.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400">Nenhuma transação encontrada com os filtros atuais.</td>
                            </tr>
                          ) : (
                            ultimasTx.map((tx, i) => (
                              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                                  {new Date(tx.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="font-medium px-2 py-1 rounded-full text-[10px]" style={{ 
                                    color: tx.portador === "BEATRIZ WERNECK" ? "#CD3278" : "#9E9E80",
                                    backgroundColor: tx.portador === "BEATRIZ WERNECK" ? "#fdf2f8" : "#f4f4f0" 
                                  }}>
                                    {tx.portador === "BEATRIZ WERNECK" ? "B" : "H"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-600 whitespace-nowrap text-xs font-medium">
                                  {tx.banco}
                                </td>
                                <td className="py-3 px-4 text-slate-700 truncate max-w-[150px] text-xs" title={tx.estabelecimento}>
                                  {tx.estabelecimento}
                                  {tx.split && (
                                    <span className="ml-1 align-middle text-[9px] font-semibold text-amber-600 bg-amber-50 px-1 py-0.5 rounded" title={`Dividido ${tx.split} com Beatriz`}>
                                      {tx.split}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{tx.categoria}</span>
                                </td>
                                <td className="py-3 px-4 text-center text-slate-400 text-xs whitespace-nowrap">
                                  {tx.parcela !== "-" ? tx.parcela : ""}
                                </td>
                                <td className="py-3 px-4 text-right font-medium whitespace-nowrap text-xs">
                                  {tx.abatido ? (
                                    <span className="text-slate-400 line-through decoration-slate-300" title={`Abatido — metade da Beatriz (dividido ${tx.split ?? "50/50"}), reembolsada em dinheiro`}>
                                      {formatBRL(tx.valor_bruto ?? tx.valor)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-800">{formatBRL(tx.valor)}</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                </div>

                {/* Lado Direito: Despesas Fixas */}
                <div className="flex flex-col h-full min-h-0 lg:col-span-4">
                  <h3 className="text-lg font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Despesas Fixas
                  </h3>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-sm">
                        <thead className="text-slate-400 sticky top-0 bg-white/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                          <tr>
                            <th className="text-left py-3 px-4 font-medium border-b border-slate-100">Responsável</th>
                            <th className="text-left py-3 px-4 font-medium border-b border-slate-100">Despesa</th>
                            <th className="text-right py-3 px-4 font-medium border-b border-slate-100">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listaDespesasFixas.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-8 text-center text-slate-400">Nenhuma despesa fixa encontrada.</td>
                            </tr>
                          ) : (
                            listaDespesasFixas.map((df, i) => (
                              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4 whitespace-nowrap w-24">
                                  <span className="font-medium px-2 py-1 rounded-full text-xs" style={{ 
                                    color: df.portador === "BEATRIZ WERNECK" ? "#CD3278" : "#9E9E80",
                                    backgroundColor: df.portador === "BEATRIZ WERNECK" ? "#fdf2f8" : "#f4f4f0" 
                                  }}>
                                    {df.portador === "BEATRIZ WERNECK" ? "Beatriz" : "Henrique"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-700 font-medium">
                                  {df.nome}
                                  {df.descontado > 0 && (
                                    <span className="block text-[10px] text-emerald-600 font-normal mt-0.5" title="Consumido no cartão de crédito (Mercado)">
                                      Cartão: -{formatBRL(df.descontado)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-slate-800 whitespace-nowrap">
                                  {df.descontado > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] text-slate-400 line-through mb-0.5" title="Orçamento total mensal">{formatBRL(df.original)}</span>
                                      <span title="Saldo restante em dinheiro/pix">{formatBRL(df.valor)}</span>
                                    </div>
                                  ) : (
                                    formatBRL(df.valor)
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200 shadow-[0_-1px_2px_rgba(0,0,0,0.05)] z-10">
                          {listaDespesasFixas.length > 0 && (
                            <tr className="font-bold">
                              <td colSpan={2} className="py-4 px-4 text-right text-slate-600">Total Fixas:</td>
                              <td className="py-4 px-4 text-right text-slate-800">{formatBRL(listaDespesasFixas.reduce((acc, df) => acc + df.valor, 0))}</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
