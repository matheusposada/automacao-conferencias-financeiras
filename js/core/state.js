/* Estado global: arquivos carregados e calendários (inicialização no DOMContentLoaded) */
// MEMÓRIA CENTRAL DE ARQUIVOS
const fileStore = {
  app: null,
  vendas: null,
  safra: null,
  pix: null,
  santander: null,
  relpedidos: null // NOVO ARQUIVO
};

// INSTÂNCIAS DOS CALENDÁRIOS FLATPICKR (PERÍODOS)
let pickerConf = null;
let pickerIndPrincipal = null;
let pickerIndComp = null;

document.addEventListener("DOMContentLoaded", () => {
  // Configuração padrão em Português para Flatpickr Range
  const rangeConfig = {
    mode: "range",
    dateFormat: "d/m/Y",
    locale: "pt",
    allowInput: true
  };

  if (document.getElementById("filtro-periodo-confirmacao")) {
    pickerConf = flatpickr("#filtro-periodo-confirmacao", rangeConfig);
    document.getElementById("btn-limpar-periodo-conf")?.addEventListener("click", () => {
      pickerConf.clear();
    });
  }

  if (document.getElementById("ind-periodo-principal")) {
    pickerIndPrincipal = flatpickr("#ind-periodo-principal", rangeConfig);
    document.getElementById("btn-limpar-ind-principal")?.addEventListener("click", () => {
      pickerIndPrincipal.clear();
    });
  }

  if (document.getElementById("ind-periodo-comparativo")) {
    pickerIndComp = flatpickr("#ind-periodo-comparativo", rangeConfig);
    document.getElementById("btn-limpar-ind-comp")?.addEventListener("click", () => {
      pickerIndComp.clear();
    });
  }
});

