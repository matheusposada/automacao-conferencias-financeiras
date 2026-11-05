/* Análise 4 — Valores (App × Vendas) */
// 4. VALORES (App x Vendas)
async function rodarValores() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido"],
    valor: ["valor total do pedido (r$)", "valor total a pagar", "valor"],
    statusGeral: ["status"],
    statusFin: ["status financeiro", "status fin"]
  });

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    valor: ["valor liquido", "valor total da venda", "valor"]
  });

  const colPedApp = idxApp.indexes.pedido ?? 0;
  const colValApp = idxApp.indexes.valor ?? 39;
  const colStGeralApp = idxApp.indexes.statusGeral ?? 7;
  const colStFinApp = idxApp.indexes.statusFin ?? 8;

  const colPedVen = idxVen.indexes.pedido ?? 9;
  const colValVen = idxVen.indexes.valor ?? 12;

  const appMap = new Map();
  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedApp]);
    const cleanPed = normPedido(rawPed);

    const stGeral = sanitizeText(r[colStGeralApp]);
    const stFin = sanitizeText(r[colStFinApp]);

    if (stGeral.includes("cancelad") || stFin.includes("cancelad")) {
      continue;
    }

    if (cleanPed) appMap.set(cleanPed, toNumber(r[colValApp]));
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedVen]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const valVendas = toNumber(r[colValVen]);

    if (valVendas === 0 || valVendas === null) {
      continue;
    }

    const valApp = appMap.get(cleanPed);

    let status = "ok";
    let label = "OK";

    if (valApp === undefined) {
      status = "warn";
      label = "Pedido não encontrado no App (ou Cancelado no App)";
    } else if (Math.round(valVendas * 100) !== Math.round(valApp * 100)) {
      status = "bad";
      label = "Valor Divergente";
    }

    results.push({
      pedido: rawPed,
      valorVendas: valVendas,
      valorApp: valApp,
      _status: status,
      _statusLabel: label
    });
  }

  renderResult("result-valores", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "valorVendas", label: "Valor (Vendas)", isCurrency: true },
    { key: "valorApp", label: "Valor (App)", isCurrency: true }
  ], "Valores_App_x_Vendas");
}

