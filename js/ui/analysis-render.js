// analysis-render.js

function refreshStatsYearFilter() {
    const $select = $('#stats-year-filter');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const invoices = getData('invoices');
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    $select.append('<option value="all">Tutti</option>');
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));

    // Default: anno corrente (se presente), altrimenti primo anno disponibile, altrimenti "Tutti"
    if (years.includes(previous) && previous !== '') {
        $select.val(previous);
    } else if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (years.length > 0) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}

// =====================
// Registri IVA
// =====================

function refreshIvaRegistersYearFilter() {
    const $select = $('#iva-year-filter');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const yearsSet = new Set();
    const invoices = getData('invoices') || [];
    const purchases = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizePurchaseInfo === 'function') ? (getData('purchases') || []).map(function (p) { return window.DomainNormalizers.normalizePurchaseInfo(p); }) : (getData('purchases') || []);

    for (const inv of invoices) {
        if (inv && inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    }
    for (const p of purchases) {
        if (p && p.date && typeof p.date === 'string' && p.date.length >= 4) {
            const y = p.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    }

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    $select.append('<option value="all">Tutti</option>');
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));

    if (years.includes(previous) && previous !== '') {
        $select.val(previous);
    } else if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (years.length > 0) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}

function renderRegistriIVAPage() {
    const container = $('#iva-registers-container');
    if (!container.length) return;

    const comp = getData('companyInfo') || {};
    let defPeriod = String(comp.ivaPeriodicita || 'mensile').toLowerCase();
    defPeriod = defPeriod.includes('tri') ? 'trimestrale' : 'mensile';

    const $periodSel = $('#iva-period-filter');
    if ($periodSel.length) {
        const cur = ($periodSel.val() || '').toLowerCase();
        if (cur !== 'mensile' && cur !== 'trimestrale') {
            $periodSel.val(defPeriod);
        }
    }

    const selectedYear = ($('#iva-year-filter').length ? ($('#iva-year-filter').val() || 'all') : 'all');
    const periodMode = ($('#iva-period-filter').length ? ($('#iva-period-filter').val() || defPeriod) : defPeriod);

    const invoices = getData('invoices') || [];
    const purchases = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizePurchaseInfo === 'function') ? (getData('purchases') || []).map(function (p) { return window.DomainNormalizers.normalizePurchaseInfo(p); }) : (getData('purchases') || []);
    const customers = getData('customers') || [];
    const suppliers = getData('suppliers') || [];



    function inSelectedYear(dateStr) {
        if (selectedYear === 'all') return true;
        if (!dateStr || typeof dateStr !== 'string') return false;
        return dateStr.substring(0, 4) === String(selectedYear);
    }

    function periodKey(dateStr) {
        if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 7) return null;
        const y = dateStr.substring(0, 4);
        const m = parseInt(dateStr.substring(5, 7), 10);
        if (!m || m < 1 || m > 12) return null;
        if (periodMode === 'trimestrale') {
            const q = Math.floor((m - 1) / 3) + 1;
            return `${y}-T${q}`;
        }
        const mm = String(m).padStart(2, '0');
        return `${y}-${mm}`;
    }

    function periodLabel(key) {
        if (!key) return '';
        if (periodMode === 'trimestrale') {
            const m = key.match(/^(\d{4})-T([1-4])$/);
            if (!m) return key;
            return `T${m[2]}/${m[1]}`;
        }
        const m = key.match(/^(\d{4})-(\d{2})$/);
        if (!m) return key;
        return `${m[2]}/${m[1]}`;
    }

    function money(n) {
        return safeFloat(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const buckets = {}; // { key: { ivaVendite, ivaAcquisti } }
    const movementsByPeriod = {}; // { key: { vendite: [], acquisti: [] } }
    const periodLabelsMap = {}; // { key: label }

    for (const inv of invoices) {
        if (!inv || !inSelectedYear(inv.date)) continue;
        // Vendite: Fattura positiva, Nota di Credito negativa
        const isNota = (String(inv.type || '').toLowerCase().includes('nota'));
        const sign = isNota ? -1 : 1;
        const k = periodKey(inv.date);
        if (!k) continue;
        buckets[k] = buckets[k] || { ivaVendite: 0, ivaAcquisti: 0 };
        buckets[k].ivaVendite += sign * safeFloat(inv.ivaTotale);

        // Movimenti (per dettaglio)
        movementsByPeriod[k] = movementsByPeriod[k] || { vendite: [], acquisti: [] };
        const cust = customers.find(c => String(c.id) === String(inv.customerId)) || {};
        const impon = sign * safeFloat(inv.totaleImponibile ?? inv.totImp ?? inv.imponibile ?? 0);
        const iva = sign * safeFloat(inv.ivaTotale ?? 0);
        const tot = sign * safeFloat(inv.total ?? inv.totDoc ?? inv.totaleDocumento ?? 0);
        movementsByPeriod[k].vendite.push({
            id: String(inv.id || ''),
            date: String(inv.date || ''),
            number: String(inv.number || ''),
            counterparty: String(cust.name || cust.ragioneSociale || ''),
            docType: String(inv.type || 'Fattura'),
            status: String(inv.status || ''),
            imponibile: impon,
            iva: iva,
            totale: tot
        });
    }

    for (const p of purchases) {
        if (!p || !inSelectedYear(p.date)) continue;
        const k = periodKey(p.date);
        if (!k) continue;
        buckets[k] = buckets[k] || { ivaVendite: 0, ivaAcquisti: 0 };
        buckets[k].ivaAcquisti += safeFloat(p.ivaTotale);

        // Movimenti (per dettaglio)
        movementsByPeriod[k] = movementsByPeriod[k] || { vendite: [], acquisti: [] };
        const sup = suppliers.find(s => String(s.id) === String(p.supplierId)) || {};
        const impon = safeFloat(p.imponibile ?? 0);
        const iva = safeFloat(p.ivaTotale ?? p.ivaTot ?? 0);
        const tot = safeFloat(p.totaleDocumento ?? p.total ?? 0);
        movementsByPeriod[k].acquisti.push({
            id: String(p.id || ''),
            date: String(p.date || ''),
            number: String(p.number || ''),
            counterparty: String(sup.name || sup.ragioneSociale || ''),
            docType: 'Acquisto',
            status: String(p.status || ''),
            imponibile: impon,
            iva: iva,
            totale: tot,
            dataScadenza: String(p.dataScadenza || '')
        });
    }

    const keys = Object.keys(buckets);
    if (keys.length === 0) {
        container.html('<div class="alert alert-info">Nessun dato per i filtri selezionati.</div>');
        return;
    }

    function sortKey(a, b) {
        // a,b like YYYY-MM or YYYY-Tn
        const ay = parseInt(a.substring(0, 4), 10);
        const by = parseInt(b.substring(0, 4), 10);
        if (ay != by) return ay - by;
        if (periodMode === 'trimestrale') {
            const aq = parseInt(a.split('-T')[1] || '0', 10);
            const bq = parseInt(b.split('-T')[1] || '0', 10);
            return aq - bq;
        }
        const am = parseInt(a.substring(5, 7), 10);
        const bm = parseInt(b.substring(5, 7), 10);
        return am - bm;
    }

    keys.sort(sortKey);

    let totVend = 0;
    let totAcq = 0;

    let html = `<table class="table table-striped table-sm">
<thead>
<tr>
  <th>Periodo</th>
  <th class="text-end">IVA Vendite</th>
  <th class="text-end">IVA Acquisti</th>
  <th class="text-end">IVA da versare</th>
  <th class="text-end">Movimenti</th>
</tr>
</thead>
<tbody>`;

    for (const k of keys) {
        const row = buckets[k];
        const vend = safeFloat(row.ivaVendite);
        const acq = safeFloat(row.ivaAcquisti);
        const diff = vend - acq;
        totVend += vend;
        totAcq += acq;
        periodLabelsMap[k] = periodLabel(k);

        html += `<tr>
  <td>${periodLabel(k)}</td>
  <td class="text-end">€ ${money(vend)}</td>
  <td class="text-end">€ ${money(acq)}</td>
  <td class="text-end fw-bold">€ ${money(diff)}</td>
  <td class="text-end"><button class="btn btn-sm btn-outline-primary iva-show-movements" data-period="${k}" type="button" title="Vedi movimenti"><i class="fas fa-list"></i></button></td>
</tr>`;
    }

    const totDiff = totVend - totAcq;

    html += `</tbody>
<tfoot>
<tr class="table-primary fw-bold">
  <td>TOTALE</td>
  <td class="text-end">€ ${money(totVend)}</td>
  <td class="text-end">€ ${money(totAcq)}</td>
  <td class="text-end">€ ${money(totDiff)}</td>
  <td class="text-end"><button class="btn btn-sm btn-outline-dark iva-show-movements" data-period="__ALL__" type="button" title="Vedi tutti i movimenti"><i class="fas fa-list"></i></button></td>
</tr>
</tfoot>
</table>`;
    // Cache per export CSV (totali e registri)
    try {
        window._lastIvaTotals = {
            selectedYear: String(selectedYear || 'all'),
            periodMode: String(periodMode || defPeriod),
            keys: (keys || []).slice(),
            buckets: buckets || {},
            totVend: totVend,
            totAcq: totAcq,
            movementsByPeriod: movementsByPeriod || {},
            periodLabelsMap: periodLabelsMap || {}
        };
    } catch (e) { }

    container.html(html);
}

function renderHomePage() {
    if (currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`);
    const note = getData('notes').find(n => n.userId === currentUser.uid);
    if (note) $('#notes-textarea').val(note.text);
    renderCalendar();
    if (dateTimeInterval) clearInterval(dateTimeInterval);
    const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
    updateDateTime();
    dateTimeInterval = setInterval(updateDateTime, 1000);
}

function getConfiguredGoogleCalendarEmbedUrl() {
    const companyInfo = window.AppStore && typeof window.AppStore.get === 'function'
        ? (window.AppStore.get('companyInfo') || {})
        : ((typeof getData === 'function') ? (getData('companyInfo') || {}) : {});
    const raw = String(companyInfo.googleCalendarEmbedUrl || companyInfo.googleCalendarId || '').trim();
    if (!raw) return '';

    // Accetta anche il codice iframe copiato da Google Calendar, estraendo solo src="...".
    const iframeMatch = raw.match(/src=["']([^"']+)["']/i);
    const value = iframeMatch ? iframeMatch[1] : raw;

    try {
        let url;
        if (/^https?:\/\//i.test(value)) {
            url = new URL(value);
        } else {
            // Se viene incollato solo l'ID calendario, costruisce l'URL embed standard.
            url = new URL('https://calendar.google.com/calendar/embed');
            url.searchParams.set('src', value);
        }

        const isGoogleCalendarEmbed = /(^|\.)calendar\.google\.com$/i.test(url.hostname) && url.pathname.indexOf('/calendar/embed') === 0;
        if (!isGoogleCalendarEmbed) return '';

        url.searchParams.set('mode', 'WEEK');
        url.searchParams.set('showTitle', '0');
        url.searchParams.set('showPrint', '0');
        url.searchParams.set('showTabs', '0');
        url.searchParams.set('showCalendars', '0');
        url.searchParams.set('showTz', '1');
        url.searchParams.set('ctz', 'Europe/Rome');
        return url.toString();
    } catch (e) {
        console.warn('URL Google Calendar non valido:', e);
        return '';
    }
}

function renderGoogleCalendarEmbed(embedUrl) {
    const safeUrl = String(embedUrl || '').replace(/"/g, '&quot;');
    return `<div class="card shadow-sm border-0 google-calendar-card">
<div class="card-header bg-primary text-white text-center fw-bold">
<i class="fab fa-google me-2"></i>GOOGLE CALENDAR · 7 GIORNI
</div>
<div class="card-body p-0">
<iframe id="google-calendar-frame" title="Google Calendar - vista 7 giorni" src="${safeUrl}" frameborder="0" scrolling="no"></iframe>
</div>
<div class="card-footer small text-muted">
Calendario incorporato da Google Calendar. Gli eventi sono visibili solo se il calendario è pubblico o condiviso con l'utente.
</div>
</div>`;
}

function renderCalendar() {
    const c = $('#calendar-widget');
    const googleCalendarEmbedUrl = getConfiguredGoogleCalendarEmbedUrl();
    if (googleCalendarEmbedUrl) {
        c.html(renderGoogleCalendarEmbed(googleCalendarEmbedUrl));
        return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayDate = now.getDate();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const totalDays = lastDay.getDate();
    let startingDay = firstDay.getDay();

    let html = `<div class="card shadow-sm border-0">
<div class="card-header bg-primary text-white text-center fw-bold">
${firstDay.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()}
</div>
<div class="card-body p-0">
<table class="table table-bordered text-center mb-0" style="table-layout: fixed;">
<thead class="table-light">
<tr>
<th class="text-danger">Dom</th><th>Lun</th><th>Mar</th><th>Mer</th>
<th>Gio</th><th>Ven</th><th>Sab</th>
</tr>
</thead>
<tbody><tr>`;

    for (let i = 0; i < startingDay; i++) {
        html += '<td class="bg-light"></td>';
    }

    for (let day = 1; day <= totalDays; day++) {
        if (startingDay > 6) {
            startingDay = 0;
            html += '</tr><tr>';
        }
        const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
        html += `<td class="align-middle p-2"><div class="${isToday}" style="width:32px; height:32px; line-height:32px; margin:0 auto;">${day}</div></td>`;
        startingDay++;
    }
    while (startingDay <= 6) {
        html += '<td class="bg-light"></td>';
        startingDay++;
    }
    html += '</tr></tbody></table></div></div>';
    c.html(html);
}

window.refreshStatsYearFilter = refreshStatsYearFilter;
window.refreshIvaRegistersYearFilter = refreshIvaRegistersYearFilter;
window.renderRegistriIVAPage = renderRegistriIVAPage;
window.renderHomePage = renderHomePage;
window.renderCalendar = renderCalendar;
window.getConfiguredGoogleCalendarEmbedUrl = getConfiguredGoogleCalendarEmbedUrl;
