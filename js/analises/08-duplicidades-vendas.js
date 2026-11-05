/* Análise 8 — Duplicidades de pedidos (Vendas) */
// 8. DUPLICIDADES DE PEDIDOS NA PLANILHA DE VENDAS
async function rodarDuplicidadesVendas() {
  const rowsVendas = await parseFileToRows(fileStore.vendas);
  if (!rowsVendas) return alert("Erro ao ler a planilha de Vendas.");

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "pedido", "nº pedido", "número do comprovante de vendas (cv)"],
    cliente: ["cliente", "nome", "razão social"],
    consultor: ["consultor", "vendedor"],
    valor: ["valor", "valor liquido", "valor total da venda"],
    data: ["data/hora da venda", "data"]
  });

  const colPed = idxVen.indexes.pedido ?? 9;
  const colCli = idxVen.indexes.cliente ?? 2;
  const colCons = idxVen.indexes.consultor ?? 3;
  const colVal = idxVen.indexes.valor ?? 12;
  const colData = idxVen.indexes.data ?? 3;

  const pedMap = new Map();

  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPed]);
    const cleanPed = normPedido(rawPed);

    if (!cleanPed || cleanPed === "0" || cleanPed === "manual") continue;

    const cliente = normKey(r[colCli]);
    const consultor = normKey(r[colCons]);
    const valor = toNumber(r[colVal]);
    const dtParsed = formatToBRDate(r[colData]);
    const strData = dtParsed ? dtParsed.str : "-";

    if (!pedMap.has(cleanPed)) {
      pedMap.set(cleanPed, []);
    }

    pedMap.get(cleanPed).push({
      rawPed: rawPed,
      data: strData,
      cliente: cliente || "-",
      consultor: consultor || "-",
      valor: valor
    });
  }

  const results = [];
  pedMap.forEach((occurrences) => {
    const isDup = occurrences.length > 1;
    occurrences.forEach(item => {
      results.push({
        pedido: item.rawPed,
        data: item.data,
        cliente: item.cliente,
        consultor: item.consultor,
        valor: item.valor,
        qntRepeticoes: occurrences.length,
        _status: isDup ? "bad" : "ok",
        _statusLabel: isDup ? `Duplicado (${occurrences.length}x)` : "Único"
      });
    });
  });

  renderResult("result-duplicidadevendas", results, [
    { key: "pedido", label: "ID Pedido" },
    { key: "data", label: "Data" },
    { key: "cliente", label: "Cliente" },
    { key: "consultor", label: "Consultor" },
    { key: "valor", label: "Valor (R$)", isCurrency: true },
    { key: "qntRepeticoes", label: "Ocorrências na Planilha" }
  ], "Duplicidades_Pedidos_Vendas");
}

