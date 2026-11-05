/* Interface: abas, uploads centrais e renderização padrão de resultados */
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

