"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dadosJson from "../data/henrique.json";
import {
  DIAS_SEMANA,
  ICONE_STATUS,
  ROTULO_STATUS,
  brl,
  brlInteiro,
  compromissosFuturos,
  ddmm,
  diaUtilAntes,
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
  type Status,
} from "../lib/financas";
import { Bullet, COR, Cascata, ComDica, Evolucao, Futuros, ProvedorDica, Sankey, Sparkline, TabelaEquivalente } from "./graficos";

const dados = dadosJson as Dados;
const limites = limitesDosDados(dados);

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

export default function Pagina() {
  const hoje = useMemo(() => new Date(), []);
  const mesHoje = mesDe(hoje);
  const [mes, setMes] = useState(mesHoje < limites.ultimo ? mesHoje : limites.ultimo);
  const janela = useRef<HTMLDialogElement>(null);
  // atalho: .../financas#lancamentos já abre a janela
  useEffect(() => {
    if (window.location.hash === "#lancamentos") janela.current?.showModal();
  }, []);

  const c = useMemo(() => {
    const r = resumoMes(dados, mes);
    const anterior = resumoMes(dados, somaMes(mes, -1));
    const hist = mesesAte(mes, 12, limites.primeiro).map((m) => resumoMes(dados, m));
    const prev6 = mesesAte(somaMes(mes, -1), 6, limites.primeiro).map((m) => resumoMes(dados, m));
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

    return { r, anterior, hist, prev6, mediaSaidas, mediaSobra, cats, reservaAtual, custoMensal, metaReserva, mesesCobertos, mesesParaMeta };
  }, [mes]);

  const { r, anterior, hist } = c;
  const futuros = compromissosFuturos(dados, mes, 12);
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
    { id: "cartao", rotulo: "Cartão XP", valor: Math.max(r.totalCartao, 0), cor: COR.s3 },
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
    ...r.entradas.map((e) => ({ dia: diaUtilAntes(mes, e.dia).getDate(), rotulo: e.real ? e.nome : `${e.nome} (estimado)`, valor: e.valor, tipo: "entrada" as const })),
    { dia: dados.fatura_vencimento_dia, rotulo: "Fatura XP", valor: r.totalCartao, tipo: "saida" as const },
    ...dados.despesas_fixas.filter((f) => f.dia).map((f) => ({ dia: f.dia as number, rotulo: f.nome, valor: f.valor, tipo: "saida" as const })),
    ...r.boletos.filter((b) => b.dia).map((b) => ({ dia: b.dia as number, rotulo: b.nome, valor: b.valor, tipo: "saida" as const })),
    ...r.foraCartao.filter((v) => v.dia && v.valor !== null).map((v) => ({ dia: v.dia as number, rotulo: v.nome, valor: v.valor as number, tipo: "saida" as const })),
  ];
  const semDia = [...dados.despesas_fixas.filter((f) => !f.dia), ...r.boletos.filter((b) => !b.dia), ...r.foraCartao.filter((v) => !v.dia && v.valor !== null)];

  const deltaSobra = r.sobra - anterior.sobra;
  const sPoup = statusPoupanca(r.taxaPoupanca);
  const sComp = statusComprometimento(r.comprometimento, dados.limite_comprometimento);
  const sTeto = statusTeto(r.usoTeto);
  const sRes = statusReserva(c.mesesCobertos, dados.reserva.meta_meses);
  const maxCat = Math.max(1, ...c.cats.map((x) => Math.max(x.atual, x.media)));
  const txOrdenadas = [...r.cartao].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <ProvedorDica>
      <header className="topo">
        <h1>
          Finanças <span>· Henrique</span>
        </h1>
        <button className="botao-lancamentos" onClick={() => janela.current?.showModal()}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Lançamentos <span className="contador num">{txOrdenadas.length}</span>
        </button>
        <nav className="seletor-mes" aria-label="Mês">
          <button onClick={() => setMes(somaMes(mes, -1))} disabled={mes <= limites.primeiro} aria-label="Mês anterior">
            ‹
          </button>
          <span className="rotulo">{rotuloMes(mes)}</span>
          <button onClick={() => setMes(somaMes(mes, 1))} disabled={mes >= limites.ultimo} aria-label="Próximo mês">
            ›
          </button>
          {mes !== mesHoje && (
            <button className="hoje" onClick={() => setMes(mesHoje)}>
              Hoje
            </button>
          )}
        </nav>
      </header>

      <main className="conteudo">
        {/* ===== Indicadores ===== */}
        <div className="grade-kpi">
          <section className="card kpi kpi-heroi">
            <h3 className="card-titulo">Sobra de {mesLongo(mes)}</h3>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className={`heroi ${r.sobra < 0 ? "neg" : ""}`}>{brl(r.sobra)}</p>
                <p className="kpi-ref">
                  <span className={deltaSobra >= 0 ? "delta-bom" : "delta-ruim"}>
                    {deltaSobra >= 0 ? "▲" : "▼"} {brl(Math.abs(deltaSobra))}
                  </span>{" "}
                  vs. {rotuloMes(anterior.mes)}
                </p>
                <p className="kpi-ref">
                  entrou {brlInteiro(r.receitas)} · saiu {brlInteiro(r.saidas)}
                </p>
              </div>
              <div className="kpi-grafico">
                <Sparkline valores={hist6.map((x) => x.sobra)} rotulos={rotHist} formatar={brl} />
              </div>
            </div>
          </section>

          <section className="card kpi">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Taxa de poupança</h3>
              <Selo status={sPoup} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">{pct(r.taxaPoupanca, 1)}</p>
                <p className="kpi-ref">meta: 20% ou mais</p>
              </div>
              <div className="kpi-grafico">
                <Sparkline valores={hist6.map((x) => x.taxaPoupanca)} rotulos={rotHist} formatar={(v) => pct(v, 1)} />
              </div>
            </div>
          </section>

          <section className="card kpi">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Renda comprometida</h3>
              <Selo status={sComp} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">{pct(r.comprometimento, 1)}</p>
                <p className="kpi-ref">
                  {brlInteiro(r.comprometido)} · limite {pct(dados.limite_comprometimento)}
                </p>
              </div>
              <div className="kpi-grafico">
                <Sparkline valores={hist6.map((x) => x.comprometimento)} rotulos={rotHist} formatar={(v) => pct(v, 1)} />
              </div>
            </div>
          </section>

          <section className="card kpi">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Cartão × teto</h3>
              <Selo status={sTeto} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">{pct(r.usoTeto)}</p>
                <p className="kpi-ref">
                  {r.totalCartao > dados.teto_cartao
                    ? `${brlInteiro(r.totalCartao - dados.teto_cartao)} acima do teto`
                    : `sobram ${brlInteiro(dados.teto_cartao - r.totalCartao)} do teto`}
                </p>
              </div>
              <div className="kpi-grafico">
                <Bullet valor={r.totalCartao} meta={dados.teto_cartao} max={Math.max(dados.teto_cartao * 1.6, r.totalCartao * 1.05)} faixas={[dados.teto_cartao * 0.85, dados.teto_cartao]} formatar={brl} rotuloMeta="teto" />
              </div>
            </div>
          </section>

          <section className="card kpi">
            <div className="kpi-cabecalho">
              <h3 className="card-titulo">Reserva de emergência</h3>
              <Selo status={sRes} />
            </div>
            <div className="kpi-corpo">
              <div className="kpi-texto">
                <p className="kpi-valor">
                  {c.mesesCobertos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <small>de {dados.reserva.meta_meses} meses</small>
                </p>
                <p className="kpi-ref" title={c.mesesParaMeta === null ? "sem sobra média para guardar" : `~${c.mesesParaMeta} meses para a meta guardando a sobra média de ${brlInteiro(c.mediaSobra)} por mês`}>
                  {brlInteiro(c.reservaAtual)} de {brlInteiro(c.metaReserva)}
                </p>
              </div>
              <div className="kpi-grafico">
                <div className="medidor" role="img" aria-label={`${pct(c.reservaAtual / c.metaReserva)} da meta`}>
                  <div style={{ width: `${Math.min(100, (c.reservaAtual / c.metaReserva) * 100)}%` }} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ===== O mês ===== */}
        <div className="grade-2 largo-esq">
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
                const conteudo = (
                  <>
                    <span className="cal-num">{dia}</span>
                    {evs.map((e) => (
                      <span key={e.rotulo} className={`cal-ev ${e.tipo}`}>
                        {e.tipo === "entrada" ? "+" : "−"}
                        {brlInteiro(e.valor).replace("R$", "").trim()}
                      </span>
                    ))}
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

        <div className="grade-2 largo-esq">
          <Painel titulo="Para onde foi o dinheiro" subtitulo="Receitas → grupos → categorias do cartão">
            <Sankey entradas={entradasSankey} grupos={gruposSankey} detalhe={detalheSankey} idDetalhe="cartao" />
          </Painel>
          <Painel titulo="Categorias do cartão" subtitulo={`Este mês (barra) × média dos ${c.prev6.length} meses anteriores (traço)`}>
            <ul className="cat-bullets">
              {c.cats.slice(0, 8).map((x) => {
                const dif = x.media > 0 ? (x.atual - x.media) / x.media : null;
                return (
                  <li key={x.nome}>
                    <div className="cat-linha">
                      <span className="cat-nome">{x.nome.charAt(0) + x.nome.slice(1).toLowerCase()}</span>
                      <span className="num">{brl(x.atual)}</span>
                    </div>
                    <div className="cat-trilho" aria-hidden="true">
                      <div className="cat-barra" style={{ width: `${(x.atual / maxCat) * 100}%` }} />
                      {x.media > 0 && <div className="cat-media" style={{ left: `${(x.media / maxCat) * 100}%` }} />}
                    </div>
                    <div className="cat-ref num">
                      média {brl(x.media)}
                      {dif !== null && Math.abs(dif) >= 0.05 && (
                        <span className={dif > 0 ? "delta-ruim" : "delta-bom"}>
                          {" "}
                          · {dif > 0 ? "▲" : "▼"} {pct(Math.abs(dif))}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {c.cats.length > 8 && <p className="cat-ref">+{c.cats.length - 8} categorias menores na tabela abaixo.</p>}
            <TabelaEquivalente cabecalho={["Categoria", "Este mês", "Média 6m"]} linhas={c.cats.map((x) => [x.nome, brl(x.atual), brl(x.media)])} />
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

        <p className="rodape">
          Dados gerados em {ddmm(new Date(dados.gerado_em + "T12:00:00"))} · reserva atualizada em {ddmm(new Date(dados.reserva.atualizado + "T12:00:00"))}
        </p>
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
            <div>
              <h2 id="janela-titulo">Lançamentos da fatura de {rotuloMes(mes)}</h2>
              <p className="num">
                {txOrdenadas.length} lançamentos · {brl(r.totalCartao)} · vence {ddmm(new Date(ano, mm - 1, dados.fatura_vencimento_dia))}
              </p>
            </div>
            <button className="botao-fechar" onClick={() => janela.current?.close()} aria-label="Fechar">
              ✕
            </button>
          </header>
          <div className="tabela-wrap janela-tabela">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Estabelecimento</th>
                  <th>Categoria</th>
                  <th>Parcela</th>
                  <th className="dir">Valor</th>
                </tr>
              </thead>
              <tbody>
                {txOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="vazio">
                      Nenhum lançamento nesta fatura.
                    </td>
                  </tr>
                )}
                {txOrdenadas.map((t, i) => (
                  <tr key={i}>
                    <td className="num">{isoParaBR(t.data)}</td>
                    <td className="estab">{t.estabelecimento}</td>
                    <td>
                      <span className={`tag ${t.a_confirmar ? "confirmar" : ""}`} title={t.a_confirmar ? "Categoria a confirmar" : undefined}>
                        {t.categoria}
                        {t.a_confirmar ? " ?" : ""}
                      </span>
                    </td>
                    <td className="num">{ehParcelado(t) ? t.parcela : ""}</td>
                    <td className={`dir num ${t.valor < 0 ? "delta-bom" : ""}`}>{brl(t.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </dialog>
    </ProvedorDica>
  );
}
