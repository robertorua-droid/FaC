// purchases-module.js
// Modulo ACQUISTI (separato) - IVA a credito (no partita doppia)
// Dipendenze: jQuery, utils.js (getData/safeFloat/getNextId), firebase-cloud.js (saveDataToCloud/deleteDataFromCloud)

(function () {
    // Bootstrap tooltips helper (safe even if Bootstrap isn't loaded)
    function initTooltipsWithin(rootEl) {
        try {
            if (!rootEl || !window.bootstrap || !bootstrap.Tooltip) return;
            const els = rootEl.querySelectorAll('[data-bs-toggle="tooltip"]');
            els.forEach(el => {
                const existing = bootstrap.Tooltip.getInstance(el);
                if (existing) existing.dispose();
                new bootstrap.Tooltip(el, { trigger: 'hover focus', container: 'body' });
            });
        } catch (e) {
            // no-op
        }
    }

    function hideTooltipFor(el) {
        try {
            if (!el || !window.bootstrap || !bootstrap.Tooltip) return;
            const inst = bootstrap.Tooltip.getInstance(el);
            if (inst) {
                inst.hide();
                inst.dispose();
            }
        } catch (e) {
            // no-op
        }
    }

    function _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function ensurePurchaseDetailModal() {
        if (document.getElementById('purchaseDetailModal')) return;
        var html = ''
            + '<div class="modal fade" id="purchaseDetailModal" tabindex="-1" aria-labelledby="purchaseDetailModalLabel" aria-hidden="true">'
            + '  <div class="modal-dialog modal-lg modal-dialog-scrollable">'
            + '    <div class="modal-content">'
            + '      <div class="modal-header">'
            + '        <h5 class="modal-title" id="purchaseDetailModalLabel">Dettaglio Acquisto</h5>'
            + '        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'
            + '      </div>'
            + '      <div class="modal-body"><div id="purchase-detail-content"></div></div>'
            + '      <div class="modal-footer">'
            + '        <button type="button" class="btn btn-outline-primary" id="purchase-detail-edit-btn"><i class="fas fa-edit me-1"></i> Apri in modifica</button>'
            + '        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>'
            + '      </div>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        document.body.insertAdjacentHTML('beforeend', html);

        // Bind: Apri in modifica
        $(document)
            .off('click.purchasesDetail', '#purchase-detail-edit-btn')
            .on('click.purchasesDetail', '#purchase-detail-edit-btn', function () {
                const id = $(this).attr('data-id');
                if (!id) return;
                try {
                    const el = document.getElementById('purchaseDetailModal');
                    if (el && window.bootstrap && bootstrap.Modal) {
                        const m = bootstrap.Modal.getInstance(el);
                        if (m) m.hide();
                    }
                } catch (e) { }

                const p = (getData('purchases') || []).find(x => String(x.id) === String(id));
                if (!p) return;
                if (typeof window.preparePurchaseForm === 'function') window.preparePurchaseForm(p);
                $('.sidebar .nav-link[data-target="nuovo-acquisto"]').click();
            });
    }

    function showPurchaseDetailModal(p) {
        try {
            ensurePurchaseDetailModal();
            if (!p) return;

            const sup = (getData('suppliers') || []).find(s => String(s.id) === String(p.supplierId)) || { name: 'Sconosciuto' };
            const total = parseFloat(p.totaleDocumento ?? p.total ?? 0) || 0;
            const impon = parseFloat(p.imponibile ?? 0) || 0;
            const iva = parseFloat(p.ivaTotale ?? p.ivaTot ?? 0) || 0;
            const status = p.status || 'Da Pagare';
            const isPaid = (status === 'Pagata' || status === 'Pagato');
            const statusBadge = isPaid
                ? '<span class="badge bg-success">Pagata</span>'
                : '<span class="badge bg-warning text-dark">Da Pagare</span>';

            let rows = '';
            (Array.isArray(p.lines) ? p.lines : []).forEach(l => {
                const qty = parseFloat(l.qty) || 0;
                const price = parseFloat(l.price) || 0;
                const sub = qty * price;
                const ivaPerc = (l.iva != null ? l.iva : '');
                rows += '<tr>'
                    + '<td>' + _esc(l.description || '') + '</td>'
                    + '<td class="text-end">' + qty + '</td>'
                    + '<td class="text-end">€ ' + price.toFixed(2) + '</td>'
                    + '<td class="text-end">' + _esc(ivaPerc) + '</td>'
                    + '<td class="text-end">€ ' + sub.toFixed(2) + '</td>'
                    + '</tr>';
            });

            const html = ''
                + '<div class="row g-2 mb-2">'
                + '  <div class="col-md-6"><div class="small text-muted">Fornitore</div><div class="fw-semibold">' + _esc(sup.name || '') + '</div></div>'
                + '  <div class="col-md-3"><div class="small text-muted">Numero</div><div>' + _esc(p.number || '') + '</div></div>'
                + '  <div class="col-md-3"><div class="small text-muted">Stato</div><div>' + statusBadge + '</div></div>'
                + '</div>'
                + '<div class="row g-2 mb-3">'
                + '  <div class="col-md-3"><div class="small text-muted">Data Doc.</div><div>' + _esc(formatDateForDisplay(p.date)) + '</div></div>'
                + '  <div class="col-md-3"><div class="small text-muted">Data Rif.</div><div>' + _esc(p.dataRiferimento ? formatDateForDisplay(p.dataRiferimento) : '') + '</div></div>'
                + '  <div class="col-md-3"><div class="small text-muted">Scadenza</div><div>' + _esc(p.dataScadenza ? formatDateForDisplay(p.dataScadenza) : '') + '</div></div>'
                + '  <div class="col-md-3"><div class="small text-muted">Totale</div><div class="fw-bold">€ ' + total.toFixed(2) + '</div></div>'
                + '</div>'
                + '<div class="mb-2"><div class="small text-muted">Note</div><div>' + _esc(p.notes || '') + '</div></div>'
                + '<div class="table-responsive mt-3">'
                + '  <table class="table table-sm align-middle">'
                + '    <thead><tr><th>Descrizione</th><th class="text-end">Qtà</th><th class="text-end">Prezzo</th><th class="text-end">IVA</th><th class="text-end">Totale</th></tr></thead>'
                + '    <tbody>' + (rows || '<tr><td colspan="5" class="text-muted">Nessuna riga</td></tr>') + '</tbody>'
                + '  </table>'
                + '</div>'
                + '<div class="text-end bg-light border rounded p-2">'
                + '  <div>Imponibile: <strong>€ ' + impon.toFixed(2) + '</strong></div>'
                + '  <div>IVA: <strong>€ ' + iva.toFixed(2) + '</strong></div>'
                + '  <div class="fs-5 mt-1">Totale Documento: <strong>€ ' + total.toFixed(2) + '</strong></div>'
                + '</div>';

            $('#purchase-detail-content').html(html);
            $('#purchase-detail-edit-btn').attr('data-id', String(p.id));

            if (window.bootstrap && bootstrap.Modal) {
                const el = document.getElementById('purchaseDetailModal');
                const modal = bootstrap.Modal.getOrCreateInstance(el);
                modal.show();
            }
        } catch (e) {
            console.warn('showPurchaseDetailModal:', e);
        }
    }

    // Expose: apri dettaglio acquisto da altri moduli (es. Registri IVA)
    window.showPurchaseDetailModalById = function (id) {
        try {
            const pid = String(id || "");
            if (!pid) return;
            const p = getNormalizedPurchases().find(x => String(x.id) === pid);
            if (!p) {
                alert("Acquisto non trovato: " + pid);
                return;
            }
            showPurchaseDetailModal(p);
        } catch (e) {
            console.warn("showPurchaseDetailModalById error:", e);
        }
    };


    // =========================================================
    // ACQUISTI (Elenco)
    // =========================================================
    window.refreshPurchaseYearFilter = function refreshPurchaseYearFilter() {
        const $select = $('#purchase-year-filter');
        if (!$select.length) return;

        const previous = $select.val();
        const yearsSet = new Set();

        getNormalizedPurchases().forEach(p => {
            if (p.date && typeof p.date === 'string' && p.date.length >= 4) {
                const y = p.date.substring(0, 4);
                if (/^\d{4}$/.test(y)) yearsSet.add(y);
            }
        });

        const years = Array.from(yearsSet).sort().reverse();
        const currentYear = String(new Date().getFullYear());
        if (!years.includes(currentYear)) years.unshift(currentYear);

        $select.empty();
        $select.append(`<option value="all">Tutti</option>`);
        years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));

        if (previous && (previous === 'all' || years.includes(previous))) $select.val(previous);
        else $select.val(currentYear);
    };

    window.refreshPurchaseSupplierFilter = function refreshPurchaseSupplierFilter() {
        const $select = $('#purchase-supplier-filter');
        if (!$select.length) return;

        const prev = $select.val();
        const suppliers = (getData('suppliers') || [])
            .slice()
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

        $select.empty();
        $select.append(`<option value="all">Tutti</option>`);
        suppliers.forEach(s => {
            const label = String(s.name || '').replace(/</g, '&lt;');
            $select.append(`<option value="${s.id}">${label}</option>`);
        });

        if (prev && (prev === 'all' || suppliers.some(s => String(s.id) === String(prev)))) $select.val(prev);
        else $select.val('all');
    };

    window.refreshPurchaseStatusFilter = function refreshPurchaseStatusFilter() {
        const $select = $('#purchase-status-filter');
        if (!$select.length) return;

        const prev = $select.val();
        $select.empty();
        $select.append(`<option value="all">Tutti</option>`);
        $select.append(`<option value="Da Pagare">Da Pagare</option>`);
        $select.append(`<option value="Pagata">Pagata</option>`);

        if (prev && (prev === 'all' || prev === 'Da Pagare' || prev === 'Pagata')) $select.val(prev);
        else $select.val('all');
    };


    window.renderPurchasesTable = function renderPurchasesTable() {
        const table = $('#purchases-table-body');
        if (!table.length) return;
        table.empty();
        // Refresh filters (if present)
        try { if (typeof refreshPurchaseYearFilter === 'function') refreshPurchaseYearFilter(); } catch (e) { }
        try { if (typeof refreshPurchaseSupplierFilter === 'function') refreshPurchaseSupplierFilter(); } catch (e) { }
        try { if (typeof refreshPurchaseStatusFilter === 'function') refreshPurchaseStatusFilter(); } catch (e) { }


        const yearSelect = $('#purchase-year-filter');
        const selectedYear = yearSelect.length ? (yearSelect.val() || 'all') : 'all';

        const supplierSelect = $('#purchase-supplier-filter');
        const selectedSupplier = supplierSelect.length ? (supplierSelect.val() || 'all') : 'all';

        const statusSelect = $('#purchase-status-filter');
        const selectedStatus = statusSelect.length ? (statusSelect.val() || 'all') : 'all';

        const dateFrom = String($('#purchase-date-from-filter').val() || '').trim();
        const dateTo = String($('#purchase-date-to-filter').val() || '').trim();

        const searchVal = String($('#purchase-search-filter').val() || '').trim().toLowerCase();

        const allPurchases = getNormalizedPurchases()
            .slice()
            .sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01'));

        let purchases = selectedYear === 'all'
            ? allPurchases
            : allPurchases.filter(p => p.date && String(p.date).substring(0, 4) === String(selectedYear));

        if (selectedSupplier !== 'all') {
            purchases = purchases.filter(p => String(p.supplierId || '') === String(selectedSupplier));
        }

        if (selectedStatus !== 'all') {
            purchases = purchases.filter(p => String(p.status || 'Da Pagare') === String(selectedStatus));
        }

        if (dateFrom) {
            purchases = purchases.filter(p => p.date && String(p.date) >= dateFrom);
        }
        if (dateTo) {
            purchases = purchases.filter(p => p.date && String(p.date) <= dateTo);
        }

        if (searchVal) {
            purchases = purchases.filter(p => {
                const sup = (getData('suppliers') || []).find(s => String(s.id) === String(p.supplierId)) || { name: '' };
                const hay = `${p.number || ''} ${sup.name || ''} ${p.notes || ''}`.toLowerCase();
                return hay.includes(searchVal);
            });
        }

        purchases.forEach(p => {
            const sup = (getData('suppliers') || []).find(s => String(s.id) === String(p.supplierId)) || { name: 'Sconosciuto' };
            const status = p.status || 'Da Pagare';
            const isPaid = (status === 'Pagata' || status === 'Pagato');
            const total = parseFloat(p.totaleDocumento ?? p.total ?? 0) || 0;

            const docDate = formatDateForDisplay(p.date);
            const refDate = p.dataRiferimento ? formatDateForDisplay(p.dataRiferimento) : '';

            const statusBadge = isPaid
                ? `<span class="badge bg-success">Pagata</span>`
                : `<span class="badge bg-warning text-dark">Da Pagare</span>`;

            const rowClass = '';

            const ttEdit = 'Dettaglio acquisto';
            const ttToggle = isPaid ? 'Segna come Da Pagare' : 'Segna come Pagata';
            const ttDelete = 'Elimina acquisto';

            table.append(`
                <tr class="${rowClass}">
                    <td>${p.number || ''}</td>
                    <td>${docDate}</td>
                    <td>${refDate}</td>
                    <td>${sup.name || ''}</td>
                    <td class="text-end">€ ${total.toFixed(2)}</td>
                    <td>${p.dataScadenza ? formatDateForDisplay(p.dataScadenza) : ''}</td>
                    <td>${statusBadge}</td>
                    <td class="text-end"><button class="btn btn-sm btn-outline-primary btn-edit-purchase" data-id="${p.id}" data-bs-toggle="tooltip" title="${ttEdit}" aria-label="${ttEdit}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success btn-toggle-purchase-status" data-id="${p.id}" data-bs-toggle="tooltip" title="${ttToggle}" aria-label="${ttToggle}">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-purchase" data-id="${p.id}" data-bs-toggle="tooltip" title="${ttDelete}" aria-label="${ttDelete}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });

        // Tooltips for action buttons (after DOM insertion)
        initTooltipsWithin(table[0]);
    };

    // =========================================================
    // ACQUISTI (Form + Righe)
    // =========================================================
    window.initPurchasesModule = function initPurchasesModule() {
        if (window.__purchasesModuleInitialized) return;
        window.__purchasesModuleInitialized = true;

        window.tempPurchaseLines = window.tempPurchaseLines || [];

        // Init tooltips for static buttons inside the purchases form
        const purchaseFormEl = document.getElementById('purchaseForm');
        if (purchaseFormEl) initTooltipsWithin(purchaseFormEl);

        function recalcPurchaseDueDate() {
            const refDateStr = $('#purchase-dataRiferimento').val();
            const giorni = parseInt($('#purchase-giorniTermini').val(), 10);
            if (!refDateStr || isNaN(giorni)) return;

            const ref = new Date(refDateStr);
            if (isNaN(ref.getTime())) return;

            ref.setDate(ref.getDate() + giorni);
            $('#purchase-dataScadenza').val(ref.toISOString().slice(0, 10));
        }

        function computePurchaseTotals() {
            let imponibile = 0;
            let ivaTot = 0;

            (window.tempPurchaseLines || []).forEach(l => {
                const qty = parseFloat(l.qty) || 0;
                const price = parseFloat(l.price) || 0;
                const sub = qty * price;
                const ivaPerc = parseFloat(l.iva) || 0;

                imponibile += sub;
                ivaTot += sub * (ivaPerc / 100);
            });

            const totale = imponibile + ivaTot;
            return { imponibile, ivaTot, totale };
        }

        function updatePurchaseTotalsDisplay() {
            const t = computePurchaseTotals();
            $('#purchase-imponibile').text('€ ' + t.imponibile.toFixed(2));
            $('#purchase-iva').text('€ ' + t.ivaTot.toFixed(2));
            $('#purchase-totale').text('€ ' + t.totale.toFixed(2));
            return t;
        }

        function renderLocalPurchaseLines() {
            const $tbody = $('#purchase-lines-tbody').empty();

            (window.tempPurchaseLines || []).forEach((l, i) => {
                const qty = parseFloat(l.qty) || 0;
                const price = parseFloat(l.price) || 0;
                const sub = qty * price;

                $tbody.append(`
                    <tr>
                        <td>${l.description || ''}</td>
                        <td class="text-end">${qty}</td>
                        <td class="text-end">€ ${price.toFixed(2)}</td>
                        <td class="text-end">${(parseFloat(l.iva) || 0).toFixed(0)}%</td>
                        <td class="text-end">€ ${sub.toFixed(2)}</td>
                        <td class="text-end">
                            <button type="button" class="btn btn-sm btn-danger del-purchase-line" data-i="${i}" data-bs-toggle="tooltip" title="Rimuovi riga" aria-label="Rimuovi riga">x</button>
                        </td>
                    </tr>
                `);
            });

            // Tooltips for dynamically created line buttons
            initTooltipsWithin($tbody[0]);
        }

        function resetPurchaseLineInputs() {
            $('#purchase-line-description').val('');
            $('#purchase-line-qty').val(1);
            $('#purchase-line-price').val('');

            const comp = getData('companyInfo') || {};
            const ivaDef = safeFloat(comp.aliquotaIva || comp.aliquotaIVA || 22) || 22;
            $('#purchase-line-iva').val(String(Math.round(ivaDef)));

            if (typeof window.toggleEsenzioneIvaField === 'function') {
                window.toggleEsenzioneIvaField('purchase', $('#purchase-line-iva').val());
            }
            $('#purchase-line-esenzione-iva').val('N2.2');
        }

        // Esposta globalmente (usata dalla navigazione)
        window.preparePurchaseForm = function preparePurchaseForm(purchaseObj = null) {
            try {
                const $h2 = $('#nuovo-acquisto h2');
                if ($h2.length) $h2.text(purchaseObj ? 'Modifica Acquisto' : 'Nuovo Acquisto');
            } catch (e) { }
            CURRENT_EDITING_PURCHASE_ID = null;
            $('#purchaseForm')[0].reset();
            $('#purchase-id').val('Nuovo');
            window.tempPurchaseLines = [];

            if (typeof populateDropdowns === 'function') populateDropdowns();

            const today = new Date().toISOString().slice(0, 10);
            $('#purchase-date').val(today);
            $('#purchase-dataRiferimento').val(today);
            $('#purchase-giorniTermini').val(30);
            recalcPurchaseDueDate();

            resetPurchaseLineInputs();
            renderLocalPurchaseLines();
            updatePurchaseTotalsDisplay();

            if (purchaseObj) {
                CURRENT_EDITING_PURCHASE_ID = String(purchaseObj.id);
                $('#purchase-id').val(String(purchaseObj.id));
                $('#purchase-supplier-select').val(String(purchaseObj.supplierId || ''));
                $('#purchase-number').val(purchaseObj.number || '');
                $('#purchase-date').val(purchaseObj.date || today);
                $('#purchase-dataRiferimento').val(purchaseObj.dataRiferimento || purchaseObj.date || today);
                $('#purchase-giorniTermini').val(purchaseObj.giorniTermini != null ? purchaseObj.giorniTermini : 30);
                $('#purchase-dataScadenza').val(purchaseObj.dataScadenza || '');
                $('#purchase-status').val(purchaseObj.status || 'Da Pagare');
                $('#purchase-notes').val(purchaseObj.notes || '');

                window.tempPurchaseLines = Array.isArray(purchaseObj.lines) ? purchaseObj.lines.map(function (l) { return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizePurchaseInfo === 'function') ? window.DomainNormalizers.normalizePurchaseInfo({ lines: [l] }).lines[0] : l; }) : [];
                renderLocalPurchaseLines();
                updatePurchaseTotalsDisplay();
            }
        };

        // ======================
        // Eventi (con namespace)
        // ======================
        $('#purchase-date')
            .off('change.purchases')
            .on('change.purchases', function () {
                const d = $(this).val();
                if (!d) return;
                $('#purchase-dataRiferimento').val(d);
                recalcPurchaseDueDate();
            });

        $('#purchase-dataRiferimento, #purchase-giorniTermini')
            .off('change.purchases keyup.purchases')
            .on('change.purchases keyup.purchases', function () {
                recalcPurchaseDueDate();
            });

        $('#purchase-line-iva')
            .off('change.purchases')
            .on('change.purchases', function () {
                if (typeof window.toggleEsenzioneIvaField === 'function') {
                    window.toggleEsenzioneIvaField('purchase', $(this).val());
                }
            });

        $('#add-purchase-line-btn')
            .off('click.purchases')
            .on('click.purchases', function () {
                const d = $('#purchase-line-description').val();
                if (!d) return;

                const qty = parseFloat($('#purchase-line-qty').val()) || 1;
                const price = parseFloat($('#purchase-line-price').val()) || 0;
                const iva = String($('#purchase-line-iva').val() || '');
                const natura = String($('#purchase-line-esenzione-iva').val() || 'N2.2');

                window.tempPurchaseLines.push({
                    description: d,
                    qty: qty,
                    price: price,
                    iva: iva,
                    natura: iva === '0' ? natura : ''
                });

                renderLocalPurchaseLines();
                updatePurchaseTotalsDisplay();
                resetPurchaseLineInputs();
            });

        $('#purchase-lines-tbody')
            .off('click.purchases', '.del-purchase-line')
            .on('click.purchases', '.del-purchase-line', function () {
                window.tempPurchaseLines.splice($(this).data('i'), 1);
                renderLocalPurchaseLines();
                updatePurchaseTotalsDisplay();
            });

        $('#savePurchaseBtn')
            .off('click.purchases')
            .on('click.purchases', async function () {
                if (!currentUser) {
                    alert("Utente non autenticato.");
                    return;
                }

                const supplierId = $('#purchase-supplier-select').val();
                if (!supplierId) {
                    alert("Seleziona un fornitore.");
                    return;
                }

                const totals = updatePurchaseTotalsDisplay();
                const rawData = {
                    supplierId: String(supplierId),
                    number: $('#purchase-number').val(),
                    date: $('#purchase-date').val(),
                    dataRiferimento: $('#purchase-dataRiferimento').val(),
                    giorniTermini: parseInt($('#purchase-giorniTermini').val(), 10) || 0,
                    dataScadenza: $('#purchase-dataScadenza').val(),
                    status: $('#purchase-status').val(),
                    notes: $('#purchase-notes').val() || '',
                    lines: window.tempPurchaseLines || [],
                    imponibile: totals.imponibile,
                    ivaTotale: totals.ivaTot,
                    totaleDocumento: totals.totale
                };
                const data = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizePurchaseInfo === 'function')
                    ? window.DomainNormalizers.normalizePurchaseInfo(rawData)
                    : rawData;

                const id = CURRENT_EDITING_PURCHASE_ID
                    ? String(CURRENT_EDITING_PURCHASE_ID)
                    : String(getNextId(getData('purchases')));


                // Controllo duplicati "soft" (non blocca: chiede conferma prima di salvare)
                try {
                    const num = String(data.number || '').trim();
                    const dateStr = String(data.date || '');
                    const year = (dateStr && dateStr.length >= 4) ? dateStr.substring(0, 4) : '';

                    if (num && year) {
                        const dupes = (getData('purchases') || []).filter(p => {
                            if (!p) return false;
                            if (CURRENT_EDITING_PURCHASE_ID && String(p.id) === String(CURRENT_EDITING_PURCHASE_ID)) return false;

                            const pNum = String(p.number || '').trim();
                            const pYear = p.date ? String(p.date).substring(0, 4) : '';

                            return (
                                String(p.supplierId || '') === String(data.supplierId || '') &&
                                pNum.toLowerCase() === num.toLowerCase() &&
                                pYear === year
                            );
                        });

                        if (dupes.length) {
                            const sup = (getData('suppliers') || []).find(s => String(s.id) === String(data.supplierId)) || {};
                            const label = sup.name || 'Fornitore';
                            const msg = `Possibile duplicato: esiste già un acquisto n. ${num} (${year}) per ${label} (${dupes.length} record).\n\nVuoi salvare comunque?`;
                            if (typeof confirm === 'function' && !confirm(msg)) return;
                        }
                    }
                } catch (e) {
                    console.warn('Duplicate check purchases:', e);
                }


                await saveDataToCloud('purchases', data, id);
                if (window.UiRefresh && typeof window.UiRefresh.refreshPurchasesAndAnalysis === 'function') window.UiRefresh.refreshPurchasesAndAnalysis();

                alert("Acquisto salvato!");
                $('.sidebar .nav-link[data-target="elenco-acquisti"]').click();
            });

        $('#purchase-year-filter')
            .off('change.purchases')
            .on('change.purchases', function () {
                renderPurchasesTable();
            });

        $('#purchase-supplier-filter, #purchase-status-filter')
            .off('change.purchasesList')
            .on('change.purchasesList', function () {
                renderPurchasesTable();
            });

        $('#purchase-date-from-filter, #purchase-date-to-filter')
            .off('change.purchasesList')
            .on('change.purchasesList', function () {
                renderPurchasesTable();
            });

        $('#purchase-search-filter')
            .off('keyup.purchasesList')
            .on('keyup.purchasesList', function () {
                renderPurchasesTable();
            });

        $('#purchase-reset-filters-btn')
            .off('click.purchasesList')
            .on('click.purchasesList', function () {
                try { if (typeof refreshPurchaseYearFilter === 'function') refreshPurchaseYearFilter(); } catch (e) { }
                try { if (typeof refreshPurchaseSupplierFilter === 'function') refreshPurchaseSupplierFilter(); } catch (e) { }
                try { if (typeof refreshPurchaseStatusFilter === 'function') refreshPurchaseStatusFilter(); } catch (e) { }
                $('#purchase-search-filter').val('');

                const currentYear = String(new Date().getFullYear());
                if ($('#purchase-year-filter option[value="' + currentYear + '"]').length) {
                    $('#purchase-year-filter').val(currentYear);
                } else {
                    $('#purchase-year-filter').val('all');
                }
                $('#purchase-supplier-filter').val('all');
                $('#purchase-status-filter').val('all');
                $('#purchase-date-from-filter').val('');
                $('#purchase-date-to-filter').val('');
                renderPurchasesTable();
            });

        $('#purchases-table-body')
            .off('click.purchases', '.btn-edit-purchase')
            .on('click.purchases', '.btn-edit-purchase', function () {
                hideTooltipFor(this);
                const id = $(this).attr('data-id');
                const p = (getData('purchases') || []).find(x => String(x.id) === String(id));
                if (!p) return;
                showPurchaseDetailModal(p);

            });

        $('#purchases-table-body')
            .off('click.purchases', '.btn-delete-purchase')
            .on('click.purchases', '.btn-delete-purchase', function () {
                hideTooltipFor(this);
                const id = $(this).attr('data-id');
                if (window.deleteDataFromCloud) window.deleteDataFromCloud('purchases', id, { skipRender: true }).then(() => {
                    if (window.UiRefresh && typeof window.UiRefresh.refreshPurchasesAnalysisAndScadenziario === 'function') {
                        window.UiRefresh.refreshPurchasesAnalysisAndScadenziario();
                    } else if (window.UiRefresh && typeof window.UiRefresh.refreshPurchasesAndAnalysis === 'function') {
                        window.UiRefresh.refreshPurchasesAndAnalysis();
                    } else if (typeof renderPurchasesTable === 'function') {
                        renderPurchasesTable();
                    } else {
                        if (typeof renderPurchasesTable === 'function') renderPurchasesTable();
                        if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
                        if (typeof renderHomePage === 'function') renderHomePage();
                    }
                });
            });

        $('#purchases-table-body')
            .off('click.purchases', '.btn-toggle-purchase-status')
            .on('click.purchases', '.btn-toggle-purchase-status', async function () {
                hideTooltipFor(this);
                const id = $(this).attr('data-id');
                const p = (getData('purchases') || []).find(x => String(x.id) === String(id));
                if (!p) return;

                const newStatus = (p.status === 'Pagata') ? 'Da Pagare' : 'Pagata';
                const updated = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizePurchaseInfo === 'function') ? window.DomainNormalizers.normalizePurchaseInfo({ ...p, status: newStatus }) : { ...p, status: newStatus };
                await saveDataToCloud('purchases', updated, String(id));
                if (window.UiRefresh && typeof window.UiRefresh.refreshPurchasesAnalysisAndScadenziario === 'function') {
                    window.UiRefresh.refreshPurchasesAnalysisAndScadenziario();
                } else if (window.UiRefresh && typeof window.UiRefresh.refreshPurchasesAndAnalysis === 'function') {
                    window.UiRefresh.refreshPurchasesAndAnalysis();
                } else if (typeof renderPurchasesTable === 'function') {
                    renderPurchasesTable();
                } else {
                    if (typeof renderPurchasesTable === 'function') renderPurchasesTable();
                    if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
                    if (typeof renderHomePage === 'function') renderHomePage();
                }
            });
    };
})();
