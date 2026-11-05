/* Análise 10 — Cancelamentos (Vendas × Relatório de Pedidos) */
// 10. AUDITORIA DE CANCELAMENTOS (Vendas x Relatório de Pedidos)
async function rodarCancelamentos() {
  const rowsRel = await parseFileToRows(fileStore.relpedidos);
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  if (!rowsRel || !rowsVendas) {
    return alert("Por favor, carregue o Relatório de Pedidos e a planilha de Vendas no topo.");
  }

  // Mapeamento de colunas no Relatório de Pedidos
  const idxRel = findHeaderAndIndexes(rowsRel, {
    pedido: ["nº pedido", "pedido", "id"],
    status: ["status"],
    valor: ["total a pagar", "valor total", "valor"]
  });

  // Mapeamento de colunas em Vendas
  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    valor: ["valor", "valor liquido", "valor total da venda"],
    status: ["status da transação", "status"]
  });

  const colPedRel = idxRel.indexes.pedido ?? 0;
  const colStRel = idxRel.indexes.status ?? 1;
  const colValRel = idxRel.indexes.valor ?? 7;

  const colPedVen = idxVen.indexes.pedido ?? 9;
  const colValVen = idxVen.indexes.valor ?? 8;
  const colStVen = idxVen.indexes.status ?? 7;

  // 1. Mapeia Relatório de Pedidos
  const relMap = new Map();
  for (let i = idxRel.headerRowIdx + 1; i < rowsRel.length; i++) {
    const r = rowsRel[i];
    const rawPed = normKey(r[colPedRel]);
    const cleanPed = normPedido(rawPed);

    if (cleanPed && !relMap.has(cleanPed)) {
      const stRel = normKey(r[colStRel]);
      relMap.set(cleanPed, {
        rawPed: rawPed,
        statusGeral: stRel,
        valor: toNumber(r[colValRel]) ?? 0,
        isCancelado: sanitizeText(stRel).includes("cancelad")
      });
    }
  }

  // 2. Mapeia Vendas
  const vendasMap = new Map();
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedVen]);
    const cleanPed = normPedido(rawPed);

    if (!cleanPed || cleanPed === "0" || cleanPed === "manual") continue;

    const valVendas = toNumber(r[colValVen]) ?? 0;
    const stVendas = normKey(r[colStVen]);

    vendasMap.set(cleanPed, {
      rawPed: rawPed,
      status: stVendas,
      valor: valVendas,
      isCancelado: sanitizeText(stVendas).includes("cancelad") || sanitizeText(stVendas).includes("estornad")
    });
  }

  const results = [];
  const processados = new Set();

  // A) Varredura a partir de VENDAS
  vendasMap.forEach((venda, cleanPed) => {
    processados.add(cleanPed);
    const relMatch = relMap.get(cleanPed);
    const isRelCancelado = relMatch ? relMatch.isCancelado : false;

    // Avalia se pelo menos um dos lados possui indicação de cancelamento
    if (venda.isCancelado || isRelCancelado) {
      let statusClass = "ok";
      let label = "OK (Cancelado em Ambos)";

      if (venda.isCancelado && !isRelCancelado) {
        statusClass = "bad";
        label = relMatch 
          ? `Divergente: Cancelado em Vendas (${venda.status}) e Ativo no Relatório (${relMatch.statusGeral})` 
          : "Divergente: Cancelado em Vendas e Não Encontrado no Relatório";
      } else if (!venda.isCancelado && isRelCancelado) {
        statusClass = "bad";
        label = `Divergente: Ativo em Vendas (${venda.status}) e Cancelado no Relatório (${relMatch.statusGeral})`;
      }

      results.push({
        pedido: venda.rawPed,
        statusVendas: `${venda.status || "N/A"} (${formatBRL(venda.valor)})`,
        statusRelatorio: relMatch ? `${relMatch.statusGeral} (${formatBRL(relMatch.valor)})` : "Não Encontrado",
        _status: statusClass,
        _statusLabel: label
      });
    }
  });

  // B) Varredura de pedidos cancelados no Relatório e não encontrados em Vendas
  relMap.forEach((relItem, cleanPed) => {
    if (processados.has(cleanPed)) return;

    if (relItem.isCancelado) {
      results.push({
        pedido: relItem.rawPed,
        statusVendas: "Não Encontrado em Vendas",
        statusRelatorio: `${relItem.statusGeral} (${formatBRL(relItem.valor)})`,
        _status: "bad",
        _statusLabel: "Divergente: Cancelado no Relatório de Pedidos e Não Encontrado em Vendas"
      });
    }
  });

  renderResult("result-cancelamentos", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "statusVendas", label: "Status / Valor (Vendas)" },
    { key: "statusRelatorio", label: "Status / Valor (Relatório de Pedidos)" }
  ], "Auditoria_Cancelamentos_Vendas_x_Relatorio");
}

