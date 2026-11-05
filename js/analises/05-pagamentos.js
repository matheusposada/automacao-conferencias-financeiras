/* Análise 5 — Pagamentos (App × Extratos) */
// 5. PAGAMENTOS (App x Safra, Pix e Santander) - CORRIGIDO
async function rodarPagamentos() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsSafra = fileStore.safra ? await parseFileToRows(fileStore.safra) : null;
  const rowsPix = fileStore.pix ? await parseFileToRows(fileStore.pix) : null;
  const rowsSantander = fileStore.santander ? await parseFileToRows(fileStore.santander) : null;

  if (!rowsApp) return alert("Erro ao ler a planilha do App.");

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido", "id"],
    nsu: ["nsus confirmados", "nsu"],
    valorTotal: ["valor total do pedido (r$)", "valor total a pagar", "valor (r$)"],
    statusFin: ["status financeiro", "status fin"]
  });

  const colPedApp = idxApp.indexes.pedido ?? 0;
  const colNsuApp = idxApp.indexes.nsu ?? 22;
  const colValApp = idxApp.indexes.valorTotal ?? 39;
  const colStatusFinApp = idxApp.indexes.statusFin !== undefined && idxApp.indexes.statusFin !== -1 ? idxApp.indexes.statusFin : 8;

  const pagamentosMap = new Map();

  function registrarPagamento(rawNsu, val) {
    const cNsu = cleanNSU(rawNsu);
    if (cNsu && val !== null) {
      if (pagamentosMap.has(cNsu)) {
        const valExistente = pagamentosMap.get(cNsu);
        if (Math.abs(valExistente - val) > 0.01) {
          pagamentosMap.set(cNsu, Math.max(valExistente, val));
        }
      } else {
        pagamentosMap.set(cNsu, val);
      }
    }
  }

  if (rowsSafra) {
    const idxSafra = findHeaderAndIndexes(rowsSafra, {
      nsu: ["nsu", "id da cobrança", "comprovante"],
      valor: ["valor da transação", "valor total da cobrança", "valor pago", "valor"],
      statusCob: ["status da cobrança", "status", "situacao", "situação"]
    });
    const colNsuSafra = idxSafra.indexes.nsu ?? 10;
    const colValSafra = idxSafra.indexes.valor ?? 16;
    const colStatusDetectado = idxSafra.indexes.statusCob;

    for (let i = idxSafra.headerRowIdx + 1; i < rowsSafra.length; i++) {
      const r = rowsSafra[i];
      
      const stDet = colStatusDetectado !== undefined && colStatusDetectado !== -1 ? normKey(r[colStatusDetectado]) : "";

      if (stDet && !isStatusAprovado(stDet)) {
        continue;
      }

      registrarPagamento(r[colNsuSafra], toNumber(r[colValSafra]));
    }
  }

  if (rowsPix) {
    const idxPix = findHeaderAndIndexes(rowsPix, {
      documento: ["documento", "nsu", "id"],
      valor: ["valor"]
    });
    const colDocPix = idxPix.indexes.documento ?? 2;
    const colValPix = idxPix.indexes.valor ?? 3;

    for (let i = idxPix.headerRowIdx + 1; i < rowsPix.length; i++) {
      const r = rowsPix[i];
      registrarPagamento(r[colDocPix], toNumber(r[colValPix]));
    }
  }

  if (rowsSantander) {
    const idxSantander = findHeaderAndIndexes(rowsSantander, {
      nsu: ["número do comprovante de vendas (cv)", "comprovante", "cv", "nsu"],
      valor: ["valor total da venda", "valor total", "valor"],
      statusCob: ["status da transação", "status"]
    });

    const colNsuSantander = idxSantander.indexes.nsu !== undefined && idxSantander.indexes.nsu !== -1 ? idxSantander.indexes.nsu : 10;
    const colValSantander = idxSantander.indexes.valor !== undefined && idxSantander.indexes.valor !== -1 ? idxSantander.indexes.valor : 12;
    const colStatusSantander = idxSantander.indexes.statusCob !== undefined && idxSantander.indexes.statusCob !== -1 ? idxSantander.indexes.statusCob : 8;

    for (let i = idxSantander.headerRowIdx + 1; i < rowsSantander.length; i++) {
      const r = rowsSantander[i];
      const statusCob = normKey(r[colStatusSantander]);
      
      if (!isStatusAprovado(statusCob)) continue;

      registrarPagamento(r[colNsuSantander], toNumber(r[colValSantander]));
    }
  }

  const pedidosAppMap = new Map();

  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedApp]);
    const cleanPed = normPedido(rawPed);
    const rawNsu = normKey(r[colNsuApp]);
    const valTotalApp = toNumber(r[colValApp]) ?? 0;
    const statusFin = normKey(r[colStatusFinApp]);

    if (!cleanPed) continue;

    if (!pedidosAppMap.has(cleanPed)) {
      pedidosAppMap.set(cleanPed, {
        rawPed: rawPed,
        valorApp: valTotalApp,
        statusFin: statusFin,
        nsus: new Set()
      });
    }

    const item = pedidosAppMap.get(cleanPed);
    if (valTotalApp > 0 && (item.valorApp === 0 || item.valorApp === null)) {
      item.valorApp = valTotalApp;
    }
    if (statusFin && !item.statusFin) {
      item.statusFin = statusFin;
    }

    if (rawNsu && rawNsu !== "," && rawNsu !== ".") {
      const tokens = rawNsu.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
      tokens.forEach(t => item.nsus.add(t));
    }
  }

  const nsuToGroupMap = new Map();

  pedidosAppMap.forEach((item, cleanPed) => {
    item.nsus.forEach(rawNsu => {
      const cNsu = cleanNSU(rawNsu);
      if (!cNsu || isExcecaoOK(rawNsu) || nsuToGroupMap.has(cNsu)) return;

      const groupNsus = new Set();
      const groupPedidos = new Set();
      const queueNsu = [cNsu];

      while (queueNsu.length > 0) {
        const currNsu = queueNsu.shift();
        if (groupNsus.has(currNsu)) continue;
        groupNsus.add(currNsu);

        pedidosAppMap.forEach((pSub, pKey) => {
          const pCleanNsus = Array.from(pSub.nsus).map(n => cleanNSU(n));
          if (pCleanNsus.includes(currNsu)) {
            groupPedidos.add(pKey);
            pCleanNsus.forEach(otherNsu => {
              if (otherNsu && !groupNsus.has(otherNsu)) {
                queueNsu.push(otherNsu);
              }
            });
          }
        });
      }

      let somaPedidosGrupo = 0;
      groupPedidos.forEach(pKey => {
        somaPedidosGrupo += (pedidosAppMap.get(pKey)?.valorApp ?? 0);
      });

      let somaExtratosGrupo = 0;
      groupNsus.forEach(nClean => {
        const { valor } = buscarPagamentoPorNsu(nClean, pagamentosMap);
        somaExtratosGrupo += valor;
      });

      const groupInfo = {
        somaPedidos: somaPedidosGrupo,
        somaExtratos: somaExtratosGrupo,
        qntPedidos: groupPedidos.size,
        qntNsus: groupNsus.size
      };

      groupNsus.forEach(nClean => {
        nsuToGroupMap.set(nClean, groupInfo);
      });
    });
  });

  const results = [];

  pedidosAppMap.forEach((item) => {
    const nsusList = Array.from(item.nsus);
    const valTotalApp = item.valorApp;
    const statusFinAppStr = (item.statusFin || "").toLowerCase();
    const isConfirmadoNoApp = statusFinAppStr.includes("confirmado") || statusFinAppStr.includes("pgto confirmado");

    if (nsusList.length === 0) {
      results.push({
        pedido: item.rawPed,
        nsu: "(vazio)",
        valorPagamento: 0,
        valorApp: valTotalApp,
        _status: "warn",
        _statusLabel: "Sem NSU no App"
      });
      return;
    }

    if (nsusList.some(n => isExcecaoOK(n))) {
      results.push({
        pedido: item.rawPed,
        nsu: nsusList.join(" / "),
        valorPagamento: valTotalApp ?? 0,
        valorApp: valTotalApp,
        _status: "ok",
        _statusLabel: "OK (Exceção: Bonificado / Boleto / Zero)"
      });
      return;
    }

    let somaExtratosDoPedido = 0;
    let nsusEncontradosCount = 0;

    nsusList.forEach(rawNsuInd => {
      const { valor, encontrado } = buscarPagamentoPorNsu(rawNsuInd, pagamentosMap);
      if (encontrado) {
        somaExtratosDoPedido += valor;
        nsusEncontradosCount++;
      }
    });

    nsusList.forEach(rawNsuInd => {
      const { cTarget, valor: valorIndividualExtrato } = buscarPagamentoPorNsu(rawNsuInd, pagamentosMap);

      const diffFracionada = Math.abs(Math.round(somaExtratosDoPedido * 100) - Math.round((valTotalApp ?? 0) * 100));
      const bateuSomaFracionada = (nsusEncontradosCount === nsusList.length) && (diffFracionada <= 100);

      const infoGrupo = nsuToGroupMap.get(cTarget);
      let bateuGrupo = false;

      if (infoGrupo) {
        const diffGrupo = Math.abs(Math.round(infoGrupo.somaExtratos * 100) - Math.round(infoGrupo.somaPedidos * 100));
        bateuGrupo = (diffGrupo <= 100);
      }

      let status = "ok";
      let label = "OK";

      if (bateuSomaFracionada || bateuGrupo) {
        status = "ok";
        if (nsusList.length > 1 || (infoGrupo && (infoGrupo.qntPedidos > 1 || infoGrupo.qntNsus > 1))) {
          label = "OK (Pagamento Fracionado/Misto)";
        } else if (diffFracionada > 1 && diffFracionada <= 100) {
          label = "OK (Diferença <= R$ 1,00)";
        } else {
          label = "OK";
        }
      } else if (valorIndividualExtrato === 0 && nsusEncontradosCount === 0) {
        status = "warn";
        label = "NSU não localizado (Safra/Pix/Santander)";
      } else {
        if (isConfirmadoNoApp) {
          status = "bad";
          label = "Valor Divergente";
        } else {
          status = "warn";
          label = `Pendente no App (${item.statusFin || "Aguardando Conferência"})`;
        }
      }

      results.push({
        pedido: item.rawPed,
        nsu: cTarget || rawNsuInd,
        valorPagamento: valorIndividualExtrato,
        valorApp: valTotalApp,
        _status: status,
        _statusLabel: label
      });
    });
  });

  results.sort((a, b) => {
    const compPed = String(a.pedido).localeCompare(String(b.pedido));
    if (compPed !== 0) return compPed;
    return String(a.nsu).localeCompare(String(b.nsu));
  });

  renderResult("result-pagamentos", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "nsu", label: "NSU(s) Registrado(s)" },
    { key: "valorPagamento", label: "Valor Pago no Extrato (R$)", isCurrency: true },
    { key: "valorApp", label: "Valor Total (App)", isCurrency: true }
  ], "Pagamentos_App_x_Safra_Pix_Santander");
}

