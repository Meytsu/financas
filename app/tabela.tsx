"use client";

/* Tabela com cabeçalhos clicáveis para ordenar (1º clique: crescente; 2º: decrescente).
   Usada na janela de lançamentos. */

import { useState } from "react";

export interface Coluna<T> {
  chave: string;
  rotulo: string;
  /** valor usado para ordenar (número ou texto) */
  ordem: (linha: T) => number | string;
  /** conteúdo da célula; se omitido, mostra o valor de `ordem` */
  celula?: (linha: T) => React.ReactNode;
  direita?: boolean;
  classe?: string;
}

export function TabelaOrdenavel<T>({
  colunas,
  linhas,
  ordemInicial,
  vazio,
  rodape,
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  ordemInicial: { chave: string; desc: boolean };
  vazio: string;
  rodape?: React.ReactNode;
}) {
  const [ordem, setOrdem] = useState(ordemInicial);
  const col = colunas.find((c) => c.chave === ordem.chave) ?? colunas[0];
  const ordenadas = [...linhas].sort((a, b) => {
    const va = col.ordem(a),
      vb = col.ordem(b);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
    return ordem.desc ? -cmp : cmp;
  });

  return (
    <table className="tabela-ordenavel">
      <thead>
        <tr>
          {colunas.map((c) => {
            const ativa = c.chave === ordem.chave;
            return (
              <th key={c.chave} className={c.direita ? "dir" : ""} aria-sort={ativa ? (ordem.desc ? "descending" : "ascending") : "none"}>
                <button
                  type="button"
                  className={`th-botao ${ativa ? "ativa" : ""}`}
                  onClick={() => setOrdem(ativa ? { chave: c.chave, desc: !ordem.desc } : { chave: c.chave, desc: false })}
                >
                  {c.rotulo}
                  <span className="seta" aria-hidden="true">
                    {ativa ? (ordem.desc ? "▼" : "▲") : "↕"}
                  </span>
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {ordenadas.length === 0 && (
          <tr>
            <td colSpan={colunas.length} className="vazio">
              {vazio}
            </td>
          </tr>
        )}
        {ordenadas.map((l, i) => (
          <tr key={i}>
            {colunas.map((c) => (
              <td key={c.chave} className={`${c.direita ? "dir" : ""} ${c.classe ?? ""}`}>
                {c.celula ? c.celula(l) : String(c.ordem(l))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {rodape && <tfoot>{rodape}</tfoot>}
    </table>
  );
}
