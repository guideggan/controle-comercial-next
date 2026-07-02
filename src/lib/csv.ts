// Helper puro de geração de CSV (AUDIT-02) — sem dependência externa (xlsx
// não está instalado no projeto; CSV é suficiente e abre nativamente no
// Excel). Separador ";" (padrão Excel pt-BR) e BOM UTF-8 para acentuação
// correta ao abrir no Excel do Windows.

export function paraCsv(colunas: string[], linhas: (string | number)[][]): string {
  const escapar = (valor: string | number): string => {
    const texto = String(valor);
    if (texto.includes(";") || texto.includes('"') || texto.includes("\n")) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };

  const cabecalho = colunas.map(escapar).join(";");
  const corpo = linhas.map((linha) => linha.map(escapar).join(";")).join("\n");

  const BOM = "﻿";
  return `${BOM}${cabecalho}\n${corpo}`;
}
