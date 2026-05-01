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
}

interface DashboardData {
  total_registros: number;
  transacoes: Transacao[];
  tetos_henrique: Record<string, number>;
  teto_total_henrique: number;
  limites: Record<string, number>;
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
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5" style={cardStyle}>
      <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wide text-center">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ label, value, color = "text-slate-800" }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-5" style={cardStyle}>
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
  const [anoCalendario, setAnoCalendario] = useState(2026);

  useEffect(() => {
    fetch("/data.json")
      .then((r) => r.json())
      .then(setData);
  }, []);

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

    // Dados mensais por fatura (respeitam filtro de portador)
    const dadosMensais = ultimos12.map((mes) => {
      const doMes = filtradasPortador.filter((t) => t.mes_fatura === mes);
      const henrique = doMes.filter((t) => t.portador === "HENRIQUE ALVES").reduce((a, t) => a + t.valor, 0);
      const beatriz = doMes.filter((t) => t.portador === "BEATRIZ WERNECK").reduce((a, t) => a + t.valor, 0);
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
      return {
        mes: formatMonth(mes),
        Henrique: Math.round(doMes.filter((t) => t.portador === "HENRIQUE ALVES").reduce((a, t) => a + t.valor, 0) * 100) / 100,
        Beatriz: Math.round(doMes.filter((t) => t.portador === "BEATRIZ WERNECK").reduce((a, t) => a + t.valor, 0) * 100) / 100,
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
    const totalFiltrado = filtradas.reduce((a, t) => a + t.valor, 0);
    const mesAtual = ultimos12[ultimos12.length - 1];
    const mesAtualData = dadosMensais[dadosMensais.length - 1];
    const mesAnteriorData = dadosMensais.length > 1 ? dadosMensais[dadosMensais.length - 2] : null;

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
    const ultimasTx = [...filtradas].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 50);

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

    // Limite dos cartões no mês da fatura selecionado
    const mesLimite = filtroMes !== "TODOS" ? filtroMes : mesAtual;
    const gastoXPMes = todas.filter((t) => t.mes_fatura === mesLimite && t.banco === "XP").reduce((a, t) => a + t.valor, 0);
    const gastoNuMes = todas.filter((t) => t.mes_fatura === mesLimite && t.banco === "NUBANK").reduce((a, t) => a + t.valor, 0);

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
    };
  }, [data, filtroPortador, filtroMes, filtroCategoria, filtroBanco]);

  if (!data || !computed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400 text-lg">Carregando...</p>
      </div>
    );
  }

  const { mesesDisponiveis, categoriasDisponiveis, dadosMensais, evolucaoData, dadosBanco, categorias, mesAtual, gastoMesAtual, gastoMesAtualH, gastoMesAtualB, gastoMesAnteriorB, variacao, variacaoH, variacaoB, mediaMensal, mediaMensalH, mediaMensalB, ultimasTx, totalRegistros, txH, txB, tetosGasto, tetoTotalGasto, mesTetoLabel, mostrarTetos, gastoXPMes, gastoNuMes, mesLimite, parcelasAtivas, comprometidoPorMes, topEstabelecimentos } = computed;

  const pieData = categorias.slice(0, 5);
  const filtrosAtivos = [filtroPortador, filtroMes, filtroCategoria, filtroBanco].filter((f) => f !== "TODOS").length;

  // Calendário
  const anosDisponiveis = [...new Set(mesesDisponiveis.map((m) => m.split("-")[0]))].sort();
  const anoAtualIdx = anosDisponiveis.indexOf(anoCalendario.toString());
  const mesesAbrev = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-white border-r border-slate-200 shadow-lg lg:shadow-none
        flex flex-col overflow-y-auto transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-800">Financas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Henrique & Beatriz</p>
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
      <main className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">Financas</h1>
          {filtrosAtivos > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {filtrosAtivos} filtro{filtrosAtivos > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="p-3 lg:p-5 max-w-7xl mx-auto">
          {/* Resumo em texto */}
          <div className="mb-3 p-4" style={cardStyle}>
            <p className="text-sm text-slate-700 leading-relaxed text-center">
              {(() => {
                const mesLabel = formatMonth(mesAtual);
                const mesAntLabel = dadosMensais.length > 1 ? dadosMensais[dadosMensais.length - 2]?.mes : "";
                const varDir = variacao <= 0 ? "a menos" : "a mais";
                const varAbs = Math.abs(variacao).toFixed(1);

                const topCat = categorias[0];

                let fraseH = "";
                if (variacaoH <= 0) {
                  fraseH = `Henrique reduziu ${Math.abs(variacaoH).toFixed(0)}%`;
                } else {
                  fraseH = `Henrique aumentou ${variacaoH.toFixed(0)}%`;
                }

                let fraseB = "";
                if (gastoMesAtualB > 0 && computed.gastoMesAnteriorB > 0) {
                  if (variacaoB <= 0) {
                    fraseB = `Beatriz reduziu ${Math.abs(variacaoB).toFixed(0)}%`;
                  } else {
                    fraseB = `Beatriz aumentou ${variacaoB.toFixed(0)}%`;
                  }
                } else if (gastoMesAtualB > 0) {
                  fraseB = `Beatriz gastou ${formatBRL(gastoMesAtualB)}`;
                }

                // Insight sobre tetos
                const tetoTotal = data.teto_total_henrique;
                const tetoPct = tetoTotal > 0 ? (tetoTotalGasto / tetoTotal) * 100 : 0;
                const categoriasEstouradas = Object.entries(data.tetos_henrique).filter(([cat, teto]) => (tetosGasto[cat] || 0) > teto);

                let fraseTeto = "";
                if (tetoPct > 100) {
                  fraseTeto = ` Henrique estourou o teto em ${(tetoPct - 100).toFixed(0)}% (${formatBRL(tetoTotalGasto - tetoTotal)} acima).`;
                } else if (tetoPct > 80) {
                  fraseTeto = ` Henrique usou ${tetoPct.toFixed(0)}% do teto — atencao.`;
                } else {
                  fraseTeto = ` Henrique esta dentro do teto (${tetoPct.toFixed(0)}%).`;
                }
                if (categoriasEstouradas.length > 0) {
                  fraseTeto += ` ${categoriasEstouradas.length} categoria${categoriasEstouradas.length > 1 ? "s" : ""} estourou: ${categoriasEstouradas.map(([c]) => c).join(", ")}.`;
                }

                return (
                  <>
                    Em <strong>{mesLabel}</strong> voces gastaram <strong>{formatBRL(gastoMesAtual)}</strong>, {varAbs}% {varDir} que {mesAntLabel}.{" "}
                    {fraseH}{fraseB ? `, ${fraseB}` : ""}.{" "}
                    {topCat && <>A maior categoria foi <strong>{topCat.name}</strong> com {formatBRL(topCat.value)}.</>}
                    {fraseTeto}
                  </>
                );
              })()}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            {/* Gasto mês atual */}
            <div className="p-5" style={cardStyle}>
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

            {/* Média mensal */}
            <div className="p-5" style={cardStyle}>
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

            {/* Variação mensal */}
            <div className="p-5" style={cardStyle}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide text-center">Variacao mensal</p>
              <p className={`text-2xl font-bold mt-1 text-center ${variacao <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {variacao >= 0 ? "+" : ""}{variacao.toFixed(1)}%
              </p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Henrique</p>
                  <p className={`text-sm font-semibold ${variacaoH <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {variacaoH >= 0 ? "+" : ""}{variacaoH.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase">Beatriz</p>
                  <p className={`text-sm font-semibold ${variacaoB <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {variacaoB >= 0 ? "+" : ""}{variacaoB.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Transações */}
            <div className="p-5" style={cardStyle}>
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
          </div>

          {/* Row 1 - Tetos mensais (Henrique) + Limites */}
          {mostrarTetos && (
          <div className="grid grid-cols-1 gap-3 mb-3">
            <Card title={`Teto mensal — Henrique (${mesTetoLabel})`}>
              {(() => {
                const tetos = data.tetos_henrique;
                const tetoTotal = data.teto_total_henrique;
                const pctTotal = tetoTotal > 0 ? (tetoTotalGasto / tetoTotal) * 100 : 0;
                const corTotal = pctTotal > 100 ? "#DC2626" : pctTotal > 80 ? "#D97706" : "#059669";

                return (
                  <div>
                    {/* Barra total */}
                    <div className="mb-5 pb-4 border-b border-slate-100">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold" style={{ color: "#1A1A2E" }}>TOTAL</span>
                        <span className="font-semibold" style={{ color: corTotal }}>
                          {formatBRL(tetoTotalGasto)} / {formatBRL(tetoTotal)}
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pctTotal, 100)}%`, backgroundColor: corTotal }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: corTotal }}>
                        {pctTotal > 100
                          ? `Excedeu ${formatBRL(tetoTotalGasto - tetoTotal)} (${pctTotal.toFixed(0)}%)`
                          : `Restam ${formatBRL(tetoTotal - tetoTotalGasto)} (${pctTotal.toFixed(0)}% usado)`
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
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

            {/* Nubank */}
            {(() => {
              const limite = data.limites.NUBANK;
              const gasto = Math.round(gastoNuMes * 100) / 100;
              const pct = limite > 0 ? (gasto / limite) * 100 : 0;
              const cor = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#059669";
              return (
                <Card title={`Limite Nubank — ${formatMonth(mesLimite)}`}>
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

          {/* Row 5 - Comprometimento + Metas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            {/* Parcelas ativas - só mostra se tiver */}
            {parcelasAtivas.length > 0 ? (
              <Card title="Parcelas ativas">
                <div>
                  <div className="mb-4 pb-3 border-b border-slate-100">
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(comprometidoPorMes).map(([mes, val]) => (
                        <div key={mes} className="bg-slate-50 rounded-lg px-3 py-2 text-center">
                          <p className="text-[10px] text-slate-400 uppercase">{formatMonth(mes)}</p>
                          <p className="text-sm font-bold text-slate-700">{formatBRL(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-[180px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-400 sticky top-0 bg-white">
                        <tr>
                          <th className="text-left py-1">Fatura</th>
                          <th className="text-left py-1">Compra</th>
                          <th className="text-center py-1">Parcela</th>
                          <th className="text-right py-1">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parcelasAtivas.map((p, i) => (
                          <tr key={i} className="border-t border-slate-50">
                            <td className="py-1 text-slate-400">{formatMonth(p.mesFatura)}</td>
                            <td className="py-1 text-slate-700 truncate max-w-[120px]" title={p.estab}>
                              {p.estab}
                              <span className="text-[10px] ml-1" style={{ color: p.portador === "BEATRIZ WERNECK" ? "#CD3278" : "#9E9E80" }}>
                                {p.portador === "BEATRIZ WERNECK" ? "B" : "H"}
                              </span>
                            </td>
                            <td className="py-1 text-center text-slate-400">{p.parcela}</td>
                            <td className="py-1 text-right font-medium text-slate-700">{formatBRL(p.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            ) : (
              <Card title="Meta — Reserva de emergencia">
                {(() => {
                  const atual = 7277; const meta = 12000; const pct = (atual / meta) * 100;
                  return (<div>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-2xl font-bold" style={{ color: "#1E40AF" }}>{formatBRL(atual)}</span>
                      <span className="text-sm text-slate-400">meta {formatBRL(meta)}</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#1E40AF" }} />
                    </div>
                    <p className="text-xs text-slate-500">{pct.toFixed(0)}% concluido — faltam {formatBRL(meta - atual)}</p>
                  </div>);
                })()}
              </Card>
            )}

            {/* Metas sempre visíveis */}
            <div className="flex flex-col gap-3">
              {parcelasAtivas.length > 0 && (
                <div className="p-5" style={cardStyle}>
                  <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wide text-center">Meta — Reserva de emergencia</h3>
                  {(() => {
                    const atual = 7277; const meta = 12000; const pct = (atual / meta) * 100;
                    return (<div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xl font-bold" style={{ color: "#1E40AF" }}>{formatBRL(atual)}</span>
                        <span className="text-sm text-slate-400">meta {formatBRL(meta)}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#1E40AF" }} />
                      </div>
                      <p className="text-xs text-slate-500">{pct.toFixed(0)}% — faltam {formatBRL(meta - atual)}</p>
                    </div>);
                  })()}
                </div>
              )}
              <div className="p-5" style={cardStyle}>
                <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wide text-center">Meta — Fundo Versys 650</h3>
                {(() => {
                  const atual = 0; const meta = 15000; const pct = meta > 0 ? (atual / meta) * 100 : 0;
                  return (<div>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xl font-bold" style={{ color: "#059669" }}>{formatBRL(atual)}</span>
                      <span className="text-sm text-slate-400">meta {formatBRL(meta)}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: "#059669" }} />
                    </div>
                    <p className="text-xs text-slate-500">{pct.toFixed(0)}% — faltam {formatBRL(meta - atual)}</p>
                  </div>);
                })()}
              </div>
            </div>
          </div>

          {/* Row 6 - Transações */}
          <div className="grid grid-cols-1 gap-3 mb-3">
            <Card title="Ultimas transacoes">
              <div className="h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400 sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-2 font-medium">Data</th>
                      <th className="text-left py-2 font-medium">Responsavel</th>
                      <th className="text-left py-2 font-medium">Banco</th>
                      <th className="text-left py-2 font-medium">Local</th>
                      <th className="text-left py-2 font-medium">Categoria</th>
                      <th className="text-center py-2 font-medium">Parcela</th>
                      <th className="text-right py-2 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimasTx.map((tx, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2 text-slate-400 whitespace-nowrap">
                          {new Date(tx.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <span className="font-medium" style={{ color: tx.portador === "BEATRIZ WERNECK" ? "#CD3278" : "#9E9E80" }}>
                            {tx.portador === "BEATRIZ WERNECK" ? "Beatriz" : "Henrique"}
                          </span>
                        </td>
                        <td className="py-2 text-slate-600 whitespace-nowrap text-xs">
                          {tx.banco}
                        </td>
                        <td className="py-2 text-slate-700 truncate max-w-[150px]" title={tx.estabelecimento}>
                          {tx.estabelecimento}
                        </td>
                        <td className="py-2 text-slate-500 text-xs whitespace-nowrap">
                          {tx.categoria}
                        </td>
                        <td className="py-2 text-center text-slate-400 text-xs whitespace-nowrap">
                          {tx.parcela !== "-" ? tx.parcela : ""}
                        </td>
                        <td className="py-2 text-right text-slate-800 font-medium whitespace-nowrap">
                          {formatBRL(tx.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <p className="text-center text-slate-400 text-xs mt-8 pb-4">
            Atualizado em {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      </main>
    </div>
  );
}
