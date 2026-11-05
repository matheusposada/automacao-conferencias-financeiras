/* Análise 3 — Pedidos / Datas (App × Vendas) */
// 3. DATAS (App x Vendas)
async function rodarDatas() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  if (!rowsApp || !rowsVendas) {
    alert("Por favor, carregue as planilhas do App e de Vendas no topo.");
    return;
  }

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido", "id"],
    dataVerificacao: ["data verificação", "data verificacao", "data financeiro aguardando"]
  });

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    data: ["data/hora da venda", "data"]
  });

  const colPedidoVendas = idxVen.indexes.pedido !== undefined && idxVen.indexes.pedido !== -1 ? idxVen.indexes.pedido : 9;
  const colDataVendas = idxVen.indexes.data !== undefined && idxVen.indexes.data !== -1 ? idxVen.indexes.data : 3;

  const colPedidoApp = idxApp.indexes.pedido !== undefined && idxApp.indexes.pedido !== -1 ? idxApp.indexes.pedido : 0;

  const headerRowStr = rowsApp[idxApp.headerRowIdx] ? rowsApp[idxApp.headerRowIdx].map(c => normKey(c).toLowerCase()) : [];
  const isFinanceiro = headerRowStr.some(c => c.includes("financeiro aguardando") || c.includes("recebimento"));

  let colDataApp = idxApp.indexes.dataVerificacao;
  if (colDataApp === undefined || colDataApp === -1) {
    colDataApp = isFinanceiro ? 4 : 3;
  }

  const appMap = new Map();
  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedidoApp]);
    const cleanPed = normPedido(rawPed);

    if (cleanPed && !appMap.has(cleanPed)) {
      const dtParsed = formatToBRDate(r[colDataApp]);
      appMap.set(cleanPed, {
        rawPed: rawPed,
        date: dtParsed ? dtParsed.dateObj : null,
        str: dtParsed ? dtParsed.str : "-"
      });
    }
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedidoVendas]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const dtVenParsed = formatToBRDate(r[colDataVendas]);
    const dVendas = dtVenParsed ? dtVenParsed.dateObj : null;
    const strVendas = dtVenParsed ? dtVenParsed.str : "-";
    const appEntry = appMap.get(cleanPed);

    let status = "ok";
    let label = "OK";

    if (!appEntry) {
      status = "warn";
      label = "Pedido não encontrado no App";
    } else if (!dVendas || !appEntry.date) {
      status = "warn";
      label = "Sem data em um dos lados";
    } else if (!sameDay(dVendas, appEntry.date)) {
      status = "bad";
      label = "Data Divergente";
    }

    results.push({
      pedido: rawPed,
      dataVendas: strVendas,
      dataApp: appEntry ? appEntry.str : "-",
      _status: status,
      _statusLabel: label
    });
  }

  renderResult("result-datas", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "dataVendas", label: "Data (Vendas)" },
    { key: "dataApp", label: "Data Verificação (App)" }
  ], "Datas_App_x_Vendas");
}

