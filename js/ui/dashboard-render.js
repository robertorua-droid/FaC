// dashboard-render.js

function renderStatisticsPage() {
    const container = $('#stats-table-container').empty();
    const companyInfoStats = getCurrentCompanyInfo();
    const showForfettarioSimulation = getTaxRegimeCapabilities(companyInfoStats).canUseLmSimulation;

    const selectedYear = ($('#stats-year-filter').length ? ($('#stats-year-filter').val() || 'all') : 'all');
    const inSelectedYear = (inv) => {
        if (selectedYear === 'all') return true;
        return (inv.date && typeof inv.date === 'string' && inv.date.substring(0, 4) === String(selectedYear));
    };
    const facts = getData('invoices').filter(i => inSelectedYear(i) && (i.type === 'Fattura' || i.type === undefined || i.type === ''));
    const notes = getData('invoices').filter(i => inSelectedYear(i) && i.type === 'Nota di Credito');

    if (facts.length === 0) {
        container.html('<div class="alert alert-info">Nessun dato.</div>');
        if (showForfettarioSimulation) renderTaxSimulation(0, 0);
        else $('#tax-simulation-container').empty();
        return;
    }

    const totF = facts.reduce((s, i) => s + safeFloat(i.total), 0);
    const totN = notes.reduce((s, i) => s + safeFloat(i.total), 0);
    const net = totF - totN;

    let cust = {};
    facts.forEach(i => {
        const c = String(i.customerId);
        if (!cust[c]) cust[c] = 0;
        cust[c] += safeFloat(i.total)
    });
    notes.forEach(i => {
        const c = String(i.customerId);
        if (cust[c]) cust[c] -= safeFloat(i.total)
    });

    let h = `<h5>Dettaglio Clienti</h5><table class="table table-striped table-sm">
<thead><tr><th>Cliente</th><th>Fatturato Netto</th><th>% sul Totale</th></tr></thead><tbody>`;
    Object.keys(cust)
        .sort((a, b) => cust[b] - cust[a])
        .forEach(cid => {
            const c = getData('customers').find(x => String(x.id) === String(cid)) || { name: '?' };
            const tot = cust[cid];
            const perc = net > 0 ? (tot / net) * 100 : 0;
            h += `<tr><td>${c.name}</td><td>€ ${tot.toFixed(2)}</td><td>${perc.toFixed(1)}%</td></tr>`;
        });
    h += `<tr class="fw-bold"><td>TOTALE</td><td>€ ${net.toFixed(2)}</td><td>100%</td></tr></tbody></table>`;
    container.html(h);

    const impF = facts.reduce((s, i) => s + safeFloat(i.totaleImponibile || i.total), 0);
    const impN = notes.reduce((s, i) => s + safeFloat(i.totaleImponibile || i.total), 0);
    if (showForfettarioSimulation) renderTaxSimulation(impF, impN);
    else $('#tax-simulation-container').empty();
}

function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
    const container = $('#tax-simulation-container').empty();
    const comp = getCurrentCompanyInfo();
    const coeff = safeFloat(comp.coefficienteRedditivita);
    const taxRate = safeFloat(comp.aliquotaSostitutiva);
    const inpsRate = safeFloat(comp.aliquotaContributi);

    if (!coeff || !taxRate || !inpsRate) {
        container.html('<div class="alert alert-warning">Dati mancanti.</div>');
        return;
    }

    const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
    const taxableIncome = grossRevenue * (coeff / 100);
    const socialSecurity = taxableIncome * (inpsRate / 100);
    const netTaxable = taxableIncome - socialSecurity;
    const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0;
    const totalDue = socialSecurity + tax;

    const html = `
<div class="row">
  <div class="col-md-6">
    <h5>Simulazione Contributi INPS</h5>
    <table class="table table-sm">
      <tr><th>Reddito Lordo Imponibile</th><td>€ ${taxableIncome.toFixed(2)}</td></tr>
      <tr><th>Aliquota Contributi INPS</th><td>${inpsRate}%</td></tr>
      <tr><th>Contributi Totali Previsti</th><td>€ ${socialSecurity.toFixed(2)}</td></tr>
      <tr><th>Stima Primo Acconto (40%)</th><td>€ ${(socialSecurity * 0.4).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (40%)</th><td>€ ${(socialSecurity * 0.4).toFixed(2)}</td></tr>
    </table>
  </div>
  <div class="col-md-6">
    <h5>Simulazione Imposta Sostitutiva (IRPEF)</h5>
    <table class="table table-sm">
      <tr><th>Reddito Lordo Imponibile</th><td>€ ${taxableIncome.toFixed(2)}</td></tr>
      <tr><th>Contributi INPS Deducibili</th><td>- € ${socialSecurity.toFixed(2)}</td></tr>
      <tr><th>Reddito Netto Imponibile</th><td>€ ${netTaxable.toFixed(2)}</td></tr>
      <tr><th>Aliquota Imposta</th><td>${taxRate}%</td></tr>
      <tr><th>Imposta Totale Prevista</th><td>€ ${tax.toFixed(2)}</td></tr>
      <tr><th>Stima Primo Acconto (50%)</th><td>€ ${(tax * 0.5).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (50%)</th><td>€ ${(tax * 0.5).toFixed(2)}</td></tr>
      <tr class="table-primary fw-bold"><th>Totale Uscite Stimate (Contributi + Imposte)</th><td>€ ${totalDue.toFixed(2)}</td></tr>
    </table>
  </div>
</div>`;

    container.html(html);
}

function _dashPad2(n) {
    n = parseInt(n, 10) || 0;
    return (n < 10 ? '0' : '') + String(n);
}

function _dashFormatHoursFromMinutes(mins) {
    const m = Math.max(0, parseInt(mins, 10) || 0);
    const h = m / 60;
    // formato italiano con 2 decimali
    try {
        return h.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h';
    } catch (e) {
        return (Math.round(h * 100) / 100).toFixed(2) + ' h';
    }
}

function _dashFormatDateIT(iso) {
    if (!iso || typeof iso !== 'string' || iso.length < 10) return '';
    const y = iso.substring(0, 4);
    const m = iso.substring(5, 7);
    const d = iso.substring(8, 10);
    return d + '/' + m + '/' + y;
}

function _dashMonthName(m) {
    const names = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const i = (parseInt(m, 10) || 1) - 1;
    return names[i] || ('Mese ' + m);
}

function refreshDashboardFilters() {
    const $year = $('#dash-year');
    const $month = $('#dash-month');
    const $mode = $('#dash-mode');
    if (!$year.length || !$month.length || !$mode.length) return;

    const prevYear = String($year.val() || '').trim();
    const prevMonth = String($month.val() || '').trim();

    const yearsSet = new Set();
    const addYearFromDate = (d) => {
        if (!d || typeof d !== 'string' || d.length < 4) return;
        const y = d.substring(0, 4);
        if (/^\d{4}$/.test(y)) yearsSet.add(y);
    };

    (getData('worklogs') || []).forEach(w => addYearFromDate(w.date));
    (getData('invoices') || []).forEach(i => addYearFromDate(i.date));
    (getData('purchases') || []).forEach(p => addYearFromDate(p.date));

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();
    $year.empty();
    years.forEach(y => $year.append(`<option value="${y}">${y}</option>`));

    if (prevYear && years.includes(prevYear)) $year.val(prevYear);
    else if (years.includes(currentYear)) $year.val(currentYear);
    else if (years.length) $year.val(years[0]);

    $month.empty();
    for (let m = 1; m <= 12; m++) {
        const mm = _dashPad2(m);
        $month.append(`<option value="${mm}">${_dashMonthName(m)}</option>`);
    }
    const currentMonth = _dashPad2(new Date().getMonth() + 1);
    if (prevMonth && $month.find(`option[value="${prevMonth}"]`).length) $month.val(prevMonth);
    else $month.val(currentMonth);

    // Default mode
    const modeVal = String($mode.val() || '').trim();
    if (modeVal !== 'year' && modeVal !== 'month') {
        $mode.val('year');
    }

    // show/hide mese
    if (String($mode.val()) === 'month') $('#dash-month-wrap').show();
    else $('#dash-month-wrap').hide();
}

function renderDashboardPage() {
    const $container = $('#dashboard-container');
    if (!$container.length) return;

    refreshDashboardFilters();

    const mode = String($('#dash-mode').val() || 'year');
    const year = String($('#dash-year').val() || String(new Date().getFullYear()));
    const month = String($('#dash-month').val() || _dashPad2(new Date().getMonth() + 1));

    let start = year + '-01-01';
    let end = year + '-12-31';

    if (mode === 'month') {
        const m = parseInt(month, 10) || (new Date().getMonth() + 1);
        const startDate = new Date(parseInt(year, 10), m - 1, 1);
        const endDate = new Date(parseInt(year, 10), m, 0);
        start = startDate.toISOString().slice(0, 10);
        end = endDate.toISOString().slice(0, 10);
    }

    const commesseMap = new Map((getData('commesse') || []).map(c => [String(c.id), c]));
    const projectsMap = new Map((getData('projects') || []).map(p => [String(p.id), p]));
    const customersMap = new Map((getData('customers') || []).map(c => [String(c.id), c]));

    const worklogs = (getData('worklogs') || []).filter(wl => wl && wl.date && String(wl.date) >= start && String(wl.date) <= end);

    let totMin = 0;
    let totMinFinal = 0;
    let billMin = 0;
    let billMinFinal = 0;
    let invoicedMin = 0;
    let invoicedMinFinal = 0;

    // aggregazioni (commessa = fatturo a, CF = cliente finale)
    const byProject = {};   // projectId -> {tot,bill,invoiced, totFinal,billFinal,invoicedFinal, commessaId, endCustomerName, projectCode, projectName}
    const byCommessa = {};  // commessaId -> {tot,bill,invoiced, totFinal,billFinal,invoicedFinal, endCustomers:Set}
    const byPeriod = {};    // YYYY-MM o YYYY-MM-DD -> {tot,bill, totFinal,billFinal}

    function getMinutesFinal(wl) {
        const base = parseInt(wl.minutes, 10) || 0;
        // Fix: se minutesFinal è 0, deve restituire 0, non base!
        if (wl.minutesFinal != null && wl.minutesFinal !== '') {
            return parseInt(wl.minutesFinal, 10) || 0;
        }
        return base;
    }

    function getEndCustomerName(projectId) {
        const pr = projectsMap.get(String(projectId));
        if (!pr || !pr.endCustomerId) return '';
        const c = customersMap.get(String(pr.endCustomerId));
        return c ? (c.name || '') : '';
    }

    function summarizeNamesSet(setObj) {
        const arr = Array.from(setObj || []).map(s => String(s || '').trim()).filter(Boolean);
        if (!arr.length) return '-';
        if (arr.length === 1) return arr[0];
        const shown = arr.slice(0, 3).join(', ');
        return arr.length > 3 ? (shown + ` +${arr.length - 3}`) : shown;
    }

    for (const wl of worklogs) {
        const minutes = parseInt(wl.minutes, 10) || 0;
        const minutesFinal = getMinutesFinal(wl);
        const billable = (wl.billable !== false);
        const invoiced = !!wl.invoiceId;

        totMin += minutes;
        totMinFinal += minutesFinal;
        if (billable) billMin += minutes;
        if (billable) billMinFinal += minutesFinal;
        if (invoiced) invoicedMin += minutes;
        if (invoiced) invoicedMinFinal += minutesFinal;

        const pid = String(wl.projectId || '');
        const cid = String(wl.commessaId || '');

        const pr = pid ? (projectsMap.get(pid) || {}) : {};
        const endCustName = pid ? getEndCustomerName(pid) : '';
        const projectCode = pr.code || '';
        const projectName = pr.name || '';

        if (pid) {
            if (!byProject[pid]) {
                byProject[pid] = {
                    tot: 0, bill: 0, invoiced: 0,
                    totFinal: 0, billFinal: 0, invoicedFinal: 0,
                    commessaId: cid,
                    endCustomerName: endCustName,
                    projectCode: projectCode,
                    projectName: projectName
                };
            }
            byProject[pid].tot += minutes;
            byProject[pid].totFinal += minutesFinal;
            if (billable) byProject[pid].bill += minutes;
            if (billable) byProject[pid].billFinal += minutesFinal;
            if (invoiced) byProject[pid].invoiced += minutes;
            if (invoiced) byProject[pid].invoicedFinal += minutesFinal;
            if (!byProject[pid].commessaId) byProject[pid].commessaId = cid;
            if (!byProject[pid].endCustomerName && endCustName) byProject[pid].endCustomerName = endCustName;
            if (!byProject[pid].projectCode && projectCode) byProject[pid].projectCode = projectCode;
            if (!byProject[pid].projectName && projectName) byProject[pid].projectName = projectName;
        }

        if (cid) {
            if (!byCommessa[cid]) {
                byCommessa[cid] = {
                    tot: 0, bill: 0, invoiced: 0,
                    totFinal: 0, billFinal: 0, invoicedFinal: 0,
                    endCustomers: new Set()
                };
            }
            byCommessa[cid].tot += minutes;
            byCommessa[cid].totFinal += minutesFinal;
            if (billable) byCommessa[cid].bill += minutes;
            if (billable) byCommessa[cid].billFinal += minutesFinal;
            if (invoiced) byCommessa[cid].invoiced += minutes;
            if (invoiced) byCommessa[cid].invoicedFinal += minutesFinal;
            if (endCustName) byCommessa[cid].endCustomers.add(endCustName);
        }

        let key;
        if (mode === 'month') key = String(wl.date).slice(0, 10);
        else key = String(wl.date).slice(0, 7);

        if (!byPeriod[key]) byPeriod[key] = { tot: 0, bill: 0, totFinal: 0, billFinal: 0 };
        byPeriod[key].tot += minutes;
        byPeriod[key].totFinal += minutesFinal;
        if (billable) byPeriod[key].bill += minutes;
        if (billable) byPeriod[key].billFinal += minutesFinal;
    }

    // KPI cards
    const periodLabel = (mode === 'month')
        ? (`${_dashMonthName(parseInt(month, 10))} ${year}`)
        : (`Anno ${year}`);

    const kpiHtml = `
      <div class="row g-3 mb-3">
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="text-muted small">Ore timesheet totali (commessa)</div>
              <div class="display-6">${_dashFormatHoursFromMinutes(totMin)}</div>
              <div class="small text-muted">Cliente finale: <b>${_dashFormatHoursFromMinutes(totMinFinal)}</b></div>
              <div class="small text-muted">${worklogs.length} righe nel periodo (${_dashFormatDateIT(start)} - ${_dashFormatDateIT(end)})</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="text-muted small">Ore fatturabili (commessa)</div>
              <div class="display-6">${_dashFormatHoursFromMinutes(billMin)}</div>
              <div class="small text-muted">Cliente finale: <b>${_dashFormatHoursFromMinutes(billMinFinal)}</b></div>
              <div class="small text-muted">${totMin ? Math.round((billMin / totMin) * 100) : 0}% del totale commessa</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="text-muted small">Ore già fatturate (commessa)</div>
              <div class="display-6">${_dashFormatHoursFromMinutes(invoicedMin)}</div>
              <div class="small text-muted">Cliente finale: <b>${_dashFormatHoursFromMinutes(invoicedMinFinal)}</b></div>
              <div class="small text-muted">worklog collegati a fatture</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="text-muted small">Periodo</div>
              <div class="h4 mb-0">${escapeHtml(periodLabel)}</div>
              <div class="small text-muted">Selettore Annuale/Mensile</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Tabella dettaglio per periodo (mesi o giorni) - con confronto CF
    let periodRows = '';
    const fmtCell = (main, fin) => {
        const mainHtml = _dashFormatHoursFromMinutes(main);
        const finHtml = _dashFormatHoursFromMinutes(fin);
        return `${mainHtml}<div class="small text-muted">CF: ${finHtml}</div>`;
    };

    if (mode === 'year') {
        for (let m = 1; m <= 12; m++) {
            const key = year + '-' + _dashPad2(m);
            const v = byPeriod[key] || { tot: 0, bill: 0, totFinal: 0, billFinal: 0 };
            periodRows += `<tr>
              <td>${escapeHtml(_dashMonthName(m))}</td>
              <td class="text-end">${fmtCell(v.tot, v.totFinal)}</td>
              <td class="text-end">${fmtCell(v.bill, v.billFinal)}</td>
              <td class="text-end">${v.tot ? Math.round((v.bill / v.tot) * 100) : 0}%</td>
            </tr>`;
        }
    } else {
        const keys = Object.keys(byPeriod).sort();
        for (const k of keys) {
            const v = byPeriod[k] || { tot: 0, bill: 0, totFinal: 0, billFinal: 0 };
            periodRows += `<tr>
              <td>${escapeHtml(_dashFormatDateIT(k))}</td>
              <td class="text-end">${fmtCell(v.tot, v.totFinal)}</td>
              <td class="text-end">${fmtCell(v.bill, v.billFinal)}</td>
              <td class="text-end">${v.tot ? Math.round((v.bill / v.tot) * 100) : 0}%</td>
            </tr>`;
        }
        if (!keys.length) {
            periodRows = `<tr><td colspan="4" class="text-muted">Nessun worklog nel periodo selezionato.</td></tr>`;
        }
    }

    const periodTableTitle = (mode === 'year') ? 'Dettaglio Mensile (Timesheet)' : 'Dettaglio Giornaliero (Timesheet)';
    const periodTable = `
      <div class="card shadow-sm mb-3">
        <div class="card-header"><strong>${escapeHtml(periodTableTitle)}</strong></div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-sm mb-0">
              <thead>
                <tr>
                  <th>${mode === 'year' ? 'Mese' : 'Data'}</th>
                  <th class="text-end">Ore totali</th>
                  <th class="text-end">Ore fatturabili</th>
                  <th class="text-end">%</th>
                </tr>
              </thead>
              <tbody>
                ${periodRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Top progetti
    const projectRows = Object.keys(byProject)
        .map(pid => ({ pid, ...byProject[pid] }))
        .sort((a, b) => (b.bill - a.bill) || (b.tot - a.tot))
        .slice(0, 10)
        .map(r => {
            const p = projectsMap.get(String(r.pid)) || {};
            const c = commesseMap.get(String(r.commessaId)) || {};
            const projLabel = (p.code ? (p.code + ' - ') : '') + (p.name || ('Progetto #' + r.pid));
            return `<tr>
              <td>${escapeHtml(projLabel)}</td>
              <td>${escapeHtml(r.endCustomerName || '-')}</td>
              <td>${escapeHtml(c.name || (r.commessaId ? ('Commessa #' + r.commessaId) : '-'))}</td>
              <td class="text-end">${fmtCell(r.tot, r.totFinal)}</td>
              <td class="text-end">${fmtCell(r.bill, r.billFinal)}</td>
              <td class="text-end">${r.tot ? Math.round((r.bill / r.tot) * 100) : 0}%</td>
            </tr>`;
        }).join('') || `<tr><td colspan="6" class="text-muted">Nessun dato.</td></tr>`;

    const projectsTable = `
      <div class="card shadow-sm mb-3">
        <div class="card-header"><strong>Top Progetti (ore fatturabili)</strong></div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-sm mb-0">
              <thead>
                <tr>
                  <th>Progetto</th>
                  <th>Cliente finale</th>
                  <th>Commessa</th>
                  <th class="text-end">Ore totali</th>
                  <th class="text-end">Ore fatturabili</th>
                  <th class="text-end">%</th>
                </tr>
              </thead>
              <tbody>${projectRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Top commesse
    const commessaRows = Object.keys(byCommessa)
        .map(cid => ({ cid, ...byCommessa[cid] }))
        .sort((a, b) => (b.bill - a.bill) || (b.tot - a.tot))
        .slice(0, 10)
        .map(r => {
            const c = commesseMap.get(String(r.cid)) || {};
            const billTo = customersMap.get(String(c.billToCustomerId || '')) || {};
            const endCustOut = summarizeNamesSet(r.endCustomers);
            return `<tr>
              <td>${escapeHtml(c.name || ('Commessa #' + r.cid))}</td>
              <td>${escapeHtml(endCustOut)}</td>
              <td>${escapeHtml(billTo.name || '-')}</td>
              <td class="text-end">${fmtCell(r.tot, r.totFinal)}</td>
              <td class="text-end">${fmtCell(r.bill, r.billFinal)}</td>
              <td class="text-end">${r.tot ? Math.round((r.bill / r.tot) * 100) : 0}%</td>
            </tr>`;
        }).join('') || `<tr><td colspan="6" class="text-muted">Nessun dato.</td></tr>`;

    const commesseTable = `
      <div class="card shadow-sm mb-3">
        <div class="card-header"><strong>Top Commesse (ore fatturabili)</strong></div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-sm mb-0">
              <thead>
                <tr>
                  <th>Commessa</th>
                  <th>Cliente finale</th>
                  <th>Fatturo a</th>
                  <th class="text-end">Ore totali</th>
                  <th class="text-end">Ore fatturabili</th>
                  <th class="text-end">%</th>
                </tr>
              </thead>
              <tbody>${commessaRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    $container.html(kpiHtml + periodTable + projectsTable + commesseTable);
}

window.renderStatisticsPage = renderStatisticsPage;
window.renderTaxSimulation = renderTaxSimulation;
window.refreshDashboardFilters = refreshDashboardFilters;
window.renderDashboardPage = renderDashboardPage;
