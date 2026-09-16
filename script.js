// MEMÓRIA CENTRAL DE ARQUIVOS
const fileStore = {
  app: null,
  vendas: null,
  safra: null,
  pix: null,
  santander: null
};

// Higienização ultra-robusta de NSU com suporte a notação científica do Excel (ex: 2,76E+10 -> 27569591546)
function cleanNSU(val) {
  if (val === null || val === undefined || val === "") return "";
  let str = String(val).trim().replace(",", ".");
  
  // Trata notação científica do Excel (ex: 2.7569591546e+10)
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

// Higieniza o número do pedido para remover prefixos (ex: "PED-2026-016077" -> "16077")
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

// REGRA GERAL DE EXCEÇÃO PARA NSUs (Bonificado, Boleto ou Zeros)
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
  if (typeof v === "number") return v;
  const cleaned = String(v)
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatBRL(val) {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function excelDateToJsDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (typeof v === "string" && v.trim() !== "") {
    const cleaned = v.trim();
    const mBr = cleaned.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (mBr) return new Date(+mBr[3], +mBr[2] - 1, +mBr[1]);
    
    const mIso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return new Date(+mIso[1], +mIso[2] - 1, +mIso[3]);
  }
  return null;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

async function parseFileToRows(file, preferredSheetName = null) {
  if (!file) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    const text = await file.text();
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
    { id: "file-base-santander", storeKey: "santander" }
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

  // EXPORTAÇÃO NATIVA PARA FUNCIONAR SOMA NA BARRA DE STATUS DO EXCEL
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
    
    const rawDateVal = r[idxData];
    const jsDate = excelDateToJsDate(rawDateVal);
    const strDate = jsDate ? jsDate.toLocaleDateString("pt-BR") : "-";

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
    const isDup = occurrences.length > 1;
    occurrences.forEach(item => {
      results.push({
        nsu: item.nsuExibicao,
        pedido: item.pedido,
        cliente: item.cliente,
        data: item.data,
        qntRepeticoes: occurrences.length,
        _status: isDup ? "bad" : "ok",
        _statusLabel: isDup ? `Duplicado (${occurrences.length}x)` : "Único"
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

// 2. CONSULTORES (App x Vendas)
async function rodarConsultores() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido", "id"],
    vendedor: ["vendedor (omie)", "vendedor", "consultor"]
  });

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido"],
    consultor: ["consultor", "vendedor"]
  });

  const colPedidoApp = idxApp.indexes.pedido ?? 0;
  const colVendedorApp = idxApp.indexes.vendedor ?? 28;

  const colPedidoVen = idxVen.indexes.pedido ?? 9;
  const colConsultorVen = idxVen.indexes.consultor ?? 3;

  const appMap = new Map();
  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedidoApp]);
    const cleanPed = normPedido(rawPed);
    if (cleanPed) appMap.set(cleanPed, normKey(r[colVendedorApp]));
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedidoVen]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const cVendas = normKey(r[colConsultorVen]);
    const cApp = appMap.get(cleanPed);

    let status = "ok";
    let label = "OK";

    if (cApp === undefined) {
      status = "warn";
      label = "Pedido não encontrado no App";
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
    pedido: ["id pedido", "nº pedido", "pedido"],
    data: ["data"]
  });

  const colPedidoVendas = idxVen.indexes.pedido !== undefined && idxVen.indexes.pedido !== -1 ? idxVen.indexes.pedido : 9;
  const colDataVendas = idxVen.indexes.data !== undefined && idxVen.indexes.data !== -1 ? idxVen.indexes.data : 0;

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
      const rawDateVal = r[colDataApp];
      const jsDate = excelDateToJsDate(rawDateVal);
      appMap.set(cleanPed, {
        rawPed: rawPed,
        date: jsDate
      });
    }
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedidoVendas]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const dVendas = excelDateToJsDate(r[colDataVendas]);
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
      dataVendas: dVendas ? dVendas.toLocaleDateString("pt-BR") : "-",
      dataApp: appEntry && appEntry.date ? appEntry.date.toLocaleDateString("pt-BR") : "-",
      _status: status,
      _statusLabel: label
    });
  }

  renderResult("result-datas", results, [
    { key: "pedido", label: "Nº Pedido" },
    { key: "dataVendas", label: "Data (Vendas - Col A)" },
    { key: "dataApp", label: "Data Verificação (App)" }
  ], "Datas_App_x_Vendas");
}

// 4. VALORES (App x Vendas)
async function rodarValores() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsVendas = await parseFileToRows(fileStore.vendas);

  const idxApp = findHeaderAndIndexes(rowsApp, {
    pedido: ["número", "nº pedido", "pedido"],
    valor: ["valor total a pagar", "valor total do pedido (r$)", "valor"]
  });

  const idxVen = findHeaderAndIndexes(rowsVendas, {
    pedido: ["id pedido", "nº pedido", "pedido"],
    valor: ["valor", "valor líquido"]
  });

  const colPedApp = idxApp.indexes.pedido ?? 0;
  const colValApp = idxApp.indexes.valor ?? 43;

  const colPedVen = idxVen.indexes.pedido ?? 9;
  const colValVen = idxVen.indexes.valor ?? 8;

  const appMap = new Map();
  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedApp]);
    const cleanPed = normPedido(rawPed);
    if (cleanPed) appMap.set(cleanPed, toNumber(r[colValApp]));
  }

  const results = [];
  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPedVen]);
    const cleanPed = normPedido(rawPed);
    if (!cleanPed) continue;

    const valVendas = toNumber(r[colValVen]);
    const valApp = appMap.get(cleanPed);

    let status = "ok";
    let label = "OK";

    if (valApp === undefined) {
      status = "warn";
      label = "Pedido não encontrado no App";
    } else if (valVendas === null || valApp === null) {
      status = "warn";
      label = "Sem valor para comparar";
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

// 5. PAGAMENTOS (App x Safra, Pix e Santander) - Exibição Individual por NSU com Validação por Grupo Cruzado e Tolerância de R$ 1,00
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
  const colStatusFinApp = idxApp.indexes.statusFin !== undefined && idxApp.indexes.statusFin !== -1 ? idxApp.indexes.statusFin : 2;

  // 1. Mapeia pagamentos dos extratos (Safra, Pix e Santander) por NSU
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
      nsu: ["nsu", "id da cobrança"],
      valor: ["valor da transação", "valor total da cobrança", "valor"],
      statusCob: ["status da cobrança", "status"]
    });
    const colNsuSafra = idxSafra.indexes.nsu ?? 10;
    const colValSafra = idxSafra.indexes.valor ?? 16;
    const colStatusSafra = idxSafra.indexes.statusCob !== undefined && idxSafra.indexes.statusCob !== -1 ? idxSafra.indexes.statusCob : 1;

    for (let i = idxSafra.headerRowIdx + 1; i < rowsSafra.length; i++) {
      const r = rowsSafra[i];
      const statusCob = normKey(r[colStatusSafra]).toLowerCase();
      if (statusCob && !statusCob.includes("autorizada")) continue;

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

    const colNsuSantander = idxSantander.indexes.nsu !== undefined && idxSantander.indexes.nsu !== -1 ? idxSantander.indexes.nsu : 10; // Coluna K
    const colValSantander = idxSantander.indexes.valor !== undefined && idxSantander.indexes.valor !== -1 ? idxSantander.indexes.valor : 12; // Coluna M
    const colStatusSantander = idxSantander.indexes.statusCob !== undefined && idxSantander.indexes.statusCob !== -1 ? idxSantander.indexes.statusCob : 8; // Coluna I

    for (let i = idxSantander.headerRowIdx + 1; i < rowsSantander.length; i++) {
      const r = rowsSantander[i];
      const statusCob = normKey(r[colStatusSantander]).toLowerCase();
      
      if (statusCob && !statusCob.includes("aprovada") && !statusCob.includes("autorizada") && !statusCob.includes("pago") && !statusCob.includes("confirmado")) {
        continue;
      }

      registrarPagamento(r[colNsuSantander], toNumber(r[colValSantander]));
    }
  }

  // 2. Consolida os Pedidos do App
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

// 3. Constrói Grupos Unificados por Teia de Interligação (Pedidos e NSUs interligados)
  const nsuToGroupMap = new Map(); // cNsu -> GroupInfo

  // Função auxiliar para expandir todo o grupo de pedidos e NSUs conectados
  pedidosAppMap.forEach((item, cleanPed) => {
    item.nsus.forEach(rawNsu => {
      const cNsu = cleanNSU(rawNsu);
      if (!cNsu || isExcecaoOK(rawNsu) || nsuToGroupMap.has(cNsu)) return;

      // Descoberta do grupo (Breadth-First Search)
      const groupNsus = new Set();
      const groupPedidos = new Set();
      const queueNsu = [cNsu];

      while (queueNsu.length > 0) {
        const currNsu = queueNsu.shift();
        if (groupNsus.has(currNsu)) continue;
        groupNsus.add(currNsu);

        // Encontra todos os pedidos que usam este NSU
        pedidosAppMap.forEach((pSub, pKey) => {
          const pCleanNsus = Array.from(pSub.nsus).map(n => cleanNSU(n));
          if (pCleanNsus.includes(currNsu)) {
            groupPedidos.add(pKey);
            // Adiciona todos os OUTROS NSUs desse pedido na fila para explorar
            pCleanNsus.forEach(otherNsu => {
              if (otherNsu && !groupNsus.has(otherNsu)) {
                queueNsu.push(otherNsu);
              }
            });
          }
        });
      }

      // Calcula as somas totais do grupo descoberto
      let somaPedidosGrupo = 0;
      groupPedidos.forEach(pKey => {
        somaPedidosGrupo += (pedidosAppMap.get(pKey)?.valorApp ?? 0);
      });

      let somaExtratosGrupo = 0;
      groupNsus.forEach(nClean => {
        somaExtratosGrupo += (pagamentosMap.get(nClean) ?? 0);
      });

      const groupInfo = {
        somaPedidos: somaPedidosGrupo,
        somaExtratos: somaExtratosGrupo,
        qntPedidos: groupPedidos.size,
        qntNsus: groupNsus.size
      };

      // Associa todos os NSUs do grupo a essa mesma info consolidada
      groupNsus.forEach(nClean => {
        nsuToGroupMap.set(nClean, groupInfo);
      });
    });
  });

  // 4. Monta os resultados exibindo o valor individual de cada NSU
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
      const cTarget = cleanNSU(rawNsuInd);
      let vEncontrado = pagamentosMap.get(cTarget) ?? null;

      if (vEncontrado === null) {
        for (let [kExt, vExt] of pagamentosMap.entries()) {
          if (kExt.endsWith(cTarget) || cTarget.endsWith(kExt)) {
            vEncontrado = vExt;
            break;
          }
        }
      }

      if (vEncontrado !== null) {
        somaExtratosDoPedido += vEncontrado;
        nsusEncontradosCount++;
      }
    });

    nsusList.forEach(rawNsuInd => {
      const cTarget = cleanNSU(rawNsuInd);
      let valorIndividualExtrato = pagamentosMap.get(cTarget) ?? 0;

      // Validação 1: Soma dos extratos do pedido == Valor do Pedido (tolerância R$ 1,00)
      const diffFracionada = Math.abs(Math.round(somaExtratosDoPedido * 100) - Math.round((valTotalApp ?? 0) * 100));
      const bateuSomaFracionada = (nsusEncontradosCount === nsusList.length) && (diffFracionada <= 100);

      // Validação 2: Checa se a soma da TEIA/GRUPO unificado de pedidos e NSUs bate (tolerância R$ 1,00)
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

  // ORDENAÇÃO DUPLA: Junta por Nº Pedido primeiro e depois por NSU
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

// 6. DATA DE PAGAMENTO (App Col Z x Safra/Pix Col A / Santander Col D)
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
      nsu: ["nsu", "id da cobrança"],
      statusCob: ["status da cobrança", "status"]
    });
    const colDataSafra = idxSafra.indexes.data !== undefined && idxSafra.indexes.data !== -1 ? idxSafra.indexes.data : 0;
    const colNsuSafra = idxSafra.indexes.nsu !== undefined && idxSafra.indexes.nsu !== -1 ? idxSafra.indexes.nsu : 10;
    const colStatusSafra = idxSafra.indexes.statusCob !== undefined && idxSafra.indexes.statusCob !== -1 ? idxSafra.indexes.statusCob : 1;

    for (let i = idxSafra.headerRowIdx + 1; i < rowsSafra.length; i++) {
      const r = rowsSafra[i];
      const statusCob = normKey(r[colStatusSafra]).toLowerCase();
      if (statusCob && !statusCob.includes("autorizada")) continue;

      const rawNsu = normKey(r[colNsuSafra]);
      const cleanNsu = cleanNSU(rawNsu);
      const jsDate = excelDateToJsDate(r[colDataSafra]);

      if (cleanNsu && jsDate) {
        extratosDataMap.set(cleanNsu, jsDate);
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
      const jsDate = excelDateToJsDate(r[colDataPix]);

      if (cleanDoc && jsDate) {
        extratosDataMap.set(cleanDoc, jsDate);
      }
    }
  }

  if (rowsSantander) {
    const idxSantander = findHeaderAndIndexes(rowsSantander, {
      data: ["data/hora da venda", "data da venda", "data do vencimento", "data"],
      nsu: ["número do comprovante de vendas (cv)", "comprovante", "cv", "nsu"],
      statusCob: ["status da transação", "status"]
    });

    const colDataSantander = idxSantander.indexes.data !== undefined && idxSantander.indexes.data !== -1 ? idxSantander.indexes.data : 3; // Coluna D
    const colNsuSantander = idxSantander.indexes.nsu !== undefined && idxSantander.indexes.nsu !== -1 ? idxSantander.indexes.nsu : 10; // Coluna K
    const colStatusSantander = idxSantander.indexes.statusCob !== undefined && idxSantander.indexes.statusCob !== -1 ? idxSantander.indexes.statusCob : 8; // Coluna I

    for (let i = idxSantander.headerRowIdx + 1; i < rowsSantander.length; i++) {
      const r = rowsSantander[i];
      const statusCob = normKey(r[colStatusSantander]).toLowerCase();

      if (statusCob && !statusCob.includes("aprovada") && !statusCob.includes("autorizada") && !statusCob.includes("pago") && !statusCob.includes("confirmado")) {
        continue;
      }

      const rawNsu = normKey(r[colNsuSantander]);
      const cleanNsu = cleanNSU(rawNsu);
      const jsDate = excelDateToJsDate(r[colDataSantander]);

      if (cleanNsu && jsDate) {
        extratosDataMap.set(cleanNsu, jsDate);
      }
    }
  }

  const results = [];

  for (let i = idxApp.headerRowIdx + 1; i < rowsApp.length; i++) {
    const r = rowsApp[i];
    const rawPed = normKey(r[colPedApp]);
    const cleanPed = normPedido(rawPed);
    const rawNsu = normKey(r[colNsuApp]);
    const dApp = excelDateToJsDate(r[colDataPagtoApp]);

    if (!cleanPed && !rawNsu) continue;

    if (isExcecaoOK(rawNsu)) {
      results.push({
        pedido: rawPed,
        nsu: rawNsu,
        dataExtrato: "-",
        dataApp: dApp ? dApp.toLocaleDateString("pt-BR") : "-",
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
        dataApp: dApp ? dApp.toLocaleDateString("pt-BR") : "-",
        _status: "warn",
        _statusLabel: "Sem NSU no App"
      });
      continue;
    }

    const nsus = rawNsu.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
    let dExtratoEncontrada = null;

    for (const nsu of nsus) {
      const cleanTarget = cleanNSU(nsu);
      if (extratosDataMap.has(cleanTarget)) {
        dExtratoEncontrada = extratosDataMap.get(cleanTarget);
        break;
      } else {
        for (let [kExt, dVal] of extratosDataMap.entries()) {
          if (kExt.endsWith(cleanTarget) || cleanTarget.endsWith(kExt)) {
            dExtratoEncontrada = dVal;
            break;
          }
        }
        if (dExtratoEncontrada) break;
      }
    }

    let status = "ok";
    let label = "OK";

    if (!dExtratoEncontrada) {
      status = "warn";
      label = "NSU não localizado nos extratos";
    } else if (!dApp) {
      status = "warn";
      label = "Sem data de pagamento no App";
    } else if (!sameDay(dExtratoEncontrada, dApp)) {
      status = "bad";
      label = "Data Divergente";
    }

    results.push({
      pedido: rawPed,
      nsu: rawNsu,
      dataExtrato: dExtratoEncontrada ? dExtratoEncontrada.toLocaleDateString("pt-BR") : "-",
      dataApp: dApp ? dApp.toLocaleDateString("pt-BR") : "-",
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

// 7. CONFIRMAÇÃO DE PAGAMENTO NOS EXTRATOS (Safra/Pix/Santander -> App)
async function rodarConfirmacaoPagamento() {
  const rowsApp = await parseFileToRows(fileStore.app, "Pedidos");
  const rowsSafra = fileStore.safra ? await parseFileToRows(fileStore.safra) : null;
  const rowsPix = fileStore.pix ? await parseFileToRows(fileStore.pix) : null;
  const rowsSantander = fileStore.santander ? await parseFileToRows(fileStore.santander) : null;

  if (!rowsApp) return alert("Erro ao ler a planilha do App.");

  const dataFiltroInput = document.getElementById("filtro-data-confirmacao") ? document.getElementById("filtro-data-confirmacao").value : "";
  let dataFiltroJs = null;
  if (dataFiltroInput) {
    const parts = dataFiltroInput.split("-");
    dataFiltroJs = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }

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

          if (!stLowerNovo.includes("confirmado") && stLowerExistente.includes("confirmado")) {
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

  const results = [];

  if (rowsSafra) {
    const idxSafra = findHeaderAndIndexes(rowsSafra, {
      data: ["data da cobrança", "data"],
      nsu: ["nsu", "id da cobrança"],
      valor: ["valor da transação", "valor total da cobrança", "valor"],
      identificador: ["link", "url", "identificador", "id"],
      statusCob: ["status da cobrança", "status"]
    });

    const colDataSafra = idxSafra.indexes.data ?? 0;
    const colNsuSafra = idxSafra.indexes.nsu ?? 10;
    const colValSafra = idxSafra.indexes.valor ?? 16;
    const colIdentificadorSafra = idxSafra.indexes.identificador !== undefined && idxSafra.indexes.identificador !== -1 ? idxSafra.indexes.identificador : 7;
    const colStatusSafra = idxSafra.indexes.statusCob !== undefined && idxSafra.indexes.statusCob !== -1 ? idxSafra.indexes.statusCob : 1;

    for (let i = idxSafra.headerRowIdx + 1; i < rowsSafra.length; i++) {
      const r = rowsSafra[i];
      const statusCob = normKey(r[colStatusSafra]).toLowerCase();
      
      if (statusCob && !statusCob.includes("autorizada")) continue;

      const rawNsu = normKey(r[colNsuSafra]);
      const cleanNsu = cleanNSU(rawNsu);
      const jsDate = excelDateToJsDate(r[colDataSafra]);
      const valor = toNumber(r[colValSafra]);
      const identificadorColH = normKey(r[colIdentificadorSafra]) || "-";

      if (!cleanNsu && !rawNsu) continue;

      if (dataFiltroJs && (!jsDate || !sameDay(dataFiltroJs, jsDate))) continue;

      if (isExcecaoOK(rawNsu)) {
        results.push({
          origem: "Safra",
          data: jsDate ? jsDate.toLocaleDateString("pt-BR") : "-",
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
        if (stLower.includes("pgto confirmado") || stLower.includes("pagamento_confirmado") || stLower.includes("confirmado")) {
          status = "ok";
          label = "OK (Pgto Confirmado)";
        } else {
          status = "bad";
          label = `Pendente no App (${appMatch.statusFin || "Sem Status"})`;
        }
      }

      results.push({
        origem: "Safra",
        data: jsDate ? jsDate.toLocaleDateString("pt-BR") : "-",
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
      const jsDate = excelDateToJsDate(r[colDataPix]);
      const valor = toNumber(r[colValPix]);
      const identificadorColH = normKey(r[colIdentificadorPix]) || "-";

      if (!cleanDoc && !rawDoc) continue;

      if (dataFiltroJs && (!jsDate || !sameDay(dataFiltroJs, jsDate))) continue;

      if (isExcecaoOK(rawDoc)) {
        results.push({
          origem: "Pix",
          data: jsDate ? jsDate.toLocaleDateString("pt-BR") : "-",
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
        if (stLower.includes("pgto confirmado") || stLower.includes("pagamento_confirmado") || stLower.includes("confirmado")) {
          status = "ok";
          label = "OK (Pgto Confirmado)";
        } else {
          status = "bad";
          label = `Pendente no App (${appMatch.statusFin || "Sem Status"})`;
        }
      }

      results.push({
        origem: "Pix",
        data: jsDate ? jsDate.toLocaleDateString("pt-BR") : "-",
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

    const colDataSantander = idxSantander.indexes.data !== undefined && idxSantander.indexes.data !== -1 ? idxSantander.indexes.data : 3; // Coluna D
    const colNsuSantander = idxSantander.indexes.nsu !== undefined && idxSantander.indexes.nsu !== -1 ? idxSantander.indexes.nsu : 10; // Coluna K
    const colValSantander = idxSantander.indexes.valor !== undefined && idxSantander.indexes.valor !== -1 ? idxSantander.indexes.valor : 12; // Coluna M
    const colIdentificadorSantander = idxSantander.indexes.identificador !== undefined && idxSantander.indexes.identificador !== -1 ? idxSantander.indexes.identificador : 9; // Coluna J (AUT)
    const colStatusSantander = idxSantander.indexes.statusCob !== undefined && idxSantander.indexes.statusCob !== -1 ? idxSantander.indexes.statusCob : 8; // Coluna I

    for (let i = idxSantander.headerRowIdx + 1; i < rowsSantander.length; i++) {
      const r = rowsSantander[i];
      const statusCob = normKey(r[colStatusSantander]).toLowerCase();

      if (statusCob && !statusCob.includes("aprovada") && !statusCob.includes("autorizada") && !statusCob.includes("pago") && !statusCob.includes("confirmado")) {
        continue;
      }

      const rawNsu = normKey(r[colNsuSantander]);
      const cleanNsu = cleanNSU(rawNsu);
      const jsDate = excelDateToJsDate(r[colDataSantander]);
      const valor = toNumber(r[colValSantander]);
      const identificadorColH = normKey(r[colIdentificadorSantander]) || "-";

      if (!cleanNsu && !rawNsu) continue;

      if (dataFiltroJs && (!jsDate || !sameDay(dataFiltroJs, jsDate))) continue;

      if (isExcecaoOK(rawNsu)) {
        results.push({
          origem: "Santander",
          data: jsDate ? jsDate.toLocaleDateString("pt-BR") : "-",
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
        if (stLower.includes("pgto confirmado") || stLower.includes("pagamento_confirmado") || stLower.includes("confirmado")) {
          status = "ok";
          label = "OK (Pgto Confirmado)";
        } else {
          status = "bad";
          label = `Pendente no App (${appMatch.statusFin || "Sem Status"})`;
        }
      }

      results.push({
        origem: "Santander",
        data: jsDate ? jsDate.toLocaleDateString("pt-BR") : "-",
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
    pedido: ["id pedido", "pedido", "nº pedido"],
    cliente: ["cliente", "nome"],
    consultor: ["consultor", "vendedor"],
    valor: ["valor", "valor líquido"],
    data: ["data"]
  });

  const colPed = idxVen.indexes.pedido ?? 9;
  const colCli = idxVen.indexes.cliente ?? 2;
  const colCons = idxVen.indexes.consultor ?? 3;
  const colVal = idxVen.indexes.valor ?? 8;
  const colData = idxVen.indexes.data ?? 0;

  const pedMap = new Map();

  for (let i = idxVen.headerRowIdx + 1; i < rowsVendas.length; i++) {
    const r = rowsVendas[i];
    const rawPed = normKey(r[colPed]);
    const cleanPed = normPedido(rawPed);

    if (!cleanPed || cleanPed === "0" || cleanPed === "manual") continue;

    const cliente = normKey(r[colCli]);
    const consultor = normKey(r[colCons]);
    const valor = toNumber(r[colVal]);
    const dJs = excelDateToJsDate(r[colData]);
    const strData = dJs ? dJs.toLocaleDateString("pt-BR") : "-";

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