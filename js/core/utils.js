/* Utilitários compartilhados: normalização, datas, números, leitura de planilhas */
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

