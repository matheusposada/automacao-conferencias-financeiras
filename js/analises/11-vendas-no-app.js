/* Análise 11 — Presença de pedidos (Vendas × App) */
// 11. PRESENÇA DE PEDIDOS (Cruzamento Bidirecional: Vendas x Relatório de Pedidos)
async function rodarVendasNoApp() {
  const rowsRel = await parseFileToRows(fileStore.relpedidos);
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  if (!rowsRel || !rowsVendas) {
    return alert("Por favor, carregue as planilhas de Vendas e o Relatório de Pedidos no topo.");
  }

  // Identificação automática de colunas no novo Relatório de Pedidos
  const idxRel = findHeaderAndIndexes(rowsRel, {
    pedido: ["nº pedido", "pedido", "id"],
    statusGeral: ["status"],
    statusFin: ["status financeiro", "status fin"],
    data: ["data do pedido", "data"],
    vendedor: ["vendedor", "consultor"],
    cliente: ["cliente", "nome"],
    valor: ["total a pagar", "valor total", "valor"]
  });

  // Identificação de colunas na planilha de Vendas
  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    cliente: ["cliente", "clientes", "nome", "razão social"],
    consultor: ["consultor", "vendedor"],
    valor: ["valor", "valor liquido", "valor total da venda"],
    data: ["data/hora da venda", "data"]
  });

  const colPedRel = idxRel.indexes.pedido ?? 0;
  const colStGeralRel = idxRel.indexes.statusGeral ?? 1;
  const colStFinRel = idxRel.indexes.statusFin ?? 2;
  const colDtRel = idxRel.indexes.data ?? 3;
  const colVendRel = idxRel.indexes.vendedor ?? 4;
  const colCliRel = idxRel.indexes.cliente ?? 5;
  const colValRel = idxRel.indexes.valor ?? 7;

  const colPedVen = idxVen.indexes.pedido ?? 9;
  const colCliVen = idxVen.indexes.cliente ?? 2;
  const colConsVen = idxVen.indexes.consultor ?? 3;
  const colValVen = idxVen.indexes.valor ?? 8;
  const colDataVen = idxVen.indexes.data ?? 0;

  // 1. Mapeia o Relatório de Pedidos
  const relMap = new Map();
  for (let i = idxRel.headerRowIdx + 1; i < rowsRel.length; i++) {
    const r = rowsRel[i];
    const rawPed = normKey(r[colPedRel]);
    const cleanPed = normPedido(rawPed);

    if (cleanPed && !relMap.has(cleanPed)) {
      const dtParsed = formatToBRDate(r[colDtRel]);
      relMap.set(cleanPed, {
        rawPed: rawPed,
        statusGeral: normKey(r[colStGeralRel]),
        statusFin: normKey(r[colStFinRel]),
        data: dtParsed ? dtParsed.str : "-",
        vendedor: normKey(r[colVendRel]),
        cliente: normKey(r[colCliRel]),
        valor: toNumber(r[colValRel])
      });
    }
  }

  // 2. Mapeia a planilha de Vendas
  const vendasMap = new Map();
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedVen]);
    const cleanPed = normPedido(rawPed);

    if (!cleanPed || cleanPed === "0" || cleanPed === "manual") continue;

    const dtParsed = formatToBRDate(r[colDataVen]);

    if (!vendasMap.has(cleanPed)) {
      vendasMap.set(cleanPed, {
        rawPed: rawPed,
        data: dtParsed ? dtParsed.str : "-",
        cliente: normKey(r[colCliVen]),
        consultor: normKey(r[colConsVen]),
        valor: toNumber(r[colValVen])
      });
    }
  }

  const results = [];

  // A) Checa tudo que está em Vendas contra o Relatório de Pedidos
  vendasMap.forEach((itemVen, cleanPed) => {
    const relMatch = relMap.get(cleanPed);

    if (!relMatch) {
      results.push({
        origem: "Vendas",
        pedido: itemVen.rawPed,
        data: itemVen.data,
        cliente: itemVen.cliente || "-",
        consultor: itemVen.consultor || "-",
        valor: itemVen.valor,
        statusInfo: "Não Encontrado no Relatório",
        _status: "bad",
        _statusLabel: "Falta no Relatório de Pedidos"
      });
    } else {
      results.push({
        origem: "Ambos",
        pedido: itemVen.rawPed,
        data: itemVen.data,
        cliente: itemVen.cliente || "-",
        consultor: itemVen.consultor || "-",
        valor: itemVen.valor,
        statusInfo: `${relMatch.statusGeral || "-"} / ${relMatch.statusFin || "-"}`,
        _status: "ok",
        _statusLabel: "OK (Presente em Ambos)"
      });
    }
  });

  // B) Checa o que está no Relatório de Pedidos mas NÃO está em Vendas
  relMap.forEach((itemRel, cleanPed) => {
    if (!vendasMap.has(cleanPed)) {
      results.push({
        origem: "Relatório de Pedidos",
        pedido: itemRel.rawPed,
        data: itemRel.data || "-",
        cliente: itemRel.cliente || "-",
        consultor: itemRel.vendedor || "-",
        valor: itemRel.valor,
        statusInfo: `${itemRel.statusGeral || "-"} / ${itemRel.statusFin || "-"}`,
        _status: "warn",
        _statusLabel: "Presente no Relatório, mas Falta em Vendas"
      });
    }
  });

  renderResult("result-vendasnoapp", results, [
    { key: "origem", label: "Origem Registro" },
    { key: "pedido", label: "Nº Pedido" },
    { key: "data", label: "Data Pedido" },
    { key: "cliente", label: "Cliente" },
    { key: "consultor", label: "Consultor / Vendedor" },
    { key: "valor", label: "Valor (R$)", isCurrency: true },
    { key: "statusInfo", label: "Status no Relatório (Geral / Fin.)" }
  ], "Presenca_Cruzada_Vendas_x_RelatorioPedidos");
}

