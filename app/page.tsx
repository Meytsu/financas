"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TabelaOrdenavel } from "./tabela";
import henriqueJson from "../data/henrique.json";
import beatrizJson from "../data/beatriz.json";
import {
  DIAS_SEMANA,
  ICONE_STATUS,
  ROTULO_STATUS,
  brl,
  brlInteiro,
  compromissosFuturos,
  dataLonga,
  ddmm,
  dataEntrada,
  ehParcelado,
  isoParaBR,
  limitesDosDados,
  mesDe,
  mesLongo,
  mesesAte,
  pct,
  resumoMes,
  rotuloMes,
  soma,
  somaMes,
  statusComprometimento,
  statusPoupanca,
  statusReserva,
  statusTeto,
  type Dados,
  type Transacao,
  type Status,
} from "../lib/financas";
import { COR, Cascata, CategoriasAjustadas, ComDica, Evolucao, Futuros, ProvedorDica, Sankey, Sparkline } from "./graficos";

// cada pessoa tem o seu arquivo de dados (gerado por ../scripts/gerar_dados.py)
const BASES = { henrique: henriqueJson as Dados, beatriz: beatrizJson as Dados };
type Pessoa = keyof typeof BASES;
const PESSOAS: Pessoa[] = ["henrique", "beatriz"];

interface LinhaFixa {
  dia?: number;
  descricao: string;
  tipo: string;
  valor: number;
  obs?: string;
}

/* ===== Peças de layout ===== */
function Selo({ status }: { status: Status }) {
  return (
    <span className={`selo selo-${status}`}>
      <span aria-hidden="true">{ICONE_STATUS[status]}</span> {ROTULO_STATUS[status]}
    </span>
  );
}

function Painel({ titulo, subtitulo, children, className = "" }: { titulo: string; subtitulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <header className="card-cabecalho">
        <h3 className="card-titulo">{titulo}</h3>
        {subtitulo && <p className="card-subtitulo">{subtitulo}</p>}
      </header>
      {children}
    </section>
  );
}

/* ===== Delta e popover dos cards do bloco 1 ===== */
/** pontos percentuais: 0,123 -> "12,3 p.p." */
const pp = (d: number) => `${Math.abs(d * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} p.p.`;

/** Variação contra o mês anterior. `sobeBom`: subir é bom (verde); senão subir é ruim (vermelho). */
function Delta({ dif, texto, sobeBom = false, vs }: { dif: number; texto: string; sobeBom?: boolean; vs: string }) {
  if (Math.abs(dif) < 0.0005) return <p className="kpi-delta" title={`igual a ${vs}`}>= sem variação</p>;
  const bom = sobeBom ? dif > 0 : dif < 0;
  return (
    <p className="kpi-delta" title={`em relação a ${vs}`}>
      <span className={bom ? "delta-bom" : "delta-ruim"}>
        {dif > 0 ? "▲" : "▼"} {texto}
      </span>
    </p>
  );
}

/** Popover que surge ao passar o mouse no card (ou tocar, no celular). */
function Pop({ children }: { children: React.ReactNode }) {
  return (
    <div className="kpi-pop" role="tooltip">
      {children}
    </div>
  );
}
function PopGrupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="pop-grupo">
      <h4>{titulo}</h4>
      {children}
    </div>
  );
}
function PopLinha({ rotulo, valor, forte, tom }: { rotulo: string; valor: string; forte?: boolean; tom?: "bom" | "ruim" }) {
  return (
    <div className={`pop-linha ${forte ? "forte" : ""}`}>
      <span>{rotulo}</span>
      <span className={`num ${tom === "bom" ? "delta-bom" : tom === "ruim" ? "delta-ruim" : ""}`}>{valor}</span>
    </div>
  );
}
function PopNota({ children }: { children: React.ReactNode }) {
  return <p className="pop-nota">{children}</p>;
}

/** Antes de entrar, pergunta quem está acessando; a página já abre filtrada para essa pessoa. */
export default function Pagina() {
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  if (!pessoa)
    return (
      <main className="escolha">
        <h1>FINANÇAS</h1>
        <p>Quem está acessando?</p>
        <div className="escolha-opcoes">
          {PESSOAS.map((p) => (
            <button key={p} onClick={() => setPessoa(p)}>
              <span className="avatar" aria-hidden="true">
                {BASES[p].nome.charAt(0)}
              </span>
              {BASES[p].nome}
            </button>
          ))}
        </div>
      </main>
    );
  return <PainelPessoa key={pessoa} pessoa={pessoa} trocar={setPessoa} />;
}

function PainelPessoa({ pessoa, trocar }: { pessoa: Pessoa; trocar: (p: Pessoa) => void }) {
  const dados = BASES[pessoa];
  const limites = useMemo(() => limitesDosDados(dados), [dados]);
  const categoriasTodas = useMemo(() => [...new Set(dados.transacoes.map((t) => t.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR")), [dados]);
  const hoje = useMemo(() => new Date(), []);
  const mesHoje = mesDe(hoje);
  const [mes, setMes] = useState(mesHoje < limites.ultimo ? mesHoje : limites.ultimo);
  const janela = useRef<HTMLDialogElement>(null);

  // ===== Filtros (painel lateral) =====
  const [gaveta, setGaveta] = useState(false);
  const [banco, setBanco] = useState<"TODOS" | "XP" | "NUBANK">("TODOS");
  const [categoria, setCategoria] = useState("TODAS");
  const [anoCal, setAnoCal] = useState(Number(mes.slice(0, 4)));
  const mesPadrao = mesHoje < limites.ultimo ? mesHoje : limites.ultimo;
  const filtrosAtivos = (banco !== "TODOS" ? 1 : 0) + (categoria !== "TODAS" ? 1 : 0) + (mes !== mesPadrao ? 1 : 0);
  const limparFiltros = () => {
    setBanco("TODOS");
    setCategoria("TODAS");
    setMes(mesPadrao);
    setAnoCal(Number(mesPadrao.slice(0, 4)));
  };
  // cartão e categoria valem para a página toda (filtram os lançamentos antes de qualquer cálculo)
  const df = useMemo<Dados>(
    () => ({
      ...dados,
      transacoes: dados.transacoes.filter((t) => (banco === "TODOS" || t.banco === banco) && (categoria === "TODAS" || t.categoria === categoria)),
    }),
    [dados, banco, categoria],
  );
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setGaveta(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  // atalho: .../financas#lancamentos já abre a janela
  useEffect(() => {
    if (window.location.hash === "#lancamentos") janela.current?.showModal();
  }, []);

  const c = useMemo(() => {
    const r = resumoMes(df, mes);
    const anterior = resumoMes(df, somaMes(mes, -1));
    const hist = mesesAte(mes, 12, limites.primeiro).map((m) => resumoMes(df, m));
    const prev6 = mesesAte(somaMes(mes, -1), 6, limites.primeiro).map((m) => resumoMes(df, m));
    const mediaSaidas = prev6.length ? soma(prev6.map((x) => x.saidas)) / prev6.length : r.saidas;
    const mediaSobra = prev6.length ? soma(prev6.map((x) => x.sobra)) / prev6.length : r.sobra;

    // categorias: este mês × média dos 6 anteriores
    const mediaCat: Record<string, number> = {};
    for (const x of prev6) for (const cat of x.categorias) mediaCat[cat.nome] = (mediaCat[cat.nome] || 0) + cat.valor / prev6.length;
    const nomesCat = [...new Set([...r.categorias.map((x) => x.nome), ...Object.entries(mediaCat).filter(([, v]) => v >= 30).map(([n]) => n)])];
    const cats = nomesCat
      .map((nome) => ({ nome, atual: r.categorias.find((x) => x.nome === nome)?.valor ?? 0, media: mediaCat[nome] ?? 0 }))
      .sort((a, b) => b.atual - a.atual || b.media - a.media);

    // reserva (posição atual, independe do mês escolhido)
    const reservaAtual = soma(dados.reserva.contas.map((x) => x.valor));
    const custoMensal = mediaSaidas;
    const metaReserva = dados.reserva.meta_meses * custoMensal;
    const mesesCobertos = custoMensal > 0 ? reservaAtual / custoMensal : 0;
    const mesesParaMeta = mediaSobra > 0 ? Math.ceil(Math.max(0, metaReserva - reservaAtual) / mediaSobra) : null;

    const mediaTaxa = prev6.length ? soma(prev6.map((x) => x.taxaPoupanca)) / prev6.length : r.taxaPoupanca;
    return { r, anterior, hist, prev6, mediaSaidas, mediaSobra, mediaTaxa, cats, reservaAtual, custoMensal, metaReserva, mesesCobertos, mesesParaMeta };
  }, [mes, df, dados, limites]);

  const { r, anterior, hist } = c;
  const futuros = compromissosFuturos(df, mes, 12);
  const faltaReserva = Math.max(0, c.metaReserva - c.reservaAtual);
  const limiteComprometimento = dados.limite_comprometimento * r.receitas;
  const hist6 = hist.slice(-6); // sparklines do bloco 1: últimos 6 meses
  const rotHist = hist6.map((x) => rotuloMes(x.mes));

  /* Cascata */
  const passos = [
    { rotulo: "Receitas", valor: r.receitas, tipo: "total" as const },
    { rotulo: "Fixas", valor: r.fixas, tipo: "saida" as const },
    ...(r.totalBoletos > 0 ? [{ rotulo: "Boletos", valor: r.totalBoletos, tipo: "saida" as const }] : []),
    { rotulo: "Cartão à vista", valor: r.cartaoAVista, tipo: "saida" as const },
    ...(r.cartaoParcelado > 0 ? [{ rotulo: "Parcelas cartão", valor: r.cartaoParcelado, tipo: "saida" as const }] : []),
    ...(r.totalForaCartao > 0 ? [{ rotulo: "Energia", valor: r.totalForaCartao, tipo: "saida" as const }] : []),
    { rotulo: "Sobra", valor: r.sobra, tipo: "total" as const },
  ];

  /* Sankey */
  const entradasSankey = [{ id: "rec", rotulo: "Receitas", valor: r.receitas }, ...(r.sobra < 0 ? [{ id: "falta", rotulo: "Faltou", valor: -r.sobra }] : [])];
  const gruposSankey = [
    { id: "contas", rotulo: "Contas da casa", valor: r.fixas + r.totalForaCartao, cor: COR.s1 },
    ...(r.totalBoletos > 0 ? [{ id: "boletos", rotulo: "Boletos", valor: r.totalBoletos, cor: COR.s2 }] : []),
    { id: "cartao", rotulo: "Cartões", valor: Math.max(r.totalCartao, 0), cor: COR.s3 },
    ...(r.sobra > 0 ? [{ id: "sobra", rotulo: "Sobra", valor: r.sobra, cor: COR.s4 }] : []),
  ];
  const top = r.categorias.slice(0, 5);
  const resto = soma(r.categorias.slice(5).map((x) => x.valor));
  const detalheSankey = [...top.map((x) => ({ id: x.nome, rotulo: x.nome.charAt(0) + x.nome.slice(1).toLowerCase(), valor: x.valor })), ...(resto > 0 ? [{ id: "outras", rotulo: "Demais", valor: resto }] : [])];

  /* Calendário */
  const [ano, mm] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, mm, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mm - 1, 1).getDay();
  const eventos: { dia: number; rotulo: string; valor: number; tipo: "entrada" | "saida" }[] = [
    ...r.entradas.map((e) => ({ dia: dataEntrada(mes, e).getDate(), rotulo: e.real ? e.nome : `${e.nome} (estimado)`, valor: e.valor, tipo: "entrada" as const })),
    ...(r.cartaoXP !== 0 ? [{ dia: dados.fatura_vencimento_dia, rotulo: "Fatura XP", valor: r.cartaoXP, tipo: "saida" as const }] : []),
    ...(r.cartaoNubank !== 0 ? [{ dia: dados.fatura_vencimento_dia_nubank ?? 22, rotulo: "Fatura Nubank", valor: r.cartaoNubank, tipo: "saida" as const }] : []),
    ...dados.despesas_fixas.filter((f) => f.dia).map((f) => ({ dia: f.dia as number, rotulo: f.nome, valor: f.valor, tipo: "saida" as const })),
    ...r.boletos.filter((b) => b.dia).map((b) => ({ dia: b.dia as number, rotulo: b.nome, valor: b.valor, tipo: "saida" as const })),
    ...r.foraCartao.filter((v) => v.dia && v.valor !== null).map((v) => ({ dia: v.dia as number, rotulo: v.nome, valor: v.valor as number, tipo: "saida" as const })),
  ];
  const semDia = [...dados.despesas_fixas.filter((f) => !f.dia), ...r.boletos.filter((b) => !b.dia), ...r.foraCartao.filter((v) => !v.dia && v.valor !== null)];

  const sPoup = statusPoupanca(r.taxaPoupanca);
  const sComp = statusComprometimento(r.comprometimento, dados.limite_comprometimento);
  const sTeto = statusTeto(r.usoTeto);
  const sRes = statusReserva(c.mesesCobertos, dados.reserva.meta_meses);
  // contas fora do cartão do mês: fixas + boletos/financiamentos + contas variáveis (energia)
  const fixos: LinhaFixa[] = [
    ...dados.despesas_fixas.map((f) => ({ dia: f.dia, descricao: f.nome, tipo: "Fixa", valor: f.valor })),
    ...r.boletos.map((b) => ({ dia: b.dia, descricao: b.nome, tipo: `Parcela ${b.parcela}`, valor: b.valor })),
    ...r.foraCartao.filter((v) => v.valor !== null).map((v) => ({ dia: v.dia, descricao: v.nome, tipo: "Conta variável", valor: v.valor as number, obs: v.obs })),
  ];
  const totalFixos = soma(fixos.map((f) => f.valor));

  return (
    <ProvedorDica>
      <header className="topo">
        <div className="topo-esq">
          <span className="usuario">{dados.nome}</span>
        </div>
        <h1 className="topo-titulo">Finanças</h1>
        <div className="topo-acoes">
          <button className="botao-icone" onClick={() => janela.current?.showModal()} aria-label="Lançamentos">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="botao-rotulo">Lançamentos</span>
          </button>
          <button className="botao-icone" onClick={() => setGaveta(true)} aria-label="Filtros" aria-expanded={gaveta}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="botao-rotulo">Filtros</span>
            {filtrosAtivos > 0 && <span className="badge num">{filtrosAtivos}</span>}
          </button>
        </div>
      </header>

      {/* ===== Painel lateral de filtros ===== */}
      <div className={`gaveta-fundo ${gaveta ? "aberta" : ""}`} onClick={() => setGaveta(false)} aria-hidden="true" />
      <aside className={`gaveta ${gaveta ? "aberta" : ""}`} aria-label="Filtros" aria-hidden={!gaveta} inert={!gaveta}>
        <header className="gaveta-cabecalho">
          <h2>Filtros</h2>
          <button className="botao-fechar" onClick={() => setGaveta(false)} aria-label="Fechar filtros">
            ✕
          </button>
        </header>
        <div className="gaveta-corpo">
          <section className="filtro">
            <h3>Mês</h3>
            <div className="cal-filtro">
              <div className="cal-filtro-ano">
                <button onClick={() => setAnoCal(anoCal - 1)} disabled={anoCal <= Number(limites.primeiro.slice(0, 4))} aria-label="Ano anterior">
                  ‹
                </button>
                <strong className="num">{anoCal}</strong>
                <button onClick={() => setAnoCal(anoCal + 1)} disabled={anoCal >= Number(limites.ultimo.slice(0, 4))} aria-label="Próximo ano">
                  ›
                </button>
              </div>
              <div className="cal-filtro-meses">
                {Array.from({ length: 12 }).map((_, i) => {
                  const m = `${anoCal}-${String(i + 1).padStart(2, "0")}`;
                  const existe = m >= limites.primeiro && m <= limites.ultimo;
                  return (
                    <button key={m} className={`${m === mes ? "ativo" : ""} ${m === mesHoje ? "atual" : ""}`} disabled={!existe} onClick={() => setMes(m)}>
                      {rotuloMes(m).slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {mes !== mesHoje && mesHoje <= limites.ultimo && (
                <button
                  className="link"
                  onClick={() => {
                    setMes(mesHoje);
                    setAnoCal(Number(mesHoje.slice(0, 4)));
                  }}
                >
                  Voltar para o mês atual
                </button>
              )}
            </div>
          </section>

          <section className="filtro">
            <h3>Usuário</h3>
            <div className="opcoes">
              {PESSOAS.map((p) => (
                <button key={p} className={p === pessoa ? "ativo" : ""} onClick={() => p !== pessoa && trocar(p)}>
                  {BASES[p].nome}
                </button>
              ))}
            </div>
          </section>

          <section className="filtro">
            <h3>Cartão</h3>
            <div className="opcoes">
              {(["TODOS", "XP", "NUBANK"] as const).map((b) => (
                <button key={b} className={banco === b ? "ativo" : ""} onClick={() => setBanco(b)}>
                  {b === "TODOS" ? "Todos" : b === "XP" ? "XP" : "Nubank"}
                </button>
              ))}
            </div>
          </section>

          <section className="filtro">
            <h3>Categoria</h3>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="TODAS">Todas as categorias</option>
              {categoriasTodas.map((x) => (
                <option key={x} value={x}>
                  {x.charAt(0) + x.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </section>

          {filtrosAtivos > 0 && (
            <button className="limpar" onClick={limparFiltros}>
              Limpar filtros ({filtrosAtivos})
            </button>
          )}
        </div>
        <footer className="gaveta-rodape">
          <strong>Última atualização</strong>
          <span>Dados: {dataLonga(dados.gerado_em)}</span>
          <span>Reserva: {dataLonga(dados.reserva.atualizado)}</span>
        </footer>
      </aside>

      <main className="conteudo">
        {(banco !== "TODOS" || categoria !== "TODAS") && (
          <div className="filtro-ativo">
            Filtrando:
            {banco !== "TODOS" && <span className="chip">{banco === "XP" ? "Cartão XP" : "Nubank"}</span>}
            {categoria !== "TODAS" && <span className="chip">{categoria.charAt(0) + categoria.slice(1).toLowerCase()}</span>}
            <button
              className="link"
              onClick={() => {
                setBanco("TODOS");
                setCategoria("TODAS");
              }}
            >
              limpar
            </button>
          </div>
        )}
        {/* ===== Indicadores ===== */}
        <div className="grade-kpi">
          {/* Sobra */}
          <section className="card kpi kpi-heroi" tabIndex={0} aria-label="Sobra do mês — detalhes">
            <h3 className="card-titulo">Sobra de {mesLongo(mes)}</h3>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className={`heroi ${r.sobra < 0 ? "neg" : ""}`}>{brl(r.sobra)}</p>
                <Delta dif={r.sobra - anterior.sobra} texto={brl(Math.abs(r.sobra - anterior.sobra))} sobeBom vs={rotuloMes(anterior.mes)} />
              </div>
              <div className="kpi-grafico">
                <Sparkline valores={hist6.map((x) => x.sobra)} rotulos={rotHist} formatar={brl} />
              </div>
            </div>
            <Pop>
              <PopGrupo titulo="Entrou">
                {r.entradas.map((e) => (
                  <PopLinha key={e.nome} rotulo={`${e.nome}${e.real ? "" : " (estimado)"}`} valor={brl(e.valor)} />
                ))}
                <PopLinha rotulo="Total" valor={brl(r.receitas)} forte />
              </PopGrupo>
              <PopGrupo titulo="Saiu">
                <PopLinha rotulo="Despesas fixas" valor={brl(r.fixas)} />
                {r.totalBoletos > 0 && <PopLinha rotulo="Boletos e financiamentos" valor={brl(r.totalBoletos)} />}
                <PopLinha rotulo="Cartão à vista" valor={brl(r.cartaoAVista)} />
                {r.cartaoParcelado > 0 && <PopLinha rotulo="Parcelas do cartão" valor={brl(r.cartaoParcelado)} />}
                {r.foraCartao.map((v) => (
                  <PopLinha key={v.nome} rotulo={v.nome} valor={v.valor === null ? "aguardando" : brl(v.valor)} />
                ))}
                <PopLinha rotulo="Total" valor={brl(r.saidas)} forte />
              </PopGrupo>
              <PopGrupo titulo="Comparação">
                <PopLinha rotulo={`Sobra em ${rotuloMes(anterior.mes)}`} valor={brl(anterior.sobra)} />
                <PopLinha rotulo={`Média dos ${c.prev6.length} meses anteriores`} valor={brl(c.mediaSobra)} />
              </PopGrupo>
            </Pop>
          </section>

          {/* Taxa de poupança */}
          <section className="card kpi" tabIndex={0} aria-label="Taxa de poupança — detalhes">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Taxa de poupança</h3>
              <Selo status={sPoup} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">{pct(r.taxaPoupanca, 1)}</p>
                <Delta dif={r.taxaPoupanca - anterior.taxaPoupanca} texto={pp(r.taxaPoupanca - anterior.taxaPoupanca)} sobeBom vs={rotuloMes(anterior.mes)} />
              </div>
              <div className="kpi-grafico">
                <Sparkline valores={hist6.map((x) => x.taxaPoupanca)} rotulos={rotHist} formatar={(v) => pct(v, 1)} />
              </div>
            </div>
            <Pop>
              <PopGrupo titulo="Como é calculada">
                <PopLinha rotulo="Sobra do mês" valor={brl(r.sobra)} />
                <PopLinha rotulo="÷ Receitas" valor={brl(r.receitas)} />
                <PopLinha rotulo="= Taxa de poupança" valor={pct(r.taxaPoupanca, 1)} forte />
              </PopGrupo>
              <PopGrupo titulo="Meta">
                <PopLinha rotulo="Meta (20% das receitas)" valor={brl(0.2 * r.receitas)} />
                <PopLinha
                  rotulo={r.taxaPoupanca >= 0.2 ? "Acima da meta" : "Falta para a meta"}
                  valor={brl(Math.abs(r.sobra - 0.2 * r.receitas))}
                  tom={r.taxaPoupanca >= 0.2 ? "bom" : "ruim"}
                />
                <PopNota>≥ 20% saudável · 10–20% atenção · 0–10% alto · negativa crítico</PopNota>
              </PopGrupo>
              <PopGrupo titulo="Comparação">
                <PopLinha rotulo={rotuloMes(anterior.mes)} valor={pct(anterior.taxaPoupanca, 1)} />
                <PopLinha rotulo={`Média dos ${c.prev6.length} meses anteriores`} valor={pct(c.mediaTaxa, 1)} />
              </PopGrupo>
            </Pop>
          </section>

          {/* Renda comprometida */}
          <section className="card kpi" tabIndex={0} aria-label="Renda comprometida — detalhes">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Renda comprometida</h3>
              <Selo status={sComp} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">{pct(r.comprometimento, 1)}</p>
                <Delta dif={r.comprometimento - anterior.comprometimento} texto={pp(r.comprometimento - anterior.comprometimento)} vs={rotuloMes(anterior.mes)} />
              </div>
              <div className="kpi-grafico">
                <Sparkline valores={hist6.map((x) => x.comprometimento)} rotulos={rotHist} formatar={(v) => pct(v, 1)} />
              </div>
            </div>
            <Pop>
              <PopGrupo titulo="Parcelas e boletos do mês">
                {r.cartaoParcelado > 0 && <PopLinha rotulo="Parcelas no cartão" valor={brl(r.cartaoParcelado)} />}
                {r.boletos.map((b) => (
                  <PopLinha key={b.nome + b.parcela} rotulo={`${b.nome} ${b.parcela}`} valor={brl(b.valor)} />
                ))}
                <PopLinha rotulo="Total comprometido" valor={brl(r.comprometido)} forte />
              </PopGrupo>
              <PopGrupo titulo="Limite">
                <PopLinha rotulo={`Limite (${pct(dados.limite_comprometimento)} das receitas)`} valor={brl(limiteComprometimento)} />
                <PopLinha
                  rotulo={r.comprometido > limiteComprometimento ? "Acima do limite" : "Folga até o limite"}
                  valor={brl(Math.abs(r.comprometido - limiteComprometimento))}
                  tom={r.comprometido > limiteComprometimento ? "ruim" : "bom"}
                />
              </PopGrupo>
              <PopGrupo titulo="Próximos meses">
                {futuros.slice(1, 4).map((f) => (
                  <PopLinha key={f.mes} rotulo={rotuloMes(f.mes)} valor={`${brl(f.total)} · ${pct(f.total / r.receitas)}`} />
                ))}
              </PopGrupo>
            </Pop>
          </section>

          {/* Cartão × teto */}
          <section className="card kpi" tabIndex={0} aria-label="Cartão e teto — detalhes">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Cartão × teto</h3>
              <Selo status={sTeto} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">{pct(r.usoTeto)}</p>
                <Delta dif={r.usoTeto - anterior.usoTeto} texto={pp(r.usoTeto - anterior.usoTeto)} vs={rotuloMes(anterior.mes)} />
              </div>
              <div className="kpi-grafico">
                {/* medidor 0–200%: azul até o teto (metade da barra), vermelho no que passar; traço = teto */}
                <div className="medidor medidor-teto" role="img" aria-label={`${pct(r.usoTeto)} do teto de ${brlInteiro(dados.teto_cartao)}`}>
                  <div className="medidor-dentro" style={{ width: `${(Math.min(r.usoTeto, 1) / 2) * 100}%` }} />
                  {r.usoTeto > 1 && <div className="medidor-acima" style={{ left: "50%", width: `${((Math.min(r.usoTeto, 2) - 1) / 2) * 100}%` }} />}
                  <span className="medidor-marca" aria-hidden="true" />
                </div>
              </div>
            </div>
            <Pop>
              <PopGrupo titulo={`Fatura de ${rotuloMes(mes)} (vence ${ddmm(new Date(ano, mm - 1, dados.fatura_vencimento_dia))})`}>
                <PopLinha rotulo="Compras à vista" valor={brl(r.cartaoAVista)} />
                <PopLinha rotulo="Parcelas" valor={brl(r.cartaoParcelado)} />
                <PopLinha rotulo="Total da fatura XP" valor={brl(r.cartaoXP)} forte />
                {r.cartaoNubank !== 0 && <PopLinha rotulo="Fatura Nubank (fora do teto)" valor={brl(r.cartaoNubank)} />}
                <PopLinha rotulo="Teto (inclui parcelas)" valor={brl(dados.teto_cartao)} />
                <PopLinha
                  rotulo={r.cartaoXP > dados.teto_cartao ? "Acima do teto" : "Sobra no teto"}
                  valor={brl(Math.abs(r.cartaoXP - dados.teto_cartao))}
                  tom={r.cartaoXP > dados.teto_cartao ? "ruim" : "bom"}
                />
              </PopGrupo>
              <PopGrupo titulo="Maiores categorias">
                {r.categorias.slice(0, 4).map((x) => (
                  <PopLinha key={x.nome} rotulo={x.nome.charAt(0) + x.nome.slice(1).toLowerCase()} valor={brl(x.valor)} />
                ))}
              </PopGrupo>
              <PopGrupo titulo="Comparação">
                <PopLinha rotulo={`Fatura de ${rotuloMes(anterior.mes)}`} valor={`${brl(anterior.cartaoXP)} · ${pct(anterior.usoTeto)}`} />
              </PopGrupo>
            </Pop>
          </section>

          {/* Reserva de emergência */}
          <section className="card kpi kpi-ultimo" tabIndex={0} aria-label="Reserva de emergência — detalhes">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Reserva de emergência</h3>
              <Selo status={sRes} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">
                  {c.mesesCobertos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <small>de {dados.reserva.meta_meses} meses</small>
                </p>
                <p className="kpi-delta">{pct(c.reservaAtual / c.metaReserva)} da meta</p>
              </div>
              <div className="kpi-grafico">
                <div className="medidor" role="img" aria-label={`${pct(c.reservaAtual / c.metaReserva)} da meta`}>
                  <div style={{ width: `${Math.min(100, (c.reservaAtual / c.metaReserva) * 100)}%` }} />
                </div>
              </div>
            </div>
            <Pop>
              <PopGrupo titulo="Onde está">
                {dados.reserva.contas.map((x) => (
                  <PopLinha key={x.nome} rotulo={x.nome} valor={brl(x.valor)} />
                ))}
                <PopLinha rotulo="Total" valor={brl(c.reservaAtual)} forte />
              </PopGrupo>
              <PopGrupo titulo="Meta">
                <PopLinha rotulo="Gasto médio por mês" valor={brl(c.custoMensal)} />
                <PopLinha rotulo={`Meta (${dados.reserva.meta_meses} meses de gastos)`} valor={brl(c.metaReserva)} />
                <PopLinha rotulo="Você já tem" valor={`${brl(c.reservaAtual)} · ${pct(c.reservaAtual / c.metaReserva)}`} />
                <PopLinha rotulo="Faltam" valor={brl(faltaReserva)} tom={faltaReserva > 0 ? "ruim" : "bom"} />
              </PopGrupo>
              {faltaReserva > 0 && (
                <PopGrupo titulo="Previsão">
                  <PopLinha rotulo="Sobra média por mês" valor={brl(c.mediaSobra)} />
                  <PopLinha
                    rotulo="Meta atingida em"
                    valor={c.mesesParaMeta === null ? "sem sobra" : `~${c.mesesParaMeta} meses · ${rotuloMes(somaMes(mesHoje, c.mesesParaMeta)).toLowerCase()}`}
                  />
                  {[12, 24].map((n) => (
                    <PopLinha key={n} rotulo={`Para chegar em ${n} meses`} valor={`${brl(faltaReserva / n)}/mês`} />
                  ))}
                </PopGrupo>
              )}
            </Pop>
          </section>
        </div>


        {/* ===== O mês ===== */}
        <div className="grade-2 largo-esq mesma-altura">
          <Painel titulo="Do salário à sobra" subtitulo={`Como as receitas de ${mesLongo(mes)} foram consumidas`}>
            <Cascata passos={passos} />
          </Painel>
          <Painel titulo="Calendário" subtitulo="Entradas e vencimentos">
            <div className="cal-semana" aria-hidden="true">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="cal-cab">
                  {d}
                </div>
              ))}
            </div>
            <div className="calendario" role="grid" aria-label={`Calendário de ${mesLongo(mes)}`}>
              {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
                <div key={`v${i}`} />
              ))}
              {Array.from({ length: diasNoMes }).map((_, i) => {
                const dia = i + 1;
                const evs = eventos.filter((e) => e.dia === dia);
                const ehHoje = mes === mesHoje && dia === hoje.getDate();
                const classe = `cal-dia ${evs.length ? "tem" : ""} ${ehHoje ? "hoje" : ""}`;
                // entradas uma a uma; saídas do dia somadas num valor só (o detalhe fica na dica)
                const saidasDia = soma(evs.filter((e) => e.tipo === "saida").map((e) => e.valor));
                const conteudo = (
                  <>
                    <span className="cal-num">{dia}</span>
                    {evs
                      .filter((e) => e.tipo === "entrada")
                      .map((e) => (
                        <span key={e.rotulo} className="cal-ev entrada">
                          +{brlInteiro(e.valor).replace("R$", "").trim()}
                        </span>
                      ))}
                    {saidasDia > 0 && <span className="cal-ev saida">−{brlInteiro(saidasDia).replace("R$", "").trim()}</span>}
                  </>
                );
                if (!evs.length)
                  return (
                    <div key={dia} className={classe}>
                      {conteudo}
                    </div>
                  );
                const data = new Date(ano, mm - 1, dia);
                // dica no dia: nome e valor exato de cada lançamento (substitui a lista que ficava embaixo)
                return (
                  <ComDica
                    key={dia}
                    className={classe}
                    titulo={`${DIAS_SEMANA[data.getDay()]}, ${ddmm(data)}`}
                    linhas={evs.map((e) => ({
                      rotulo: e.rotulo,
                      valor: `${e.tipo === "entrada" ? "+" : "−"}${brl(e.valor)}`,
                      cor: e.tipo === "entrada" ? "var(--cascata-entrada)" : "var(--cascata-saida)",
                    }))}
                  >
                    {conteudo}
                  </ComDica>
                );
              })}
            </div>
            {semDia.length > 0 && <p className="cal-sem-dia">Sem dia definido: {semDia.map((s) => s.nome).join(", ")}</p>}
          </Painel>
        </div>

        <div className="grade-2 largo-esq mesma-altura">
          <Painel titulo="Para onde foi o dinheiro" subtitulo="Receitas → grupos → categorias do cartão">
            <Sankey entradas={entradasSankey} grupos={gruposSankey} detalhe={detalheSankey} idDetalhe="cartao" />
          </Painel>
          <Painel titulo="Categorias do cartão" subtitulo={`Este mês (barra) × média dos ${c.prev6.length} meses anteriores (traço)`}>
            <CategoriasAjustadas cats={c.cats} formatar={brl} formatarPct={(v) => pct(v)} />
          </Painel>
        </div>

        <div className="grade-2">
          <Painel titulo="Evolução" subtitulo={`Últimos ${hist.length} meses até ${rotuloMes(mes)}`}>
            <Evolucao meses={hist.map((x) => ({ mes: x.mes, receitas: x.receitas, saidas: x.saidas, sobra: x.sobra }))} />
          </Painel>
          <Painel titulo="Compromissos já assumidos" subtitulo="Parcelas, boletos e financiamentos nos próximos 12 meses">
            <Futuros meses={futuros} limite={limiteComprometimento} />
          </Painel>
        </div>

      </main>

      {/* ===== Janela de lançamentos ===== */}
      <dialog
        ref={janela}
        className="janela"
        aria-labelledby="janela-titulo"
        onClick={(e) => {
          if (e.target === e.currentTarget) janela.current?.close(); // clique fora fecha
        }}
      >
        <div className="janela-corpo">
          <header className="janela-cabecalho">
            <h2 id="janela-titulo">Lançamentos de {rotuloMes(mes)}</h2>
            <div className="janela-acoes">
              {/* total do mês: contas fora do cartão + cartões (o detalhe fica na dica) */}
              <span className="janela-total num" title={`Contas ${brl(totalFixos)} + cartões ${brl(r.totalCartao)}`}>
                {brl(totalFixos + r.totalCartao)}
              </span>
              <button className="botao-fechar" onClick={() => janela.current?.close()} aria-label="Fechar">
                ✕
              </button>
            </div>
          </header>
          <div className="janela-tabelas">
            <section>
              <h3 className="janela-secao">
                Contas fora do cartão
              </h3>
              <div className="tabela-wrap">
                <TabelaOrdenavel
                  colunas={[
                    { chave: "dia", rotulo: "Dia", ordem: (l: LinhaFixa) => l.dia ?? 99, celula: (l: LinhaFixa) => (l.dia ? String(l.dia).padStart(2, "0") : "—"), classe: "num" },
                    { chave: "descricao", rotulo: "Descrição", ordem: (l: LinhaFixa) => l.descricao, classe: "estab" },
                    { chave: "tipo", rotulo: "Tipo", ordem: (l: LinhaFixa) => l.tipo, celula: (l: LinhaFixa) => <span className="tag">{l.tipo}</span> },
                    { chave: "obs", rotulo: "Observação", ordem: (l: LinhaFixa) => l.obs ?? "", classe: "obs" },
                    { chave: "valor", rotulo: "Valor", ordem: (l: LinhaFixa) => l.valor, celula: (l: LinhaFixa) => brl(l.valor), direita: true, classe: "num" },
                  ]}
                  linhas={fixos}
                  ordemInicial={{ chave: "dia", desc: false }}
                  vazio="Nenhuma conta fora do cartão neste mês."
                  rodape={
                    <tr>
                      <td colSpan={4}>Total</td>
                      <td className="dir num">{brl(totalFixos)}</td>
                    </tr>
                  }
                />
              </div>
            </section>
            <section>
              <h3 className="janela-secao">
                Cartões
              </h3>
              <div className="tabela-wrap">
                <TabelaOrdenavel
                  colunas={[
                    { chave: "data", rotulo: "Data", ordem: (t: Transacao) => t.data, celula: (t: Transacao) => isoParaBR(t.data), classe: "num" },
                    { chave: "banco", rotulo: "Cartão", ordem: (t: Transacao) => t.banco, celula: (t: Transacao) => <span className="tag">{t.banco === "XP" ? "XP" : "Nubank"}</span> },
                    { chave: "estab", rotulo: "Estabelecimento", ordem: (t: Transacao) => t.estabelecimento, classe: "estab" },
                    {
                      chave: "categoria",
                      rotulo: "Categoria",
                      ordem: (t: Transacao) => t.categoria,
                      celula: (t: Transacao) => (
                        <span className={`tag ${t.a_confirmar ? "confirmar" : ""}`} title={t.a_confirmar ? "Categoria a confirmar" : undefined}>
                          {t.categoria}
                          {t.a_confirmar ? " ?" : ""}
                        </span>
                      ),
                    },
                    { chave: "parcela", rotulo: "Parcela", ordem: (t: Transacao) => (ehParcelado(t) ? t.parcela : ""), classe: "num" },
                    {
                      chave: "valor",
                      rotulo: "Valor",
                      ordem: (t: Transacao) => t.valor,
                      celula: (t: Transacao) =>
                        t.split ? (
                          <span
                            title={
                              t.valor_fatura !== undefined
                                ? `Na fatura ${brl(t.valor_fatura)} ${(t.ajuste ?? 0) < 0 ? "−" : "+"} ${brl(Math.abs(t.ajuste ?? 0))} (${t.obs ?? "ajuste"}) = ${brl(t.valor_bruto ?? 0)}, dividido 50/50`
                                : `Total na fatura ${brl(t.valor_bruto ?? 0)}, dividido 50/50`
                            }
                          >
                            {t.valor_fatura !== undefined && <span className="tag">ajuste</span>} <span className="tag">{t.split}</span> {brl(t.valor)}
                          </span>
                        ) : (
                          <span className={t.valor < 0 ? "delta-bom" : ""}>{brl(t.valor)}</span>
                        ),
                      direita: true,
                      classe: "num",
                    },
                  ]}
                  linhas={r.cartao}
                  ordemInicial={{ chave: "data", desc: true }}
                  vazio="Nenhum lançamento nesta fatura."
                  rodape={
                    <tr>
                      <td colSpan={5}>Total</td>
                      <td className="dir num">{brl(r.totalCartao)}</td>
                    </tr>
                  }
                />
              </div>
            </section>
          </div>
        </div>
      </dialog>
    </ProvedorDica>
  );
}
