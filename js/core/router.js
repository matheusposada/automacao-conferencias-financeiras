/* Roteador dos botões "Rodar análise" (valida arquivos e chama a análise) */
// ---------- ROTEADOR DE BOTÕES ----------
document.querySelectorAll(".btn-executar").forEach(btn => {
  btn.addEventListener("click", async () => {
    const analise = btn.dataset.analise;

    switch (analise) {
      case "duplicidade":
        if (!fileStore.app) return alert("Por favor, carregue a planilha do App no topo.");
        await rodarDuplicidades();
        break;

      case "consultores":
        if (!fileStore.app || !fileStore.vendas) return alert("Por favor, carregue as planilhas do App e de Vendas no topo.");
        await rodarConsultores();
        break;

      case "datas":
        if (!fileStore.app || !fileStore.vendas) return alert("Por favor, carregue as planilhas do App e de Vendas no topo.");
        await rodarDatas();
        break;

      case "valores":
        if (!fileStore.app || !fileStore.vendas) return alert("Por favor, carregue as planilhas do App e de Vendas no topo.");
        await rodarValores();
        break;

      case "pagamentos":
        if (!fileStore.app || (!fileStore.safra && !fileStore.pix && !fileStore.santander)) {
          return alert("Por favor, carregue a planilha do App e ao menos um extrato (Safra, Pix ou Santander) no topo.");
        }
        await rodarPagamentos();
        break;

      case "datapagto":
        if (!fileStore.app || (!fileStore.safra && !fileStore.pix && !fileStore.santander)) {
          return alert("Por favor, carregue a planilha do App e ao menos um extrato (Safra, Pix ou Santander) no topo.");
        }
        await rodarDataPagamento();
        break;

      case "confirmacao":
        if (!fileStore.app || (!fileStore.safra && !fileStore.pix && !fileStore.santander)) {
          return alert("Por favor, carregue a planilha do App e ao menos um extrato (Safra, Pix ou Santander) no topo.");
        }
        await rodarConfirmacaoPagamento();
        break;

      case "duplicidadevendas":
        if (!fileStore.vendas) return alert("Por favor, carregue a planilha de Vendas no topo.");
        await rodarDuplicidadesVendas();
        break;

      case "indicadores":
        if (!fileStore.app) return alert("Por favor, carregue a planilha do App no topo.");
        await rodarAnaliseIndicadores();
        break;

      case "cancelamentos":
        if (!fileStore.relpedidos || !fileStore.vendas) {
          return alert("Por favor, carregue o Relatório de Pedidos e a planilha de Vendas no topo.");
        }
        await rodarCancelamentos();
        break;

      case "vendasnoapp":
        if (!fileStore.relpedidos || !fileStore.vendas) {
          return alert("Por favor, carregue as planilhas de Vendas e o novo Relatório de Pedidos no topo.");
        }
        await rodarVendasNoApp();
        break;

        case "statusfinanceiro":
        if (!fileStore.relpedidos || !fileStore.vendas) {
          return alert("Por favor, carregue o Relatório de Pedidos e a planilha de Vendas no topo.");
        }
        await rodarStatusFinanceiro();
        break;
    }
  });
});

// ---------- ENGINES DE ANÁLISE ----------

