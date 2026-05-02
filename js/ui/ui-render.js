// ui-render.js

// 3. FUNZIONI DI RENDER UI
// =========================================================

function renderMasterDataArea() {
    renderProductsTable();
    renderCustomersTable();
    if (typeof bindAnagraficheSearchOnce === 'function') bindAnagraficheSearchOnce();
}

function renderPurchasesArea(companyInfo) {
    const regimeCapabilities = getTaxRegimeCapabilities(companyInfo);
    if (regimeCapabilities.canManageSuppliers) {
        renderSuppliersTable();
        if (typeof refreshPurchaseYearFilter === 'function') refreshPurchaseYearFilter();
        if (typeof renderPurchasesTable === 'function') renderPurchasesTable();
        return;
    }

    try { $('#suppliers-table-body').empty(); } catch (e) { }
    try { $('#purchases-table-body').empty(); } catch (e) { }
}

function renderSalesArea() {
    refreshInvoiceYearFilter();
    if (typeof refreshInvoiceCustomerFilter === 'function') refreshInvoiceCustomerFilter();
    if (typeof refreshInvoiceStatusFilter === 'function') refreshInvoiceStatusFilter();
    if (typeof bindInvoiceListFiltersOnce === 'function') bindInvoiceListFiltersOnce();
    renderInvoicesTable();
    populateDropdowns();
}

function renderAnalysisArea(companyInfo) {
    const regimeUi = getTaxRegimeUiVisibility(companyInfo);
    refreshStatsYearFilter();
    if (regimeUi.showVatRegistersMenu) {
        refreshIvaRegistersYearFilter();
        renderRegistriIVAPage();
    } else {
        try { $('#iva-registers-table-container').empty(); } catch (e) { }
    }
    renderStatisticsPage();
    renderScadenziarioPage();
    renderHomePage();
}

function renderAll() {
    const companyInfo = getCurrentCompanyInfo();
    renderCompanyInfoForm();
    renderNavigationVisibility();
    renderMasterDataArea();
    renderPurchasesArea(companyInfo);
    renderSalesArea();
    renderAnalysisArea(companyInfo);
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

    const allowed = new Set(['all', 'bozze', 'fatture_da_inviare', 'fatture_inviata', 'fatture_da_incassare', 'fatture_pagata', 'note_credito']);
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
        } catch (e) { }
        try { $('#invoice-customer-filter').val('all'); } catch (e) { }
        try { $('#invoice-status-filter').val('all'); } catch (e) { }
        try { $('#invoice-search-filter').val(''); } catch (e) { }
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    });
}


// Ricerca anagrafiche estratta in js/ui/masterdata-render.js




// Statistiche UI estratte in js/ui/analysis-render.js





// =====================
// Registri IVA
// =====================

// Analisi/Registri IVA estratti in js/ui/analysis-render.js
// Estratto in js/ui/navigation-visibility.js

// Home page helpers estratti in js/ui/analysis-render.js

// Calendario home estratto in js/ui/analysis-render.js

// Estratto in js/ui/dashboard-render.js

// Estratto in js/ui/dashboard-render.js

// Estratto in js/ui/company-render.js

// Tabelle anagrafiche estratte in js/ui/masterdata-render.js

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
    const isForfettario = window.TaxRegimePolicy ? window.TaxRegimePolicy.isForfettario(companyInfoPurch) : false;

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
// Fornitori UI estratti in js/ui/masterdata-render.js

// =========================================================
// 3.W / 3.X SIMULAZIONI FISCALI UI
// Estratte in js/ui/tax-render.js
// Manteniamo qui solo wrapper difensivi per non rompere il bootstrap legacy.
// =========================================================

function refreshOrdinarioYearFilter() {
    if (window.TaxRender && typeof window.TaxRender.refreshOrdinarioYearFilter === 'function') {
        return window.TaxRender.refreshOrdinarioYearFilter();
    }
}

function renderOrdinarioSimPage() {
    if (window.TaxRender && typeof window.TaxRender.renderOrdinarioSimPage === 'function') {
        return window.TaxRender.renderOrdinarioSimPage();
    }
}

function refreshLMYearFilter() {
    if (window.TaxRender && typeof window.TaxRender.refreshLMYearFilter === 'function') {
        return window.TaxRender.refreshLMYearFilter();
    }
}

function renderLMPage() {
    if (window.TaxRender && typeof window.TaxRender.renderLMPage === 'function') {
        return window.TaxRender.renderLMPage();
    }
}

// =====================
// Scadenziario
// =====================

// Estratto in js/ui/scadenziario-render.js

function escapeHtml(str) {
    const raw = String(str || '');
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
        (getData('customers') || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .forEach(c => $billTo.append(`<option value="${c.id}">${escapeHtml(c.name || '')}</option>`));
        if (prev && $billTo.find(`option[value="${prev}"]`).length) $billTo.val(prev);
    }

    const commesse = (getData('commesse') || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    $tbody.empty();
    commesse.forEach(cm => {
        const billTo = cm.billToCustomerId ? getCustomerById(cm.billToCustomerId) : null;
        const commessaName = String(cm.name || '');
        const billToName = (billTo && billTo.name) ? String(billTo.name) : '';
        $tbody.append(`
          <tr>
            <td>${escapeHtml(cm.id)}</td>
            <td title="${escapeHtml(commessaName)}">${escapeHtml(commessaName)}</td>
            <td class="commessa-billto" title="${escapeHtml(billToName)}">${escapeHtml(billToName)}</td>
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

    // assicura select CLIENTE FINALE nella modale progetto
    const $endCustSel = $('#project-endCustomer');
    if ($endCustSel.length) {
        const prev = String($endCustSel.val() || '');
        $endCustSel.empty().append('<option value="">(nessuno)</option>');
        (getData('customers') || [])
            .slice()
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .forEach(c => {
                $endCustSel.append(`<option value="${c.id}">${escapeHtml(c.name || '')}</option>`);
            });
        if (prev && $endCustSel.find(`option[value="${prev}"]`).length) $endCustSel.val(prev);
    }

    // assicura select servizi nella modale progetto
    const $prodSel = $('#project-default-product');
    if ($prodSel.length) {
        const prev = String($prodSel.val() || '');
        $prodSel.empty().append('<option value="">(nessuno)</option>');
        (getData('products') || [])
            .slice()
            .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')))
            .forEach(p => {
                $prodSel.append(`<option value="${p.id}">${escapeHtml((p.code || '') + (p.code ? ' - ' : '') + (p.description || ''))}</option>`);
            });
        if (prev && $prodSel.find(`option[value="${prev}"]`).length) $prodSel.val(prev);
    }

    const filterCommessa = String($('#projects-commessa-filter').val() || 'all');

    const projects = (getData('projects') || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const filtered = (filterCommessa && filterCommessa !== 'all') ? projects.filter(p => String(p.commessaId) === filterCommessa) : projects;

    const getProdLabel = (prodId) => {
        if (!prodId) return '';
        const pr = (getData('products') || []).find(x => String(x.id) === String(prodId));
        if (!pr) return '';
        return (pr.code ? (pr.code + ' - ') : '') + (pr.description || '');
    };

    // [NEW] Calcolo totale ore cliente finale per progetto
    const allWorklogs = getData('worklogs') || [];
    const projectHoursMap = {}; // projectId -> totalMinutesFinal

    allWorklogs.forEach(wl => {
        if (wl.projectId) {
            const pid = String(wl.projectId);
            const base = parseInt(wl.minutes, 10) || 0;
            // Logica corretta per minutesFinal (se 0, è 0)
            let mf = base;
            if (wl.minutesFinal != null && wl.minutesFinal !== '') {
                mf = parseInt(wl.minutesFinal, 10) || 0;
            }
            projectHoursMap[pid] = (projectHoursMap[pid] || 0) + mf;
        }
    });

    const formatHours = (mins) => {
        const mAcc = mins || 0;
        const h = Math.floor(mAcc / 60);
        const m = mAcc % 60;
        return `${h}:${m < 10 ? '0' + m : m}`;
    };

    $tbody.empty();

    // Header tabella (aggiunto dinamicamente se non presente nel template HTML, ma qui stiamo appendendo le rows)
    // Nota: L'header HTML statico deve essere aggiornato nel file HTML o via JS se non c'è. 
    // Controlliamo se c'è l'header per 'Ore CF Tot'. Se non c'è, lo aggiungiamo.
    const $theadRow = $('#projects-table thead tr');
    if ($theadRow.length && !$theadRow.find('th.th-ore-cf').length) {
        $theadRow.find('th').eq(4).after('<th class="th-ore-cf text-end">Ore CF Tot</th>');
    }

    filtered.forEach(pr => {
        const cm = pr.commessaId ? getCommessaById(pr.commessaId) : null;
        const prodLabel = getProdLabel(pr.billingProductId);
        const rate = (pr.hourlyRate != null && pr.hourlyRate !== '' && !isNaN(parseFloat(pr.hourlyRate))) ? parseFloat(pr.hourlyRate) : null;
        const tipo = (pr.isCosto === true || pr.isCosto === 'true') ? 'Costo' : 'Lavoro';

        // Risoluzione cliente finale
        const endCust = pr.endCustomerId ? getCustomerById(pr.endCustomerId) : null;
        const endCustName = endCust ? (endCust.name || '') : '';

        // Ore CF totali
        const totalMinutes = projectHoursMap[String(pr.id)] || 0;
        const totalHoursLabel = formatHours(totalMinutes);

        $tbody.append(`
          <tr>
            <td>${escapeHtml(pr.id)}</td>
            <td>${escapeHtml(cm ? (cm.name || '') : '')}</td>
            <td>${escapeHtml(pr.code || '')}</td>
            <td>${escapeHtml(pr.name || '')}</td>
            <td>${escapeHtml(endCustName)}</td>
            <td class="text-end fw-bold">${totalHoursLabel}</td>
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
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const totalMinutes = rows.reduce((s, r) => s + (parseInt(r.minutes, 10) || 0), 0);
    $('#ts-total-minutes').text(totalMinutes);
    $('#ts-total-hours').text((totalMinutes / 60).toFixed(2));

    $tbody.empty();
    rows.forEach(wl => {
        const cm = wl.commessaId ? getCommessaById(wl.commessaId) : null;
        const pr = wl.projectId ? getProjectById(wl.projectId) : null;

        // Calcolo Ore / Min (Principale)
        const mMain = parseInt(wl.minutes, 10) || 0;
        const hMainPart = Math.floor(mMain / 60);
        const mMainPart = mMain % 60;
        const displayMain = `${String(hMainPart).padStart(2, '0')}:${String(mMainPart).padStart(2, '0')}`;

        // Calcolo Ore / Min (Cliente Finale)
        const mFinal = (wl.minutesFinal != null && wl.minutesFinal !== '') ? (parseInt(wl.minutesFinal, 10) || 0) : mMain;
        const hFinalPart = Math.floor(mFinal / 60);
        const mFinalPart = mFinal % 60;
        const displayFinal = `${String(hFinalPart).padStart(2, '0')}:${String(mFinalPart).padStart(2, '0')}`;

        let invBadge = '';
        if (wl.invoiceId) {
            const inv = (getData('invoices') || []).find(i => String(i.id) === String(wl.invoiceId));
            const num = String(wl.invoiceNumber || (inv ? (inv.number || '') : '') || '').trim();
            invBadge = num ? `<span class="badge bg-info">${escapeHtml(num)}</span>` : `<span class="badge bg-info">Fatturato</span>`;
        }

        $tbody.append(`
              <tr>
                <td class="text-center">${wl.invoiceId ? `<input class="form-check-input ts-wl-select" type="checkbox" data-id="${wl.id}" title="Seleziona per sbloccare" />` : `<input class="form-check-input ts-wl-select" type="checkbox" data-id="${wl.id}" disabled title="Non fatturato" />`} </td>
                <td>${escapeHtml(formatDateForDisplay(wl.date || ''))}</td>
                <td>${escapeHtml(cm ? (cm.name || '') : '')}</td>
                <td>${escapeHtml(pr ? (pr.name || '') : '')}</td>
                <td class="text-end">${displayMain}</td>
                <td class="text-end">${displayFinal}</td>
                <td>${invBadge}</td>
                <td>${(wl.billable !== false) ? '<span class="badge bg-success">SI</span>' : '<span class="badge bg-secondary">NO</span>'}</td>
                <td>${escapeHtml(wl.ticket || '')}</td>
                <td style="white-space:pre-line">${escapeHtml(wl.note || '')}</td>
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
        (getData('customers') || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .forEach(c => $billto.append(`<option value="${c.id}">${escapeHtml(c.name || '')}</option>`));
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

// Estratto in js/ui/dashboard-render.js

// Estratto in js/ui/dashboard-render.js

// Estratto in js/ui/dashboard-render.js

// Estratto in js/ui/dashboard-render.js

// Estratto in js/ui/dashboard-render.js

// Estratto in js/ui/dashboard-render.js


window.renderMasterDataArea = renderMasterDataArea;
window.renderPurchasesArea = renderPurchasesArea;
window.renderSalesArea = renderSalesArea;
window.renderAnalysisArea = renderAnalysisArea;
window.renderAll = renderAll;
