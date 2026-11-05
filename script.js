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

// FUNÇÃO UTILITÁRIA PARA LER O INTERVALO DO FLATPICKR
function getFlatpickrRange(pickerInstance) {
  if (!pickerInstance || !pickerInstance.selectedDates || pickerInstance.selectedDates.length === 0) {
    return { ini: null, fim: null };
  }
  const dates = pickerInstance.selectedDates;
  const ini = dates[0] ? new Date(dates[0]) : null;
  const fim = dates[1] ? new Date(dates[1]) : (dates[0] ? new Date(dates[0]) : null);

  if (ini) ini.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);

  return { ini, fim };
}

// FORMATADOR ESTRITO DE DATAS NO PADRÃO BR (DD/MM/YYYY)
function formatToBRDate(v) {
  if (!v && v !== 0) return null;

  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    const day = String(v.getDate()).padStart(2, '0');
    const month = String(v.getMonth() + 1).padStart(2, '0');
    const year = v.getFullYear();
    return { str: `${day}/${month}/${year}`, dateObj: v };
  }

  if (typeof v === "number") {
    const utcDays = Math.floor(v - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const dateObj = new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
    
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return { str: `${day}/${month}/${year}`, dateObj };
  }

  if (typeof v === "string" && v.trim() !== "") {
    const cleaned = v.trim();

    const mBr = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mBr) {
      const day = String(parseInt(mBr[1], 10)).padStart(2, '0');
      const month = String(parseInt(mBr[2], 10)).padStart(2, '0');
      const year = parseInt(mBr[3], 10);
      const dateObj = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
      return { str: `${day}/${month}/${year}`, dateObj };
    }

    const mIso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (mIso) {
      const year = parseInt(mIso[1], 10);
      const month = String(parseInt(mIso[2], 10)).padStart(2, '0');
      const day = String(parseInt(mIso[3], 10)).padStart(2, '0');
      const dateObj = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
      return { str: `${day}/${month}/${year}`, dateObj };
    }
  }

  return null;
}

function excelDateToJsDate(v) {
  const parsed = formatToBRDate(v);
  return parsed ? parsed.dateObj : null;
}

function cleanNSU(val) {
  if (val === null || val === undefined || val === "") return "";
  let str = String(val).trim().replace(",", ".");
  
  if (str.toLowerCase().includes("e+")) {
    const num = Number(str);
    if (!isNaN(num)) {
      str = BigInt(Math.round(num)).toString();
    }
  } else {
    str = str.split('.')[0];
  }
  
  return str.replace(/\D/g, "").replace(/^0+/, "");
}

function normPedido(v) {
  if (v === null || v === undefined) return "";
  let str = String(v).trim();
  if (str.includes("-")) {
    str = str.split("-").pop().trim();
  }
  const digits = str.replace(/\D/g, "");
  return digits ? String(parseInt(digits, 10)) : str.toLowerCase();
}

function normKey(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function sanitizeText(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, " ")
    .trim();
}

function isStatusAprovado(statusStr) {
  if (!statusStr || String(statusStr).trim() === "") return true;
  
  const st = sanitizeText(statusStr);
  
  if (
    st.includes("nao") || 
    st.includes("negad") || 
    st.includes("recusad") || 
    st.includes("cancelad") || 
    st.includes("vencid") || 
    st.includes("falha") ||
    st.includes("estornad") ||
    st.includes("devolvido")
  ) {
    return false;
  }
  
  return (
    st.includes("autoriz") || 
    st.includes("aprovad") || 
    st.includes("pago") || 
    st.includes("liquidad") || 
    st.includes("confirmad") ||
    st.includes("sucesso") ||
    st === "ok"
  );
}

function isExcecaoOK(rawNsu) {
  if (!rawNsu) return false;
  const str = String(rawNsu).trim().toLowerCase();
  
  if (str === "" || str === "." || str === ",") return false;
  if (str.includes("bonifica") || str.includes("bonif") || str.includes("boleto")) return true;
  
  const digitsOnly = str.replace(/\D/g, "");
  if (digitsOnly.length > 0 && /^0+$/.test(digitsOnly)) return true;
  
  return false;
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  
  let cleaned = String(v)
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .trim();

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }

  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatBRL(val) {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// FUNÇÃO UNIFICADA PARA BUSCA DE PAGAMENTO POR NSU
function buscarPagamentoPorNsu(rawNsuInd, pagamentosMap) {
  if (!rawNsuInd) return { cTarget: "", valor: 0, encontrado: false };

  const cTarget = cleanNSU(rawNsuInd).replace(/^0+/, "");
  let valor = pagamentosMap.get(cTarget) ?? null;

  if (valor === null) {
    for (let [kExt, vExt] of pagamentosMap.entries()) {
      const kExtClean = kExt.replace(/^0+/, "");
      if (kExtClean === cTarget || kExtClean.endsWith(cTarget) || cTarget.endsWith(kExtClean)) {
        valor = vExt;
        break;
      }
    }
  }

  return { 
    cTarget, 
    valor: valor ?? 0, 
    encontrado: valor !== null 
  };
}

async function parseFileToRows(file, preferredSheetName = null) {
  if (!file) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

    if (text.includes('\uFFFD')) {
      text = new TextDecoder('windows-1252').decode(buffer);
    }

    const delimiter = text.includes(';') ? ';' : ',';
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    return lines.map(line => line.split(delimiter).map(cell => cell.replace(/^"|"$/g, '').trim()));
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  
  let targetSheet = wb.SheetNames[0];
  if (preferredSheetName && wb.SheetNames.length > 1) {
    const exactMatch = wb.SheetNames.find(s => s.toLowerCase().trim() === preferredSheetName.toLowerCase().trim());
    if (exactMatch) {
      targetSheet = exactMatch;
    } else {
      const found = wb.SheetNames.find(s => s.toLowerCase().includes(preferredSheetName.toLowerCase()));
      if (found) targetSheet = found;
    }
  }

  const ws = wb.Sheets[targetSheet];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
}

function findHeaderAndIndexes(rows, columnRules) {
  if (!rows) return { headerRowIdx: 0, indexes: {} };
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const rowStr = rows[r].map(c => normKey(c).toLowerCase());
    const indexes = {};
    let matchesCount = 0;

    for (const [key, possibleNames] of Object.entries(columnRules)) {
      let matchedIdx = -1;
      for (const name of possibleNames) {
        const foundIdx = rowStr.findIndex(cell => cell.includes(name.toLowerCase()));
        if (foundIdx !== -1) {
          matchedIdx = foundIdx;
          break;
        }
      }
      if (matchedIdx !== -1) {
        indexes[key] = matchedIdx;
        matchesCount++;
      }
    }

    if (matchesCount >= 1) {
      return { headerRowIdx: r, indexes };
    }
  }
  return { headerRowIdx: 0, indexes: {} };
}

// ---------- UI CONTROLES ----------
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    });
  });
}
setupTabs();

function setupCentralUploads() {
  const inputs = [
    { id: "file-base-app", storeKey: "app" },
    { id: "file-base-vendas", storeKey: "vendas" },
    { id: "file-base-safra", storeKey: "safra" },
    { id: "file-base-pix", storeKey: "pix" },
    { id: "file-base-santander", storeKey: "santander" },
    { id: "file-base-relpedidos", storeKey: "relpedidos" } // NOVO INPUT
  ];

  inputs.forEach(item => {
    const inputEl = document.getElementById(item.id);
    if (!inputEl) return;
    const dropZone = inputEl.closest('.drop');
    const span = dropZone ? dropZone.querySelector('span') : null;
    const defaultText = span ? span.textContent : "Clique ou arraste o arquivo aqui";

    inputEl.addEventListener('change', () => {
      if (inputEl.files && inputEl.files[0]) {
        fileStore[item.storeKey] = inputEl.files[0];
        if (span) span.innerHTML = `✅ <b>${inputEl.files[0].name}</b> carregado`;
      } else {
        fileStore[item.storeKey] = null;
        if (span) span.textContent = defaultText;
      }
    });

    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eName => {
        dropZone.addEventListener(eName, (e) => {
          e.preventDefault(); e.stopPropagation();
          dropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eName => {
        dropZone.addEventListener(eName, (e) => {
          e.preventDefault(); e.stopPropagation();
          dropZone.classList.remove('dragover');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length) {
          inputEl.files = files;
          inputEl.dispatchEvent(new Event('change'));
        }
      });
    }
  });
}
setupCentralUploads();

function renderResult(containerId, rows, columns, tabTitle = "Conferencia") {
  const el = document.getElementById(containerId);
  el.style.display = "block";
  el.innerHTML = "";

  const counts = { ok: 0, bad: 0, warn: 0 };
  rows.forEach(r => counts[r._status]++);

  const summary = document.createElement("div");
  summary.className = "summary";
  summary.innerHTML = `
    <span class="pill total">${rows.length} registros</span>
    <span class="pill ok">${counts.ok} OK</span>
    <span class="pill bad">${counts.bad} Divergente / Pendente</span>
    <span class="pill warn">${counts.warn} Não Encontrado / Sem Data</span>
  `;
  el.appendChild(summary);

  const controlsRow = document.createElement("div");
  controlsRow.className = "controls-row";

  const filters = document.createElement("div");
  filters.className = "filters";
  filters.innerHTML = `
    <button data-f="all" class="active">Tudo</button>
    <button data-f="bad">Só Divergentes/Pendentes</button>
    <button data-f="warn">Só Não Encontrados</button>
    <button data-f="ok">Só OK</button>
  `;

  const exportBtn = document.createElement("button");
  exportBtn.className = "btn-export";
  exportBtn.textContent = "📥 Exportar (.xlsx)";

  controlsRow.appendChild(filters);
  controlsRow.appendChild(exportBtn);
  el.appendChild(controlsRow);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "🔎 Buscar por pedido, cliente, NSU, status...";
  searchInput.className = "search-input";
  el.appendChild(searchInput);

  const tablewrap = document.createElement("div");
  tablewrap.className = "tablewrap";
  el.appendChild(tablewrap);

  let currentFilter = "all";

  function draw() {
    let visible = rows;
    if (currentFilter !== "all") visible = rows.filter(r => r._status === currentFilter);

    const term = searchInput.value.toLowerCase().trim();
    if (term !== "") {
      visible = visible.filter(r => 
        columns.some(c => String(r[c.key] ?? "").toLowerCase().includes(term)) ||
        r._statusLabel.toLowerCase().includes(term)
      );
    }

    if (visible.length === 0) {
      tablewrap.innerHTML = `<div class="empty">Nenhum registro encontrado.</div>`;
      return;
    }

    let html = "<table><thead><tr>";
    columns.forEach(c => html += `<th>${c.label}</th>`);
    html += "<th>Status</th></tr></thead><tbody>";

    visible.forEach(r => {
      html += `<tr class="status-${r._status}">`;
      columns.forEach(c => {
        let val = r[c.key] ?? "";
        if (c.isCurrency && typeof val === "number") val = formatBRL(val);
        html += `<td>${val}</td>`;
      });
      html += `<td class="status">${r._statusLabel}</td></tr>`;
    });
    html += "</tbody></table>";
    tablewrap.innerHTML = html;
  }

  draw();

  filters.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      filters.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentFilter = b.dataset.f;
      draw();
    });
  });

  searchInput.addEventListener("input", draw);

  exportBtn.addEventListener("click", () => {
    const exportData = rows.map(r => {
      const obj = {};
      columns.forEach(c => {
        let val = r[c.key];
        if (c.isCurrency && (typeof val === "number" || (!isNaN(parseFloat(val)) && isFinite(val)))) {
          obj[c.label] = val !== null && val !== undefined ? Number(val) : "";
        } else {
          obj[c.label] = val ?? "";
        }
      });
      obj["Status"] = r._statusLabel;
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    columns.forEach((c, colIdx) => {
      if (c.isCurrency) {
        const colLetter = XLSX.utils.encode_col(colIdx);
        for (let rIdx = 2; rIdx <= rows.length + 1; rIdx++) {
          const cellRef = `${colLetter}${rIdx}`;
          if (ws[cellRef] && typeof ws[cellRef].v === "number") {
            ws[cellRef].z = '"R$"#,##0.00;("R$"#,##0.00);"-"';
          }
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conferencia");
    XLSX.writeFile(wb, `${tabTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

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

// 2. CONSULTORES (App x Vendas) - EXCLUI VENDEDORES 'SAC'
async function rodarConsultores() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido", "id"],
    vendedor: ["vendedor (omie)", "vendedor", "consultor"]
  });

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    consultor: ["consultor", "vendedor", "razão social"]
  });

  const colPedidoApp = idxApp.indexes.pedido ?? 0;
  const colVendedorApp = idxApp.indexes.vendedor ?? 11;

  const colPedidoVen = idxVen.indexes.pedido ?? 9;
  const colConsultorVen = idxVen.indexes.consultor ?? 3;

  const appMap = new Map();
  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedidoApp]);
    const cleanPed = normPedido(rawPed);
    const consultorApp = normKey(r[colVendedorApp]);

    if (sanitizeText(consultorApp) === "sac" || sanitizeText(consultorApp).includes("sac")) {
      continue;
    }

    if (cleanPed) appMap.set(cleanPed, consultorApp);
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedidoVen]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const cApp = appMap.get(cleanPed);
    const cVendas = normKey(r[colConsultorVen]);

    let status = "ok";
    let label = "OK";

    if (cApp === undefined) {
      status = "warn";
      label = "Pedido não encontrado no App (ou consultor é SAC)";
    } else if (cVendas.toLowerCase() !== cApp.toLowerCase()) {
      status = "bad";
      label = "Consultor Divergente";
    }

    results.push({
      pedido: rawPed,
      consultorVendas: cVendas,
      consultorApp: cApp || "-",
      _status: status,
      _statusLabel: label
    });
  }

  renderResult("result-consultores", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "consultorVendas", label: "Consultor (Vendas)" },
    { key: "consultorApp", label: "Consultor (App)" }
  ], "Consultores_App_x_Vendas");
}

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

// 4. VALORES (App x Vendas)
async function rodarValores() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido"],
    valor: ["valor total do pedido (r$)", "valor total a pagar", "valor"],
    statusGeral: ["status"],
    statusFin: ["status financeiro", "status fin"]
  });

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    valor: ["valor liquido", "valor total da venda", "valor"]
  });

  const colPedApp = idxApp.indexes.pedido ?? 0;
  const colValApp = idxApp.indexes.valor ?? 39;
  const colStGeralApp = idxApp.indexes.statusGeral ?? 7;
  const colStFinApp = idxApp.indexes.statusFin ?? 8;

  const colPedVen = idxVen.indexes.pedido ?? 9;
  const colValVen = idxVen.indexes.valor ?? 12;

  const appMap = new Map();
  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedApp]);
    const cleanPed = normPedido(rawPed);

    const stGeral = sanitizeText(r[colStGeralApp]);
    const stFin = sanitizeText(r[colStFinApp]);

    if (stGeral.includes("cancelad") || stFin.includes("cancelad")) {
      continue;
    }

    if (cleanPed) appMap.set(cleanPed, toNumber(r[colValApp]));
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedVen]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const valVendas = toNumber(r[colValVen]);

    if (valVendas === 0 || valVendas === null) {
      continue;
    }

    const valApp = appMap.get(cleanPed);

    let status = "ok";
    let label = "OK";

    if (valApp === undefined) {
      status = "warn";
      label = "Pedido não encontrado no App (ou Cancelado no App)";
    } else if (Math.round(valVendas * 100) !== Math.round(valApp * 100)) {
      status = "bad";
      label = "Valor Divergente";
    }

    results.push({
      pedido: rawPed,
      valorVendas: valVendas,
      valorApp: valApp,
      _status: status,
      _statusLabel: label
    });
  }

  renderResult("result-valores", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "valorVendas", label: "Valor (Vendas)", isCurrency: true },
    { key: "valorApp", label: "Valor (App)", isCurrency: true }
  ], "Valores_App_x_Vendas");
}

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

// 9. ANÁLISE DE INDICADORES FINANCEIROS
async function rodarAnaliseIndicadores() {
  const rows = await parseFileToRows(fileStore.app, "Pedidos");
  if (!rows) return alert("Erro ao ler a planilha do App.");

  const { headerRowIdx, indexes } = findHeaderAndIndexes(rows, {
    dtFinAguardando: ["data financeiro aguardando", "data e hora", "criado em"],
    statusGeral: ["status"],
    statusFin: ["status financeiro", "status fin"],
    tPendVer: ["tempo aguardando → verificado (h)", "tempo aguardando verificado"],
    tVerConf: ["tempo verificado → confirmado (h)", "tempo verificado confirmado"],
    tTotal: ["tempo total aguardando → confirmado (h)", "tempo total aguardando confirmado"]
  });

  const colDtFinAguardando = indexes.dtFinAguardando !== undefined && indexes.dtFinAguardando !== -1 ? indexes.dtFinAguardando : 4;
  const colStGeralApp = indexes.statusGeral !== undefined && indexes.statusGeral !== -1 ? indexes.statusGeral : 7;
  const colStatusFin = indexes.statusFin !== undefined && indexes.statusFin !== -1 ? indexes.statusFin : 8;
  const colTPendVer = indexes.tPendVer !== undefined && indexes.tPendVer !== -1 ? indexes.tPendVer : 33;
  const colTVerConf = indexes.tVerConf !== undefined && indexes.tVerConf !== -1 ? indexes.tVerConf : 34;
  const colTTotal = indexes.tTotal !== undefined && indexes.tTotal !== -1 ? indexes.tTotal : 35;

  const { ini: dtMainIni, fim: dtMainFim } = getFlatpickrRange(pickerIndPrincipal);
  const { ini: dtCompIni, fim: dtCompFim } = getFlatpickrRange(pickerIndComp);

  function isNoRange(dt, ini, fim) {
    if (!dt) return false;
    if (ini && dt < ini) return false;
    if (fim && dt > fim) return false;
    return true;
  }

  let totalMain = 0, cntConfMain = 0, cntAguardMain = 0, cntPendMain = 0;
  const evolucaoDiariaMap = new Map();

  let listTPendVer = [];
  let listTVerConf = [];
  let listTTotal = [];

  const faixasSLA = {
    ate24h: 0,
    entre24e48h: 0,
    entre48e72h: 0,
    entre3e5dias: 0,
    entre5e10dias: 0,
    acima10dias: 0
  };

  let totalComp = 0, cntConfComp = 0, cntAguardComp = 0, cntPendComp = 0;
  let temComparativo = false;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    
    const dtParsed = formatToBRDate(r[colDtFinAguardando]);
    if (!dtParsed) continue;

    const dtPed = dtParsed.dateObj;
    const strDateBR = dtParsed.str;

    const rawStatusFin = normKey(r[colStatusFin]).toLowerCase();
    const rawStatusGeral = normKey(r[colStGeralApp]).toLowerCase();

    if (rawStatusFin.includes("cancelad") || rawStatusGeral.includes("cancelad")) {
      continue;
    }

    let statusCat = "Pendente";

    if (
      rawStatusFin.includes("confirmado") || 
      rawStatusFin.includes("pgto confirmado") || 
      rawStatusFin.includes("faturado") || 
      rawStatusFin.includes("faturamento")
    ) {
      statusCat = "Confirmado";
    } else if (rawStatusFin.includes("aguardando pagamento") || rawStatusFin.includes("verificado")) {
      statusCat = "Aguardando";
    } else if (rawStatusFin.includes("pagamento pendente") || rawStatusFin.includes("pendente")) {
      statusCat = "Pendente";
    }

    if (isNoRange(dtPed, dtMainIni, dtMainFim)) {
      totalMain++;
      if (statusCat === "Confirmado") cntConfMain++;
      else if (statusCat === "Aguardando") cntAguardMain++;
      else cntPendMain++;

      if (!evolucaoDiariaMap.has(strDateBR)) {
        evolucaoDiariaMap.set(strDateBR, { 
          dataKey: dtPed, 
          dataStr: strDateBR, 
          total: 0, 
          confirmado: 0, 
          aguardando: 0, 
          pendente: 0 
        });
      }
      const dItem = evolucaoDiariaMap.get(strDateBR);
      dItem.total++;
      if (statusCat === "Confirmado") dItem.confirmado++;
      if (statusCat === "Aguardando") dItem.aguardando++;
      if (statusCat === "Pendente") dItem.pendente++;

      const valPendVer = toNumber(r[colTPendVer]);
      const valVerConf = toNumber(r[colTVerConf]);
      const valTotal = toNumber(r[colTTotal]);

      if (valPendVer !== null && valPendVer >= 0) listTPendVer.push(valPendVer);
      if (valVerConf !== null && valVerConf >= 0) listTVerConf.push(valVerConf);

      if (valTotal !== null && valTotal >= 0) {
        listTTotal.push(valTotal);

        if (valTotal <= 24) faixasSLA.ate24h++;
        else if (valTotal <= 48) faixasSLA.entre24e48h++;
        else if (valTotal <= 72) faixasSLA.entre48e72h++;
        else if (valTotal <= 120) faixasSLA.entre3e5dias++;
        else if (valTotal <= 240) faixasSLA.entre5e10dias++;
        else faixasSLA.acima10dias++;
      }
    }

    if ((dtCompIni || dtCompFim) && isNoRange(dtPed, dtCompIni, dtCompFim)) {
      temComparativo = true;
      totalComp++;
      if (statusCat === "Confirmado") cntConfComp++;
      else if (statusCat === "Aguardando") cntAguardComp++;
      else cntPendComp++;
    }
  }

  const avg = arr => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "0.0";
  const calcPct = (v, t) => t > 0 ? ((v / t) * 100).toFixed(1) : "0.0";

  const listDiariaOrdenada = Array.from(evolucaoDiariaMap.values()).sort((a, b) => a.dataKey - b.dataKey);
  const totalConfirmadosComSLA = listTTotal.length;

  const el = document.getElementById("result-indicadores");
  el.style.display = "block";
  el.innerHTML = "";

  let html = `
    <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
      <button id="btn-copy-gamma" style="background: #6b46c1; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
        📋 Copiar Resumo Formatado para o Gamma
      </button>
      <button id="btn-export-xlsx-ind" style="background: #2b6cb0; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
        📥 Exportar Indicadores (.xlsx)
      </button>
    </div>

    <!-- 1. DISTRIBUIÇÃO POR STATUS FINANCEIRO -->
    <div style="margin-bottom: 25px;">
      <h2>📊 1. Distribuição por Status Financeiro</h2>
      <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 15px;">
        <div style="background: #2b303b; padding: 15px; border-radius: 8px; flex: 1; min-width: 180px;">
          <small style="color: #a0aec0;">Total de Pedidos</small>
          <div style="font-size: 24px; font-weight: bold; color: #fff;">${totalMain}</div>
        </div>
        <div style="background: #1e3a2b; padding: 15px; border-radius: 8px; flex: 1; min-width: 180px;">
          <small style="color: #68d391;">Pgto Confirmado</small>
          <div style="font-size: 24px; font-weight: bold; color: #48bb78;">${cntConfMain} (${calcPct(cntConfMain, totalMain)}%)</div>
        </div>
        <div style="background: #3d321d; padding: 15px; border-radius: 8px; flex: 1; min-width: 180px;">
          <small style="color: #f6ad55;">Aguardando Pagamento</small>
          <div style="font-size: 24px; font-weight: bold; color: #ecc94b;">${cntAguardMain} (${calcPct(cntAguardMain, totalMain)}%)</div>
        </div>
        <div style="background: #3b1e1e; padding: 15px; border-radius: 8px; flex: 1; min-width: 180px;">
          <small style="color: #fc8181;">Pagamento Pendente</small>
          <div style="font-size: 24px; font-weight: bold; color: #f56565;">${cntPendMain} (${calcPct(cntPendMain, totalMain)}%)</div>
        </div>
      </div>
    </div>

    <!-- 2. EVOLUÇÃO DIÁRIA DE PEDIDOS -->
    <div style="margin-bottom: 25px;">
      <h2>📈 2. Evolução Diária de Pedidos</h2>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Data Chegada Fin. (Coluna E)</th>
              <th>Total Pedidos</th>
              <th>Pgto Confirmado</th>
              <th>Aguardando Pagamento</th>
              <th>Pagamento Pendente</th>
              <th>% Conversão Dia</th>
            </tr>
          </thead>
          <tbody>
            ${listDiariaOrdenada.map(d => `
              <tr>
                <td><b>${d.dataStr}</b></td>
                <td>${d.total}</td>
                <td style="color: #48bb78; font-weight: bold;">${d.confirmado}</td>
                <td style="color: #ecc94b;">${d.aguardando}</td>
                <td style="color: #f56565;">${d.pendente}</td>
                <td>${calcPct(d.confirmado, d.total)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. TEMPOS MÉDIOS DE PROCESSAMENTO -->
    <div style="margin-bottom: 25px;">
      <h2>⏱️ 3. Tempos Médios de Processamento (SLA)</h2>
      <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 15px;">
        <div style="background: #1a202c; border: 1px solid #2d3748; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px;">
          <small style="color: #a0aec0;">Pendente → Aguardando Pgto (h)</small>
          <div style="font-size: 22px; font-weight: bold; color: #63b3ed;">${avg(listTPendVer)}h</div>
        </div>
        <div style="background: #1a202c; border: 1px solid #2d3748; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px;">
          <small style="color: #a0aec0;">Aguardando Pgto → Confirmado (h)</small>
          <div style="font-size: 22px; font-weight: bold; color: #63b3ed;">${avg(listTVerConf)}h</div>
        </div>
        <div style="background: #1a202c; border: 1px solid #3182ce; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px;">
          <small style="color: #a0aec0;">Total Pendente → Confirmado (h)</small>
          <div style="font-size: 22px; font-weight: bold; color: #3182ce;">${avg(listTTotal)}h</div>
        </div>
      </div>
    </div>

    <!-- 4. MATRIZ REAL DE TEMPO DE CONFIRMAÇÃO -->
    <div style="margin-bottom: 25px;">
      <h2>📅 4. Matriz Real de Tempo de Confirmação</h2>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Faixa de Tempo</th>
              <th>Qtd. Pedidos</th>
              <th>% do Total Confirmado</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><b>Até 24h</b></td><td>${faixasSLA.ate24h}</td><td><b>${calcPct(faixasSLA.ate24h, totalConfirmadosComSLA)}%</b></td></tr>
            <tr><td><b>24 a 48h</b></td><td>${faixasSLA.entre24e48h}</td><td>${calcPct(faixasSLA.entre24e48h, totalConfirmadosComSLA)}%</td></tr>
            <tr><td><b>48 a 72h</b></td><td>${faixasSLA.entre48e72h}</td><td>${calcPct(faixasSLA.entre48e72h, totalConfirmadosComSLA)}%</td></tr>
            <tr><td><b>3 a 5 dias</b></td><td>${faixasSLA.entre3e5dias}</td><td>${calcPct(faixasSLA.entre3e5dias, totalConfirmadosComSLA)}%</td></tr>
            <tr><td><b>5 a 10 dias</b></td><td>${faixasSLA.entre5e10dias}</td><td>${calcPct(faixasSLA.entre5e10dias, totalConfirmadosComSLA)}%</td></tr>
            <tr><td><b>Acima de 10 dias</b></td><td>${faixasSLA.acima10dias}</td><td>${calcPct(faixasSLA.acima10dias, totalConfirmadosComSLA)}%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (temComparativo) {
    html += `
      <div style="margin-bottom: 25px; padding-top: 15px; border-top: 2px dashed #4a5568;">
        <h2>🔄 5. Comparativo Semanal</h2>
        <div class="tablewrap" style="margin-top: 15px;">
          <table>
            <thead>
              <tr>
                <th>Métrica / Status</th>
                <th>Semana Anterior</th>
                <th>Semana Atual</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Total de Pedidos</b></td>
                <td>${totalComp}</td>
                <td>${totalMain}</td>
                <td><b>${(totalMain - totalComp) >= 0 ? '+' : ''}${totalMain - totalComp} pedidos</b></td>
              </tr>
              <tr>
                <td><b>Pgto Confirmado</b></td>
                <td>${cntConfComp} (${calcPct(cntConfComp, totalComp)}%)</td>
                <td>${cntConfMain} (${calcPct(cntConfMain, totalMain)}%)</td>
                <td style="color: ${cntConfMain >= cntConfComp ? '#48bb78' : '#f56565'}; font-weight: bold;">
                  ${(calcPct(cntConfMain, totalMain) - calcPct(cntConfComp, totalComp)).toFixed(1)}% p.p.
                </td>
              </tr>
              <tr>
                <td><b>Aguardando Pagamento</b></td>
                <td>${cntAguardComp} (${calcPct(cntAguardComp, totalComp)}%)</td>
                <td>${cntAguardMain} (${calcPct(cntAguardMain, totalMain)}%)</td>
                <td>${(calcPct(cntAguardMain, totalMain) - calcPct(cntAguardComp, totalComp)).toFixed(1)}% p.p.</td>
              </tr>
              <tr>
                <td><b>Pagamento Pendente</b></td>
                <td>${cntPendComp} (${calcPct(cntPendComp, totalComp)}%)</td>
                <td>${cntPendMain} (${calcPct(cntPendMain, totalMain)}%)</td>
                <td>${(calcPct(cntPendMain, totalMain) - calcPct(cntPendComp, totalComp)).toFixed(1)}% p.p.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  el.innerHTML = html;

  document.getElementById("btn-copy-gamma").addEventListener("click", () => {
    let textForGamma = `DISTRIBUIÇÃO POR STATUS FINANCEIRO\n`;
    textForGamma += `Total de Pedidos no Período: ${totalMain}\n`;
    textForGamma += `Pagamento Confirmado: ${cntConfMain} pedidos (${calcPct(cntConfMain, totalMain)}%)\n`;
    textForGamma += `Aguardando Pagamento: ${cntAguardMain} pedidos (${calcPct(cntAguardMain, totalMain)}%)\n`;
    textForGamma += `Pagamento Pendente: ${cntPendMain} pedidos (${calcPct(cntPendMain, totalMain)}%)\n\n`;

    textForGamma += `EVOLUÇÃO DIÁRIA DE PEDIDOS\nData Chegada | Total | Confirmado | Aguardando | Pendente | Conversão\n`;
    listDiariaOrdenada.forEach(d => {
      textForGamma += `${d.dataStr} | ${d.total} | ${d.confirmado} | ${d.aguardando} | ${d.pendente} | ${calcPct(d.confirmado, d.total)}%\n`;
    });

    textForGamma += `\nTEMPOS MÉDIOS DE PROCESSAMENTO (SLA)\n`;
    textForGamma += `Pendente -> Aguardando Pgto: ${avg(listTPendVer)}h\n`;
    textForGamma += `Aguardando Pgto -> Confirmado: ${avg(listTVerConf)}h\n`;
    textForGamma += `Total End-to-End: ${avg(listTTotal)}h\n\n`;

    textForGamma += `MATRIZ REAL DE TEMPO DE CONFIRMAÇÃO\n`;
    textForGamma += `Até 24h: ${faixasSLA.ate24h} (${calcPct(faixasSLA.ate24h, totalConfirmadosComSLA)}%)\n`;
    textForGamma += `24 a 48h: ${faixasSLA.entre24e48h} (${calcPct(faixasSLA.entre24e48h, totalConfirmadosComSLA)}%)\n`;
    textForGamma += `48 a 72h: ${faixasSLA.entre48e72h} (${calcPct(faixasSLA.entre48e72h, totalConfirmadosComSLA)}%)\n`;
    textForGamma += `3 a 5 dias: ${faixasSLA.entre3e5dias} (${calcPct(faixasSLA.entre3e5dias, totalConfirmadosComSLA)}%)\n`;
    textForGamma += `5 a 10 dias: ${faixasSLA.entre5e10dias} (${calcPct(faixasSLA.entre5e10dias, totalConfirmadosComSLA)}%)\n`;
    textForGamma += `Acima de 10 dias: ${faixasSLA.acima10dias} (${calcPct(faixasSLA.acima10dias, totalConfirmadosComSLA)}%)\n`;

    if (temComparativo) {
      textForGamma += `\nCOMPARATIVO SEMANAL\n`;
      textForGamma += `Total de Pedidos: Anterior ${totalComp} vs Atual ${totalMain}\n`;
      textForGamma += `Pgto Confirmado: Anterior ${cntConfComp} (${calcPct(cntConfComp, totalComp)}%) vs Atual ${cntConfMain} (${calcPct(cntConfMain, totalMain)}%)\n`;
    }

    navigator.clipboard.writeText(textForGamma).then(() => {
      alert("✅ Resumo copiado para a área de transferência! Cole no Gamma.");
    });
  });

  document.getElementById("btn-export-xlsx-ind").addEventListener("click", () => {
    const wb = XLSX.utils.book_new();

    const dsResumo = [
      ["Métrica", "Valor", "Percentual"],
      ["Total de Pedidos", totalMain, "100%"],
      ["Pgto Confirmado", cntConfMain, `${calcPct(cntConfMain, totalMain)}%`],
      ["Aguardando Pagamento", cntAguardMain, `${calcPct(cntAguardMain, totalMain)}%`],
      ["Pagamento Pendente", cntPendMain, `${calcPct(cntPendMain, totalMain)}%`],
      [],
      ["Métrica de Tempo (SLA)", "Horas Média"],
      ["Pendente -> Aguardando Pgto", `${avg(listTPendVer)}h`],
      ["Aguardando Pgto -> Confirmado", `${avg(listTVerConf)}h`],
      ["Total End-to-End", `${avg(listTTotal)}h`]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dsResumo), "Resumo_Geral");

    const dsDiario = [["Data Chegada Fin.", "Total Pedidos", "Confirmados", "Aguardando Pgto", "Pendentes", "% Conversão"]];
    listDiariaOrdenada.forEach(d => {
      dsDiario.push([d.dataStr, d.total, d.confirmado, d.aguardando, d.pendente, `${calcPct(d.confirmado, d.total)}%`]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dsDiario), "Evolucao_Diaria");

    const dsMatriz = [
      ["Faixa de Tempo", "Qtd Pedidos", "% do Total Confirmado"],
      ["Até 24h", faixasSLA.ate24h, `${calcPct(faixasSLA.ate24h, totalConfirmadosComSLA)}%`],
      ["24 a 48h", faixasSLA.entre24e48h, `${calcPct(faixasSLA.entre24e48h, totalConfirmadosComSLA)}%`],
      ["48 a 72h", faixasSLA.entre48e72h, `${calcPct(faixasSLA.entre48e72h, totalConfirmadosComSLA)}%`],
      ["3 a 5 dias", faixasSLA.entre3e5dias, `${calcPct(faixasSLA.entre3e5dias, totalConfirmadosComSLA)}%`],
      ["5 a 10 dias", faixasSLA.entre5e10dias, `${calcPct(faixasSLA.entre5e10dias, totalConfirmadosComSLA)}%`],
      ["Acima de 10 dias", faixasSLA.acima10dias, `${calcPct(faixasSLA.acima10dias, totalConfirmadosComSLA)}%`]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dsMatriz), "Matriz_SLA");

    XLSX.writeFile(wb, `Indicadores_Financeiros_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

// 10. AUDITORIA DE CANCELAMENTOS (Vendas x Relatório de Pedidos)
async function rodarCancelamentos() {
  const rowsRel = await parseFileToRows(fileStore.relpedidos);
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  if (!rowsRel || !rowsVendas) {
    return alert("Por favor, carregue o Relatório de Pedidos e a planilha de Vendas no topo.");
  }

  // Mapeamento de colunas no Relatório de Pedidos
  const idxRel = findHeaderAndIndexes(rowsRel, {
    pedido: ["nº pedido", "pedido", "id"],
    status: ["status"],
    valor: ["total a pagar", "valor total", "valor"]
  });

  // Mapeamento de colunas em Vendas
  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido", "número do comprovante de vendas (cv)"],
    valor: ["valor", "valor liquido", "valor total da venda"],
    status: ["status da transação", "status"]
  });

  const colPedRel = idxRel.indexes.pedido ?? 0;
  const colStRel = idxRel.indexes.status ?? 1;
  const colValRel = idxRel.indexes.valor ?? 7;

  const colPedVen = idxVen.indexes.pedido ?? 9;
  const colValVen = idxVen.indexes.valor ?? 8;
  const colStVen = idxVen.indexes.status ?? 7;

  // 1. Mapeia Relatório de Pedidos
  const relMap = new Map();
  for (let i = idxRel.headerRowIdx + 1; i < rowsRel.length; i++) {
    const r = rowsRel[i];
    const rawPed = normKey(r[colPedRel]);
    const cleanPed = normPedido(rawPed);

    if (cleanPed && !relMap.has(cleanPed)) {
      const stRel = normKey(r[colStRel]);
      relMap.set(cleanPed, {
        rawPed: rawPed,
        statusGeral: stRel,
        valor: toNumber(r[colValRel]) ?? 0,
        isCancelado: sanitizeText(stRel).includes("cancelad")
      });
    }
  }

  // 2. Mapeia Vendas
  const vendasMap = new Map();
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedVen]);
    const cleanPed = normPedido(rawPed);

    if (!cleanPed || cleanPed === "0" || cleanPed === "manual") continue;

    const valVendas = toNumber(r[colValVen]) ?? 0;
    const stVendas = normKey(r[colStVen]);

    vendasMap.set(cleanPed, {
      rawPed: rawPed,
      status: stVendas,
      valor: valVendas,
      isCancelado: sanitizeText(stVendas).includes("cancelad") || sanitizeText(stVendas).includes("estornad")
    });
  }

  const results = [];
  const processados = new Set();

  // A) Varredura a partir de VENDAS
  vendasMap.forEach((venda, cleanPed) => {
    processados.add(cleanPed);
    const relMatch = relMap.get(cleanPed);
    const isRelCancelado = relMatch ? relMatch.isCancelado : false;

    // Avalia se pelo menos um dos lados possui indicação de cancelamento
    if (venda.isCancelado || isRelCancelado) {
      let statusClass = "ok";
      let label = "OK (Cancelado em Ambos)";

      if (venda.isCancelado && !isRelCancelado) {
        statusClass = "bad";
        label = relMatch 
          ? `Divergente: Cancelado em Vendas (${venda.status}) e Ativo no Relatório (${relMatch.statusGeral})` 
          : "Divergente: Cancelado em Vendas e Não Encontrado no Relatório";
      } else if (!venda.isCancelado && isRelCancelado) {
        statusClass = "bad";
        label = `Divergente: Ativo em Vendas (${venda.status}) e Cancelado no Relatório (${relMatch.statusGeral})`;
      }

      results.push({
        pedido: venda.rawPed,
        statusVendas: `${venda.status || "N/A"} (${formatBRL(venda.valor)})`,
        statusRelatorio: relMatch ? `${relMatch.statusGeral} (${formatBRL(relMatch.valor)})` : "Não Encontrado",
        _status: statusClass,
        _statusLabel: label
      });
    }
  });

  // B) Varredura de pedidos cancelados no Relatório e não encontrados em Vendas
  relMap.forEach((relItem, cleanPed) => {
    if (processados.has(cleanPed)) return;

    if (relItem.isCancelado) {
      results.push({
        pedido: relItem.rawPed,
        statusVendas: "Não Encontrado em Vendas",
        statusRelatorio: `${relItem.statusGeral} (${formatBRL(relItem.valor)})`,
        _status: "bad",
        _statusLabel: "Divergente: Cancelado no Relatório de Pedidos e Não Encontrado em Vendas"
      });
    }
  });

  renderResult("result-cancelamentos", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "statusVendas", label: "Status / Valor (Vendas)" },
    { key: "statusRelatorio", label: "Status / Valor (Relatório de Pedidos)" }
  ], "Auditoria_Cancelamentos_Vendas_x_Relatorio");
}

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