"use client";

/* Gráficos em SVG puro, sem biblioteca. Regras (guia de dataviz):
   marcas finas, barras ≤ 24px com ponta arredondada de 4px, linhas de 2px,
   grade em linha fina sólida, legenda para ≥ 2 séries, dica no hover/foco
   e uma tabela equivalente em cada gráfico. */

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { brl, brlCompacto, brlInteiro, mesCurto, rotuloMes, soma } from "../lib/financas";

/* ===== Dica (tooltip) compartilhada ===== */
interface LinhaDica {
  rotulo: string;
  valor: string;
  cor?: string;
}
interface EstadoDica {
  x: number;
  y: number;
  titulo: string;
  linhas: LinhaDica[];
}
type Mostrar = (e: React.PointerEvent | React.FocusEvent, titulo: string, linhas: LinhaDica[]) => void;

const DicaCtx = createContext<{ mostrar: Mostrar; esconder: () => void }>({ mostrar: () => {}, esconder: () => {} });

export function ProvedorDica({ children }: { children: React.ReactNode }) {
  const [dica, setDica] = useState<EstadoDica | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // Posiciona depois de medir: se não couber à direita/embaixo do mouse, abre para o outro lado.
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || !dica) return;
    const m = 8,
      off = 14;
    const { width: w, height: h } = el.getBoundingClientRect();
    let left = dica.x + off;
    if (left + w > window.innerWidth - m) left = dica.x - off - w;
    let top = dica.y + off;
    if (top + h > window.innerHeight - m) top = dica.y - off - h;
    el.style.left = `${Math.max(m, left)}px`;
    el.style.top = `${Math.max(m, top)}px`;
  }, [dica]);
  const mostrar: Mostrar = (e, titulo, linhas) => {
    let x: number, y: number;
    if ("clientX" in e) {
      x = e.clientX;
      y = e.clientY;
    } else {
      const r = (e.target as Element).getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top;
    }
    setDica({ x, y, titulo, linhas });
  };
  return (
    <DicaCtx.Provider value={{ mostrar, esconder: () => setDica(null) }}>
      {children}
      {dica && (
        <div ref={caixa} className="dica" role="status" style={{ left: dica.x + 14, top: dica.y + 14 }}>
          <div className="dica-titulo">{dica.titulo}</div>
          {dica.linhas.map((l) => (
            <div className="dica-linha" key={l.rotulo}>
              {l.cor && <span className="chave-linha" style={{ background: l.cor }} />}
              <strong className="num">{l.valor}</strong>
              <span>{l.rotulo}</span>
            </div>
          ))}
        </div>
      )}
    </DicaCtx.Provider>
  );
}

function useDica() {
  return useContext(DicaCtx);
}

/** Props de hover + foco por teclado para uma marca. */
function alvo(dica: ReturnType<typeof useDica>, titulo: string, linhas: LinhaDica[]) {
  return {
    tabIndex: 0,
    onPointerMove: (e: React.PointerEvent) => dica.mostrar(e, titulo, linhas),
    onPointerLeave: dica.esconder,
    onFocus: (e: React.FocusEvent) => dica.mostrar(e, titulo, linhas),
    onBlur: dica.esconder,
    "aria-label": `${titulo}: ${linhas.map((l) => `${l.rotulo} ${l.valor}`).join(", ")}`,
  };
}

/** Qualquer bloco HTML com a mesma dica dos gráficos (hover e foco). */
export function ComDica({ titulo, linhas, className, children }: { titulo: string; linhas: LinhaDica[]; className?: string; children: React.ReactNode }) {
  const dica = useDica();
  return (
    <div className={className} {...alvo(dica, titulo, linhas)}>
      {children}
    </div>
  );
}

/* ===== Peças comuns ===== */
export const COR = { s1: "var(--s1)", s2: "var(--s2)", s3: "var(--s3)", s4: "var(--s4)" };

export function Legenda({ itens, tipo = "barra" }: { itens: { rotulo: string; cor: string }[]; tipo?: "barra" | "linha" }) {
  return (
    <ul className="legenda">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <span className={tipo === "linha" ? "chave-linha" : "chave-barra"} style={{ background: i.cor }} />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}


/** Passo "redondo" para os eixos: 1, 2, 2,5 ou 5 × 10ⁿ. */
function passoBonito(bruto: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1e-9))));
  const f = bruto / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function marcas(min: number, max: number, n = 4) {
  const passo = passoBonito((max - min) / n || 1);
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const out: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Coluna com ponta arredondada (4px) e base reta. */
function coluna(x: number, yTopo: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  const yb = yTopo + h;
  return `M${x},${yb} V${yTopo + rr} Q${x},${yTopo} ${x + rr},${yTopo} H${x + w - rr} Q${x + w},${yTopo} ${x + w},${yTopo + rr} V${yb} Z`;
}
/** Barra flutuante (cascata): cantos arredondados nos dois lados. */
function bloco(x: number, y: number, w: number, h: number, r = 3) {
  const rr = Math.min(r, h / 2, w / 2);
  return `M${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x + rr} Q${x},${y + h} ${x},${y + h - rr} V${y + rr} Q${x},${y} ${x + rr},${y} Z`;
}

/* ===== Sparkline ===== */
export function Sparkline({ valores, rotulos, formatar }: { valores: number[]; rotulos: string[]; formatar: (v: number) => string }) {
  const dica = useDica();
  const W = 132,
    H = 52,
    pad = 5;
  if (valores.length < 2) return null;
  const min = Math.min(0, ...valores),
    max = Math.max(...valores, 0.0001);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (valores.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (H - 2 * pad);
  const pts = valores.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const ult = valores.length - 1;
  const base = y(0); // a área vai da linha até o zero
  const area = `M${x(0)},${base} L${pts.replace(/ /g, " L")} L${x(ult)},${base} Z`;
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={area} className="spark-area" />
      {min < 0 && <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="grade" />}
      <polyline points={pts} className="spark-linha" />
      {valores.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === ult ? 4.5 : 3.5} className="spark-ponto" />
      ))}
      {valores.map((v, i) => (
        <rect
          key={i}
          x={x(i) - (W - 2 * pad) / (valores.length - 1) / 2}
          y={0}
          width={(W - 2 * pad) / (valores.length - 1)}
          height={H}
          fill="transparent"
          onPointerMove={(e) => dica.mostrar(e, rotulos[i], [{ rotulo: "", valor: formatar(v) }])}
          onPointerLeave={dica.esconder}
        />
      ))}
    </svg>
  );
}

/* ===== Bullet (realizado × meta, com faixas) ===== */
export function Bullet({ valor, meta, max, faixas, formatar, rotuloMeta }: { valor: number; meta: number; max: number; faixas: number[]; formatar: (v: number) => string; rotuloMeta: string }) {
  const W = 260,
    H = 34;
  const x = (v: number) => (Math.min(Math.max(v, 0), max) / max) * W;
  const limites = [0, ...faixas, max];
  return (
    <svg className="bullet" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${formatar(valor)} de ${formatar(meta)} (${rotuloMeta})`}>
      {limites.slice(0, -1).map((ini, i) => (
        <rect key={i} x={x(ini)} y={4} width={Math.max(0, x(limites[i + 1]) - x(ini) - (i < limites.length - 2 ? 2 : 0))} height={18} className={`faixa faixa-${i}`} />
      ))}
      <rect x={0} y={9} width={Math.max(2, x(valor))} height={8} rx={2} className="bullet-barra" />
      <rect x={x(meta) - 1} y={1} width={2} height={24} className="bullet-meta" />
    </svg>
  );
}

/* ===== Cascata do mês ===== */
export interface PassoCascata {
  rotulo: string;
  valor: number;
  tipo: "total" | "saida";
}
export function Cascata({ passos }: { passos: PassoCascata[] }) {
  const dica = useDica();
  const W = 640,
    H = 250,
    m = { t: 22, r: 8, b: 40, l: 52 };
  // posições acumuladas
  const barras: (PassoCascata & { de: number; ate: number })[] = [];
  for (const p of passos) {
    const acc = barras.length ? barras[barras.length - 1].ate : 0;
    barras.push(p.tipo === "total" ? { ...p, de: 0, ate: p.valor } : { ...p, de: acc, ate: acc - p.valor });
  }
  const min = Math.min(0, ...barras.map((b) => Math.min(b.de, b.ate)));
  const max = Math.max(...barras.map((b) => Math.max(b.de, b.ate)));
  const ticks = marcas(min, max);
  const y0 = ticks[0],
    y1 = ticks[ticks.length - 1];
  const y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const banda = (W - m.l - m.r) / passos.length;
  const bw = Math.min(24 * 1.6, banda * 0.5);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-svg" role="img" aria-label="Cascata do mês: das receitas até a sobra">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className={t === 0 ? "eixo" : "grade"} />
            <text x={m.l - 8} y={y(t)} className="rotulo-eixo" textAnchor="end" dominantBaseline="middle">
              {brlCompacto(t)}
            </text>
          </g>
        ))}
        {barras.map((b, i) => {
          const cx = m.l + banda * i + banda / 2;
          const topo = y(Math.max(b.de, b.ate));
          const h = Math.max(1, Math.abs(y(b.de) - y(b.ate)));
          const negativo = b.tipo === "total" && b.valor < 0;
          // verde = dinheiro que entra/sobra; vermelho = saída (ou sobra negativa)
          const cor = b.tipo === "saida" || negativo ? "var(--cascata-saida)" : "var(--cascata-entrada)";
          const d = b.tipo === "total" && !negativo ? coluna(cx - bw / 2, topo, bw, h) : bloco(cx - bw / 2, topo, bw, h);
          const proxima = barras[i + 1];
          return (
            <g key={b.rotulo}>
              {proxima && <line x1={cx + bw / 2} x2={m.l + banda * (i + 1) + banda / 2 - bw / 2} y1={y(b.ate)} y2={y(b.ate)} className="conector" />}
              <path d={d} fill={cor} className="marca" {...alvo(dica, b.rotulo, [{ rotulo: b.tipo === "saida" ? "saiu" : "total", valor: brl(b.tipo === "saida" ? -b.valor : b.valor), cor }])} />
              <text x={cx} y={topo - 6} className="rotulo-valor" textAnchor="middle">
                {b.tipo === "saida" ? `−${brlInteiro(b.valor)}` : brlInteiro(b.valor)}
              </text>
              <text x={cx} y={H - m.b + 16} className="rotulo-eixo" textAnchor="middle">
                {b.rotulo}
              </text>
            </g>
          );
        })}
      </svg>
      {/* sem legenda nem tabela (pedido do Henrique): verde entra, vermelho sai; valor exato na dica */}
    </>
  );
}

/* ===== Sankey: de onde vem e para onde vai ===== */
interface No {
  id: string;
  rotulo: string;
  valor: number;
  cor?: string;
}
export function Sankey({ entradas, grupos, detalhe, idDetalhe }: { entradas: No[]; grupos: No[]; detalhe: No[]; idDetalhe: string }) {
  const dica = useDica();
  const W = 640,
    H = 300,
    nw = 12,
    gap = 8,
    xs = [4, 250, 470];
  const total = Math.max(soma(entradas.map((n) => n.valor)), 1);
  const maxNos = Math.max(entradas.length, grupos.length, detalhe.length);
  const k = (H - 20 - gap * (maxNos - 1)) / total;

  function posicionar(nos: No[], escala: number) {
    let yy = 10,
      acc = 0;
    return nos.map((n) => {
      const p = { ...n, y: yy, h: Math.max(1, n.valor * escala), ini: acc };
      yy += p.h + gap;
      acc += n.valor;
      return p;
    });
  }
  const colE = posicionar(entradas, k);
  const colG = posicionar(grupos, k);
  const noDet = colG.find((g) => g.id === idDetalhe);
  const somaDet = Math.max(soma(detalhe.map((d) => d.valor)), 1);
  const kDet = noDet ? (noDet.valor * k) / somaDet : k;
  let colD = posicionar(detalhe, kDet).map((d) => ({ ...d, y: d.y + (noDet ? noDet.y - 10 : 0) }));
  const fundoD = colD.length ? colD[colD.length - 1].y + colD[colD.length - 1].h : 0;
  if (fundoD > H - 4) colD = colD.map((d) => ({ ...d, y: d.y - (fundoD - (H - 4)) }));

  function faixa(x0: number, y0: number, x1: number, y1: number, h0: number, h1: number) {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h1} C${mx},${y1 + h1} ${mx},${y0 + h0} ${x0},${y0 + h0} Z`;
  }

  // ligações entrada → grupo: sobreposição dos intervalos acumulados
  const ligacoes1: { d: string; cor: string; de: string; para: string; valor: number }[] = [];
  for (const e of colE)
    for (const g of colG) {
      const s = Math.max(e.ini, g.ini),
        f = Math.min(e.ini + e.valor, g.ini + g.valor);
      if (f - s <= 0.005) continue;
      const ye = e.y + (s - e.ini) * k,
        yg = g.y + (s - g.ini) * k;
      ligacoes1.push({ d: faixa(xs[0] + nw, ye, xs[1], yg, (f - s) * k, (f - s) * k), cor: g.cor ?? COR.s1, de: e.rotulo, para: g.rotulo, valor: f - s });
    }
  // ligações grupo detalhado → categorias
  const ligacoes2: typeof ligacoes1 = [];
  if (noDet) {
    let off = 0;
    for (const d of colD) {
      const hOrig = d.valor * kDet;
      ligacoes2.push({ d: faixa(xs[1] + nw, noDet.y + off, xs[2], d.y, hOrig, d.h), cor: noDet.cor ?? COR.s1, de: noDet.rotulo, para: d.rotulo, valor: d.valor });
      off += hOrig;
    }
  }

  const rotuloNo = (x: number, n: { id: string; y: number; h: number; rotulo: string; valor: number }, lado: "dir" | "esq") => (
    <text key={`r-${x}-${n.id}`} x={lado === "dir" ? x + nw + 6 : x - 6} y={n.y + n.h / 2} className="rotulo-no" textAnchor={lado === "dir" ? "start" : "end"} dominantBaseline="middle">
      {n.rotulo} <tspan className="rotulo-no-valor">{brlCompacto(n.valor)}</tspan>
    </text>
  );

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-svg" role="img" aria-label="Fluxo do dinheiro do mês">
        {[...ligacoes1, ...ligacoes2].map((l, i) => (
          <path key={i} d={l.d} fill={l.cor} className="ligacao" {...alvo(dica, `${l.de} → ${l.para}`, [{ rotulo: "", valor: brl(l.valor), cor: l.cor }])} />
        ))}
        {colE.map((n) => (
          <rect key={n.id} x={xs[0]} y={n.y} width={nw} height={n.h} rx={2} className="no" />
        ))}
        {colG.map((n) => (
          <rect key={n.id} x={xs[1]} y={n.y} width={nw} height={n.h} rx={2} fill={n.cor} />
        ))}
        {colD.map((n) => (
          <rect key={n.id} x={xs[2]} y={n.y} width={nw} height={n.h} rx={2} fill={noDet?.cor} />
        ))}
        {colE.map((n) => rotuloNo(xs[0], n, "dir"))}
        {colG.map((n) => rotuloNo(xs[1], n, "dir"))}
        {colD.map((n) => rotuloNo(xs[2], n, "dir"))}
      </svg>
      {/* sem legenda nem tabela (pedido do Henrique): os nós já têm nome e valor; o valor exato fica na dica */}
    </>
  );
}

/* ===== Evolução: receitas × saídas + sobra ===== */
export function Evolucao({ meses }: { meses: { mes: string; receitas: number; saidas: number; sobra: number }[] }) {
  const dica = useDica();
  const W = 640,
    H = 250,
    m = { t: 16, r: 8, b: 30, l: 52 };
  const min = Math.min(0, ...meses.map((x) => x.sobra));
  const max = Math.max(...meses.map((x) => Math.max(x.receitas, x.saidas)));
  const ticks = marcas(min, max);
  const y0 = ticks[0],
    y1 = ticks[ticks.length - 1];
  const y = (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const banda = (W - m.l - m.r) / meses.length;
  const bw = Math.min(14, banda * 0.3);
  const cx = (i: number) => m.l + banda * i + banda / 2;
  const linha = meses.map((x, i) => `${cx(i)},${y(x.sobra)}`).join(" ");
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-svg" role="img" aria-label="Receitas, saídas e sobra por mês">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className={t === 0 ? "eixo" : "grade"} />
            <text x={m.l - 8} y={y(t)} className="rotulo-eixo" textAnchor="end" dominantBaseline="middle">
              {brlCompacto(t)}
            </text>
          </g>
        ))}
        {meses.map((x, i) => (
          <g key={x.mes}>
            <path d={coluna(cx(i) - bw - 1, y(x.receitas), bw, y(0) - y(x.receitas))} fill={COR.s1} />
            <path d={coluna(cx(i) + 1, y(x.saidas), bw, y(0) - y(x.saidas))} fill={COR.s2} />
            <text x={cx(i)} y={H - m.b + 18} className="rotulo-eixo" textAnchor="middle">
              {mesCurto(x.mes)}
            </text>
          </g>
        ))}
        <polyline points={linha} className="serie-linha" stroke={COR.s3} />
        {meses.map((x, i) => (
          <circle key={x.mes} cx={cx(i)} cy={y(x.sobra)} r={4} fill={COR.s3} className="ponto" />
        ))}
        {/* área de hover por mês (toda a banda) */}
        {meses.map((x, i) => (
          <rect
            key={`h${x.mes}`}
            x={m.l + banda * i}
            y={m.t}
            width={banda}
            height={H - m.t - m.b}
            className="alvo-banda"
            {...alvo(dica, rotuloMes(x.mes), [
              { rotulo: "Receitas", valor: brl(x.receitas), cor: COR.s1 },
              { rotulo: "Saídas", valor: brl(x.saidas), cor: COR.s2 },
              { rotulo: "Sobra", valor: brl(x.sobra), cor: COR.s3 },
            ])}
          />
        ))}
      </svg>
      <div className="legenda-dupla">
        <Legenda
          itens={[
            { rotulo: "Receitas", cor: COR.s1 },
            { rotulo: "Saídas", cor: COR.s2 },
          ]}
        />
        <Legenda itens={[{ rotulo: "Sobra", cor: COR.s3 }]} tipo="linha" />
      </div>
    </>
  );
}

/* ===== Compromissos futuros (colunas empilhadas) ===== */
export function Futuros({ meses, limite }: { meses: { mes: string; parcelasCartao: number; boletos: number; bmw: number; total: number }[]; limite: number }) {
  const dica = useDica();
  const W = 640,
    H = 250,
    m = { t: 16, r: 8, b: 30, l: 52 };
  // cores fixas por série (a cor segue a série, não a posição); séries sem nenhum valor saem da legenda
  const series = [
    { chave: "parcelasCartao" as const, rotulo: "Parcelas do cartão", cor: COR.s1 },
    { chave: "boletos" as const, rotulo: "Boletos e financiamentos", cor: COR.s2 },
    { chave: "bmw" as const, rotulo: "BMW", cor: COR.s3 },
  ].filter((s) => meses.some((x) => x[s.chave] > 0.005));
  const max = Math.max(limite * 1.1, ...meses.map((x) => x.total));
  const ticks = marcas(0, max);
  const y1 = ticks[ticks.length - 1];
  const y = (v: number) => m.t + (1 - v / y1) * (H - m.t - m.b);
  const banda = (W - m.l - m.r) / meses.length;
  const bw = Math.min(24, banda * 0.55);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-svg" role="img" aria-label="Parcelas e financiamentos já assumidos nos próximos meses">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className={t === 0 ? "eixo" : "grade"} />
            <text x={m.l - 8} y={y(t)} className="rotulo-eixo" textAnchor="end" dominantBaseline="middle">
              {brlCompacto(t)}
            </text>
          </g>
        ))}
        {meses.map((x, i) => {
          const cx = m.l + banda * i + banda / 2;
          let base = 0;
          const visiveis = series.filter((s) => x[s.chave] > 0.005);
          return (
            <g key={x.mes} {...alvo(dica, rotuloMes(x.mes), [...series.map((s) => ({ rotulo: s.rotulo, valor: brl(x[s.chave]), cor: s.cor })), { rotulo: "Total", valor: brl(x.total) }])}>
              <rect x={m.l + banda * i} y={m.t} width={banda} height={H - m.t - m.b} className="alvo-banda" />
              {visiveis.map((s, j) => {
                const v = x[s.chave];
                const topo = y(base + v);
                const h = y(base) - topo - (j > 0 ? 2 : 0); // 2px de respiro entre segmentos
                const ultimo = j === visiveis.length - 1;
                const d = ultimo ? coluna(cx - bw / 2, topo, bw, Math.max(h, 1)) : `M${cx - bw / 2},${topo} h${bw} v${Math.max(h, 1)} h${-bw} Z`;
                base += v;
                return <path key={s.chave} d={d} fill={s.cor} />;
              })}
              <text x={cx} y={H - m.b + 18} className="rotulo-eixo" textAnchor="middle">
                {mesCurto(x.mes)}
              </text>
            </g>
          );
        })}
        <line x1={m.l} x2={W - m.r} y1={y(limite)} y2={y(limite)} className="linha-limite" />
        <text x={W - m.r} y={m.t - 4} className="rotulo-limite" textAnchor="end">
          <tspan fill="var(--critico)">━</tspan> limite de 30% da renda · {brlCompacto(limite)}
        </text>
      </svg>
      <Legenda itens={series.map((s) => ({ rotulo: s.rotulo, cor: s.cor }))} />
    </>
  );
}

/* ===== Categorias × média, ajustadas à altura do card ===== */
interface Cat {
  nome: string;
  atual: number;
  media: number;
}
const nomeBonito = (n: string) => n.charAt(0) + n.slice(1).toLowerCase();

/** Mostra só as linhas que cabem na altura disponível; o excedente (e a categoria
    "OUTROS" original) vira uma linha "Outros" com o valor e a média somados. */
export function CategoriasAjustadas({ cats, formatar, formatarPct }: { cats: Cat[]; formatar: (v: number) => string; formatarPct: (v: number) => string }) {
  const area = useRef<HTMLDivElement>(null);
  const [cabem, setCabem] = useState(6); // valor inicial (HTML do servidor); a medição real ajusta logo ao abrir

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const medir = () => {
      const primeira = el.querySelector("li");
      if (!primeira) return;
      const gap = 12;
      const altLinha = primeira.getBoundingClientRect().height + gap;
      setCabem(Math.max(1, Math.floor((el.clientHeight + gap) / altLinha)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const semOutros = cats.filter((c) => c.nome !== "OUTROS");
  const outrosOrig = cats.find((c) => c.nome === "OUTROS");
  let linhas: Cat[];
  if (cats.length <= cabem && !outrosOrig) linhas = cats;
  else {
    const vagas = Math.max(0, cabem - 1);
    const visiveis = semOutros.slice(0, vagas);
    const resto = [...semOutros.slice(vagas), ...(outrosOrig ? [outrosOrig] : [])];
    linhas = resto.length
      ? [...visiveis, { nome: "OUTROS", atual: soma(resto.map((r) => r.atual)), media: soma(resto.map((r) => r.media)) }]
      : visiveis;
  }
  const max = Math.max(1, ...linhas.map((x) => Math.max(x.atual, x.media)));

  return (
    <div className="cat-area" ref={area}>
      <ul className="cat-bullets">
        {linhas.map((x) => {
          const dif = x.media > 0 ? (x.atual - x.media) / x.media : null;
          return (
            <li key={x.nome}>
              <div className="cat-linha">
                <span className="cat-nome">{nomeBonito(x.nome)}</span>
                <span className="num">{formatar(x.atual)}</span>
              </div>
              <div className="cat-trilho" aria-hidden="true">
                <div className="cat-barra" style={{ width: `${(x.atual / max) * 100}%` }} />
                {x.media > 0 && <div className="cat-media" style={{ left: `${(x.media / max) * 100}%` }} />}
              </div>
              <div className="cat-ref num">
                média {formatar(x.media)}
                {dif !== null && Math.abs(dif) >= 0.05 && (
                  <span className={dif > 0 ? "delta-ruim" : "delta-bom"}>
                    {" "}
                    · {dif > 0 ? "▲" : "▼"} {formatarPct(Math.abs(dif))}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
