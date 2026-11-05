/* Análise 9 — Indicadores Financeiros: tela, relatório Markdown e exportação (cálculo em 09-indicadores-motor.js) */
// 9. ANÁLISE DE INDICADORES FINANCEIROS (relatório semanal)
// O cálculo fica em 09-indicadores-motor.js (testável em Node); aqui só leitura de arquivos, tela e exportações.
async function rodarAnaliseIndicadores() {
  const I = window.IndicadoresFin;
  if (!I) return alert("Arquivo indicadores.js não carregado. Verifique se ele está na mesma pasta do index.html.");

  const rowsApp = await parseFileToRows(fileStore.app, "Conferência Financeira");
  if (!rowsApp) return alert("Erro ao ler a planilha do App.");
  const rowsRel = fileStore.relpedidos ? await parseFileToRows(fileStore.relpedidos) : null;

  const { ini, fim } = getFlatpickrRange(pickerIndPrincipal);
  if (!ini || !fim) return alert("Selecione a semana atual (ex.: 26/10 a 31/10).");
  const comp = getFlatpickrRange(pickerIndComp);
  // Campo de masterclasses: um evento por item, separados por ";" — formato "nome" ou "nome | dd/mm/aaaa"
  const eventos = (document.getElementById("ind-evento")?.value || "").split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const [termo, data] = x.split("|").map(y => y.trim());
    return { termo, data: data ? I.util.parseDT(data) : null };
  }).filter(e => e.termo);

  let R;
  try {
    R = I.calcularIndicadoresFinanceiros({ rowsApp, rowsRel, ini, fim, comp, eventos });
  } catch (e) {
    return alert(e.message);
  }
  const U = I.util, M = R.main, C = R.comparativo;
  const f1 = v => (v === null || v === undefined || isNaN(v)) ? "–" : v.toFixed(1).replace(".", ",");
  const fh = v => v === null || v === undefined ? "–" : `${f1(v)} h`;
  const fp = v => `${f1(v)}%`;
  const brl = v => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const sgn = (v, d = 0) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d).replace(".", ",");
  const periodoTxt = `${U.fmtDate(ini)} a ${U.fmtDate(fim)}`;
  const tile = (label, value, sub = "") => `<div class="ind-tile"><small>${label}</small><div class="ind-val">${value}</div>${sub ? `<div class="ind-sub">${sub}</div>` : ""}</div>`;
  const table = (heads, body) => `<div class="tablewrap"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

  // ---- 1. STATUS
  const st = M.status;
  let html = `
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <button id="btn-copy-gamma" class="btn-export" style="background:#6b46c1;">📋 Copiar Relatório Formatado (Markdown/Gamma)</button>
      <button id="btn-export-xlsx-ind" class="btn-export">📥 Exportar Planilha de Indicadores (.xlsx)</button>
    </div>
    ${R.warnings.map(w => `<div class="ind-warn">⚠️ ${w}</div>`).join("")}
    <h2>📊 1. Distribuição por Status Financeiro — ${periodoTxt}</h2>
    <p class="desc">Pedidos que entraram no financeiro no período, por status no fechamento de ${U.fmtDate(fim)} (sem cancelados e sem os status excluídos).</p>
    <div class="ind-tiles">
      ${tile("Total de pedidos", M.total)}
      ${tile("Pgto confirmado", `${st.Confirmado} (${fp(U.pct(st.Confirmado, M.total))})`)}
      ${tile("Verificado — aguardando pagamento", `${st.Verificado} (${fp(U.pct(st.Verificado, M.total))})`)}
      ${tile("Pagamento pendente", `${st.Pendente} (${fp(U.pct(st.Pendente, M.total))})`)}
    </div>`;

  // ---- 2. POR DIA
  const diasComp = C ? C.dia : null;
  const media = M.total / (R.dia.filter(d => d.data.getDay() !== 0).length || 1);
  html += `
    <h2 style="margin-top:26px;">📈 2. Pedidos que Entraram por Dia</h2>
    ${table(C ? ["Dia", "Data", "Semana anterior", "Semana atual", "Variação"] : ["Dia", "Data", "Pedidos"],
      R.dia.map((d, i) => C ? [d.dia, d.label, diasComp[i] ? diasComp[i].total : "–", `<b>${d.total}</b>`, diasComp[i] ? sgn(d.total - diasComp[i].total) : "–"] : [d.dia, d.label, `<b>${d.total}</b>`])
        .concat([C ? ["<b>Total</b>", "", `<b>${C.m.total}</b>`, `<b>${M.total}</b>`, `<b>${sgn(M.total - C.m.total)} (${sgn(U.pct(M.total - C.m.total, C.m.total), 1)}%)</b>`] : ["<b>Total</b>", "", `<b>${M.total}</b>`]]))}
    <p class="desc">Média de segunda a sábado: ${Math.round(media)} pedidos/dia.</p>`;

  // ---- 3. MASTERCLASS (uma ou mais por semana)
  const mcs = R.mcs || [];
  mcs.forEach(mc => {
    html += `
    <h2 style="margin-top:26px;">🎓 3. Masterclass — ${mc.termo}</h2>
    <div class="ind-tiles">
      ${tile("Valor dos pedidos que entraram", brl(mc.valor), `${mc.totalEntradas} pedidos · ticket médio ${brl(mc.ticket)}`)}
      ${tile("Do último dia do período", fp(mc.pctUltimoDia), "das entradas do dia vieram da masterclass")}
      ${tile("Entraram na semana", mc.entraramSemana, `+${mc.entraramPos} depois do período`)}
    </div>
    ${table(["Dia", "Pedidos criados (masterclass)", "Entraram no financeiro (masterclass)", "Total de entradas do dia", "% da masterclass"],
      mc.dias.map(d => [`${d.label} (${d.dia.slice(0, 3).toLowerCase()})${d.evento ? " — masterclass" : ""}${d.posSemana ? " · após o período" : ""}`, d.criados, d.entraram, d.totalDia, fp(U.pct(d.entraram, d.totalDia))])
        .concat([[`<b>Semana</b>`, `<b>${mc.criadosSemana}</b>`, `<b>${mc.entraramSemana}</b>`, `<b>${mc.totalSemana}</b>`, `<b>${fp(U.pct(mc.entraramSemana, mc.totalSemana))}</b>`]]))}
    <p class="desc">Pedidos criados usam a coluna ${mc.usouCriacao ? "'Data de criação'" : "'Data do pedido' (o relatório carregado não tem 'Data de criação')"}. Entrada no financeiro = coluna 'Data Financeiro Aguardando'.</p>`;
  });
  if (mcs.length > 1) {
    html += `<p class="desc">Pedidos de eventos diferentes são contados separadamente em cada tabela; se um mesmo pedido estiver em mais de um evento, ele aparece em ambos.</p>`;
  }

  // ---- 4. SÁBADOS
  const sabs = R.sat, sabAtual = sabs.filter(s => s.data >= U.dayStart(ini) && s.data <= fim).pop();
  if (sabs.length) {
    const anteriores = sabs.filter(s => !sabAtual || s.data < sabAtual.data);
    const mediaAnt = anteriores.length ? U.mean(anteriores.map(s => s.pct)) : null;
    html += `
    <h2 style="margin-top:26px;">🗓️ 4. Pedidos que Entram no Sábado</h2>
    ${sabAtual ? `<div class="ind-tiles">
      ${tile(`Pedidos entraram no sábado ${U.fmtDM(sabAtual.data)}`, sabAtual.pedidos)}
      ${tile("Pagos no próprio sábado", `${fp(sabAtual.pct)}`, `${sabAtual.pagos} pedidos`)}
      ${tile("Média dos sábados anteriores", mediaAnt === null ? "–" : fp(mediaAnt), "pagos no próprio sábado")}
    </div>` : ""}
    ${table(["Sábado", "Pedidos", "Pagos no sábado", "%", "Confirmados no sábado"], sabs.map(s => [U.fmtDate(s.data) + (sabAtual && s === sabAtual ? " ◀" : ""), s.pedidos, s.pagos, fp(s.pct), s.confirmados]))}
    <p class="desc">Pago no sábado = data de pagamento (NSU) igual à data de entrada; com mais de uma forma de pagamento vale o último recebimento. Só há sábados a partir da primeira entrada da planilha (${U.fmtDate(R.menorEntrada)}).</p>`;
  }

  // ---- 5. TEMPOS
  html += `
    <h2 style="margin-top:26px;">⏱️ 5. Tempos Médios de Processamento</h2>
    <div class="ind-tiles">
      ${tile("Envio do link (entrada → aguardando pagamento)", `${fh(M.link.mean)}`, `mediana ${fh(M.link.med)}${C ? ` · semana anterior ${fh(C.m.link.mean)} (mediana ${fh(C.m.link.med)})` : ""}`)}
      ${tile("Verificação → confirmação do pagamento", `${fh(M.v2c.mean)}`, `mediana ${fh(M.v2c.med)}${C ? ` · semana anterior ${fh(C.m.v2c.mean)} (mediana ${fh(C.m.v2c.med)})` : ""}`)}
      ${tile("Links enviados em até 4 h", fp(M.link.le4pct), C ? `semana anterior ${fp(C.m.link.le4pct)}` : "")}
    </div>
    <p class="desc">Pedidos sem verificação (boleto, bonificado e PIX já pago) são confirmados direto e ficam fora das médias do link: ${M.semVerificacaoConfirmados} nesta semana.</p>`;

  // ---- 6. MATRIZ VERIFICAÇÃO
  html += `
    <h2 style="margin-top:26px;">🔎 6. Matriz Real de Tempo de Verificação do Pedido</h2>
    ${table(["Faixa", "Pedidos", "%"], M.matVer.bands.map(b => [b.label, b.n, fp(b.pct)]).concat([[`<b>Total com link enviado</b>`, `<b>${M.matVer.total}</b>`, "<b>100,0%</b>"]]))}
    <p class="desc">A partir de 4 h as faixas contam dias de calendário: "Acima de 24 h" = verificado no dia seguinte à entrada, e assim por diante.</p>`;

  // ---- 7. MATRIZ CONFIRMAÇÃO
  const ct = M.confTempo;
  html += `
    <h2 style="margin-top:26px;">✅ 7. Matriz Real de Confirmação de Pagamento</h2>
    <div class="ind-tiles">${tile("Confirmados em até 24 h", fp(M.matConf.le24pct), C ? `semana anterior ${fp(C.m.matConf.le24pct)}` : "")}</div>
    ${table(["Faixa", "Pedidos", "%"], M.matConf.bands.map(b => [b.label, b.n, fp(b.pct)]).concat([[`<b>Total confirmados</b>`, `<b>${M.matConf.total}</b>`, "<b>100,0%</b>"]]))}
    <p class="desc">Tempo contado desde a data de entrada do pedido no financeiro (início do dia) até a confirmação do pagamento. ${M.pixDireto} pedidos com PIX confirmados direto (já pagos na chegada, sem verificação) entram na faixa 0 a 4 h.</p>
    ${table(["Indicador", ...(C ? ["Semana anterior"] : []), "Semana atual"], [
      ["Menor tempo", ...(C ? [fh(C.m.confTempo.min)] : []), fh(ct.min)],
      ["Mediana", ...(C ? [fh(C.m.confTempo.med)] : []), fh(ct.med)],
      ["Média", ...(C ? [fh(C.m.confTempo.mean)] : []), fh(ct.mean)],
      ["Maior tempo", ...(C ? [C.m.confTempo.maxDias === null ? "–" : `${f1(C.m.confTempo.maxDias)} dias`] : []), ct.maxDias === null ? "–" : `${f1(ct.maxDias)} dias`]
    ])}
    <p class="desc">Esta tabela usa o horário real de confirmação (sem a regra do PIX direto).</p>`;

  // ---- 8. COMPARATIVO
  if (C) {
    const cm = C.m, ccan = C.canc;
    const linha = (nome, a, b, fmt, diff) => [`<b>${nome}</b>`, fmt(a), fmt(b), diff];
    const dd = (b, a, d = 1, un = "") => `${sgn(b - a, d)}${un}`;
    html += `
    <h2 style="margin-top:26px;">🔄 8. Comparativo com a Semana Anterior</h2>
    <p class="desc">Semana anterior (${U.fmtDate(C.ini)} a ${U.fmtDate(C.fim)}) recalculada a partir da planilha carregada; pode diferir levemente de uma apresentação feita com extração mais antiga.</p>
    ${table(["Indicador", "Semana anterior", "Semana atual", "Variação"], [
      linha("Total de pedidos", cm.total, M.total, v => v, dd(M.total, cm.total, 0)),
      linha("Pagamento confirmado", cm.status.Confirmado, st.Confirmado, v => v, dd(st.Confirmado, cm.status.Confirmado, 0)),
      linha("Verificado", cm.status.Verificado, st.Verificado, v => v, dd(st.Verificado, cm.status.Verificado, 0)),
      linha("Pagamento pendente", cm.status.Pendente, st.Pendente, v => v, dd(st.Pendente, cm.status.Pendente, 0)),
      linha("Envio do link — média", cm.link.mean, M.link.mean, fh, dd(M.link.mean, cm.link.mean, 1, " h")),
      linha("Envio do link — mediana", cm.link.med, M.link.med, fh, dd(M.link.med, cm.link.med, 1, " h")),
      linha("Verificação até confirmação — média", cm.v2c.mean, M.v2c.mean, fh, dd(M.v2c.mean, cm.v2c.mean, 1, " h")),
      linha("Link enviado em até 4 h", cm.link.le4pct, M.link.le4pct, fp, dd(M.link.le4pct, cm.link.le4pct, 1, " p.p.")),
      linha("Pagamentos confirmados em até 24 h", cm.matConf.le24pct, M.matConf.le24pct, fp, dd(M.matConf.le24pct, cm.matConf.le24pct, 1, " p.p."))
    ].concat(R.canc && ccan ? [linha("Cancelamentos", ccan.total, R.canc.total, v => v, dd(R.canc.total, ccan.total, 0))] : []))}`;
  }

  // ---- 9. CANCELAMENTOS
  const cn = R.canc;
  if (cn) {
    const ccn = C && C.canc;
    html += `
    <h2 style="margin-top:26px;">🚫 9. Cancelamentos da Semana</h2>
    <div class="ind-tiles">
      ${tile("Valor de pedidos cancelados", brl(cn.valor))}
      ${tile("Cancelamentos na semana", cn.total, ccn ? `semana anterior: ${ccn.total}` : "")}
      ${tile("Por prazo de pagamento excedido", cn.porMotivo["Prazo de pagamento excedido"].n, ccn ? `semana anterior: ${ccn.porMotivo["Prazo de pagamento excedido"].n}` : "")}
    </div>
    ${table(["Motivo", "Pedidos", "%", "Valor", ...(ccn ? ["Semana anterior"] : [])],
      I.CATEGORIAS_CANCEL.filter(c => cn.porMotivo[c].n > 0 || (ccn && ccn.porMotivo[c].n > 0)).map(c => [c, cn.porMotivo[c].n, fp(U.pct(cn.porMotivo[c].n, cn.total)), brl(cn.porMotivo[c].valor), ...(ccn ? [ccn.porMotivo[c].n] : [])])
        .concat([[`<b>Total</b>`, `<b>${cn.total}</b>`, "<b>100,0%</b>", `<b>${brl(cn.valor)}</b>`, ...(ccn ? [`<b>${ccn.total}</b>`] : [])]]))}
    <p class="desc">Contagem pela data do cancelamento, independentemente da data de entrada do pedido: ${cn.antesSemanaAnterior} dos ${cn.total} cancelamentos foram de pedidos feitos antes da semana anterior.</p>
    ${table(["Pedido", "Cancelado em", "Grupo", "Categoria informada", "Cancelado por", "Valor"], cn.rows.map(r => [r.pedido, U.fmtDT(r.canceladoEm), r.grupo, r.categoria || "–", r.canceladoPor || "–", brl(r.total)]))}`;
  }

  // ---- 10. SLA
  const sl = R.sla;
  html += `
    <h2 style="margin-top:26px;">⏳ 10. SLA de Pagamento do Cliente (prazo de ${I.PRAZO_PAGAMENTO_DIAS} dias)</h2>
    <div class="ind-tiles">
      ${tile(`Em aberto com prazo vencido em ${U.fmtDM(fim)}`, sl.vencidos.length, C ? `em ${U.fmtDM(C.fim)}: ${C.sla.vencidos.length}` : "")}
      ${tile("Pagos fora do prazo na semana", sl.pagosFora.length, C ? `semana anterior: ${C.sla.pagosFora.length}` : "")}
      ${tile("Em aberto ainda dentro do prazo", sl.dentro)}
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;">
      <div style="flex:1;min-width:260px;">${table(["Em aberto vencidos: dias desde a entrada", "Pedidos"], Object.entries(sl.faixas).map(([k, v]) => [k, v]).concat([["<b>Total</b>", `<b>${sl.vencidos.length}</b>`]]))}</div>
      <div style="flex:1;min-width:260px;">${table(["Em aberto vencidos: semana de entrada", "Pedidos"], sl.porSemana.map(w => [w.label, w.n]).concat([["<b>Total</b>", `<b>${sl.vencidos.length}</b>`]]))}</div>
    </div>
    <p class="desc">Em aberto = link enviado (aguardando pagamento) e pagamento ainda não confirmado no fechamento. Pagos fora do prazo = pagamento no período, mais de ${I.PRAZO_PAGAMENTO_DIAS} dias após a entrada (data do NSU; na falta dela, data de confirmação). Base: entradas desde ${U.fmtDate(R.menorEntrada)}.</p>`;

  const el = document.getElementById("result-indicadores");
  el.style.display = "block";
  el.innerHTML = html;

  // ---------- RELATÓRIO EM MARKDOWN ----------
  function relatorioMarkdown() {
    const L = [];
    const tb = (heads, rows) => { L.push(`| ${heads.join(" | ")} |`); L.push(`| ${heads.map(() => "---").join(" | ")} |`); rows.forEach(r => L.push(`| ${r.join(" | ")} |`)); L.push(""); };
    const strip = s => String(s).replace(/<[^>]+>/g, "");
    L.push("FINANCEIRO", "", "# INDICADORES OPERACIONAIS FINANCEIRO", "", `Indicadores da Semana: ${periodoTxt}`, "");
    L.push(`## Distribuição por Status Financeiro — Semana ${U.fmtDM(ini)} a ${U.fmtDM(fim)}`, "", `Pedidos que entraram no financeiro na semana, por status no fechamento de ${U.fmtDate(fim)}:`, "");
    tb(["Status financeiro", "Pedidos", "% do total"], [
      ["Pagamento pendente — etapa anterior à verificação", st.Pendente, fp(U.pct(st.Pendente, M.total))],
      ["Verificado — aguardando confirmação do pagamento", st.Verificado, fp(U.pct(st.Verificado, M.total))],
      ["Pagamento confirmado", st.Confirmado, fp(U.pct(st.Confirmado, M.total))],
      ["Total de pedidos após etapa em verificação", M.total, "100,0%"]]);
    L.push("## Pedidos que Entraram por Dia", "");
    tb(C ? ["Dia", "Semana anterior", "Semana atual", "Variação"] : ["Dia", "Pedidos"],
      R.dia.map((d, i) => C ? [`${d.dia} ${d.label}`, diasComp[i] ? diasComp[i].total : "–", d.total, diasComp[i] ? sgn(d.total - diasComp[i].total) : "–"] : [`${d.dia} ${d.label}`, d.total]));
    L.push(`*Semana atual: ${M.total} pedidos${C ? ` - Semana anterior: ${C.m.total} (${sgn(U.pct(M.total - C.m.total, C.m.total), 1)}%)` : ""} - Média de segunda a sábado: ${Math.round(media)} pedidos/dia*`, "");
    mcs.forEach(mc => {
      L.push(`## Masterclass — ${mc.termo}${mc.dias.find(d => d.evento) ? ` (${mc.dias.find(d => d.evento).label})` : ""}`, "");
      L.push(`**${brl(mc.valor)}** em ${mc.totalEntradas} pedidos (ticket médio de ${brl(mc.ticket)})`, "", `**${fp(mc.pctUltimoDia)}** das entradas do último dia vieram da masterclass`, "", `**${mc.entraramSemana}** pedidos da masterclass entraram no financeiro na semana; +${mc.entraramPos} depois do período`, "");
      tb(["Dia", "Pedidos criados (masterclass)", "Entraram no financeiro (masterclass)", "Total de entradas do dia", "% da masterclass"],
        mc.dias.map(d => [`${d.label} (${d.dia.slice(0, 3).toLowerCase()})${d.evento ? " — masterclass" : ""}${d.posSemana ? " · após o período" : ""}`, d.criados, d.entraram, d.totalDia, fp(U.pct(d.entraram, d.totalDia))]));
    });
    if (sabs.length) {
      L.push("## Pedidos Entram no Sábado", "");
      if (sabAtual) { const ant = sabs.filter(s => s.data < sabAtual.data); L.push(`**${fp(sabAtual.pct)}** pagos no próprio sábado (${sabAtual.pagos} pedidos)`, "", `**${sabAtual.pedidos}** pedidos entraram no sábado ${U.fmtDM(sabAtual.data)}`, "", `**${ant.length ? fp(U.mean(ant.map(s => s.pct))) : "–"}** pagos no próprio sábado na média dos sábados anteriores`, ""); }
      tb(["Sábado", "Pedidos", "Pagos no sábado", "%", "Confirmados no sábado"], sabs.map(s => [U.fmtDate(s.data), s.pedidos, s.pagos, fp(s.pct), s.confirmados]));
    }
    L.push("## Tempos Médios de Processamento", "", `**${fh(M.link.mean)}** — Tempo médio para envio do link (entrada → aguardando pagamento) · mediana ${fh(M.link.med)}`, "", `**${fh(M.v2c.mean)}** — Tempo médio entre envio do link e confirmação do pagamento · mediana ${fh(M.v2c.med)}`, "");
    L.push("## Matriz Real de Tempo de Verificação do Pedido", ""); tb(["Faixa", "Pedidos", "%"], M.matVer.bands.map(b => [b.label, b.n, fp(b.pct)]));
    L.push(`**${fp(M.link.le4pct)}** dos links enviados em até 4 h`, "");
    L.push("## Matriz Real de Confirmação de Pagamento", "", `**${fp(M.matConf.le24pct)}** dos pagamentos confirmados em até 24 h`, ""); tb(["Faixa", "Pedidos", "%"], M.matConf.bands.map(b => [b.label, b.n, fp(b.pct)]));
    L.push(`*Total: ${M.matConf.total} pedidos da semana com pagamento confirmado até ${U.fmtDate(fim)}*`, "", "Observação: Tempo contado desde a data de entrada do pedido no financeiro (início do dia) até a confirmação do pagamento. PIX confirmado direto entra em 0 a 4 h.", "");
    L.push("## Tempo de Confirmação do Pagamento", ""); tb(["Indicador", ...(C ? ["Semana anterior"] : []), "Semana atual"], [
      ["Menor tempo", ...(C ? [fh(C.m.confTempo.min)] : []), fh(ct.min)], ["Mediana", ...(C ? [fh(C.m.confTempo.med)] : []), fh(ct.med)],
      ["Média", ...(C ? [fh(C.m.confTempo.mean)] : []), fh(ct.mean)], ["Maior tempo", ...(C ? [`${f1(C.m.confTempo.maxDias)} dias`] : []), `${f1(ct.maxDias)} dias`]]);
    if (C) {
      L.push("## Comparativo com a Semana Anterior", "");
      tb(["Indicador", "Semana anterior", "Semana atual", "Variação"], [
        ["Total de pedidos", C.m.total, M.total, sgn(M.total - C.m.total)], ["Pagamento confirmado", C.m.status.Confirmado, st.Confirmado, sgn(st.Confirmado - C.m.status.Confirmado)],
        ["Verificado", C.m.status.Verificado, st.Verificado, sgn(st.Verificado - C.m.status.Verificado)], ["Pagamento pendente", C.m.status.Pendente, st.Pendente, sgn(st.Pendente - C.m.status.Pendente)],
        ["Envio do link — média", fh(C.m.link.mean), fh(M.link.mean), sgn(M.link.mean - C.m.link.mean, 1) + " h"], ["Envio do link — mediana", fh(C.m.link.med), fh(M.link.med), sgn(M.link.med - C.m.link.med, 1) + " h"],
        ["Verificação até confirmação — média", fh(C.m.v2c.mean), fh(M.v2c.mean), sgn(M.v2c.mean - C.m.v2c.mean, 1) + " h"],
        ["Link enviado em até 4 h", fp(C.m.link.le4pct), fp(M.link.le4pct), sgn(M.link.le4pct - C.m.link.le4pct, 1) + " p.p."],
        ["Pagamentos confirmados em até 24 h", fp(C.m.matConf.le24pct), fp(M.matConf.le24pct), sgn(M.matConf.le24pct - C.m.matConf.le24pct, 1) + " p.p."]]);
    }
    if (cn) {
      L.push("## Cancelamentos da Semana", "", `**${brl(cn.valor)}** em valor de pedidos cancelados`, "", `**${cn.total}** cancelamentos na semana${C && C.canc ? ` (semana anterior: ${C.canc.total})` : ""}`, "");
      tb(["Motivo", "Pedidos", "%", "Valor", ...(C && C.canc ? ["Semana anterior"] : [])],
        I.CATEGORIAS_CANCEL.filter(c => cn.porMotivo[c].n > 0 || (C && C.canc && C.canc.porMotivo[c].n > 0)).map(c => [c, cn.porMotivo[c].n, fp(U.pct(cn.porMotivo[c].n, cn.total)), brl(cn.porMotivo[c].valor), ...(C && C.canc ? [C.canc.porMotivo[c].n] : [])])
          .concat([["Total", cn.total, "100,0%", brl(cn.valor), ...(C && C.canc ? [C.canc.total] : [])]]));
      L.push(`Observação: Contagem pela data do cancelamento, independentemente da data de entrada do pedido: ${cn.antesSemanaAnterior} dos ${cn.total} cancelamentos foram de pedidos feitos antes da semana anterior.`, "");
    }
    L.push("## SLA de Pagamento do Cliente", "", `Prazo máximo de ${I.PRAZO_PAGAMENTO_DIAS} dias para o cliente pagar, contado a partir da entrada do pedido no financeiro:`, "",
      `**${sl.vencidos.length}** pedidos em aberto com prazo vencido em ${U.fmtDM(fim)}${C ? ` (em ${U.fmtDM(C.fim)}: ${C.sla.vencidos.length})` : ""}`, "", `**${sl.pagosFora.length}** pedidos pagos fora do prazo durante a semana${C ? ` (semana anterior: ${C.sla.pagosFora.length})` : ""}`, "", `**${sl.dentro}** pedidos em aberto ainda dentro do prazo em ${U.fmtDM(fim)}`, "");
    tb(["Em aberto vencidos: dias desde a entrada", "Pedidos"], Object.entries(sl.faixas).map(([k, v]) => [k, v]).concat([["Total", sl.vencidos.length]]));
    tb(["Em aberto vencidos: semana de entrada", "Pedidos"], sl.porSemana.map(w => [w.label, w.n]).concat([["Total", sl.vencidos.length]]));
    return L.join("\n");
  }

  document.getElementById("btn-copy-gamma").addEventListener("click", () => {
    navigator.clipboard.writeText(relatorioMarkdown()).then(() => alert("✅ Relatório copiado! Cole no Gamma ou salve como .md."));
  });

  // ---------- PLANILHA DE INDICADORES (.xlsx) ----------
  document.getElementById("btn-export-xlsx-ind").addEventListener("click", () => {
    const wb = XLSX.utils.book_new();
    const add = (nome, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nome);
    const n1 = v => (v === null || v === undefined || isNaN(v)) ? "" : Math.round(v * 100) / 100;
    const resumo = [["Indicador", `Semana ${U.fmtDM(ini)}–${U.fmtDM(fim)}`, ...(C ? [`Semana anterior ${U.fmtDM(C.ini)}–${U.fmtDM(C.fim)}`] : [])],
      ["Total de pedidos", M.total, ...(C ? [C.m.total] : [])],
      ["Pagamento pendente", st.Pendente, ...(C ? [C.m.status.Pendente] : [])],
      ["Verificado – aguardando confirmação", st.Verificado, ...(C ? [C.m.status.Verificado] : [])],
      ["Pagamento confirmado", st.Confirmado, ...(C ? [C.m.status.Confirmado] : [])],
      ["Envio do link — média (h)", n1(M.link.mean), ...(C ? [n1(C.m.link.mean)] : [])],
      ["Envio do link — mediana (h)", n1(M.link.med), ...(C ? [n1(C.m.link.med)] : [])],
      ["Verificação até confirmação — média (h)", n1(M.v2c.mean), ...(C ? [n1(C.m.v2c.mean)] : [])],
      ["Link enviado em até 4 h (%)", n1(M.link.le4pct), ...(C ? [n1(C.m.link.le4pct)] : [])],
      ["Pagamentos confirmados em até 24 h (%)", n1(M.matConf.le24pct), ...(C ? [n1(C.m.matConf.le24pct)] : [])],
      ["Cancelamentos", cn ? cn.total : "", ...(C ? [C.canc ? C.canc.total : ""] : [])],
      ["Valor cancelado (R$)", cn ? n1(cn.valor) : "", ...(C ? [C.canc ? n1(C.canc.valor) : ""] : [])],
      ["SLA: pagos fora do prazo na semana", sl.pagosFora.length, ...(C ? [C.sla.pagosFora.length] : [])],
      ["SLA: em aberto com prazo vencido", sl.vencidos.length, ...(C ? [C.sla.vencidos.length] : [])]];
    resumo.push([], ["Matriz de verificação (envio do link)", "Pedidos", "%"]);
    M.matVer.bands.forEach(b => resumo.push([b.label, b.n, n1(b.pct)]));
    resumo.push(["Sem envio de link (boleto, bonificado, PIX pago)", M.matVer.semLink, ""], [], ["Matriz de confirmação (desde a entrada)", "Pedidos", "%"]);
    M.matConf.bands.forEach(b => resumo.push([b.label, b.n, n1(b.pct)]));
    resumo.push([], ["Dia", "Data", "Pedidos", "Masterclass"]);
    R.dia.forEach(d => resumo.push([d.dia, U.fmtDate(d.data), d.total, d.mc]));
    add("Resumo", resumo);

    const ped = [["Nº Pedido", "Entrada no financeiro", "Dia da semana", "Data", "Hora", "Verificação (envio do link)", "Confirmação do pagamento", `Status no fechamento (${U.fmtDM(fim)})`,
      "Envio do link (h)", "Faixa de verificação", "Verificação → confirmação (h)", "Confirmação desde a entrada (h)", "Faixa de confirmação", "Forma de pagamento", "Quem verificou", "Quem confirmou", "Valor total (R$)", "Mentoria / Evento", "Masterclass (evento analisado)"]];
    M.pedidos.forEach(o => ped.push([o.pedido, U.fmtDT(o.entry), I.DIAS_SEMANA[o.entry.getDay()], U.fmtDate(o.entry), o.entry.getHours(),
      U.fmtDT(o.faixaVer ? o.ver : null), U.fmtDT(o.faixaConf ? o.conf : null), o.statusFech === "Verificado" ? "Verificado – aguardando confirmação" : o.statusFech === "Confirmado" ? "Pagamento confirmado" : "Pagamento pendente",
      n1(o.hLink), o.faixaVer || "Sem envio de link", n1(o.hV2C), n1(o.hConf), o.faixaConf || "Não confirmado", o.formaPag, o.quemVer || "", o.quemConf || "", o.valor === null ? "" : o.valor,
      R.eventos ? (R.eventos.get(o.key) || "") : "", (mcs.filter(m => m.keys.has(o.key)).map(m => m.termo).join(" + ")) || "Não"]));
    add("Pedidos da semana", ped);

    add("SLA", [["Nº Pedido", "Situação", "Entrada no financeiro", "Data do pagamento", "Dias desde a entrada", "Forma de pagamento", "Valor total (R$)"]]
      .concat(sl.vencidos.map(o => [o.pedido, `Em aberto com prazo vencido em ${U.fmtDM(fim)}`, U.fmtDT(o.entry), "", o.diasAberto, o.formaPag, o.valor === null ? "" : o.valor]))
      .concat(sl.pagosFora.map(o => [o.pedido, "Pago fora do prazo na semana", U.fmtDT(o.entry), U.fmtDate(o.pagDate), o.diasPagto, o.formaPag, o.valor === null ? "" : o.valor])));

    if (cn) add("Cancelamentos", [["Nº Pedido", "Cancelado em", "Data do pedido", "Motivo (agrupado)", "Categoria informada", "Descrição", "Cancelado por", "Valor (R$)"]]
      .concat(cn.rows.map(r => [r.pedido, U.fmtDT(r.canceladoEm), r.dtPedido ? U.fmtDate(r.dtPedido) : "", r.grupo, r.categoria, r.motivo, r.canceladoPor, r.total === null ? "" : r.total])));

    if (mcs.length) add("Masterclass", [["Evento", "Dia", "Data", "Pedidos criados", "Entraram no financeiro", "Total de entradas do dia", "% masterclass"]]
      .concat(mcs.flatMap(mc => mc.dias.map(d => [mc.termo, d.dia, U.fmtDate(d.data), d.criados, d.entraram, d.totalDia, n1(U.pct(d.entraram, d.totalDia))]))));

    add("Notas", [
      [`Período: pedidos com entrada no financeiro (Data Financeiro Aguardando) de ${periodoTxt}.`],
      ["Status excluídos: Aprovação gerencial / SAC, Análise de crédito, Crédito reprovado, Efetivado, Orçamento, Rejeitado, Retroativo e Cancelado (cancelados só entram na análise de cancelamentos)."],
      ["Status no fechamento reconstruído pelas datas de verificação e confirmação. Aguardando cadastro, Em faturamento e Faturado contam como Pagamento confirmado."],
      ["Envio do link: da entrada até a verificação (aguardando pagamento). Boleto, bonificado e PIX já pago são confirmados direto, sem verificação."],
      ["Confirmação desde a entrada: do início do dia de entrada até a confirmação. PIX confirmado direto entra na faixa 0 a 4 h."],
      [`SLA: prazo de ${I.PRAZO_PAGAMENTO_DIAS} dias. Base com entradas desde ${U.fmtDate(R.menorEntrada)}.`],
      ...R.warnings.map(w => [w])
    ]);
    XLSX.writeFile(wb, `Indicadores_semana_${U.fmtDM(ini).replace("/", "-")}_a_${U.fmtDM(fim).replace("/", "-")}.xlsx`);
  });
}

