// scadenziario-render.js

function renderScadenziarioPage() {
    const sec = $('#scadenziario');
    if (sec.length === 0) return;

    const company = getCurrentCompanyInfo();
    const periodicita = (company.ivaPeriodicita || 'mensile');

    // Defaults range: oggi -> +60 gg
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);
    const plus60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const fromEl = $('#scad-from');
    const toEl = $('#scad-to');
    if (fromEl.val() === '') fromEl.val(isoToday);
    if (toEl.val() === '') toEl.val(plus60);

    const from = new Date(fromEl.val());
    const to = new Date(toEl.val());
    to.setHours(23, 59, 59, 999);
    const showIncassi = $('#scad-show-incassi').is(':checked');
    let showPagamenti = $('#scad-show-pagamenti').is(':checked');
    let showIVA = $('#scad-show-iva').is(':checked');
    let showIvaCrediti = $('#scad-show-iva-crediti').is(':checked');
    const showChiuse = $('#scad-show-chiuse').is(':checked');

    const scadenziarioVisibility = getTaxRegimeUiVisibility(company).scadenziario || { showPurchasePayments: false, showVatDeadlines: false };
    if (!scadenziarioVisibility.showPurchasePayments) showPagamenti = false;
    if (!scadenziarioVisibility.showVatDeadlines) {
        showIVA = false;
        showIvaCrediti = false;
    }

    const customers = getData('customers');
    const invoices = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceStatusInfo === 'function') ? (getData('invoices') || []).map(function (inv) { return window.DomainNormalizers.normalizeInvoiceStatusInfo(inv); }) : getData('invoices');
    const suppliers = scadenziarioVisibility.showPurchasePayments ? getData('suppliers') : [];
    const purchases = scadenziarioVisibility.showPurchasePayments ? ((window.DomainNormalizers && typeof window.DomainNormalizers.normalizePurchaseInfo === 'function') ? (getData('purchases') || []).map(function (p) { return window.DomainNormalizers.normalizePurchaseInfo(p); }) : getData('purchases')) : [];

    const items = [];

    function inRange(dateStr) {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d >= from && d <= to;
    }

    function fmtMoney(n) {
        return (safeFloat(n)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // 1) Incassi fatture
    if (showIncassi) {
        invoices.forEach(inv => {
            if (!inv || inv.isCreditNote === true || inv.type === 'Nota di Credito') return;
            const isPaid = inv.isPaid === true || inv.status === 'Pagata';
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
                overdue: (!isPaid) && (new Date(due) < new Date(new Date().toISOString().slice(0, 10)))
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
            const amount = (p.totaleDocumento != null) ? p.totaleDocumento : (p.total != null ? p.total : 0);

            items.push({
                date: due,
                kind: 'Pagamento',
                soggetto,
                doc: `Acq. #${p.number || p.id}`,
                amount: safeFloat(amount),
                status: isPaid ? 'Pagata' : (p.status || 'Da Pagare'),
                entity: 'purchase',
                id: p.id,
                overdue: (!isPaid) && (new Date(due) < new Date(new Date().toISOString().slice(0, 10)))
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


    items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Cache per export CSV
    try { window._lastScadenziarioItems = (items || []).slice(); } catch (e) { }

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
                : '<span class="badge bg-warning text-dark">' + escapeHtml(it.status) + '</span>');

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

window.renderScadenziarioPage = renderScadenziarioPage;
