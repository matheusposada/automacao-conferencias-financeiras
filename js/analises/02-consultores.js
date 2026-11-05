/* Análise 2 — Consultores (App × Vendas) */
// 2. CONSULTORES (App x Vendas) - EXCLUI VENDEDORES 'SAC'
async function rodarConsultores() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido", "id"],
    vendedor: ["vendedor (omie)", "vendedor", "consultor"]
  });

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    consultor: ["consultor", "vendedor", "razão social"]
  });

  const colPedidoApp = idxApp.indexes.pedido ?? 0;
  const colVendedorApp = idxApp.indexes.vendedor ?? 11;

  const colPedidoVen = idxVen.indexes.pedido ?? 9;
  const colConsultorVen = idxVen.indexes.consultor ?? 3;

  const appMap = new Map();
  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedidoApp]);
    const cleanPed = normPedido(rawPed);
    const consultorApp = normKey(r[colVendedorApp]);

    if (sanitizeText(consultorApp) === "sac" || sanitizeText(consultorApp).includes("sac")) {
      continue;
    }

    if (cleanPed) appMap.set(cleanPed, consultorApp);
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedidoVen]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const cApp = appMap.get(cleanPed);
    const cVendas = normKey(r[colConsultorVen]);

    let status = "ok";
    let label = "OK";

    if (cApp === undefined) {
      status = "warn";
      label = "Pedido não encontrado no App (ou consultor é SAC)";
    } else if (cVendas.toLowerCase() !== cApp.toLowerCase()) {
      status = "bad";
      label = "Consultor Divergente";
    }

    results.push({
      pedido: rawPed,
      consultorVendas: cVendas,
      consultorApp: cApp || "-",
      _status: status,
      _statusLabel: label
    });
  }

  renderResult("result-consultores", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "consultorVendas", label: "Consultor (Vendas)" },
    { key: "consultorApp", label: "Consultor (App)" }
  ], "Consultores_App_x_Vendas");
}

