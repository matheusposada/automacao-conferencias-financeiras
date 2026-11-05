// =====================================================================
// INDICADORES FINANCEIROS SEMANAIS — MOTOR DE CÁLCULO (sem DOM)
// Usado pela Análise 9 (script.js) e testável em Node.
// =====================================================================
(function (root) {
  "use strict";

  // ---------- REGRAS DE NEGÓCIO ----------
  // Status do pedido que NÃO entram na análise (comparação sempre sem acento / minúsculo).
  const STATUS_EXCLUIDOS = [
    "aprovacao gerencial", "analise de credito", "analise credito", "credito reprovado",
    "efetivado", "orcamento", "rejeitado", "retroativo", "cancelado"
  ];
  const PRAZO_PAGAMENTO_DIAS = 5;

  const FAIXAS_VERIFICACAO = [
    "Até 5 min", "5 a 15 min", "15 a 30 min", "30 a 60 min", "1 a 4 h",
    "Acima de 4 h (mesmo dia)", "Acima de 24 h (dia seguinte)", "Acima de 48 h", "Acima de 72 h", "Acima de 96 h"
  ];
  const FAIXAS_CONFIRMACAO = ["0 a 4 h", "4 a 12 h", "12 a 24 h", "24 a 48 h", "48 a 72 h", "Acima de 72 h"];
  const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // ---------- HELPERS ----------
  function norm(s) {
    return String(s === null || s === undefined ? "" : s)
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function parseDT(v) {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getTime());
    if (typeof v === "number") {
      if (!isFinite(v) || v < 20000) return null;
      const ms = Math.round((v - 25569) * 86400 * 1000);
      const u = new Date(ms);
      return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return null;
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return isNaN(v) ? null : v;
    let c = String(v).replace(/R\$/g, "").replace(/\s/g, "");
    if (c.includes(",") && c.includes(".")) c = c.replace(/\./g, "").replace(",", ".");
    else if (c.includes(",")) c = c.replace(",", ".");
    const n = parseFloat(c);
    return isNaN(n) ? null : n;
  }

  const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const diffDays = (a, b) => dayNum(a) - dayNum(b);
  const hoursBetween = (a, b) => (b.getTime() - a.getTime()) / 3600000;
  const sameDay = (a, b) => !!a && !!b && dayNum(a) === dayNum(b);
  const pad = n => String(n).padStart(2, "0");
  const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const fmtDM = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const fmtDT = d => d ? `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "";

  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  function median(a) {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  const pct = (v, t) => t > 0 ? (v / t) * 100 : 0;

  function normPedidoId(v) {
    if (v === null || v === undefined) return "";
    let s = String(v).trim();
    if (s.includes("-")) s = s.split("-").pop().trim();
    const d = s.replace(/\D/g, "");
    return d ? String(parseInt(d, 10)) : s.toLowerCase();
  }

  function mapColumns(rows, rules) {
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const head = (rows[r] || []).map(norm);
      const idx = {};
      let hits = 0;
      for (const [key, names] of Object.entries(rules)) {
        let found = -1;
        for (const n of names) { found = head.findIndex(c => c === norm(n)); if (found !== -1) break; }
        if (found === -1) for (const n of names) { found = head.findIndex(c => c.includes(norm(n))); if (found !== -1) break; }
        if (found !== -1) { idx[key] = found; hits++; }
      }
      if (hits >= 3) return { headerRowIdx: r, idx };
    }
    return { headerRowIdx: -1, idx: {} };
  }

  function statusExcluido(statusRaw) {
    const s = norm(statusRaw);
    return STATUS_EXCLUIDOS.some(x => s.includes(x));
  }

  // ---------- LEITURA DO ARQUIVO DO APP (financeiro-conferencia) ----------
  // Uma linha por recebimento -> consolida em um registro por pedido.
  function buildOrders(rows) {
    const { headerRowIdx, idx } = mapColumns(rows, {
      pedido: ["Nº Pedido", "Pedido"],
      recebimento: ["Recebimento"],
      status: ["Status"],
      statusFin: ["Status Financeiro"],
      cliente: ["Cliente"],
      vendedor: ["Vendedor"],
      entrada: ["Data Financeiro Aguardando"],
      verificado: ["Data Financeiro Verificado"],
      confirmado: ["Data Financeiro Confirmado"],
      pagto: ["Data Pagto (NSU)", "Data Pagto"],
      tipo: ["Tipo Recebimento"],
      forma: ["Forma Pagamento"],
      quemVer: ["Quem Verificou (financeiro)", "Quem Verificou"],
      quemConf: ["Quem Confirmou (financeiro)", "Quem Confirmou"],
      valor: ["Valor Total do Pedido (R$)", "Valor Total do Pedido"]
    });
    if (headerRowIdx < 0 || idx.pedido === undefined || idx.entrada === undefined) {
      throw new Error("Planilha do App sem as colunas 'Nº Pedido' e 'Data Financeiro Aguardando'. Use o arquivo financeiro-conferencia.");
    }
    const get = (r, k) => idx[k] === undefined ? null : r[idx[k]];
    const map = new Map();
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const rawPed = get(r, "pedido");
      const key = normPedidoId(rawPed);
      if (!key) continue;
      let o = map.get(key);
      if (!o) {
        o = {
          key, pedido: String(rawPed).trim(), status: get(r, "status") || "", statusFin: get(r, "statusFin") || "",
          cliente: get(r, "cliente") || "", vendedor: get(r, "vendedor") || "",
          entry: null, ver: null, conf: null, pagMax: null,
          tipos: new Set(), formas: new Set(), quemVer: null, quemConf: null, valor: null
        };
        map.set(key, o);
      }
      o.entry = o.entry || parseDT(get(r, "entrada"));
      o.ver = o.ver || parseDT(get(r, "verificado"));
      o.conf = o.conf || parseDT(get(r, "confirmado"));
      const pg = parseDT(get(r, "pagto"));
      if (pg && (!o.pagMax || pg > o.pagMax)) o.pagMax = pg;
      const tp = get(r, "tipo"), fm = get(r, "forma");
      if (tp) o.tipos.add(String(tp).trim());
      if (fm) o.formas.add(String(fm).trim());
      o.quemVer = o.quemVer || get(r, "quemVer") || null;
      o.quemConf = o.quemConf || get(r, "quemConf") || null;
      if (o.valor === null) o.valor = num(get(r, "valor"));
    }
    const orders = [];
    for (const o of map.values()) {
      if (!o.entry) continue;
      if (statusExcluido(o.status)) continue;                    // exclusões de status (inclui cancelado)
      o.formaPag = [...(o.tipos.size ? o.tipos : o.formas)].sort().join(" + ");
      o.temPix = /pix/i.test(o.formaPag);
      o.pixDireto = !o.ver && !!o.conf && o.temPix;              // PIX já pago na chegada: confirmado direto
      o.pagDate = o.pagMax || (o.conf ? dayStart(o.conf) : null);
      orders.push(o);
    }
    orders.sort((a, b) => a.entry - b.entry);
    return orders;
  }

  // ---------- LEITURA DO RELATÓRIO DE PEDIDOS (eventos e cancelamentos) ----------
  function buildRelatorio(rows) {
    if (!rows) return null;
    const { headerRowIdx, idx } = mapColumns(rows, {
      pedido: ["Nº Pedido"],
      status: ["Status"],
      evento: ["Mentoria / Evento", "Mentoria"],
      criacao: ["Data de criação"],
      dtPedido: ["Data do pedido"],
      total: ["Total a pagar"],
      motivo: ["Motivo cancelamento/rejeição", "Motivo cancelamento"],
      categoria: ["Categoria do cancelamento"],
      canceladoEm: ["Cancelado em"],
      canceladoPor: ["Cancelado por"]
    });
    if (headerRowIdx < 0 || idx.pedido === undefined) return null;
    const get = (r, k) => idx[k] === undefined ? null : r[idx[k]];
    const out = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || get(r, "pedido") === null || get(r, "pedido") === "") continue;
      out.push({
        key: normPedidoId(get(r, "pedido")), pedido: String(get(r, "pedido")).trim(),
        status: get(r, "status") || "", evento: get(r, "evento") || "",
        criacao: parseDT(get(r, "criacao")), dtPedido: parseDT(get(r, "dtPedido")),
        total: num(get(r, "total")), motivo: get(r, "motivo") || "", categoria: get(r, "categoria") || "",
        canceladoEm: parseDT(get(r, "canceladoEm")), canceladoPor: get(r, "canceladoPor") || ""
      });
    }
    return { rows: out, temCriacao: idx.criacao !== undefined };
  }

  // ---------- CLASSIFICAÇÕES ----------
  function statusNoFechamento(o, fim) {
    if (o.conf && o.conf <= fim) return "Confirmado";
    if (o.ver && o.ver <= fim) return "Verificado";
    return "Pendente";
  }

  function faixaVerificacao(o, fim) {
    if (!o.ver || o.ver > fim) return null;
    const dd = diffDays(o.ver, o.entry);
    if (dd === 0) {
      const m = (o.ver - o.entry) / 60000;
      const lims = [5, 15, 30, 60, 240];
      for (let i = 0; i < lims.length; i++) if (m <= lims[i]) return FAIXAS_VERIFICACAO[i];
      return FAIXAS_VERIFICACAO[5];
    }
    return dd === 1 ? FAIXAS_VERIFICACAO[6] : dd === 2 ? FAIXAS_VERIFICACAO[7] : dd === 3 ? FAIXAS_VERIFICACAO[8] : FAIXAS_VERIFICACAO[9];
  }

  function horasConfirmacao(o) {            // do início do dia de entrada até a confirmação
    return o.conf ? hoursBetween(dayStart(o.entry), o.conf) : null;
  }

  function faixaConfirmacao(o, fim) {
    if (!o.conf || o.conf > fim) return null;
    if (o.pixDireto) return FAIXAS_CONFIRMACAO[0];   // PIX confirmado direto entra em 0 a 4 h
    const h = horasConfirmacao(o), lims = [4, 12, 24, 48, 72];
    for (let i = 0; i < lims.length; i++) if (h <= lims[i]) return FAIXAS_CONFIRMACAO[i];
    return FAIXAS_CONFIRMACAO[5];
  }

  function categoriaCancelamento(motivo, categoriaInformada) {
    const m = String(motivo || ""), c = String(categoriaInformada || "");
    const base = norm(c || m);
    const t = norm(m);
    if (!c && !m) return "Sem motivo informado";
    if (base.startsWith("cliente desistiu")) return "Cliente desistiu";
    if (base.startsWith("erro no")) return "Erro no pedido";
    if (t.includes("prazo") || base.includes("prazo")) return "Prazo de pagamento excedido";
    if (base.includes("teste") || t.includes("teste")) return "Teste";
    if (["duplic", "refez", "fez outro pedido", "pela masterclass", "pelo master", "pedido masterclass", "orcamento realizado no dia"].some(k => t.includes(k) || base.includes(k))) return "Pedido duplicado ou refeito";
    if (t.includes("errado") || t.includes("erro")) return "Erro no pedido";
    if (t.includes("alter")) return "Alteração do pedido pelo cliente";
    return "Cliente desistiu";
  }
  const CATEGORIAS_CANCEL = ["Prazo de pagamento excedido", "Pedido duplicado ou refeito", "Teste", "Cliente desistiu", "Erro no pedido", "Alteração do pedido pelo cliente", "Sem motivo informado"];

  // ---------- MÉTRICAS DE UM PERÍODO ----------
  function metricasPeriodo(orders, ini, fim) {
    const dos = orders.filter(o => o.entry >= ini && o.entry <= fim);
    const status = { Pendente: 0, Verificado: 0, Confirmado: 0 };
    const link = [], v2c = [], confH = [], confBands = {}, verBands = {};
    FAIXAS_VERIFICACAO.forEach(f => verBands[f] = 0);
    FAIXAS_CONFIRMACAO.forEach(f => confBands[f] = 0);
    let semLink = 0;
    dos.forEach(o => {
      o.statusFech = statusNoFechamento(o, fim);
      status[o.statusFech]++;
      o.faixaVer = faixaVerificacao(o, fim);
      o.faixaConf = faixaConfirmacao(o, fim);
      o.hLink = o.faixaVer ? hoursBetween(o.entry, o.ver) : null;
      o.hV2C = (o.faixaVer && o.conf && o.conf <= fim) ? hoursBetween(o.ver, o.conf) : null;
      o.hConf = (o.conf && o.conf <= fim) ? horasConfirmacao(o) : null;
      if (o.hLink !== null) { link.push(o.hLink); verBands[o.faixaVer]++; } else semLink++;
      if (o.hV2C !== null && o.hV2C >= 0) v2c.push(o.hV2C);
      if (o.faixaConf) { confBands[o.faixaConf]++; if (o.hConf !== null) confH.push(o.hConf); }
    });
    const nLink = link.length, nConf = FAIXAS_CONFIRMACAO.reduce((s, f) => s + confBands[f], 0);
    const le24 = confBands[FAIXAS_CONFIRMACAO[0]] + confBands[FAIXAS_CONFIRMACAO[1]] + confBands[FAIXAS_CONFIRMACAO[2]];
    return {
      ini, fim, pedidos: dos, total: dos.length, status,
      link: { n: nLink, mean: mean(link), med: median(link), le4pct: nLink ? pct(link.filter(h => h <= 4).length, nLink) : 0 },
      v2c: { n: v2c.length, mean: mean(v2c), med: median(v2c) },
      confTempo: { n: confH.length, min: confH.length ? Math.min(...confH) : null, med: median(confH), mean: mean(confH), maxDias: confH.length ? Math.max(...confH) / 24 : null },
      matVer: { bands: FAIXAS_VERIFICACAO.map(f => ({ label: f, n: verBands[f], pct: pct(verBands[f], nLink) })), total: nLink, semLink },
      matConf: { bands: FAIXAS_CONFIRMACAO.map(f => ({ label: f, n: confBands[f], pct: pct(confBands[f], nConf) })), total: nConf, le24pct: pct(le24, nConf) },
      pixDireto: dos.filter(o => o.pixDireto && o.conf <= fim).length,
      semVerificacaoConfirmados: dos.filter(o => !o.faixaVer && o.faixaConf).length
    };
  }

  function diario(orders, ini, fim, marcaEventoKeys) {
    const out = [];
    for (let d = dayStart(ini); d <= fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const doDia = orders.filter(o => sameDay(o.entry, d));
      out.push({
        data: d, label: fmtDM(d), dia: DIAS_SEMANA[d.getDay()], total: doDia.length,
        mc: marcaEventoKeys ? doDia.filter(o => marcaEventoKeys.has(o.key)).length : 0
      });
    }
    return out;
  }

  // ---------- SÁBADOS ----------
  function sabados(orders, fim) {
    const map = new Map();
    orders.forEach(o => {
      if (o.entry.getDay() !== 6 || o.entry > fim) return;
      const k = dayNum(o.entry);
      if (!map.has(k)) map.set(k, { data: dayStart(o.entry), pedidos: 0, pagos: 0, confirmados: 0 });
      const s = map.get(k);
      s.pedidos++;
      if (o.pagMax && sameDay(o.pagMax, o.entry)) s.pagos++;
      if (o.conf && o.conf <= fim && sameDay(o.conf, o.entry)) s.confirmados++;
    });
    const lista = [...map.values()].sort((a, b) => a.data - b.data);
    lista.forEach(s => s.pct = pct(s.pagos, s.pedidos));
    return lista;
  }

  // ---------- SLA DE PAGAMENTO DO CLIENTE ----------
  function slaPeriodo(orders, ini, fim) {
    const fimDia = dayStart(fim);
    const abertos = orders.filter(o => o.entry <= fim && o.ver && o.ver <= fim && !(o.conf && o.conf <= fim))
      .map(o => Object.assign({}, o, { diasAberto: diffDays(fimDia, o.entry) }));   // cópia: não contamina outros períodos
    const vencidos = abertos.filter(o => o.diasAberto > PRAZO_PAGAMENTO_DIAS);
    const dentro = abertos.length - vencidos.length;
    const faixas = { "6 a 10 dias": 0, "11 a 15 dias": 0, "Acima de 15 dias": 0 };
    vencidos.forEach(o => {
      if (o.diasAberto <= 10) faixas["6 a 10 dias"]++; else if (o.diasAberto <= 15) faixas["11 a 15 dias"]++; else faixas["Acima de 15 dias"]++;
    });
    const porSemana = new Map();
    vencidos.forEach(o => {
      const d = dayStart(o.entry), seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      const sab = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 5);
      const k = dayNum(seg);
      if (!porSemana.has(k)) porSemana.set(k, { seg, label: `${fmtDM(seg)}–${fmtDM(sab)}`, n: 0 });
      porSemana.get(k).n++;
    });
    const pagosFora = orders.filter(o => o.pagDate && o.pagDate >= dayStart(ini) && o.pagDate <= fim && diffDays(o.pagDate, o.entry) > PRAZO_PAGAMENTO_DIAS)
      .map(o => Object.assign({}, o, { diasPagto: diffDays(o.pagDate, o.entry) }));
    return {
      vencidos, dentro, faixas, porSemana: [...porSemana.values()].sort((a, b) => a.seg - b.seg), pagosFora,
      menorEntradaBase: orders.length ? orders[0].entry : null
    };
  }

  // ---------- CANCELAMENTOS ----------
  function cancelamentos(rel, ini, fim, antesDe) {
    if (!rel) return null;
    const rows = rel.rows.filter(r => norm(r.status) === "cancelado" && r.canceladoEm && r.canceladoEm >= ini && r.canceladoEm <= fim)
      .sort((a, b) => a.canceladoEm - b.canceladoEm);
    rows.forEach(r => r.grupo = categoriaCancelamento(r.motivo, r.categoria));
    const porMotivo = {};
    CATEGORIAS_CANCEL.forEach(c => porMotivo[c] = { n: 0, valor: 0 });
    rows.forEach(r => { porMotivo[r.grupo].n++; porMotivo[r.grupo].valor += r.total || 0; });
    const dataRef = r => r.criacao || r.dtPedido;
    return {
      rows, total: rows.length, valor: rows.reduce((s, r) => s + (r.total || 0), 0), porMotivo,
      antesSemanaAnterior: antesDe ? rows.filter(r => dataRef(r) && dataRef(r) < antesDe).length : null
    };
  }

  // ---------- MASTERCLASS ----------
  function masterclass(rel, orders, ini, fim, termo, dataEvento, ultimaData) {
    if (!rel || !termo) return null;
    const t = norm(termo);
    const mcRows = rel.rows.filter(r => norm(r.evento).includes(t));
    const keys = new Set(mcRows.map(r => r.key));
    const entradas = orders.filter(o => keys.has(o.key));
    const refCriacao = r => r.criacao || r.dtPedido;
    const dias = [];
    const fimExt = ultimaData && ultimaData > fim ? ultimaData : fim;
    for (let d = dayStart(ini); d <= fimExt; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const ehEvento = dataEvento && sameDay(d, dataEvento);
      const doDia = orders.filter(o => sameDay(o.entry, d));
      dias.push({
        data: d, label: fmtDM(d), dia: DIAS_SEMANA[d.getDay()], evento: !!ehEvento, posSemana: d > fim,
        criados: mcRows.filter(r => refCriacao(r) && sameDay(refCriacao(r), d)).length,
        entraram: doDia.filter(o => keys.has(o.key)).length,
        totalDia: doDia.length
      });
    }
    const semana = dias.filter(d => !d.posSemana);
    const entraramSemana = semana.reduce((s, d) => s + d.entraram, 0);
    const valor = entradas.reduce((s, o) => s + (o.valor || 0), 0);
    const ultimoDia = semana.length ? semana[semana.length - 1] : null;
    return {
      termo, dias, totalCriados: mcRows.length, totalEntradas: entradas.length, entraramSemana,
      entraramPos: dias.filter(d => d.posSemana).reduce((s, d) => s + d.entraram, 0),
      criadosPos: dias.filter(d => d.posSemana).reduce((s, d) => s + d.criados, 0),
      criadosSemana: semana.reduce((s, d) => s + d.criados, 0), totalSemana: semana.reduce((s, d) => s + d.totalDia, 0),
      valor, ticket: entradas.length ? valor / entradas.length : 0,
      pctUltimoDia: ultimoDia && ultimoDia.totalDia ? pct(ultimoDia.entraram, ultimoDia.totalDia) : 0,
      usouCriacao: rel.temCriacao, keys
    };
  }

  // ---------- ORQUESTRADOR ----------
  function calcularIndicadoresFinanceiros(opts) {
    const { rowsApp, rowsRel, ini, fim, comp } = opts;
    // Suporta várias masterclasses na mesma semana: opts.eventos = [{ termo, data }]
    const eventos = (opts.eventos && opts.eventos.length) ? opts.eventos : (opts.evento ? [{ termo: opts.evento, data: opts.dataEvento }] : []);
    const orders = buildOrders(rowsApp);
    const rel = rowsRel ? buildRelatorio(rowsRel) : null;
    const warnings = [];
    if (!orders.length) throw new Error("Nenhum pedido válido encontrado na planilha do App.");
    const menor = orders[0].entry, maior = orders[orders.length - 1].entry;

    const main = metricasPeriodo(orders, ini, fim);
    const ultimaData = maior;
    const mcs = rel ? eventos.map(e => masterclass(rel, orders, ini, fim, e.termo, e.data, ultimaData)).filter(Boolean) : [];
    const keysTodas = new Set(); mcs.forEach(m => m.keys.forEach(k => keysTodas.add(k)));
    const dia = diario(orders, ini, fim, mcs.length ? keysTodas : null);
    const sat = sabados(orders, fim);
    const sla = slaPeriodo(orders, ini, fim);
    const antesDe = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() - 7);
    const canc = cancelamentos(rel, ini, fim, antesDe);

    let comparativo = null;
    if (comp && comp.ini && comp.fim) {
      const m = metricasPeriodo(orders, comp.ini, comp.fim);
      comparativo = {
        ini: comp.ini, fim: comp.fim, m,
        dia: diario(orders, comp.ini, comp.fim, null),
        sla: slaPeriodo(orders, comp.ini, comp.fim),
        canc: cancelamentos(rel, comp.ini, comp.fim, null)
      };
      // metricasPeriodo reescreve campos por pedido; recalcula o principal para manter os campos do período atual
      metricasPeriodo(orders, ini, fim);
    }
    if (ini < menor) warnings.push(`A planilha do App só tem pedidos a partir de ${fmtDate(menor)}; o período começa antes disso.`);
    if (diffDays(fim, menor) < 40) warnings.push(`SLA de pagamento: a planilha começa em ${fmtDate(menor)}. Pedidos mais antigos ainda em aberto não aparecem. Use uma extração com entradas desde 01/09.`);
    if (!rel) warnings.push("Relatório de Pedidos não carregado: Cancelamentos e Masterclass foram ignorados.");
    if (rel && !rel.temCriacao) warnings.push("O Relatório de Pedidos não tem a coluna 'Data de criação'; os pedidos criados da masterclass usam 'Data do pedido'.");
    const semCanceladoPor = canc ? canc.rows.filter(r => !r.canceladoPor).length : 0;
    if (canc && semCanceladoPor) warnings.push(`${semCanceladoPor} cancelamento(s) sem 'Cancelado por' no relatório.`);

    const eventosPorPedido = rel ? new Map(rel.rows.map(r => [r.key, r.evento])) : null;
    return { main, orders, dia, sat, sla, canc, mcs, mc: mcs[0] || null, comparativo, warnings, eventos: eventosPorPedido, menorEntrada: menor, maiorEntrada: maior };
  }

  const api = {
    calcularIndicadoresFinanceiros, buildOrders, buildRelatorio, metricasPeriodo, categoriaCancelamento,
    FAIXAS_VERIFICACAO, FAIXAS_CONFIRMACAO, CATEGORIAS_CANCEL, DIAS_SEMANA, STATUS_EXCLUIDOS, PRAZO_PAGAMENTO_DIAS,
    util: { parseDT, norm, fmtDate, fmtDM, fmtDT, pct, mean, median, diffDays, dayStart, sameDay }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IndicadoresFin = api;
})(typeof window !== "undefined" ? window : globalThis);
