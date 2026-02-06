// ui-render.js

// 3. FUNZIONI DI RENDER UI
    // =========================================================

    function renderAll() {
    renderCompanyInfoForm();
    updateCompanyUI();
    renderProductsTable();
    renderCustomersTable();
    if (typeof bindAnagraficheSearchOnce === 'function') bindAnagraficheSearchOnce();

    const companyInfo = (getData('companyInfo') || {});
    const isForfettario = (typeof window.isForfettario === 'function') ? window.isForfettario(companyInfo) : (String(companyInfo.taxRegime || '').trim().toLowerCase() === 'forfettario');

    if (!isForfettario) {
        renderSuppliersTable();
        if (typeof refreshPurchaseYearFilter === 'function') refreshPurchaseYearFilter();
        if (typeof renderPurchasesTable === 'function') renderPurchasesTable();
    } else {
        // In forfettario non gestiamo fornitori/acquisti nel gestionale didattico
        try { $('#suppliers-table-body').empty(); } catch(e) {}
        try { $('#purchases-table-body').empty(); } catch(e) {}
    }

    refreshInvoiceYearFilter();   // <- POPOLA / AGGIORNA LA COMBO ANNO
    if (typeof refreshInvoiceCustomerFilter === 'function') refreshInvoiceCustomerFilter();
    if (typeof refreshInvoiceStatusFilter === 'function') refreshInvoiceStatusFilter();
    if (typeof bindInvoiceListFiltersOnce === 'function') bindInvoiceListFiltersOnce();
    renderInvoicesTable();        // <- USA I FILTRI SELEZIONATI
    populateDropdowns();
    refreshStatsYearFilter();     // <- POPOLA / AGGIORNA LA COMBO ANNO STATISTICHE
    if (!isForfettario) {
        refreshIvaRegistersYearFilter();
        renderRegistriIVAPage();
    } else {
        try { $('#iva-registers-table-container').empty(); } catch(e) {}
    }
    renderStatisticsPage();
    renderScadenziarioPage();
    renderHomePage();
}

// Popola la combo "Anno" in Elenco Documenti
function refreshInvoiceYearFilter() {
    const $select = $('#invoice-year-filter');
    if (!$select.length) return; // se per qualche motivo non esiste, esco

    const previous = $select.val(); // può essere null/undefined al primo load

    const invoices = getData('invoices');
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const years = Array.from(yearsSet).sort().reverse(); // anni decrescenti
    const currentYear = String(new Date().getFullYear());

    // Garantisco che l'anno corrente sia sempre selezionabile (anche se non ci sono documenti in quell'anno)
    if (!years.includes(currentYear)) years.unshift(currentYear);


    // Ricostruisco la combo mettendo PRIMA gli anni e SOLO ALLA FINE "Tutti".
    // Questo evita che al primo render (quando non c'è ancora una selezione) rimanga visivamente "Tutti".
    $select.empty();

    // Anni (incluso anno corrente già garantito sopra)
    years.forEach(y => {
        $select.append(`<option value="${y}">${y}</option>`);
    });

    // Opzione Tutti (in fondo)
    $select.append('<option value="all">Tutti</option>');

    // Default: anno corrente (se presente), altrimenti mantieni scelta precedente, altrimenti primo anno disponibile
    if (previous && previous !== 'all' && years.includes(previous)) {
        $select.val(previous);
    } else if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (years.length > 0) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }

    // Assicura che il cambio anno rinfreschi la tabella (namespace per non rompere altri handler)
    $select.off('change.invoiceYear').on('change.invoiceYear', function () {
        renderInvoicesTable();
    });
}


// Popola la combo "Cliente" in Elenco Documenti
function refreshInvoiceCustomerFilter() {
    const $select = $('#invoice-customer-filter');
    if (!$select.length) return;

    const prev = $select.val() || 'all';
    const customers = (getData('customers') || [])
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    $select.empty();
    $select.append('<option value="all">Tutti</option>');
    customers.forEach(c => {
        const label = String(c.name || '').replace(/</g, '&lt;');
        $select.append(`<option value="${c.id}">${label}</option>`);
    });

    if (prev && (prev === 'all' || customers.some(c => String(c.id) === String(prev)))) $select.val(prev);
    else $select.val('all');
}

// Popola la combo "Stato" in Elenco Documenti
function refreshInvoiceStatusFilter() {
    const $select = $('#invoice-status-filter');
    if (!$select.length) return;

    const prev = $select.val() || 'all';
    $select.empty();
    $select.append('<option value="all">Tutti</option>');
    $select.append('<option value="bozze">Bozze</option>');
    $select.append('<option value="fatture_da_inviare">Fatture - Da inviare</option>');
    $select.append('<option value="fatture_inviata">Fatture - Inviate</option>');
    $select.append('<option value="fatture_da_incassare">Fatture - Da incassare</option>');
    $select.append('<option value="fatture_pagata">Fatture - Pagate</option>');
    $select.append('<option value="note_credito">Note di Credito</option>');

    const allowed = new Set(['all','bozze','fatture_da_inviare','fatture_inviata','fatture_da_incassare','fatture_pagata','note_credito']);
    $select.val(allowed.has(prev) ? prev : 'all');
}

// Bind (una sola volta) degli eventi dei filtri elenco documenti
let __invoiceListFiltersBound = false;
function bindInvoiceListFiltersOnce() {
    if (__invoiceListFiltersBound) return;
    __invoiceListFiltersBound = true;

    $('#invoice-customer-filter, #invoice-status-filter').off('change.invoiceFilters').on('change.invoiceFilters', function () {
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    });

    $('#invoice-search-filter').off('input.invoiceFilters').on('input.invoiceFilters', function () {
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    });

    $('#invoice-reset-filters-btn').off('click.invoiceFilters').on('click.invoiceFilters', function () {
        try {
            const currentYear = String(new Date().getFullYear());
            const $year = $('#invoice-year-filter');
            if ($year.length) {
                if ($year.find(`option[value="${currentYear}"]`).length) $year.val(currentYear);
                else $year.val('all');
            }
        } catch (e) {}
        try { $('#invoice-customer-filter').val('all'); } catch (e) {}
        try { $('#invoice-status-filter').val('all'); } catch (e) {}
        try { $('#invoice-search-filter').val(''); } catch (e) {}
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    });
}


// Bind (una sola volta) dei campi ricerca per Anagrafiche (Clienti/Fornitori)
let __anagraficheSearchBound = false;
function bindAnagraficheSearchOnce() {
    if (__anagraficheSearchBound) return;
    __anagraficheSearchBound = true;

    $('#customers-search-filter').off('input.custSearch').on('input.custSearch', function () {
        if (typeof renderCustomersTable === 'function') renderCustomersTable();
    });
    $('#customers-reset-search-btn').off('click.custSearch').on('click.custSearch', function () {
        try { $('#customers-search-filter').val(''); } catch (e) {}
        if (typeof renderCustomersTable === 'function') renderCustomersTable();
    });

    $('#suppliers-search-filter').off('input.supSearch').on('input.supSearch', function () {
        if (typeof renderSuppliersTable === 'function') renderSuppliersTable();
    });
    $('#suppliers-reset-search-btn').off('click.supSearch').on('click.supSearch', function () {
        try { $('#suppliers-search-filter').val(''); } catch (e) {}
        if (typeof renderSuppliersTable === 'function') renderSuppliersTable();
    });
}




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
    const purchases = getData('purchases') || [];

    for (const inv of invoices) {
        if (inv && inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0,4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    }
    for (const p of purchases) {
        if (p && p.date && typeof p.date === 'string' && p.date.length >= 4) {
            const y = p.date.substring(0,4);
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
    const purchases = getData('purchases') || [];



    function inSelectedYear(dateStr) {
        if (selectedYear === 'all') return true;
        if (!dateStr || typeof dateStr !== 'string') return false;
        return dateStr.substring(0,4) === String(selectedYear);
    }

    function periodKey(dateStr) {
        if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 7) return null;
        const y = dateStr.substring(0,4);
        const m = parseInt(dateStr.substring(5,7), 10);
        if (!m || m < 1 || m > 12) return null;
        if (periodMode === 'trimestrale') {
            const q = Math.floor((m - 1) / 3) + 1;
            return `${y}-T${q}`;
        }
        const mm = String(m).padStart(2,'0');
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

    for (const inv of invoices) {
        if (!inv || !inSelectedYear(inv.date)) continue;
        // Vendite: Fattura positiva, Nota di Credito negativa
        const isNota = (String(inv.type || '').toLowerCase().includes('nota'));
        const sign = isNota ? -1 : 1;
        const k = periodKey(inv.date);
        if (!k) continue;
        buckets[k] = buckets[k] || { ivaVendite: 0, ivaAcquisti: 0 };
        buckets[k].ivaVendite += sign * safeFloat(inv.ivaTotale);
    }

    for (const p of purchases) {
        if (!p || !inSelectedYear(p.date)) continue;
        const k = periodKey(p.date);
        if (!k) continue;
        buckets[k] = buckets[k] || { ivaVendite: 0, ivaAcquisti: 0 };
        buckets[k].ivaAcquisti += safeFloat(p.ivaTotale);
    }

    const keys = Object.keys(buckets);
    if (keys.length === 0) {
        container.html('<div class="alert alert-info">Nessun dato per i filtri selezionati.</div>');
        return;
    }

    function sortKey(a, b) {
        // a,b like YYYY-MM or YYYY-Tn
        const ay = parseInt(a.substring(0,4), 10);
        const by = parseInt(b.substring(0,4), 10);
        if (ay != by) return ay - by;
        if (periodMode === 'trimestrale') {
            const aq = parseInt(a.split('-T')[1] || '0', 10);
            const bq = parseInt(b.split('-T')[1] || '0', 10);
            return aq - bq;
        }
        const am = parseInt(a.substring(5,7), 10);
        const bm = parseInt(b.substring(5,7), 10);
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

        html += `<tr>
  <td>${periodLabel(k)}</td>
  <td class="text-end">€ ${money(vend)}</td>
  <td class="text-end">€ ${money(acq)}</td>
  <td class="text-end fw-bold">€ ${money(diff)}</td>
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
            totAcq: totAcq
        };
    } catch (e) {}

    container.html(html);
}
function updateCompanyUI() { 
        const company = getData('companyInfo'); 
        const sidebarName = String((company && (company.name || company.ragioneSociale || company.denominazione || company.nomeStudio)) || '').trim();
        $('#company-name-sidebar').text(sidebarName || 'MIO STUDIO');
        if(currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);

        // Regime fiscale (gestionale): abilita/disabilita sezioni forfettario
        const resolvedRegime = (typeof window.getResolvedTaxRegime === 'function') ? window.getResolvedTaxRegime(company || {}) : String((company && company.taxRegime) || '').trim().toLowerCase();
        const isForfettario = (resolvedRegime === 'forfettario');
        const isOrdinario = (resolvedRegime === 'ordinario');

        // Menu: Simulazione LM solo per forfettari
        const $lmLink = $('#menu-simulazione-lm').length ? $('#menu-simulazione-lm') : $('.sidebar .nav-link[data-target="simulazione-lm"]');
        const $lmItem = $lmLink.closest('li');
        if (isForfettario) {
            $lmItem.removeClass('d-none');
        } else {
            $lmItem.addClass('d-none');
        }

        // Menu: Simulazione Ordinario solo per ordinario
        const $ordLink = $('#menu-simulazione-ordinario').length ? $('#menu-simulazione-ordinario') : $('.sidebar .nav-link[data-target="simulazione-ordinario"]');
        const $ordItem = $ordLink.closest('li');
        if (isOrdinario) {
            $ordItem.removeClass('d-none');
        } else {
            $ordItem.addClass('d-none');
        }

        // Menu: Registri IVA solo per ordinario
        const $ivaLink = $('#menu-registri-iva').length ? $('#menu-registri-iva') : $('.sidebar .nav-link[data-target="registri-iva"]');
        const $ivaItem = $ivaLink.closest('li');
        if (isOrdinario) {
            $ivaItem.removeClass('d-none');
        } else {
            $ivaItem.addClass('d-none');
        }

        // Menu: Fornitori e Acquisti solo per ordinario (in forfettario non si registrano fatture ricevute)
        const $fornLink = $('#menu-fornitori').length ? $('#menu-fornitori') : $('.sidebar .nav-link[data-target="anagrafica-fornitori"]');
        const $fornItem = $fornLink.closest('li');

        const $acqTitleItem = $('#menu-acquisti-title').length ? $('#menu-acquisti-title') : $('.sidebar .nav-section-title').filter(function(){ return $(this).text().trim() === 'Acquisti'; }).closest('li');
        const $acqNewLink = $('#menu-nuovo-acquisto').length ? $('#menu-nuovo-acquisto') : $('.sidebar .nav-link[data-target="nuovo-acquisto"]');
        const $acqListLink = $('#menu-elenco-acquisti').length ? $('#menu-elenco-acquisti') : $('.sidebar .nav-link[data-target="elenco-acquisti"]');
        const $acqNewItem = $acqNewLink.closest('li');
        const $acqListItem = $acqListLink.closest('li');

        if (isForfettario) {
            $fornItem.addClass('d-none');
            $acqTitleItem.addClass('d-none');
            $acqNewItem.addClass('d-none');
            $acqListItem.addClass('d-none');
        } else {
            $fornItem.removeClass('d-none');
            $acqTitleItem.removeClass('d-none');
            $acqNewItem.removeClass('d-none');
            $acqListItem.removeClass('d-none');
        }

        // Scadenziario: in forfettario nascondi filtri pagamenti acquisti e scadenze IVA
        const $chkPag = $('#scad-show-pagamenti');
        const $chkIva = $('#scad-show-iva');
        const $chkIvaCred = $('#scad-show-iva-crediti');
        if (isForfettario) {
            $chkPag.prop('checked', false).prop('disabled', true).closest('.form-check').addClass('d-none');
            $chkIva.prop('checked', false).prop('disabled', true).closest('.form-check').addClass('d-none');
            $chkIvaCred.prop('checked', false).prop('disabled', true).closest('.form-check').addClass('d-none');
        } else {
            $chkPag.prop('disabled', false).closest('.form-check').removeClass('d-none');
            $chkIva.prop('disabled', false).closest('.form-check').removeClass('d-none');
            $chkIvaCred.prop('disabled', false).closest('.form-check').removeClass('d-none');
        }


        // Statistiche: sezione simulazione fiscale solo per forfettari
        if (isForfettario) {
            $('#tax-simulation-section').removeClass('d-none');
        } else {
            $('#tax-simulation-section').addClass('d-none');
            $('#tax-simulation-container').empty();
        }
    }

    function renderHomePage() { 
        if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
        const note = getData('notes').find(n => n.userId === currentUser.uid);
        if(note) $('#notes-textarea').val(note.text);
        renderCalendar();
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        }));
        updateDateTime();
        dateTimeInterval = setInterval(updateDateTime, 1000);
    }

    function renderCalendar() {
        const c = $('#calendar-widget');
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
${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}
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

        for(let i = 0; i < startingDay; i++) { 
            html += '<td class="bg-light"></td>'; 
        }

        for(let day = 1; day <= totalDays; day++) {
            if (startingDay > 6) { 
                startingDay = 0; 
                html += '</tr><tr>'; 
            }
            const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
            html += `<td class="align-middle p-2"><div class="${isToday}" style="width:32px; height:32px; line-height:32px; margin:0 auto;">${day}</div></td>`;
            startingDay++;
        }
        while(startingDay <= 6) { 
            html += '<td class="bg-light"></td>'; 
            startingDay++; 
        }
        html += '</tr></tbody></table></div></div>';
        c.html(html);
    }

    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty();
        const companyInfoStats = (getData('companyInfo') || {});
        const showForfettarioSimulation = (typeof window.isForfettario === 'function') ? window.isForfettario(companyInfoStats) : (String(companyInfoStats.taxRegime || '').trim().toLowerCase() === 'forfettario');

        const selectedYear = ($('#stats-year-filter').length ? ($('#stats-year-filter').val() || 'all') : 'all');
        const inSelectedYear = (inv) => {
            if (selectedYear === 'all') return true;
            return (inv.date && typeof inv.date === 'string' && inv.date.substring(0,4) === String(selectedYear));
        };
        const facts = getData('invoices').filter(i => inSelectedYear(i) && (i.type === 'Fattura' || i.type === undefined || i.type === ''));
        const notes = getData('invoices').filter(i => inSelectedYear(i) && i.type === 'Nota di Credito');

        if(facts.length === 0) { 
            container.html('<div class="alert alert-info">Nessun dato.</div>'); 
            if (showForfettarioSimulation) renderTaxSimulation(0,0);
            else $('#tax-simulation-container').empty();
            return; 
        }

        const totF = facts.reduce((s,i)=>s+safeFloat(i.total),0);
        const totN = notes.reduce((s,i)=>s+safeFloat(i.total),0);
        const net = totF - totN;

        let cust = {};
        facts.forEach(i=>{
            const c=String(i.customerId); 
            if(!cust[c])cust[c]=0; 
            cust[c]+=safeFloat(i.total)
        });
        notes.forEach(i=>{
            const c=String(i.customerId); 
            if(cust[c])cust[c]-=safeFloat(i.total)
        });

        let h = `<h5>Dettaglio Clienti</h5><table class="table table-striped table-sm">
<thead><tr><th>Cliente</th><th>Fatturato Netto</th><th>% sul Totale</th></tr></thead><tbody>`;
        Object.keys(cust)
            .sort((a,b)=>cust[b]-cust[a])
            .forEach(cid=>{
                const c = getData('customers').find(x=>String(x.id)===String(cid))||{name:'?'};
                const tot = cust[cid];
                const perc = net > 0 ? (tot / net) * 100 : 0;
                h+=`<tr><td>${c.name}</td><td>€ ${tot.toFixed(2)}</td><td>${perc.toFixed(1)}%</td></tr>`;
            });
        h+=`<tr class="fw-bold"><td>TOTALE</td><td>€ ${net.toFixed(2)}</td><td>100%</td></tr></tbody></table>`;
        container.html(h);

        const impF = facts.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        const impN = notes.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        if (showForfettarioSimulation) renderTaxSimulation(impF, impN);
        else $('#tax-simulation-container').empty();
    }

    function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
        const container = $('#tax-simulation-container').empty();
        const comp = getData('companyInfo');
        const coeff = safeFloat(comp.coefficienteRedditivita);
        const taxRate = safeFloat(comp.aliquotaSostitutiva);
        const inpsRate = safeFloat(comp.aliquotaContributi);

        if(!coeff || !taxRate || !inpsRate) {
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
      <tr><th>Stima Primo Acconto (40%)</th><td>€ ${(socialSecurity*0.4).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (40%)</th><td>€ ${(socialSecurity*0.4).toFixed(2)}</td></tr>
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
      <tr><th>Stima Primo Acconto (50%)</th><td>€ ${(tax*0.5).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (50%)</th><td>€ ${(tax*0.5).toFixed(2)}</td></tr>
      <tr class="table-primary fw-bold"><th>Totale Uscite Stimate (Contributi + Imposte)</th><td>€ ${totalDue.toFixed(2)}</td></tr>
    </table>
  </div>
</div>`;

        container.html(html);
    }

    function renderCompanyInfoForm() {
        const c = getData('companyInfo') || {};
        for (const k in c) {
            $(`#company-${k}`).val(c[k]);
        }
        // Se taxRegime non è salvato ma è deducibile dal codice RFxx, precompilo la select per coerenza UI
        if (!String(c.taxRegime || '').trim() && typeof window.getResolvedTaxRegime === 'function') {
            const derived = window.getResolvedTaxRegime(c);
            if (derived) { try { $('#company-taxRegime').val(derived); } catch(e) {} }
        }
        // Nasconde/mostra i campi legati al forfettario in base al regime selezionato
        if (typeof window.applyCompanyTaxRegimeVisibility === 'function') {
            window.applyCompanyTaxRegimeVisibility();
        }
    }

    function renderProductsTable() {
        const table = $('#products-table-body').empty();
        const ci = getData('companyInfo') || {};
        const isForf = (typeof window.isForfettario === 'function') ? window.isForfettario(ci) : (String(ci.taxRegime || '').toLowerCase() === 'forfettario');
        getData('products').forEach(p => {
            const price = parseFloat(p.salePrice || 0).toFixed(2);
            table.append(`
<tr>
  <td>${p.code || ''}</td>
  <td>${p.description || ''}</td>
  <td class="text-end-numbers col-price pe-5">€ ${price}</td>
  <td class="text-end-numbers">${(isForf ? '0' : (p.iva || '0'))}%</td>
  <td class="text-end col-actions">
    <button class="btn btn-sm btn-outline-secondary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
        });
    }

    function renderCustomersTable() {
        const table = $('#customers-table-body').empty();
        const q = String($('#customers-search-filter').val() || '').trim().toLowerCase();

        let customers = (getData('customers') || []).slice()
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

        if (q) {
            customers = customers.filter(c => {
                const name = String(c.name || '').toLowerCase();
                const piva = String(c.piva || '').toLowerCase();
                const sdi = String(c.sdi || '').toLowerCase();
                const addr = String(c.address || '').toLowerCase();
                return name.includes(q) || piva.includes(q) || sdi.includes(q) || addr.includes(q);
            });
        }

        customers.forEach(c => {
            table.append(`
<tr>
  <td>${c.name || ''}</td>
  <td>${c.piva || ''}</td>
  <td>${c.sdi || '-'}</td>
  <td>${c.address || ''}</td>
  <td class="text-end">
    <button class="btn btn-sm btn-outline-secondary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
        });
    }

// Filtro anno per elenco fatture
    function getInvoiceFilterYear() {
        return $('#invoice-year-filter').val() || 'all';
    }

    function renderInvoicesTable() {
    const table = $('#invoices-table-body').empty();

    // Tutte le fatture ordinate per numero (come prima)
    const allInvoices = getData('invoices').sort(
        (a, b) => (b.number || '').localeCompare(a.number || '')
    );

    // Legge il filtro anno (se esiste la select)
    const yearSelect = $('#invoice-year-filter');
    const selectedYear = yearSelect.length ? (yearSelect.val() || 'all') : 'all';

    // Se è selezionato un anno specifico, filtra; altrimenti mostra tutte
    let invoices = selectedYear === 'all'
        ? allInvoices
        : allInvoices.filter(inv =>
            inv.date && String(inv.date).substring(0, 4) === String(selectedYear)
        );

    // Filtro Cliente
    const selectedCustomer = ($('#invoice-customer-filter').val() || 'all');
    if (selectedCustomer !== 'all') {
        invoices = invoices.filter(inv => String(inv.customerId || '') === String(selectedCustomer));
    }

    // Filtro Stato
    const selectedStatus = ($('#invoice-status-filter').val() || 'all');
    if (selectedStatus !== 'all') {
        invoices = invoices.filter(inv => {
            const isDraft = (inv.isDraft === true || String(inv.status || '') === 'Bozza');

            // Filtro dedicato
            if (selectedStatus === 'bozze') return isDraft;

            // Tutti gli altri filtri escludono le bozze (restano visibili in "Tutti")
            if (isDraft) return false;

            const isCredit = inv.type === 'Nota di Credito';
            const isPaid = (!isCredit) && (inv.status === 'Pagata');
            const isSent = inv.sentToAgenzia === true;

            if (selectedStatus === 'note_credito') return isCredit;
            if (isCredit) return false; // gli altri stati sono solo per fatture

            if (selectedStatus === 'fatture_da_inviare') return !isSent;
            if (selectedStatus === 'fatture_inviata') return isSent;
            if (selectedStatus === 'fatture_da_incassare') return !isPaid;
            if (selectedStatus === 'fatture_pagata') return isPaid;

            return true;
        });
    }

    // Ricerca libera (numero/cliente/tipo)
    const q = String($('#invoice-search-filter').val() || '').trim().toLowerCase();
    if (q) {
        const customers = getData('customers') || [];
        const custMap = new Map(customers.map(c => [String(c.id), String(c.name || '').toLowerCase()]));
        invoices = invoices.filter(inv => {
            const num = String(inv.number || '').toLowerCase();
            const typ = String(inv.type || 'Fattura').toLowerCase();
            const dt = String(inv.date || '').toLowerCase();
            const cust = custMap.get(String(inv.customerId || '')) || '';
            return num.includes(q) || typ.includes(q) || dt.includes(q) || cust.includes(q);
        });
    }

    invoices.forEach(inv => {
        const c = getData('customers').find(
            cust => String(cust.id) === String(inv.customerId)
        ) || { name: 'Sconosciuto' };

        const isDraft = (inv.isDraft === true || String(inv.status || '') === 'Bozza');
        const isCredit = inv.type === 'Nota di Credito';
        const isPaid = (!isDraft) && (!isCredit) && (inv.status === 'Pagata');
        const isSent = (!isDraft) && (inv.sentToAgenzia === true);

        // Blocchi:
        // - Modifica/Elimina: bloccati se Pagata (solo fatture) oppure se marcata Inviata ad ADE
        // - Pagata: deve restare cliccabile anche se "Inviata", finché non è Pagata. (Per NdC è sempre disabilitato)
        const lockEditDelete = isSent || ((!isCredit) && isPaid);
        const lockPaidButton = isDraft || isCredit || isPaid;
const badgeType = inv.type === 'Nota di Credito'
            ? '<span class="badge bg-warning text-dark border border-dark">NdC</span>'
            : '<span class="badge bg-primary">Fatt.</span>';
        const badgeDraft = isDraft ? ' <span class="badge bg-secondary">Bozza</span>' : '';
        const badge = badgeType + badgeDraft;

        // Badge stato documenti:
        // - Fatture: sempre doppio badge (invio + incasso)
        //   * appena creata: Da inviare + Da incassare
        //   * dopo invio: Inviata + Da incassare
        //   * dopo pagamento: Inviata + Pagata
        // - Note di credito: Emessa finché non marcata come inviata; poi Emessa + Inviata
        let statusBadge = '';
        if (isDraft) {
            statusBadge = '<span class="badge bg-secondary">Bozza</span>';
        } else if (inv.type === 'Nota di Credito') {
            statusBadge = '<span class="badge bg-info text-dark">Emessa</span>';
            if (isSent) statusBadge += ' <span class="badge bg-dark">Inviata</span>';
        } else {
            const sendBadge = isSent
                ? '<span class="badge bg-dark">Inviata</span>'
                : '<span class="badge bg-secondary">Da inviare</span>';

            const payBadge = isPaid
                ? '<span class="badge bg-success">Pagata</span>'
                : '<span class="badge bg-warning text-dark">Da Incassare</span>';

            statusBadge = `${sendBadge} ${payBadge}`;
        }

        const payClass = lockPaidButton ? 'btn-secondary disabled' : 'btn-success';
        const editClass = lockEditDelete ? 'btn-secondary disabled' : 'btn-outline-secondary';
        const btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice ${lockEditDelete ? 'disabled' : ''}" data-id="${inv.id}" title="Elimina" ${lockEditDelete ? 'disabled' : ''}><i class="fas fa-trash"></i></button>`;

        const btns = `
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Vedi">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm ${editClass} btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${lockEditDelete ? 'disabled' : ''}>
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-warning btn-export-xml-row ${isDraft ? 'disabled' : ''}" data-id="${inv.id}" title="XML" ${isDraft ? 'disabled' : ''}>
                    <i class="fas fa-file-code"></i>
                </button>
                <button class=\"btn btn-sm ${isDraft ? 'btn-secondary disabled' : (isSent ? 'btn-dark' : 'btn-outline-dark')} btn-mark-sent\" data-id=\"${inv.id}\" ${isDraft ? 'disabled' : ''} title=\"${isDraft ? 'Documento in bozza' : (isSent ? 'Segnato come Inviato (clic per annullare)' : 'Segna come Inviato')}\">
                    <i class=\"fas fa-paper-plane\"></i>
                </button>
                <button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="Segna come pagata" ${lockPaidButton ? 'disabled' : ''}>
                    <i class="fas fa-check"></i>
                </button>
                ${btnDelete}
            </div>
        `;

        const total = (parseFloat(inv.total) || 0).toFixed(2);
        table.append(`
            <tr class="${isDraft ? 'table-secondary' : (lockEditDelete ? 'table-light text-muted' : '')}">
                <td>${badge}</td>
                <td class="fw-bold">${inv.number}</td>
                <td>${formatDateForDisplay(inv.date)}</td>
                <td>${c.name}</td>
                <td class="text-end">€ ${total}</td>
                <td class="text-end small">${formatDateForDisplay(inv.dataScadenza)}</td>
                <td>${statusBadge}</td>
                <td class="text-end">${btns}</td>
            </tr>
        `);
    });
}

    function populateDropdowns() {
        // clienti
        $('#invoice-customer-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append(
                getData('customers').map(c => 
                    `<option value="${c.id}">${c.name}</option>`
                )
            );

        // prodotti/servizi
        $('#invoice-product-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append('<option value="manual">Manuale</option>')
            .append(
                getData('products').map(p =>
                    `<option value="${p.id}">${p.code || ''} - ${p.description || ''}</option>`
                )
            );
        // fornitori (acquisti)
        const companyInfoPurch = (getData('companyInfo') || {});
        const isForfettario = (typeof window.isForfettario === 'function') ? window.isForfettario(companyInfoPurch) : (String(companyInfoPurch.taxRegime || '').trim().toLowerCase() === 'forfettario');

        const $supSel = $('#purchase-supplier-select');
        if ($supSel.length) {
            $supSel
                .empty()
                .append('<option value="">Seleziona...</option>');

            // In forfettario non gestiamo fornitori/acquisti: evito di popolare la combo
            if (!isForfettario) {
                $supSel.append(
                    getData('suppliers').map(s =>
                        `<option value="${s.id}">${s.name}</option>`
                    )
                );
            }
        }

    }

    // =========================================================


// =========================================================
// FORNITORI (Anagrafica)
// =========================================================
function renderSuppliersTable() {
    const table = $('#suppliers-table-body');
    if (!table.length) return;
    table.empty();

    const q = String($('#suppliers-search-filter').val() || '').trim().toLowerCase();

    let suppliers = (getData('suppliers') || [])
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    if (q) {
        suppliers = suppliers.filter(s => {
            const name = String(s.name || '').toLowerCase();
            const piva = String(s.piva || '').toLowerCase();
            const pec = String(s.pec || '').toLowerCase();
            return name.includes(q) || piva.includes(q) || pec.includes(q);
        });
    }

    suppliers.forEach(s => {
        table.append(`
            <tr>
                <td>${s.name || ''}</td>
                <td>${s.piva || ''}</td>
                <td>${s.pec || ''}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary btn-edit-supplier" data-id="${s.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-supplier" data-id="${s.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `);
    });
}

// =========================================================
// 3.W SIMULAZIONE REDDITI (ORDINARIO) - SOLO UI
// (NON modifica fatture/XML: usa solo i dati gia' caricati)
// =========================================================

function refreshOrdinarioYearFilter() {
    const $select = $('#ord-year-select');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const invoices = getData('invoices') || [];
    const purchases = getData('purchases') || [];
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv && inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    purchases.forEach(p => {
        if (p && p.date && typeof p.date === 'string' && p.date.length >= 4) {
            const y = p.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));
    $select.append('<option value="all">Tutti</option>');

    if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (previous && ($select.find(`option[value="${previous}"]`).length)) {
        $select.val(previous);
    } else if (years.length) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}

function renderOrdinarioSimPage() {
    const $out = $('#ord-output');
    if (!$out.length) return;

    const company = getData('companyInfo') || {};
    const isOrd = (typeof window.isOrdinario === 'function') ? window.isOrdinario(company) : (String((company.taxRegime) || '').trim().toLowerCase() === 'ordinario');
    if (!isOrd) {
        $out.html('<div class="alert alert-info mb-0">La simulazione ordinario e\' disponibile solo se in <b>Azienda</b> hai selezionato <b>Ordinario</b>.</div>');
        return;
    }

    if (typeof OrdinarioCalc === 'undefined' || !OrdinarioCalc.computeYearlySummary) {
        $out.html('<div class="alert alert-warning mb-0">Motore ordinario non disponibile (file ordinario-calc.js non caricato).</div>');
        return;
    }

    const yearVal = $('#ord-year-select').val() || String(new Date().getFullYear());
    const onlyPaid = $('#ord-only-paid').is(':checked');
    const includeBollo = $('#ord-include-bollo').is(':checked');

    // Aliquota Gestione Separata: input -> azienda -> default 26.07
    const readAliquota = () => {
        const v = String($('#ord-inps-aliquota').val() || '').trim();
        const n = parseFloat(v.replace(',', '.'));
        if (isFinite(n)) return n;
        const cv = String(company.aliquotaGestioneSeparata || '').trim();
        const cn = parseFloat(cv.replace(',', '.'));
        if (isFinite(cn)) return cn;
        return 26.07;
    };

    const aliquotaGS = readAliquota();
    if (!String($('#ord-inps-aliquota').val() || '').trim()) {
        $('#ord-inps-aliquota').val(String(aliquotaGS));
    }

    const inpsVersati = safeFloat($('#ord-inps-versati').val());
    const detrazioni = safeFloat($('#ord-detrazioni').val());
    const crediti = safeFloat($('#ord-crediti').val());
    const accontiIrpefVersati = safeFloat($('#ord-acconti-irpef').val());

    const backup = {
        companyInfo: company,
        invoices: getData('invoices') || [],
        purchases: getData('purchases') || []
    };

    const summary = OrdinarioCalc.computeYearlySummary(backup, {
        year: yearVal === 'all' ? 'all' : parseInt(yearVal, 10),
        onlyPaid: !!onlyPaid,
        includeBolloInCompensi: !!includeBollo,
        aliquotaGestioneSeparata: aliquotaGS,
        inpsVersati: inpsVersati,
        detrazioniIrpef: detrazioni,
        creditiIrpef: crediti,
        accontiIrpefVersati: accontiIrpefVersati
    });

    const money = (v) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '0.00';

    const t = summary.totals || {};
    const inps = summary.inps || {};
    const irpef = summary.irpef || {};
    const ac = summary.acconti || {};

    const notePaidHint = onlyPaid
        ? '<div class="text-muted small">Nota: il filtro "solo pagate" si applica alle fatture (status=Pagata) e agli acquisti (status=Pagata). Le note di credito vengono considerate come rettifica dell\'anno.</div>'
        : '';

    let acIrpefHtml = '<span class="text-muted">Nessun acconto stimato</span>';
    if (ac && ac.irpef && ac.irpef.totale && ac.irpef.totale > 0) {
        if (ac.irpef.rate && ac.irpef.rate.length === 1) {
            acIrpefHtml = `Unica rata: € ${money(ac.irpef.rate[0].importo)}`;
        } else if (ac.irpef.rate && ac.irpef.rate.length === 2) {
            acIrpefHtml = `1ª rata: € ${money(ac.irpef.rate[0].importo)} — 2ª rata: € ${money(ac.irpef.rate[1].importo)}`;
        } else {
            acIrpefHtml = `Totale: € ${money(ac.irpef.totale)}`;
        }
    }

    let acInpsHtml = '<span class="text-muted">Nessun acconto stimato</span>';
    if (ac && ac.inps && ac.inps.totale && ac.inps.totale > 0) {
        if (ac.inps.rate && ac.inps.rate.length === 2) {
            acInpsHtml = `1ª rata: € ${money(ac.inps.rate[0].importo)} — 2ª rata: € ${money(ac.inps.rate[1].importo)}`;
        } else {
            acInpsHtml = `Totale: € ${money(ac.inps.totale)}`;
        }
    }

    $out.html(`
      <div class="mb-2"><b>Anno:</b> ${escapeXML(String(summary.meta && summary.meta.year ? summary.meta.year : yearVal))}</div>
      <div class="mb-2"><b>Modalita\':</b> ${onlyPaid ? 'Solo Pagate' : 'Tutti i documenti'} | ${includeBollo ? 'Bollo incluso nei compensi' : 'Bollo escluso dai compensi'}</div>
      ${notePaidHint}
      <hr/>

      <div class="row g-3">
        <div class="col-md-6">
          <div class="p-2 border rounded bg-white">
            <div class="mb-1"><span class="badge bg-primary">REDDITO</span></div>
            <div><b>Compensi (imponibile):</b> € ${money(t.compensiImponibile)}</div>
            <div><b>Bollo considerato:</b> € ${money(t.bolloConsiderato)}</div>
            <div><b>Spese deducibili (imponibile acquisti):</b> € ${money(t.speseImponibile)}</div>
            <div class="mt-1"><b>Reddito ante INPS:</b> € ${money(t.redditoAnteInps)}</div>
            <div class="text-muted small">Ritenute d'acconto subite: € ${money(t.ritenuteSubite)}</div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="p-2 border rounded bg-white">
            <div class="mb-1"><span class="badge bg-success">INPS</span></div>
            <div><b>Aliquota Gestione Separata:</b> ${escapeXML(String(inps.aliquota || aliquotaGS))}%</div>
            <div><b>Contributi stimati:</b> € ${money(inps.contributiDovuti)}</div>
            <div><b>Versati (input):</b> € ${money(inps.versati)}</div>
            <div class="mt-1"><b>Saldo INPS:</b> € ${money(inps.saldo)}</div>
            <div class="text-muted small">Stima acconti INPS: ${acInpsHtml}</div>
          </div>
        </div>
      </div>

      <div class="row g-3 mt-1">
        <div class="col-md-12">
          <div class="p-2 border rounded bg-white">
            <div class="mb-1"><span class="badge bg-dark">IRPEF</span></div>
            <div><b>Base imponibile IRPEF (dopo deduzione INPS):</b> € ${money(irpef.baseImponibile)}</div>
            <div><b>IRPEF lorda:</b> € ${money(irpef.irpefLorda)}</div>
            <div><b>Detrazioni (input):</b> € ${money(irpef.detrazioni)}</div>
            <div><b>Crediti (input):</b> € ${money(irpef.crediti)}</div>
            <div class="mt-1"><b>IRPEF netta stimata:</b> € ${money(irpef.irpefNetta)}</div>
            <div><b>Ritenute subite:</b> € ${money(irpef.ritenute)}</div>
            <div><b>Acconti IRPEF gia\' versati (input):</b> € ${money(irpef.accontiVersati)}</div>
            <div class="mt-1"><b>Saldo IRPEF:</b> € ${money(irpef.saldo)}</div>
            <div class="text-muted small">Stima acconti IRPEF: ${acIrpefHtml}</div>
          </div>
        </div>
      </div>

      <hr/>
      <h5 class="mt-2">Mappa quadri (indicativa)</h5>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th style="width:110px;">Quadro</th>
              <th>Campo (descrizione)</th>
              <th style="width:220px;" class="text-end">Valore</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><b>RE</b></td><td>Compensi (imponibile)</td><td class="text-end">€ ${money(t.compensiImponibile)}</td></tr>
            <tr><td><b>RE</b></td><td>Spese deducibili (imponibile acquisti)</td><td class="text-end">€ ${money(t.speseImponibile)}</td></tr>
            <tr><td><b>RE</b></td><td>Reddito (ante INPS)</td><td class="text-end">€ ${money(t.redditoAnteInps)}</td></tr>
            <tr><td><b>RN</b></td><td>Base imponibile IRPEF (dopo INPS)</td><td class="text-end">€ ${money(irpef.baseImponibile)}</td></tr>
            <tr><td><b>RN</b></td><td>IRPEF netta</td><td class="text-end">€ ${money(irpef.irpefNetta)}</td></tr>
            <tr><td><b>RN</b></td><td>Ritenute subite</td><td class="text-end">€ ${money(irpef.ritenute)}</td></tr>
            <tr><td><b>RN</b></td><td>Saldo IRPEF</td><td class="text-end">€ ${money(irpef.saldo)}</td></tr>
            <tr><td><b>RN</b></td><td>Acconti IRPEF (stimati)</td><td class="text-end">€ ${money((ac.irpef && ac.irpef.totale) || 0)}</td></tr>
            <tr><td><b>RR</b></td><td>Contributi Gestione Separata (dovuti)</td><td class="text-end">€ ${money(inps.contributiDovuti)}</td></tr>
            <tr><td><b>RR</b></td><td>Saldo INPS</td><td class="text-end">€ ${money(inps.saldo)}</td></tr>
            <tr><td><b>RR</b></td><td>Acconti INPS (stimati)</td><td class="text-end">€ ${money((ac.inps && ac.inps.totale) || 0)}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="mt-2 text-muted small">
        <b>Nota:</b> la numerazione dei righi e le regole degli acconti possono variare per annualita\' e casistiche (detrazioni, crediti, addizionali, altre imposte).
      </div>
    `);
}
// =========================================================
// 3.X SIMULAZIONE FISCALE (QUADRO LM) - SOLO UI
// (NON modifica fatture/XML: usa solo i dati già caricati)
// =========================================================

function refreshLMYearFilter() {
    const $select = $('#lm-year-select');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const invoices = getData('invoices') || [];
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv && inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));
    $select.append('<option value="all">Tutti</option>');

    // Default: anno corrente se presente; altrimenti ripristina precedente; altrimenti primo
    if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (previous && ($select.find(`option[value="${previous}"]`).length)) {
        $select.val(previous);
    } else if (years.length) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}

function renderLMPage() {
    const $out = $('#lm-output');
    if (!$out.length) return;

    const companyLM = (getData('companyInfo') || {});
    const isForf = (typeof window.isForfettario === 'function') ? window.isForfettario(companyLM) : (String(companyLM.taxRegime || '').trim().toLowerCase() === 'forfettario');
    if (!isForf) {
        $out.html('<div class="alert alert-info mb-0">La simulazione Quadro LM è disponibile solo per il regime <b>Forfettario</b>.</div>');
        return;
    }

    if (typeof ForfettarioCalc === 'undefined' || !ForfettarioCalc.computeYearlySummary) {
        $out.html('<div class="alert alert-warning mb-0">Motore LM non disponibile (file forfettario-calc.js non caricato).</div>');
        return;
    }

    const yearVal = $('#lm-year-select').val() || String(new Date().getFullYear());
    const onlyPaid = $('#lm-only-paid').is(':checked');
    const includeBollo = $('#lm-include-bollo').is(':checked');

    // backup minimo dal globalData
    const backup = {
        companyInfo: getData('companyInfo') || {},
        invoices: getData('invoices') || []
    };

    const summary = ForfettarioCalc.computeYearlySummary(backup, {
        year: yearVal === 'all' ? 'all' : parseInt(yearVal, 10),
        onlyPaid: !!onlyPaid,
        includeBolloInCompensi: !!includeBollo
    });

    const t = summary.totals || {};
    const s = summary.forfettarioSimulation || {};
    const params = summary.companyParams || {};

    const money = (v) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '0.00';
    const numVal = (v) => (v === null || v === undefined || v === '') ? '' : String(v);

    // Versamenti (stima realistica)
    const v = (s.versamenti || {});
    const vImp = (v.imposta || {});
    const vInps = (v.inps || {});

    const metaYear = (summary.meta && summary.meta.year) ? summary.meta.year : yearVal;
    const yearNum = (String(metaYear) !== 'all' && !isNaN(parseInt(metaYear, 10))) ? parseInt(metaYear, 10) : null;
    const nextYear = (yearNum !== null) ? (yearNum + 1) : null;

    // Sezione acconti (mostra sia lordi che "netti" dopo compensazione credito)
    let accontiHtml = '';
    if (vImp && typeof vImp.accontoTotaleStimato === 'number') {
        const a1 = vImp.acconto1Stimato || 0;
        const a2 = vImp.acconto2Stimato || 0;
        const unica = vImp.accontoUnicaRataStimata || 0;
        const a1n = vImp.acconto1NettoDaVersare || 0;
        const a2n = vImp.acconto2NettoDaVersare || 0;
        const thNo = (vImp.soglieAcconti && vImp.soglieAcconti.noAcconto) ? vImp.soglieAcconti.noAcconto : 51.65;
        const thTwo = (vImp.soglieAcconti && vImp.soglieAcconti.dueRate) ? vImp.soglieAcconti.dueRate : 257.52;

        if ((a1 + a2) <= 0) {
            accontiHtml = `<div class="mt-2 text-muted"><b>Acconti imposta:</b> nessun acconto (sotto € ${money(thNo)})</div>`;
        } else if (unica > 0 && a1 === 0) {
            accontiHtml = `<div class="mt-2"><b>Acconto imposta (unica rata):</b> € ${money(unica)} <span class="text-muted">(sotto € ${money(thTwo)})</span> — <b>Netto dopo crediti:</b> € ${money(a2n)}</div>`;
        } else {
            accontiHtml = `<div class="mt-2"><b>Acconti imposta:</b> 1° (40%) € ${money(a1)} — 2° (60%) € ${money(a2)} — <b>Netti dopo crediti:</b> € ${money(a1n)} + € ${money(a2n)}</div>`;
        }
    }

    // Box versamenti (F24) con input modificabili e persistiti su companyInfo
    const versamentiHtml = `
      <div class="mt-3 p-2 border rounded">
        <div class="mb-1"><span class="badge bg-warning text-dark">VERSAMENTI (stima)</span></div>

        <div class="row g-2">
          <div class="col-md-4">
            <label class="form-label mb-0">Contributi INPS già versati (€)</label>
            <input class="form-control form-control-sm" id="lm-contributi-versati" type="number" step="0.01" value="${numVal(params.contributiVersati)}"/>
            <div class="form-text">Usato per stimare il saldo RR (dovuti − versati).</div>
          </div>
          <div class="col-md-4">
            <label class="form-label mb-0">Acconti imposta già versati (€)</label>
            <input class="form-control form-control-sm" id="lm-acconti-imposta-versati" type="number" step="0.01" value="${numVal(params.accontiImpostaVersati)}"/>
            <div class="form-text">Riduce il saldo dell’anno (RX).</div>
          </div>
          <div class="col-md-4">
            <label class="form-label mb-0">Crediti/compensazioni disponibili (€)</label>
            <input class="form-control form-control-sm" id="lm-crediti-imposta" type="number" step="0.01" value="${numVal(params.creditiImposta)}"/>
            <div class="form-text">Credito compensabile in F24 (RX).</div>
          </div>
        </div>

        <button class="btn btn-sm btn-outline-primary mt-2" id="lm-save-versamenti-btn" type="button">
          <i class="fas fa-save"></i> Salva e ricalcola
        </button>

        <hr class="my-2"/>

        <div><b>Saldo imposta (anno ${escapeXML(String(metaYear))}):</b> € ${money(vImp.saldoNettoDaVersare || 0)}</div>
        <div class="text-muted" style="font-size:0.9em;">
          Dovuta € ${money(vImp.dovutaAnno || 0)} — Acconti versati € ${money(vImp.accontiVersatiAnno || 0)} — Crediti € ${money(vImp.creditiDisponibili || 0)}
          ${((vImp.creditoResiduoDopoSaldo || 0) > 0) ? ` — Credito residuo dopo saldo € ${money(vImp.creditoResiduoDopoSaldo)}` : ``}
        </div>

        <div class="mt-2"><b>INPS (saldo stimato):</b> € ${money(vInps.saldoNettoDaVersareStimato || 0)}</div>
        <div class="text-muted" style="font-size:0.9em;">Dovuti € ${money(vInps.dovutiStimati || 0)} — Versati € ${money(vInps.versatiAnno || 0)}</div>

        ${nextYear ? `
          <div class="mt-2"><b>Acconti imposta stimati (anno ${nextYear}):</b></div>
          ${accontiHtml}

          <div class="mt-2">
            <b>Scadenze tipiche (stima):</b>
            <ul class="mb-0">
              <li><b>30/06/${nextYear}:</b> saldo imposta (anno ${yearNum}) + 1° acconto (anno ${nextYear}) → € ${money((vImp.saldoNettoDaVersare || 0) + (vImp.acconto1NettoDaVersare || 0))}</li>
              <li><b>30/11/${nextYear}:</b> 2° acconto (anno ${nextYear}) → € ${money(vImp.acconto2NettoDaVersare || 0)}</li>
            </ul>
            <div class="text-muted" style="font-size:0.9em;">Nota: scadenze/percentuali possono variare per annualità e casi particolari; questa è una simulazione didattica.</div>
          </div>
        ` : `<div class="mt-2 text-muted" style="font-size:0.9em;">Seleziona un anno specifico (non “Tutti”) per vedere la stima acconti e scadenze.</div>`}
      </div>
    `;


    $out.html(`
        <div class="mb-2"><b>Anno:</b> ${escapeXML(String(summary.meta && summary.meta.year ? summary.meta.year : yearVal))}</div>
        <div class="mb-2"><b>Modalità:</b> ${onlyPaid ? 'Solo Pagate' : 'Tutti i documenti'} | ${includeBollo ? 'Bollo incluso nei compensi' : 'Bollo escluso dai compensi'}</div>
        <hr>
        <div><b>Fatture:</b> ${t.fattureCount || 0} | <b>Note di credito:</b> ${t.noteCreditoCount || 0}</div>
        <div><b>Imponibile netto:</b> € ${money(t.totaleImponibile && t.totaleImponibile.netto)}</div>
        <div><b>Bollo netto:</b> € ${money(t.bollo && t.bollo.netto)}</div>
        <div><b>Totale documento netto:</b> € ${money(t.totaleDocumento && t.totaleDocumento.netto)}</div>
        <hr>
        <div><b>Base compensi (LM22 col.3):</b> € ${money(s.baseCompensi)}</div>
        <div><b>Coefficiente redditività (LM22 col.2):</b> ${escapeXML(String(s.coefficienteRedditivita || ''))}%</div>
        <div><b>Reddito forfettario (LM22 col.5):</b> € ${money(s.redditoForfettario)}</div>

        
        <div class="mt-3 p-2 border rounded">
          <div class="mb-1"><span class="badge bg-success">PREVIDENZA</span></div>
          <div><b>Contributi INPS stimati:</b> € ${money(s.contributiINPSStimati)} (${escapeXML(String(s.aliquotaContributi || ''))}%)</div>
          <div class="text-muted" style="font-size:0.9em;">Questa voce è deducibile e riduce la base su cui si calcola l’imposta.</div>
        </div>

        <div class="mt-3 p-2 border rounded">
          <div class="mb-1"><span class="badge bg-primary">FISCO</span></div>
          <div><b>Imponibile imposta:</b> € ${money(s.imponibileImposta)}</div>
          <div><b>Imposta sostitutiva stimata:</b> € ${money(s.impostaSostitutivaStimata)} (${escapeXML(String(s.aliquotaSostitutiva || ''))}%)</div>
        </div>

        ${versamentiHtml}
        <hr>
        <h5 class="mt-2">Quadro LM (mappa righi/colonne)</h5>
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width:90px;">Rigo</th>
                <th style="width:90px;">Col.</th>
                <th>Campo</th>
                <th style="width:220px;">Valore</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>LM22</b></td>
                <td>1</td>
                <td>Codice attività (ATECO)</td>
                <td>${escapeXML(String((backup.companyInfo && (backup.companyInfo.ateco || backup.companyInfo.codiceAteco || backup.companyInfo.codiceAttivita || backup.companyInfo.ATECO)) || ''))}</td>
              </tr>
              <tr>
                <td><b>LM22</b></td>
                <td>2</td>
                <td>Coefficiente di redditività</td>
                <td>${escapeXML(String(s.coefficienteRedditivita || ''))}%</td>
              </tr>
              <tr>
                <td><b>LM22</b></td>
                <td>3</td>
                <td>Compensi/ricavi (base di calcolo)</td>
                <td>€ ${money(s.baseCompensi)}</td>
              </tr>
              <tr>
                <td><b>LM22</b></td>
                <td>5</td>
                <td>Reddito forfettario</td>
                <td>€ ${money(s.redditoForfettario)}</td>
              </tr>
              <tr>
                <td><b>LM34</b></td>
                <td>—</td>
                <td>Reddito lordo (totale attività)</td>
                <td>€ ${money(s.redditoForfettario)}</td>
              </tr>
              <tr>
                <td><b>LM35</b></td>
                <td>—</td>
                <td>Contributi previdenziali (stimati)</td>
                <td>€ ${money(s.contributiINPSStimati)}</td>
              </tr>
              <tr>
                <td><b>LM36</b></td>
                <td>—</td>
                <td>Reddito netto (base imposta)</td>
                <td>€ ${money(s.imponibileImposta)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="text-muted mt-2" style="font-size: 0.9em;">
          Nota: questa è una <b>mappa didattica</b> basata sui valori calcolati dal gestionale (una sola attività).
        </div>

    `);

    // Salva i parametri di versamento (persistenza su companyInfo) e ricalcola
    $('#lm-save-versamenti-btn').off('click').on('click', async function () {
        const c = getData('companyInfo') || {};
        const inpsV = $('#lm-contributi-versati').val();
        const accV = $('#lm-acconti-imposta-versati').val();
        const credV = $('#lm-crediti-imposta').val();

        const patch = {
            contributiVersati: inpsV,
            accontiImpostaVersati: accV,
            creditiImposta: credV
        };

        if (typeof saveDataToCloud !== 'function') {
            alert('Funzione saveDataToCloud non disponibile.');
            return;
        }

        await saveDataToCloud('companyInfo', patch);
        // Rinfresca form azienda e ricalcola LM
        try { if (typeof renderCompanyInfoForm === 'function') renderCompanyInfoForm(); } catch (e) {}
        renderLMPage();
    });
}



// =====================
// Scadenziario
// =====================

function renderScadenziarioPage() {
    const sec = $('#scadenziario');
    if (sec.length === 0) return;

    const company = globalData.companyInfo || {};
    const periodicita = (company.ivaPeriodicita || 'mensile');

    // Defaults range: oggi -> +60 gg
    const today = new Date();
    const isoToday = today.toISOString().slice(0,10);
    const plus60 = new Date(today.getTime() + 60*24*60*60*1000).toISOString().slice(0,10);

    const fromEl = $('#scad-from');
    const toEl = $('#scad-to');
    if (fromEl.val() === '') fromEl.val(isoToday);
    if (toEl.val() === '') toEl.val(plus60);

    const from = new Date(fromEl.val());
    const to = new Date(toEl.val());
    to.setHours(23,59,59,999);
    const showIncassi = $('#scad-show-incassi').is(':checked');
    let showPagamenti = $('#scad-show-pagamenti').is(':checked');
    let showIVA = $('#scad-show-iva').is(':checked');
    let showIvaCrediti = $('#scad-show-iva-crediti').is(':checked');
    const showChiuse = $('#scad-show-chiuse').is(':checked');

    const isForfettario = (typeof window.isForfettario === 'function') ? window.isForfettario(company) : (String((company.taxRegime || '')).trim().toLowerCase() === 'forfettario');
    if (isForfettario) {
        showPagamenti = false;
        showIVA = false;
        showIvaCrediti = false;
    }

    const customers = getData('customers');
    const invoices = getData('invoices');
    const suppliers = isForfettario ? [] : getData('suppliers');
    const purchases = isForfettario ? [] : getData('purchases');

    const items = [];

    function inRange(dateStr){
        if(!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d >= from && d <= to;
    }

    function fmtMoney(n){
        return (safeFloat(n)).toLocaleString('it-IT',{minimumFractionDigits:2, maximumFractionDigits:2});
    }

    // 1) Incassi fatture
    if (showIncassi) {
        invoices.forEach(inv => {
            if (!inv || inv.type === 'Nota di Credito') return;
            const isPaid = inv.status === 'Pagata';
            if (!showChiuse && isPaid) return;
            const due = inv.dataScadenza || '';
            if (!inRange(due)) return;

            const cust = customers.find(c => String(c.id) === String(inv.customerId));
            const soggetto = cust ? cust.name : 'Cliente';
            const amount = (inv.nettoDaPagare != null) ? inv.nettoDaPagare : (inv.totDoc != null ? inv.totDoc : 0);

            items.push({
                date: due,
                kind: 'Incasso',
                soggetto,
                doc: `${inv.type === 'Fattura' ? 'Fatt.' : inv.type} #${inv.number || inv.id}`,
                amount: safeFloat(amount),
                status: isPaid ? 'Pagata' : (inv.status || 'Da Incassare'),
                entity: 'invoice',
                id: inv.id,
                overdue: (!isPaid) && (new Date(due) < new Date(new Date().toISOString().slice(0,10)))
            });
        });
    }

    // 2) Pagamenti acquisti
    if (showPagamenti) {
        purchases.forEach(p => {
            if (!p) return;
            const isPaid = p.status === 'Pagata';
            if (!showChiuse && isPaid) return;
            const due = p.dataScadenza || '';
            if (!inRange(due)) return;

            const sup = suppliers.find(s => String(s.id) === String(p.supplierId));
            const soggetto = sup ? sup.name : 'Fornitore';
            const amount = (p.totaleDocumento != null) ? p.totaleDocumento : 0;

            items.push({
                date: due,
                kind: 'Pagamento',
                soggetto,
                doc: `Acq. #${p.number || p.id}`,
                amount: safeFloat(amount),
                status: isPaid ? 'Pagata' : (p.status || 'Da Pagare'),
                entity: 'purchase',
                id: p.id,
                overdue: (!isPaid) && (new Date(due) < new Date(new Date().toISOString().slice(0,10)))
            });
        });
    }

        // 3) Scadenze IVA (didattico): calcolo saldo IVA per periodo e mostra versamento se saldo > 0
        // Nota: la scadenza è il 16 del mese/trimestre successivo al periodo IVA.
        // Questo permette di mostrare correttamente, ad es., il Q4 2025 con scadenza 16/03/2026.
        if (showIVA) {
            const getYM = (dateStr) => {
                if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 7) return { y: NaN, m: NaN };
                return {
                    y: parseInt(dateStr.slice(0, 4), 10),
                    m: parseInt(dateStr.slice(5, 7), 10)
                };
            };
            const quarterOf = (m) => Math.floor((m - 1) / 3) + 1;

            function calcSaldoMensile(y, m) {
                let ivaDebito = 0;
                let ivaCredito = 0;

                invoices.forEach(inv => {
                    if (!inv || !inv.date) return;
                    const { y: yy, m: mm } = getYM(inv.date);
                    if (yy !== y || mm !== m) return;
                    const sign = (inv.type === 'Nota di Credito') ? -1 : 1;
                    ivaDebito += sign * safeFloat(inv.ivaTotale || 0);
                });

                purchases.forEach(p => {
                    if (!p || !p.date) return;
                    const { y: yy, m: mm } = getYM(p.date);
                    if (yy !== y || mm !== m) return;
                    ivaCredito += safeFloat(p.ivaTotale || 0);
                });

                return ivaDebito - ivaCredito;
            }

            function calcSaldoTrimestrale(y, q) {
                let ivaDebito = 0;
                let ivaCredito = 0;

                invoices.forEach(inv => {
                    if (!inv || !inv.date) return;
                    const { y: yy, m: mm } = getYM(inv.date);
                    if (yy !== y || quarterOf(mm) !== q) return;
                    const sign = (inv.type === 'Nota di Credito') ? -1 : 1;
                    ivaDebito += sign * safeFloat(inv.ivaTotale || 0);
                });

                purchases.forEach(p => {
                    if (!p || !p.date) return;
                    const { y: yy, m: mm } = getYM(p.date);
                    if (yy !== y || quarterOf(mm) !== q) return;
                    ivaCredito += safeFloat(p.ivaTotale || 0);
                });

                return ivaDebito - ivaCredito;
            }

            const todayIso = new Date().toISOString().slice(0, 10);

            if (periodicita === 'trimestrale') {
                const yStart = from.getFullYear() - 1;
                const yEnd = to.getFullYear() + 1;

                for (let dueYear = yStart; dueYear <= yEnd; dueYear++) {
                    const candidates = [
                        { due: `${dueYear}-05-16`, perY: dueYear, q: 1 },
                        { due: `${dueYear}-08-16`, perY: dueYear, q: 2 },
                        { due: `${dueYear}-11-16`, perY: dueYear, q: 3 },
                        { due: `${dueYear}-03-16`, perY: dueYear - 1, q: 4 }
                    ];

                    for (const c of candidates) {
                        if (!c.due || !inRange(c.due)) continue;
                        const saldo = calcSaldoTrimestrale(c.perY, c.q);
                        if (!(saldo > 0 || (showIvaCrediti && saldo !== 0))) continue;

                        items.push({
                            date: c.due,
                            kind: 'IVA',
                            soggetto: 'Erario',
                            doc: `IVA ${c.perY} Q${c.q}`,
                            amount: safeFloat(saldo),
                            status: (saldo > 0) ? 'Da versare' : 'Credito',
                            entity: 'vat',
                            id: `${c.perY}-${c.q}`,
                            overdue: (saldo > 0) && (new Date(c.due) < new Date(todayIso))
                        });
                    }
                }
            } else {
                // Mensile
                const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
                const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);

                while (cursor <= endMonth) {
                    const dueYear = cursor.getFullYear();
                    const dueMonth = cursor.getMonth() + 1;
                    const due = `${dueYear}-${String(dueMonth).padStart(2, '0')}-16`;

                    if (inRange(due)) {
                        // Il versamento del mese M (periodo IVA) scade il 16 del mese successivo.
                        let perY = dueYear;
                        let perM = dueMonth - 1;
                        if (perM === 0) {
                            perM = 12;
                            perY = dueYear - 1;
                        }

                        const saldo = calcSaldoMensile(perY, perM);
                        if (saldo > 0 || (showIvaCrediti && saldo !== 0)) {
                            items.push({
                                date: due,
                                kind: 'IVA',
                                soggetto: 'Erario',
                                doc: `IVA ${perY}-${String(perM).padStart(2, '0')}`,
                                amount: safeFloat(saldo),
                                status: (saldo > 0) ? 'Da versare' : 'Credito',
                                entity: 'vat',
                                id: `${perY}-${perM}`,
                                overdue: (saldo > 0) && (new Date(due) < new Date(todayIso))
                            });
                        }
                    }

                    cursor.setMonth(cursor.getMonth() + 1);
                }
            }
        }


items.sort((a,b) => (a.date||'').localeCompare(b.date||''));

    // Cache per export CSV
    try { window._lastScadenziarioItems = (items || []).slice(); } catch (e) {}

    const tbody = $('#scadenziario-table-body');
    if (items.length === 0) {
        tbody.html('<tr><td colspan="7" class="text-center text-muted py-4">Nessuna scadenza nel periodo selezionato.</td></tr>');
        return;
    }

    const rows = items.map(it => {
        const badgeType = it.kind === 'Incasso'
            ? '<span class="badge bg-success">Incasso</span>'
            : (it.kind === 'Pagamento'
                ? '<span class="badge bg-danger">Pagamento</span>'
                : '<span class="badge bg-primary">IVA</span>');

        const badgeStatus = (it.status === 'Pagata')
            ? '<span class="badge bg-success">Pagata</span>'
            : (it.status === 'Credito'
                ? '<span class="badge bg-info text-dark">Credito</span>'
                : '<span class="badge bg-warning text-dark">'+escapeHtml(it.status)+'</span>');

        const trClass = it.overdue ? 'table-danger' : '';
        let actions = '';
        if (it.entity === 'invoice' && it.status !== 'Pagata') {
            const tt = 'Segna incasso come Pagato';
            actions = `<button class="btn btn-sm btn-success btn-scad-mark-invoice-paid" data-id="${it.id}" data-bs-toggle="tooltip" title="${tt}" aria-label="${tt}"><i class="fas fa-check"></i></button>`;
        } else if (it.entity === 'purchase') {
            const tt = (it.status === 'Pagata') ? 'Segna pagamento come Da Pagare' : 'Segna pagamento come Pagata';
            actions = `<button class="btn btn-sm btn-outline-success btn-scad-toggle-purchase-status" data-id="${it.id}" data-bs-toggle="tooltip" title="${tt}" aria-label="${tt}"><i class="fas fa-check"></i></button>`;
        } else {
            actions = '<span class="text-muted">—</span>';
        }

        return `
          <tr class="${trClass}">
            <td>${escapeHtml(it.date)}</td>
            <td>${badgeType}</td>
            <td>${escapeHtml(it.soggetto)}</td>
            <td>${escapeHtml(it.doc)}</td>
            <td class="text-end">${fmtMoney(it.amount)}</td>
            <td>${badgeStatus}</td>
            <td class="text-end">${actions}</td>
          </tr>
        `;
    }).join('');

    tbody.html(rows);

    // Tooltips Bootstrap 5 per i bottoni azione (spunta)
    try {
        if (window.bootstrap && bootstrap.Tooltip) {
            const rootEl = (sec && sec.length) ? sec[0] : null;
            if (rootEl) {
                rootEl.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                    const existing = bootstrap.Tooltip.getInstance(el);
                    if (existing) existing.dispose();
                    new bootstrap.Tooltip(el, { trigger: 'hover focus', container: 'body' });
                });
            }
        }
    } catch (e) { /* no-op */ }
}


function escapeHtml(str){
  const raw = String(str||'');
  const safe = (typeof window.sanitizeTextForAgenzia === 'function') ? window.sanitizeTextForAgenzia(raw) : raw;
  return safe.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[s]));
}

// =========================================================
// PASSO 0 - COMMESSE / PROGETTI / TIMESHEET
// (Modulo separato: rendering centralizzato qui)
// =========================================================

// Helper: popola una select con le Commesse
window.populateCommesseSelect = function (selectSelector, selectedId = '', includeAllOption = false) {
    const $sel = $(selectSelector);
    if (!$sel.length) return;

    const commesse = (getData('commesse') || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    const prev = selectedId || $sel.val() || '';
    $sel.empty();

    if (includeAllOption) $sel.append('<option value="all">Tutte</option>');
    $sel.append('<option value="">Seleziona...</option>');

    commesse.forEach(cm => {
        $sel.append(`<option value="${cm.id}">${escapeHtml(cm.name || '')}</option>`);
    });

    if (prev && $sel.find(`option[value="${prev}"]`).length) {
        $sel.val(prev);
    } else if (includeAllOption) {
        $sel.val('all');
    } else {
        $sel.val('');
    }
};

// Helper: popola una select con i Progetti filtrando per commessaId (opzionale)
window.populateProjectsForCommessa = function (selectSelector, commessaId = '', selectedId = '', includeAllOption = false) {
    const $sel = $(selectSelector);
    if (!$sel.length) return;

    const allProjects = (getData('projects') || []).slice();
    const projects = commessaId ? allProjects.filter(p => String(p.commessaId) === String(commessaId)) : allProjects;

    projects.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    const prev = selectedId || $sel.val() || '';
    $sel.empty();

    if (includeAllOption) $sel.append('<option value="all">Tutti</option>');
    $sel.append('<option value="">Seleziona...</option>');

    projects.forEach(pr => {
        $sel.append(`<option value="${pr.id}">${escapeHtml(pr.name || '')}</option>`);
    });

    if (prev && $sel.find(`option[value="${prev}"]`).length) {
        $sel.val(prev);
    } else if (includeAllOption) {
        $sel.val('all');
    } else {
        $sel.val('');
    }
};

function getCommessaById(id) {
    return (getData('commesse') || []).find(c => String(c.id) === String(id));
}
function getProjectById(id) {
    return (getData('projects') || []).find(p => String(p.id) === String(id));
}
function getCustomerById(id) {
    return (getData('customers') || []).find(c => String(c.id) === String(id));
}

function renderCommessePage() {
    const $tbody = $('#commesse-table-body');
    if (!$tbody.length) return;

    // Select clienti in modale (bill-to)
    const $billTo = $('#commessa-billToCustomer');
    if ($billTo.length) {
        const prev = $billTo.val() || '';
        $billTo.empty().append('<option value="">(nessuno)</option>');
        (getData('customers') || []).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')))
          .forEach(c => $billTo.append(`<option value="${c.id}">${escapeHtml(c.name||'')}</option>`));
        if (prev && $billTo.find(`option[value="${prev}"]`).length) $billTo.val(prev);
    }

    const commesse = (getData('commesse') || []).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));

    $tbody.empty();
    commesse.forEach(cm => {
        const billTo = cm.billToCustomerId ? getCustomerById(cm.billToCustomerId) : null;
        $tbody.append(`
          <tr>
            <td>${escapeHtml(cm.id)}</td>
            <td>${escapeHtml(cm.name || '')}</td>
            <td>${escapeHtml(cm.endCustomerName || '')}</td>
            <td>${escapeHtml((billTo && billTo.name) ? billTo.name : '')}</td>
            <td>${escapeHtml(cm.status || '')}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary btn-edit-commessa" data-id="${cm.id}" title="Modifica"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-outline-danger btn-delete-commessa" data-id="${cm.id}" title="Elimina"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `);
    });

    // aggiorna select collegate
    window.populateCommesseSelect('#projects-commessa-filter', '', true);
    window.populateCommesseSelect('#project-commessa', '', false);
    window.populateCommesseSelect('#ts-commessa', '', false);
    window.populateCommesseSelect('#ts-commessa-filter', '', true);
    window.populateCommesseSelect('#ts-exp-commessa', '', true);
}

function renderProjectsPage() {
    const $tbody = $('#projects-table-body');
    if (!$tbody.length) return;

    // assicura select commesse in filtro e modale
    window.populateCommesseSelect('#projects-commessa-filter', $('#projects-commessa-filter').val() || 'all', true);
    window.populateCommesseSelect('#project-commessa', $('#project-commessa').val() || '', false);

    // assicura select servizi nella modale progetto
    const $prodSel = $('#project-default-product');
    if ($prodSel.length) {
        const prev = String($prodSel.val() || '');
        $prodSel.empty().append('<option value="">(nessuno)</option>');
        (getData('products') || [])
          .slice()
          .sort((a,b)=>String(a.code||'').localeCompare(String(b.code||'')))
          .forEach(p => {
              $prodSel.append(`<option value="${p.id}">${escapeHtml((p.code||'') + (p.code ? ' - ' : '') + (p.description||''))}</option>`);
          });
        if (prev && $prodSel.find(`option[value="${prev}"]`).length) $prodSel.val(prev);
    }

    const filterCommessa = String($('#projects-commessa-filter').val() || 'all');

    const projects = (getData('projects') || []).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const filtered = (filterCommessa && filterCommessa !== 'all') ? projects.filter(p => String(p.commessaId) === filterCommessa) : projects;

    const getProdLabel = (prodId) => {
        if (!prodId) return '';
        const pr = (getData('products') || []).find(x => String(x.id) === String(prodId));
        if (!pr) return '';
        return (pr.code ? (pr.code + ' - ') : '') + (pr.description || '');
    };

    $tbody.empty();
    filtered.forEach(pr => {
        const cm = pr.commessaId ? getCommessaById(pr.commessaId) : null;
        const prodLabel = getProdLabel(pr.billingProductId);
        const rate = (pr.hourlyRate != null && pr.hourlyRate !== '' && !isNaN(parseFloat(pr.hourlyRate))) ? parseFloat(pr.hourlyRate) : null;
        const tipo = (pr.isCosto === true || pr.isCosto === 'true') ? 'Costo' : 'Lavoro';

        $tbody.append(`
          <tr>
            <td>${escapeHtml(pr.id)}</td>
            <td>${escapeHtml(cm ? (cm.name || '') : '')}</td>
            <td>${escapeHtml(pr.name || '')}</td>
            <td>${escapeHtml(prodLabel)}</td>
            <td class="text-end">${rate == null ? '' : ('€ ' + rate.toFixed(2))}</td>
            <td>${tipo === 'Costo' ? '<span class="badge bg-warning text-dark">Costo</span>' : '<span class="badge bg-primary">Lavoro</span>'}</td>
            <td>${escapeHtml(pr.status || '')}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary btn-edit-project" data-id="${pr.id}" title="Modifica"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-outline-danger btn-delete-project" data-id="${pr.id}" title="Elimina"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `);
    });
}

function renderTimesheetPage() {
    const $tbody = $('#worklogs-table-body');
    if (!$tbody.length) return;

    // reset selezione/sblocco
    try {
      $('#ts-select-all-invoiced').prop('checked', false);
      $('#ts-unlock-selected-btn').prop('disabled', true);
    } catch (e) { /* no-op */ }

    // assicura select commesse
    window.populateCommesseSelect('#ts-commessa', $('#ts-commessa').val() || '', false);
    window.populateCommesseSelect('#ts-commessa-filter', $('#ts-commessa-filter').val() || 'all', true);

    // form: progetti dipendenti dalla commessa selezionata
    const formCommessaId = String($('#ts-commessa').val() || '');
    window.populateProjectsForCommessa('#ts-project', formCommessaId, $('#ts-project').val() || '', false);

    // filtri
    const from = String($('#ts-filter-from').val() || '').trim();
    const to = String($('#ts-filter-to').val() || '').trim();
    const commessaId = String($('#ts-commessa-filter').val() || 'all');
    const projectId = String($('#ts-project-filter').val() || 'all');
    const billable = String($('#ts-billable-filter').val() || 'all');
    const invoiced = String($('#ts-invoiced-filter').val() || 'all');

    // filtro -> progetti
    const commessaForProjects = (commessaId && commessaId !== 'all') ? commessaId : '';
    window.populateProjectsForCommessa('#ts-project-filter', commessaForProjects, projectId, true);

    let rows = (getData('worklogs') || []).slice();

    // range
    if (from) rows = rows.filter(r => String(r.date || '') >= from);
    if (to) rows = rows.filter(r => String(r.date || '') <= to);

    if (commessaId && commessaId !== 'all') rows = rows.filter(r => String(r.commessaId) === commessaId);
    if (projectId && projectId !== 'all') rows = rows.filter(r => String(r.projectId) === projectId);
    if (billable !== 'all') {
        const want = billable === 'billable';
        rows = rows.filter(r => (r.billable !== false) === want);
    }

    if (invoiced !== 'all') {
        const wantInv = invoiced === 'invoiced';
        rows = rows.filter(r => (!!r.invoiceId) === wantInv);
    }

    // sort desc by date
    rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));

    const totalMinutes = rows.reduce((s, r) => s + (parseInt(r.minutes, 10) || 0), 0);
    $('#ts-total-minutes').text(totalMinutes);
    $('#ts-total-hours').text((totalMinutes / 60).toFixed(2));

    $tbody.empty();
    rows.forEach(wl => {
        const cm = wl.commessaId ? getCommessaById(wl.commessaId) : null;
        const pr = wl.projectId ? getProjectById(wl.projectId) : null;
        const mins = parseInt(wl.minutes, 10) || 0;
        const hrs = (mins / 60).toFixed(2);

        let invBadge = '';
        if (wl.invoiceId) {
            const inv = (getData('invoices') || []).find(i => String(i.id) === String(wl.invoiceId));
            const num = String(wl.invoiceNumber || (inv ? (inv.number || '') : '') || '').trim();
            invBadge = num ? `<span class="badge bg-info">${escapeHtml(num)}</span>` : `<span class="badge bg-info">Fatturato</span>`;
        }

        $tbody.append(`
          <tr>
            <td class="text-center">${wl.invoiceId ? `<input class=\"form-check-input ts-wl-select\" type=\"checkbox\" data-id=\"${wl.id}\" title=\"Seleziona per sbloccare\" />` : `<input class=\"form-check-input ts-wl-select\" type=\"checkbox\" data-id=\"${wl.id}\" disabled title=\"Non fatturato\" />`} </td>
            <td>${escapeHtml(formatDateForDisplay(wl.date || ''))}</td>
            <td>${escapeHtml(cm ? (cm.name || '') : '')}</td>
            <td>${escapeHtml(pr ? (pr.name || '') : '')}</td>
            <td class="text-end">${mins}</td>
            <td class="text-end">${hrs}</td>
            <td>${invBadge}</td>
            <td>${(wl.billable !== false) ? '<span class="badge bg-success">SI</span>' : '<span class="badge bg-secondary">NO</span>'}</td>
            <td>${escapeHtml(wl.note || '')}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary btn-edit-worklog" data-id="${wl.id}" title="Modifica"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-outline-danger btn-delete-worklog" data-id="${wl.id}" title="Elimina"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `);
    });
}

function renderTimesheetExportPage() {
    // commesse
    window.populateCommesseSelect('#ts-exp-commessa', $('#ts-exp-commessa').val() || 'all', true);

    // bill-to
    const $billto = $('#ts-exp-billto');
    if ($billto.length) {
        const prev = $billto.val() || 'all';
        $billto.empty().append('<option value="all">Tutti</option>');
        (getData('customers') || []).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')))
          .forEach(c => $billto.append(`<option value="${c.id}">${escapeHtml(c.name||'')}</option>`));
        if ($billto.find(`option[value="${prev}"]`).length) $billto.val(prev);
        else $billto.val('all');
    }

    // projects dipendenti da commessa
    const commessaId = String($('#ts-exp-commessa').val() || 'all');
    window.populateProjectsForCommessa('#ts-exp-project', commessaId !== 'all' ? commessaId : '', $('#ts-exp-project').val() || 'all', true);

    // preview
    try {
        if (typeof window._timesheetExport_buildRowsFiltered === 'function' && typeof window._timesheetExport_updatePreview === 'function') {
            const rows = window._timesheetExport_buildRowsFiltered();
            window._timesheetExport_updatePreview(rows);
        }
    } catch (e) {
        // no-op
    }
}

// Esposizione globale
window.renderCommessePage = renderCommessePage;
window.renderProjectsPage = renderProjectsPage;
window.renderTimesheetPage = renderTimesheetPage;
window.renderTimesheetExportPage = renderTimesheetExportPage;


// =====================
// Dashboard (Annuale/Mensile)
// =====================

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
    const y = iso.substring(0,4);
    const m = iso.substring(5,7);
    const d = iso.substring(8,10);
    return d + '/' + m + '/' + y;
}

function _dashMonthName(m) {
    const names = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
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
        const y = d.substring(0,4);
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
        start = startDate.toISOString().slice(0,10);
        end = endDate.toISOString().slice(0,10);
    }

    const worklogs = (getData('worklogs') || []).filter(wl => wl && wl.date && String(wl.date) >= start && String(wl.date) <= end);

    let totMin = 0;
    let billMin = 0;
    let invoicedMin = 0;

    // aggregazioni
    const byProject = {}; // projectId -> {tot,bill,invoiced,commessaId}
    const byCommessa = {}; // commessaId -> {tot,bill,invoiced}
    const byPeriod = {}; // YYYY-MM o YYYY-MM-DD

    for (const wl of worklogs) {
        const minutes = parseInt(wl.minutes, 10) || 0;
        const billable = (wl.billable !== false);
        const invoiced = !!wl.invoiceId;

        totMin += minutes;
        if (billable) billMin += minutes;
        if (invoiced) invoicedMin += minutes;

        const pid = String(wl.projectId || '');
        const cid = String(wl.commessaId || '');

        if (pid) {
            if (!byProject[pid]) byProject[pid] = { tot: 0, bill: 0, invoiced: 0, commessaId: cid };
            byProject[pid].tot += minutes;
            if (billable) byProject[pid].bill += minutes;
            if (invoiced) byProject[pid].invoiced += minutes;
            if (!byProject[pid].commessaId) byProject[pid].commessaId = cid;
        }

        if (cid) {
            if (!byCommessa[cid]) byCommessa[cid] = { tot: 0, bill: 0, invoiced: 0 };
            byCommessa[cid].tot += minutes;
            if (billable) byCommessa[cid].bill += minutes;
            if (invoiced) byCommessa[cid].invoiced += minutes;
        }

        let key;
        if (mode === 'month') key = String(wl.date).slice(0,10);
        else key = String(wl.date).slice(0,7);
        if (!byPeriod[key]) byPeriod[key] = { tot: 0, bill: 0 };
        byPeriod[key].tot += minutes;
        if (billable) byPeriod[key].bill += minutes;
    }

    const commesseMap = new Map((getData('commesse') || []).map(c => [String(c.id), c]));
    const projectsMap = new Map((getData('projects') || []).map(p => [String(p.id), p]));
    const customersMap = new Map((getData('customers') || []).map(c => [String(c.id), c]));

    // KPI cards
    const periodLabel = (mode === 'month')
      ? (`${_dashMonthName(parseInt(month,10))} ${year}`)
      : (`Anno ${year}`);

    const kpiHtml = `
      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4 col-lg-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="text-muted small">Ore timesheet totali</div>
              <div class="display-6">${_dashFormatHoursFromMinutes(totMin)}</div>
              <div class="small text-muted">${worklogs.length} righe nel periodo (${_dashFormatDateIT(start)} - ${_dashFormatDateIT(end)})</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-4 col-lg-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="text-muted small">Ore fatturabili</div>
              <div class="display-6">${_dashFormatHoursFromMinutes(billMin)}</div>
              <div class="small text-muted">${totMin ? Math.round((billMin / totMin) * 100) : 0}% del totale</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-4 col-lg-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="text-muted small">Ore già fatturate</div>
              <div class="display-6">${_dashFormatHoursFromMinutes(invoicedMin)}</div>
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

    // Tabella dettaglio per periodo (mesi o giorni)
    let periodRows = '';
    if (mode === 'year') {
        for (let m = 1; m <= 12; m++) {
            const key = year + '-' + _dashPad2(m);
            const v = byPeriod[key] || { tot: 0, bill: 0 };
            periodRows += `<tr>
              <td>${escapeHtml(_dashMonthName(m))}</td>
              <td class="text-end">${_dashFormatHoursFromMinutes(v.tot)}</td>
              <td class="text-end">${_dashFormatHoursFromMinutes(v.bill)}</td>
              <td class="text-end">${v.tot ? Math.round((v.bill / v.tot) * 100) : 0}%</td>
            </tr>`;
        }
    } else {
        // giorni ordinati
        const keys = Object.keys(byPeriod).sort();
        for (const k of keys) {
            const v = byPeriod[k] || { tot: 0, bill: 0 };
            periodRows += `<tr>
              <td>${escapeHtml(_dashFormatDateIT(k))}</td>
              <td class="text-end">${_dashFormatHoursFromMinutes(v.tot)}</td>
              <td class="text-end">${_dashFormatHoursFromMinutes(v.bill)}</td>
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
      .sort((a,b) => (b.bill - a.bill) || (b.tot - a.tot))
      .slice(0, 10)
      .map(r => {
        const p = projectsMap.get(String(r.pid)) || {};
        const c = commesseMap.get(String(r.commessaId)) || {};
        return `<tr>
          <td>${escapeHtml(p.name || ('Progetto #' + r.pid))}</td>
          <td>${escapeHtml(c.name || (r.commessaId ? ('Commessa #' + r.commessaId) : '-'))}</td>
          <td class="text-end">${_dashFormatHoursFromMinutes(r.tot)}</td>
          <td class="text-end">${_dashFormatHoursFromMinutes(r.bill)}</td>
          <td class="text-end">${r.tot ? Math.round((r.bill / r.tot) * 100) : 0}%</td>
        </tr>`;
      }).join('') || `<tr><td colspan="5" class="text-muted">Nessun dato.</td></tr>`;

    const projectsTable = `
      <div class="card shadow-sm mb-3">
        <div class="card-header"><strong>Top Progetti (ore fatturabili)</strong></div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-sm mb-0">
              <thead>
                <tr>
                  <th>Progetto</th>
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
      .sort((a,b) => (b.bill - a.bill) || (b.tot - a.tot))
      .slice(0, 10)
      .map(r => {
        const c = commesseMap.get(String(r.cid)) || {};
        const billTo = customersMap.get(String(c.billToCustomerId || '')) || {};
        return `<tr>
          <td>${escapeHtml(c.name || ('Commessa #' + r.cid))}</td>
          <td>${escapeHtml(c.endCustomerName || '-')}</td>
          <td>${escapeHtml(billTo.name || '-')}</td>
          <td class="text-end">${_dashFormatHoursFromMinutes(r.tot)}</td>
          <td class="text-end">${_dashFormatHoursFromMinutes(r.bill)}</td>
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
                  <th>End Customer</th>
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

// esposizione globale
window.refreshDashboardFilters = refreshDashboardFilters;
window.renderDashboardPage = renderDashboardPage;
