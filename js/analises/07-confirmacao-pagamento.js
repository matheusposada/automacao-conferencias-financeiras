/* Análise 7 — Confirmação de pagamento (Extratos → App) */
// 7. CONFIRMAÇÃO DE PAGAMENTO NOS EXTRATOS (Suporta filtro por Período Range)
async function rodarConfirmacaoPagamento() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsSafra = fileStore.safra ? await parseFileToRows(fileStore.safra) : null;
  const rowsPix = fileStore.pix ? await parseFileToRows(fileStore.pix) : null;
  const rowsSantander = fileStore.santander ? await parseFileToRows(fileStore.santander) : null;

  if (!rowsApp) return alert("Erro ao ler a planilha do App.");

  const { ini: dtFiltroIni, fim: dtFiltroFim } = getFlatpickrRange(pickerConf);

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["nº pedido", "número", "pedido"],
    nsu: ["nsu", "nsus confirmados"],
    statusFin: ["status financeiro", "status fin"],
    vendedor: ["vendedor (omie)", "vendedor", "consultor"]
  });

  const colPedApp = idxApp.indexes.pedido ?? 0;
  const colNsuApp = idxApp.indexes.nsu ?? 22;
  const colStatusFinApp = idxApp.indexes.statusFin !== undefined && idxApp.indexes.statusFin !== -1 ? idxApp.indexes.statusFin : 8;
  const colVendedorApp = idxApp.indexes.vendedor !== undefined && idxApp.indexes.vendedor !== -1 ? idxApp.indexes.vendedor : 11;

  const appNsuStatusMap = new Map();

  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedApp]);
    const rawNsu = normKey(r[colNsuApp]);
    const statusFin = normKey(r[colStatusFinApp]);
    const consultor = normKey(r[colVendedorApp]);

    if (!rawNsu || rawNsu === "," || rawNsu === ".") continue;

    const nsus = rawNsu.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
    nsus.forEach(nsu => {
      let cleanNsuKey = cleanNSU(nsu);
      if (cleanNsuKey) {
        if (appNsuStatusMap.has(cleanNsuKey)) {
          const existente = appNsuStatusMap.get(cleanNsuKey);
          const stLowerExistente = existente.statusFin.toLowerCase();
          const stLowerNovo = statusFin.toLowerCase();

          if (!existente.pedido.includes(rawPed)) {
            existente.pedido = `${existente.pedido} / ${rawPed}`;
          }

          const isNovoConfirmadoOuFaturado = stLowerNovo.includes("confirmado") || stLowerNovo.includes("faturado") || stLowerNovo.includes("faturamento");
          const isExistenteConfirmadoOuFaturado = stLowerExistente.includes("confirmado") || stLowerExistente.includes("faturado") || stLowerExistente.includes("faturamento");

          if (!isNovoConfirmadoOuFaturado && isExistenteConfirmadoOuFaturado) {
            existente.statusFin = statusFin;
          }
        } else {
          appNsuStatusMap.set(cleanNsuKey, {
            pedido: rawPed,
            statusFin: statusFin,
            consultor: consultor || "-",
            rawNsu: nsu
          });
        }
      }
    });
  }

  function inRange(jsDate) {
    if (!dtFiltroIni && !dtFiltroFim) return true;
    if (!jsDate) return false;
    if (dtFiltroIni && jsDate < dtFiltroIni) return false;
    if (dtFiltroFim && jsDate > dtFiltroFim) return false;
    return true;
  }

  function isConfirmadoStatus(stLower) {
    return (
      stLower.includes("pgto confirmado") ||
      stLower.includes("pagamento_confirmado") ||
      stLower.includes("confirmado") ||
      stLower.includes("faturado") ||
      stLower.includes("faturamento")
    );
  }

  const results = [];

  if (rowsSafra) {
    const idxSafra = findHeaderAndIndexes(rowsSafra, {
      data: ["data da cobrança", "data"],
      nsu: ["nsu", "id da cobrança", "comprovante"],
      valor: ["valor da transação", "valor total da cobrança", "valor pago", "valor"],
      identificador: ["link", "url", "identificador", "id"],
      statusCob: ["status da cobrança", "status", "situacao", "situação"]
    });

    const colDataSafra = idxSafra.indexes.data ?? 0;
    const colNsuSafra = idxSafra.indexes.nsu ?? 10;
    const colValSafra = idxSafra.indexes.valor ?? 16;
    const colIdentificadorSafra = idxSafra.indexes.identificador !== undefined && idxSafra.indexes.identificador !== -1 ? idxSafra.indexes.identificador : 7;
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
      const jsDate = dtParsed ? dtParsed.dateObj : null;
      const strDate = dtParsed ? dtParsed.str : "-";
      const valor = toNumber(r[colValSafra]);
      const identificadorColH = normKey(r[colIdentificadorSafra]) || "-";

      if (!cleanNsu && !rawNsu) continue;
      if (!inRange(jsDate)) continue;

      if (isExcecaoOK(rawNsu)) {
        results.push({
          origem: "Safra",
          data: strDate,
          nsu: cleanNsu || rawNsu,
          identificadorColH: identificadorColH,
          valor: valor,
          pedidoApp: "-",
          consultorApp: "-",
          statusFinApp: "-",
          _status: "ok",
          _statusLabel: "OK (Exceção: Bonificado / Boleto / Zero)"
        });
        continue;
      }

      let appMatch = appNsuStatusMap.get(cleanNsu);
      if (!appMatch) {
        for (let [kExt, item] of appNsuStatusMap.entries()) {
          if (kExt.endsWith(cleanNsu) || cleanNsu.endsWith(kExt)) {
            appMatch = item;
            break;
          }
        }
      }

      let status = "ok";
      let label = "OK (Pgto Confirmado)";

      if (!appMatch) {
        status = "warn";
        label = "Não Encontrado no App";
      } else {
        const stLower = appMatch.statusFin.toLowerCase();
        if (isConfirmadoStatus(stLower)) {
          status = "ok";
          label = "OK (Pgto Confirmado)";
        } else {
          status = "bad";
          label = `Pendente no App (${appMatch.statusFin || "Sem Status"})`;
        }
      }

      results.push({
        origem: "Safra",
        data: strDate,
        nsu: cleanNsu || rawNsu,
        identificadorColH: identificadorColH,
        valor: valor,
        pedidoApp: appMatch ? appMatch.pedido : "-",
        consultorApp: appMatch ? appMatch.consultor : "-",
        statusFinApp: appMatch ? appMatch.statusFin : "-",
        _status: status,
        _statusLabel: label
      });
    }
  }

  if (rowsPix) {
    const idxPix = findHeaderAndIndexes(rowsPix, {
      data: ["data"],
      documento: ["documento", "nsu", "id"],
      valor: ["valor"],
      identificador: ["link", "url", "identificador"]
    });

    const colDataPix = idxPix.indexes.data ?? 0;
    const colDocPix = idxPix.indexes.documento ?? 2;
    const colValPix = idxPix.indexes.valor ?? 3;
    const colIdentificadorPix = idxPix.indexes.identificador !== undefined && idxPix.indexes.identificador !== -1 ? idxPix.indexes.identificador : 7;

    for (let i = idxPix.headerRowIdx + 1; i < rowsPix.length; i++) {
      const r = rowsPix[i];
      const rawDoc = normKey(r[colDocPix]);
      const cleanDoc = cleanNSU(rawDoc);
      const dtParsed = formatToBRDate(r[colDataPix]);
      const jsDate = dtParsed ? dtParsed.dateObj : null;
      const strDate = dtParsed ? dtParsed.str : "-";
      const valor = toNumber(r[colValPix]);
      const identificadorColH = normKey(r[colIdentificadorPix]) || "-";

      if (!cleanDoc && !rawDoc) continue;
      if (!inRange(jsDate)) continue;

      if (isExcecaoOK(rawDoc)) {
        results.push({
          origem: "Pix",
          data: strDate,
          nsu: cleanDoc || rawDoc,
          identificadorColH: identificadorColH,
          valor: valor,
          pedidoApp: "-",
          consultorApp: "-",
          statusFinApp: "-",
          _status: "ok",
          _statusLabel: "OK (Exceção: Bonificado / Boleto / Zero)"
        });
        continue;
      }

      let appMatch = appNsuStatusMap.get(cleanDoc);
      if (!appMatch) {
        for (let [kExt, item] of appNsuStatusMap.entries()) {
          if (kExt.endsWith(cleanDoc) || cleanDoc.endsWith(kExt)) {
            appMatch = item;
            break;
          }
        }
      }

      let status = "ok";
      let label = "OK (Pgto Confirmado)";

      if (!appMatch) {
        status = "warn";
        label = "Não Encontrado no App";
      } else {
        const stLower = appMatch.statusFin.toLowerCase();
        if (isConfirmadoStatus(stLower)) {
          status = "ok";
          label = "OK (Pgto Confirmado)";
        } else {
          status = "bad";
          label = `Pendente no App (${appMatch.statusFin || "Sem Status"})`;
        }
      }

      results.push({
        origem: "Pix",
        data: strDate,
        nsu: cleanDoc || rawDoc,
        identificadorColH: identificadorColH,
        valor: valor,
        pedidoApp: appMatch ? appMatch.pedido : "-",
        consultorApp: appMatch ? appMatch.consultor : "-",
        statusFinApp: appMatch ? appMatch.statusFin : "-",
        _status: status,
        _statusLabel: label
      });
    }
  }

  if (rowsSantander) {
    const idxSantander = findHeaderAndIndexes(rowsSantander, {
      data: ["data/hora da venda", "data da venda", "data do vencimento", "data"],
      nsu: ["número do comprovante de vendas (cv)", "comprovante", "cv", "nsu"],
      valor: ["valor total da venda", "valor total", "valor"],
      identificador: ["número de autorização (aut)", "aut", "número do terminal", "terminal"],
      statusCob: ["status da transação", "status"]
    });

    const colDataSantander = idxSantander.indexes.data !== undefined && idxSantander.indexes.data !== -1 ? idxSantander.indexes.data : 3;
    const colNsuSantander = idxSantander.indexes.nsu !== undefined && idxSantander.indexes.nsu !== -1 ? idxSantander.indexes.nsu : 10;
    const colValSantander = idxSantander.indexes.valor !== undefined && idxSantander.indexes.valor !== -1 ? idxSantander.indexes.valor : 12;
    const colIdentificadorSantander = idxSantander.indexes.identificador !== undefined && idxSantander.indexes.identificador !== -1 ? idxSantander.indexes.identificador : 9;
    const colStatusSantander = idxSantander.indexes.statusCob !== undefined && idxSantander.indexes.statusCob !== -1 ? idxSantander.indexes.statusCob : 8;

    for (let i = idxSantander.headerRowIdx + 1; i < rowsSantander.length; i++) {
      const r = rowsSantander[i];
      const statusCob = normKey(r[colStatusSantander]);

      if (!isStatusAprovado(statusCob)) continue;

      const rawNsu = normKey(r[colNsuSantander]);
      const cleanNsu = cleanNSU(rawNsu);
      const dtParsed = formatToBRDate(r[colDataSantander]);
      const jsDate = dtParsed ? dtParsed.dateObj : null;
      const strDate = dtParsed ? dtParsed.str : "-";
      const valor = toNumber(r[colValSantander]);
      const identificadorColH = normKey(r[colIdentificadorSantander]) || "-";

      if (!cleanNsu && !rawNsu) continue;
      if (!inRange(jsDate)) continue;

      if (isExcecaoOK(rawNsu)) {
        results.push({
          origem: "Santander",
          data: strDate,
          nsu: cleanNsu || rawNsu,
          identificadorColH: identificadorColH,
          valor: valor,
          pedidoApp: "-",
          consultorApp: "-",
          statusFinApp: "-",
          _status: "ok",
          _statusLabel: "OK (Exceção: Bonificado / Boleto / Zero)"
        });
        continue;
      }

      let appMatch = appNsuStatusMap.get(cleanNsu);
      if (!appMatch) {
        for (let [kExt, item] of appNsuStatusMap.entries()) {
          if (kExt.endsWith(cleanNsu) || cleanNsu.endsWith(kExt)) {
            appMatch = item;
            break;
          }
        }
      }

      let status = "ok";
      let label = "OK (Pgto Confirmado)";

      if (!appMatch) {
        status = "warn";
        label = "Não Encontrado no App";
      } else {
        const stLower = appMatch.statusFin.toLowerCase();
        if (isConfirmadoStatus(stLower)) {
          status = "ok";
          label = "OK (Pgto Confirmado)";
        } else {
          status = "bad";
          label = `Pendente no App (${appMatch.statusFin || "Sem Status"})`;
        }
      }

      results.push({
        origem: "Santander",
        data: strDate,
        nsu: cleanNsu || rawNsu,
        identificadorColH: identificadorColH,
        valor: valor,
        pedidoApp: appMatch ? appMatch.pedido : "-",
        consultorApp: appMatch ? appMatch.consultor : "-",
        statusFinApp: appMatch ? appMatch.statusFin : "-",
        _status: status,
        _statusLabel: label
      });
    }
  }

  renderResult("result-confirmacao", results, [
    { key: "origem", label: "Origem (Extrato)" },
    { key: "data", label: "Data Liquidação" },
    { key: "nsu", label: "NSU / Documento" },
    { key: "identificadorColH", label: "Identificador / Link / AUT" },
    { key: "valor", label: "Valor Pago (R$)", isCurrency: true },
    { key: "pedidoApp", label: "Nº Pedido (App)" },
    { key: "consultorApp", label: "Consultor (App)" },
    { key: "statusFinApp", label: "Status Financeiro (App - Col I)" }
  ], "Confirmacao_Pagamento_Extratos_x_App");
}

