/* Análise 1 — Duplicidades de NSU no App */
// 1. DUPLICIDADES NO APP
async function rodarDuplicidades() {
  const rows = await parseFileToRows(fileStore.app, "Pedidos");
  if (!rows) return alert("Erro ao ler a planilha do App.");

  const { headerRowIdx, indexes } = findHeaderAndIndexes(rows, {
    pedido: ["nº pedido", "número", "pedido"],
    nsu: ["nsus confirmados", "nsu"],
    cliente: ["cliente", "nome"]
  });

  const headerRowStr = rows[headerRowIdx] ? rows[headerRowIdx].map(c => normKey(c).toLowerCase()) : [];
  const isFinanceiro = headerRowStr.some(c => c.includes("financeiro aguardando") || c.includes("recebimento"));

  const idxData = isFinanceiro ? 4 : 3;
  const idxPed = indexes.pedido ?? 0;
  const idxCli = indexes.cliente ?? (isFinanceiro ? 9 : 15);
  const idxNsu = indexes.nsu ?? (isFinanceiro ? 22 : 48);

  const nsuMap = new Map();

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const pedido = normKey(r[idxPed]);
    const cliente = normKey(r[idxCli]);
    const rawNsu = normKey(r[idxNsu]);
    
    const dtParsed = formatToBRDate(r[idxData]);
    const strDate = dtParsed ? dtParsed.str : "-";

    if (!rawNsu || rawNsu === "," || rawNsu === ".") continue;
    if (isExcecaoOK(rawNsu)) continue;

    const nsus = rawNsu.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
    nsus.forEach(nsu => {
      const cleanNsu = cleanNSU(nsu);
      const targetKey = cleanNsu || nsu;

      if (!nsuMap.has(targetKey)) nsuMap.set(targetKey, []);
      nsuMap.get(targetKey).push({ 
        nsuExibicao: nsu, 
        pedido, 
        cliente, 
        data: strDate 
      });
    });
  }

  const results = [];
  nsuMap.forEach((occurrences) => {
    const clientesUnicos = new Set(occurrences.map(o => sanitizeText(o.cliente)));
    const isDup = occurrences.length > 1 && clientesUnicos.size > 1;

    occurrences.forEach(item => {
      let status = "ok";
      let statusLabel = "Único";

      if (isDup) {
        status = "bad";
        statusLabel = `Duplicado (${occurrences.length}x - Clientes Distintos)`;
      } else if (occurrences.length > 1) {
        status = "ok";
        statusLabel = `Único / Mesmo Cliente (${occurrences.length}x pedidos)`;
      }

      results.push({
        nsu: item.nsuExibicao,
        pedido: item.pedido,
        cliente: item.cliente,
        data: item.data,
        qntRepeticoes: occurrences.length,
        _status: status,
        _statusLabel: statusLabel
      });
    });
  });

  renderResult("result-duplicidade", results, [
    { key: "nsu", label: "NSU" },
    { key: "pedido", label: "Nº Pedido" },
    { key: "cliente", label: "Cliente" },
    { key: "data", label: "Data" },
    { key: "qntRepeticoes", label: "Ocorrências" }
  ], "Duplicidades_NSU_App");
}

