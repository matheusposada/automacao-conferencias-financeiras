/* Análise 6 — Data de Pagamento (App × Extratos) */
// 6. DATA DE PAGAMENTO
async function rodarDataPagamento() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsSafra = fileStore.safra ? await parseFileToRows(fileStore.safra) : null;
  const rowsPix = fileStore.pix ? await parseFileToRows(fileStore.pix) : null;
  const rowsSantander = fileStore.santander ? await parseFileToRows(fileStore.santander) : null;

  if (!rowsApp) return alert("Erro ao ler a planilha do App.");

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido", "id"],
    nsu: ["nsus confirmados", "nsu"],
    dataPagto: ["data pagto (nsu)", "data confirmação pgto", "data conf. pgto"]
  });

  const colPedApp = idxApp.indexes.pedido ?? 0;
  const colNsuApp = idxApp.indexes.nsu ?? 22;
  const colDataPagtoApp = idxApp.indexes.dataPagto !== undefined && idxApp.indexes.dataPagto !== -1 ? idxApp.indexes.dataPagto : 25;

  const extratosDataMap = new Map();

  if (rowsSafra) {
    const idxSafra = findHeaderAndIndexes(rowsSafra, {
      data: ["data da cobrança", "data"],
      nsu: ["nsu", "id da cobrança", "comprovante"],
      statusCob: ["status da cobrança", "status", "situacao", "situação"]
    });
    const colDataSafra = idxSafra.indexes.data !== undefined && idxSafra.indexes.data !== -1 ? idxSafra.indexes.data : 0;
    const colNsuSafra = idxSafra.indexes.nsu !== undefined && idxSafra.indexes.nsu !== -1 ? idxSafra.indexes.nsu : 10;
    const colStatusDetectado = idxSafra.indexes.statusCob;

    for (let i = idxSafra.headerRowIdx + 1; i < rowsSafra.length; i++) {
      const r = rowsSafra[i];
      
      const stDet = colStatusDetectado !== undefined && colStatusDetectado !== -1 ? normKey(r[colStatusDetectado]) : "";

      if (stDet && !isStatusAprovado(stDet)) {
        continue;
      }

      const rawNsu = normKey(r[colNsuSafra]);
      const cleanNsu = cleanNSU(rawNsu);
      const dtParsed = formatToBRDate(r[colDataSafra]);

      if (cleanNsu && dtParsed) {
        extratosDataMap.set(cleanNsu, dtParsed);
      }
    }
  }

  if (rowsPix) {
    const idxPix = findHeaderAndIndexes(rowsPix, {
      data: ["data"],
      documento: ["documento", "nsu", "id"]
    });
    const colDataPix = idxPix.indexes.data !== undefined && idxPix.indexes.data !== -1 ? idxPix.indexes.data : 0;
    const colDocPix = idxPix.indexes.documento !== undefined && idxPix.indexes.documento !== -1 ? idxPix.indexes.documento : 2;

    for (let i = idxPix.headerRowIdx + 1; i < rowsPix.length; i++) {
      const r = rowsPix[i];
      const rawDoc = normKey(r[colDocPix]);
      const cleanDoc = cleanNSU(rawDoc);
      const dtParsed = formatToBRDate(r[colDataPix]);

      if (cleanDoc && dtParsed) {
        extratosDataMap.set(cleanDoc, dtParsed);
      }
    }
  }

  if (rowsSantander) {
    const idxSantander = findHeaderAndIndexes(rowsSantander, {
      data: ["data/hora da venda", "data da venda", "data do vencimento", "data"],
      nsu: ["número do comprovante de vendas (cv)", "comprovante", "cv", "nsu"],
      statusCob: ["status da transação", "status"]
    });

    const colDataSantander = idxSantander.indexes.data !== undefined && idxSantander.indexes.data !== -1 ? idxSantander.indexes.data : 3;
    const colNsuSantander = idxSantander.indexes.nsu !== undefined && idxSantander.indexes.nsu !== -1 ? idxSantander.indexes.nsu : 10;
    const colStatusSantander = idxSantander.indexes.statusCob !== undefined && idxSantander.indexes.statusCob !== -1 ? idxSantander.indexes.statusCob : 8;

    for (let i = idxSantander.headerRowIdx + 1; i < rowsSantander.length; i++) {
      const r = rowsSantander[i];
      const statusCob = normKey(r[colStatusSantander]);

      if (!isStatusAprovado(statusCob)) continue;

      const rawNsu = normKey(r[colNsuSantander]);
      const cleanNsu = cleanNSU(rawNsu);
      const dtParsed = formatToBRDate(r[colDataSantander]);

      if (cleanNsu && dtParsed) {
        extratosDataMap.set(cleanNsu, dtParsed);
      }
    }
  }

  const results = [];

  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedApp]);
    const cleanPed = normPedido(rawPed);
    const rawNsu = normKey(r[colNsuApp]);
    const dtAppParsed = formatToBRDate(r[colDataPagtoApp]);
    const dApp = dtAppParsed ? dtAppParsed.dateObj : null;
    const strApp = dtAppParsed ? dtAppParsed.str : "-";

    if (!cleanPed && !rawNsu) continue;

    if (isExcecaoOK(rawNsu)) {
      results.push({
        pedido: rawPed,
        nsu: rawNsu,
        dataExtrato: "-",
        dataApp: strApp,
        _status: "ok",
        _statusLabel: "OK (Exceção: Bonificado / Boleto / Zero)"
      });
      continue;
    }

    if (!rawNsu || rawNsu === "," || rawNsu === ".") {
      results.push({
        pedido: rawPed,
        nsu: "(vazio)",
        dataExtrato: "-",
        dataApp: strApp,
        _status: "warn",
        _statusLabel: "Sem NSU no App"
      });
      continue;
    }

    const nsus = rawNsu.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
    let dtExtratoEncontrada = null;

    for (const nsu of nsus) {
      const cleanTarget = cleanNSU(nsu);
      if (extratosDataMap.has(cleanTarget)) {
        dtExtratoEncontrada = extratosDataMap.get(cleanTarget);
        break;
      } else {
        for (let [kExt, dtObj] of extratosDataMap.entries()) {
          if (kExt.endsWith(cleanTarget) || cleanTarget.endsWith(kExt)) {
            dtExtratoEncontrada = dtObj;
            break;
          }
        }
        if (dtExtratoEncontrada) break;
      }
    }

    let status = "ok";
    let label = "OK";

    if (!dtExtratoEncontrada) {
      status = "warn";
      label = "NSU não localizado nos extratos";
    } else if (!dApp) {
      status = "warn";
      label = "Sem data de pagamento no App";
    } else if (!sameDay(dtExtratoEncontrada.dateObj, dApp)) {
      status = "bad";
      label = "Data Divergente";
    }

    results.push({
      pedido: rawPed,
      nsu: rawNsu,
      dataExtrato: dtExtratoEncontrada ? dtExtratoEncontrada.str : "-",
      dataApp: strApp,
      _status: status,
      _statusLabel: label
    });
  }

  renderResult("result-datapagto", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "nsu", label: "NSU(s)" },
    { key: "dataExtrato", label: "Data Liquidação (Extratos)" },
    { key: "dataApp", label: "Data Pagto (App - Col Z)" }
  ], "Data_Pagamento_App_x_Extratos");
}

