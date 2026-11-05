/* Análise 12 — Status financeiro (Vendas × Relatório de Pedidos) */
// 12. CONFERÊNCIA DE STATUS FINANCEIRO (Vendas x Relatório de Pedidos - Regras Atualizadas)
async function rodarStatusFinanceiro() {
  const rowsRel = await parseFileToRows(fileStore.relpedidos);
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  if (!rowsRel || !rowsVendas) {
    return alert("Por favor, carregue o Relatório de Pedidos e a planilha de Vendas no topo.");
  }

  // Mapeia colunas do Relatório de Pedidos
  const idxRel = findHeaderAndIndexes(rowsRel, {
    pedido: ["nº pedido", "pedido", "id"],
    statusFin: ["status financeiro", "status fin"] // Coluna C
  });

  // Mapeia colunas de Vendas
  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    formaPgto: ["forma de pagamento", "forma pgto", "pagamento"], // Coluna G
    status: ["status da transação", "status"] // Coluna H
  });

  const colPedRel = idxRel.indexes.pedido ?? 0;
  const colStFinRel = idxRel.indexes.statusFin ?? 2; // Coluna C

  const colPedVen = idxVen.indexes.pedido ?? 9;
  const colFormaVen = idxVen.indexes.formaPgto ?? 6; // Coluna G
  const colStVen = idxVen.indexes.status ?? 7; // Coluna H

  // 1. Mapeia o Relatório de Pedidos por código do pedido
  const relMap = new Map();
  for (let i = idxRel.headerRowIdx + 1; i < rowsRel.length; i++) {
    const r = rowsRel[i];
    const rawPed = normKey(r[colPedRel]);
    const cleanPed = normPedido(rawPed);

    if (cleanPed && !relMap.has(cleanPed)) {
      relMap.set(cleanPed, {
        rawPed: rawPed,
        statusFin: normKey(r[colStFinRel])
      });
    }
  }

  // Métodos de pagamento do Grupo 1
  const grupo1Formas = ["link cartao", "pix", "pix+boleto", "pix+cartao", "cartao+boleto", "pix+link+boleto"];
  
  // Status do relatório aceitos para pagamentos concluídos / liquidados / faturados
  const statusOkConcluidos = [
    "pagamento confirmado", 
    "pagamento_confirmado", 
    "faturado", 
    "em_faturamento", 
    "em faturamento", 
    "aguardando_cadastro", 
    "aguardando cadastro"
  ];

  const results = [];

  // 2. Varredura da planilha de Vendas aplicando as regras
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedVen]);
    const cleanPed = normPedido(rawPed);

    if (!cleanPed || cleanPed === "0" || cleanPed === "manual") continue;

    const formaPgto = normKey(r[colFormaVen]);
    const stVendas = normKey(r[colStVen]);
    const formaClean = sanitizeText(formaPgto);
    const stVendasClean = sanitizeText(stVendas);

    const relMatch = relMap.get(cleanPed);

    if (!relMatch) {
      results.push({
        pedido: rawPed,
        formaPgto: formaPgto || "-",
        statusVendas: stVendas || "-",
        statusFinRel: "Não Encontrado no Relatório",
        _status: "warn",
        _statusLabel: "Pedido não localizado no Relatório de Pedidos"
      });
      continue;
    }

    const stFinRel = relMatch.statusFin;
    const stFinRelClean = sanitizeText(stFinRel);

    let isValido = false;
    let regraDesc = "";

    // Validação se o status em Vendas é um dos estados concluídos
    const isVendasConcluido = ["pgto confirmado", "pagamento confirmado", "confirmado", "finalizado", "credito", "crédito"].includes(stVendasClean);

    // REGRA 1: Link cartão, Pix, Pix+Boleto, Pix+Cartão, Cartão+Boleto, Pix+Link+Boleto
    const isGrupo1 = grupo1Formas.includes(formaClean) || 
                     (formaClean.includes("link") || formaClean.includes("pix") || formaClean.includes("cartao"));

    if (isGrupo1 && !formaClean.includes("bonifica")) {
      if (["gerado", "pendente", "unificar"].includes(stVendasClean)) {
        regraDesc = "Grupo 1: Gerado/Pendente/Unificar → Verificado";
        if (["verificado"].includes(stFinRelClean)) {
          isValido = true;
        }
      } else if (isVendasConcluido) {
        regraDesc = "Grupo 1: Concluído → Confirmado / Faturado / Em Faturamento / Aguardando Cadastro";
        if (statusOkConcluidos.includes(stFinRelClean)) {
          isValido = true;
        }
      } else {
        regraDesc = `Grupo 1 com Status inesperado em Vendas (${stVendas})`;
      }
    }
    // REGRA 2: Boleto
    else if (formaClean.includes("boleto")) {
      regraDesc = "Boleto: Finalizado / Concluído → Confirmado / Faturado / Em Faturamento / Aguardando Cadastro";
      if ((["finalizado"].includes(stVendasClean) || isVendasConcluido) && statusOkConcluidos.includes(stFinRelClean)) {
        isValido = true;
      }
    }
    // REGRA 3: Bonificado
    else if (formaClean.includes("bonifica")) {
      regraDesc = "Bonificado: Crédito / Concluído → Confirmado / Faturado / Em Faturamento / Aguardando Cadastro";
      if ((["credito", "crédito"].includes(stVendasClean) || isVendasConcluido) && statusOkConcluidos.includes(stFinRelClean)) {
        isValido = true;
      }
    } else {
      regraDesc = `Forma de pagamento não mapeada (${formaPgto})`;
    }

    results.push({
      pedido: rawPed,
      formaPgto: formaPgto || "-",
      statusVendas: stVendas || "-",
      statusFinRel: stFinRel || "-",
      _status: isValido ? "ok" : "bad",
      _statusLabel: isValido ? "OK" : `Divergente (${regraDesc})`
    });
  }

  renderResult("result-statusfinanceiro", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "formaPgto", label: "Forma de Pagamento (Vendas - Col G)" },
    { key: "statusVendas", label: "Status (Vendas - Col H)" },
    { key: "statusFinRel", label: "Status Financeiro (Relatório - Col C)" }
  ], "Conferencia_Status_Financeiro_Vendas_x_Relatorio");
}