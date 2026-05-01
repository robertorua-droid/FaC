// js/features/registri-iva/registri-iva-module.js
// Modulo: gestisce filtri/eventi per la pagina Registri IVA.

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.registriIva = window.AppModules.registriIva || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    // Filtri pagina
    $('#iva-year-filter, #iva-period-filter')
      .off('change.registriIva')
      .on('change.registriIva', function () {
        if (typeof renderRegistriIVAPage === 'function') renderRegistriIVAPage();
      });

    function cleanText(val) {
      return String(val ?? '').replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function formatDateIT(dateStr) {
      const s = cleanText(dateStr);
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
      return s;
    }
    function escapeCsvField(val) {
      const s = String(val ?? '');
      if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    function downloadCsv(csvText, filename) {
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    }
    function moneyIt(n) {
      return (parseFloat(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Export Totali
    $('#registri-iva').on('click', '#iva-export-totals-csv-btn', function () {
      try {
        if (typeof renderRegistriIVAPage === 'function') renderRegistriIVAPage();
        const cache = window._lastIvaTotals;
        if (!cache || !cache.keys || !cache.keys.length) {
          alert('Nessun dato da esportare con i filtri selezionati.');
          return;
        }
        const header = ['Periodo', 'IVA Vendite', 'IVA Acquisti', 'IVA da versare'];
        const lines = [header.join(';')];

        let totV = 0, totA = 0;
        cache.keys.forEach(k => {
          const row = (cache.buckets && cache.buckets[k]) ? cache.buckets[k] : { ivaVendite: 0, ivaAcquisti: 0 };
          const vend = parseFloat(row.ivaVendite) || 0;
          const acq = parseFloat(row.ivaAcquisti) || 0;
          totV += vend; totA += acq;
          const diff = vend - acq;

          const out = [
            cleanText(k),
            moneyIt(vend),
            moneyIt(acq),
            moneyIt(diff)
          ].map(escapeCsvField).join(';');
          lines.push(out);
        });

        lines.push(['TOTALE', moneyIt(totV), moneyIt(totA), moneyIt(totV - totA)].map(escapeCsvField).join(';'));

        const y = String(cache.selectedYear || 'all');
        const mode = String(cache.periodMode || 'mensile');
        const fn = `iva_totali_${y}_${mode}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        downloadCsv(lines.join('\r\n'), fn);
      } catch (e) {
        console.error('IVA export totali error:', e);
        alert('Errore export totali IVA.');
      }
    });

    // Registro Vendite
    $('#registri-iva').on('click', '#iva-export-registro-vendite-btn', function () {
      try {
        const selectedYear = ($('#iva-year-filter').length ? ($('#iva-year-filter').val() || 'all') : 'all');
        const invoices = getData('invoices') || [];
        const customers = getData('customers') || [];

        const rows = invoices
          .filter(inv => inv && inv.date && (selectedYear === 'all' || String(inv.date).substring(0,4) === String(selectedYear)))
          .slice()
          .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));

        if (!rows.length) {
          alert('Nessuna fattura/nota di credito da esportare per i filtri selezionati.');
          return;
        }

        const header = ['Date', 'Numero', 'Cliente', 'Tipo', 'Imponibile', 'IVA', 'Totale', 'Stato'];
        const lines = [header.join(';')];

        rows.forEach(inv => {
          const cust = customers.find(c => String(c.id) === String(inv.customerId)) || { name: '' };
          const isNota = String(inv.type || '').toLowerCase().includes('nota');
          const sign = isNota ? -1 : 1;

          const impon = sign * (parseFloat(inv.totaleImponibile ?? inv.totImp ?? 0) || 0);
          const iva = sign * (parseFloat(inv.ivaTotale ?? 0) || 0);
          const tot = sign * (parseFloat(inv.total ?? inv.totDoc ?? 0) || 0);

          const out = [
            formatDateIT(inv.date || ''),
            cleanText(inv.number || inv.id || ''),
            cleanText(cust.name || ''),
            cleanText(inv.type || ''),
            moneyIt(impon),
            moneyIt(iva),
            moneyIt(tot),
            cleanText(inv.status || '')
          ].map(escapeCsvField).join(';');

          lines.push(out);
        });

        const y = String(selectedYear || 'all');
        const fn = `registro_vendite_${y}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        downloadCsv(lines.join('\r\n'), fn);
      } catch (e) {
        console.error('Registro vendite export error:', e);
        alert('Errore export Registro Vendite.');
      }
    });

    // Registro Acquisti
    $('#registri-iva').on('click', '#iva-export-registro-acquisti-btn', function () {
      try {
        const selectedYear = ($('#iva-year-filter').length ? ($('#iva-year-filter').val() || 'all') : 'all');
        const purchases = getData('purchases') || [];
        const suppliers = getData('suppliers') || [];

        const rows = purchases
          .filter(p => p && p.date && (selectedYear === 'all' || String(p.date).substring(0,4) === String(selectedYear)))
          .slice()
          .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));

        if (!rows.length) {
          alert('Nessun acquisto da esportare per i filtri selezionati.');
          return;
        }

        const header = ['Date', 'Numero', 'Fornitore', 'Imponibile', 'IVA', 'Totale', 'Stato', 'Scadenza'];
        const lines = [header.join(';')];

        rows.forEach(p => {
          const sup = suppliers.find(s => String(s.id) === String(p.supplierId)) || { name: '' };
          const impon = parseFloat(p.imponibile ?? 0) || 0;
          const iva = parseFloat(p.ivaTotale ?? 0) || 0;
          const tot = parseFloat(p.totaleDocumento ?? 0) || 0;

          const out = [
            formatDateIT(p.date || ''),
            cleanText(p.number || p.id || ''),
            cleanText(sup.name || ''),
            moneyIt(impon),
            moneyIt(iva),
            moneyIt(tot),
            cleanText(p.status || ''),
            formatDateIT(p.dataScadenza || '')
          ].map(escapeCsvField).join(';');

          lines.push(out);
        });

        const y = String(selectedYear || 'all');
        const fn = `registro_acquisti_${y}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        downloadCsv(lines.join('\r\n'), fn);
      } catch (e) {
        console.error('Registro acquisti export error:', e);
        alert('Errore export Registro Acquisti.');
      }
    });

    // =============================
    // Dettaglio movimenti (drilldown totali)
    // =============================

    function escapeHtml(val) {
      return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function showIvaMovementsModal(periodKey) {
      try {
        if (typeof renderRegistriIVAPage === 'function') renderRegistriIVAPage();
        const cache = window._lastIvaTotals || {};
        const movementsByPeriod = cache.movementsByPeriod || {};
        const periodLabelsMap = cache.periodLabelsMap || {};
        const keys = Array.isArray(cache.keys) ? cache.keys : [];

        let vendite = [];
        let acquisti = [];
        let titleLabel = '';

        if (periodKey === '__ALL__') {
          titleLabel = 'Tutti i periodi';
          keys.forEach(k => {
            const b = movementsByPeriod[k] || {};
            vendite = vendite.concat(Array.isArray(b.vendite) ? b.vendite : []);
            acquisti = acquisti.concat(Array.isArray(b.acquisti) ? b.acquisti : []);
          });
        } else {
          titleLabel = periodLabelsMap[periodKey] || periodKey;
          const b = movementsByPeriod[periodKey] || {};
          vendite = Array.isArray(b.vendite) ? b.vendite : [];
          acquisti = Array.isArray(b.acquisti) ? b.acquisti : [];
        }

        const sumVendIva = vendite.reduce((acc, m) => acc + (parseFloat(m.iva) || 0), 0);
        const sumAcqIva = acquisti.reduce((acc, m) => acc + (parseFloat(m.iva) || 0), 0);
        const diff = sumVendIva - sumAcqIva;

        // Summary
        $('#ivaMovementsModalLabel').text(`Movimenti Registri IVA - ${titleLabel}`);
        $('#iva-movements-summary').html(
          `<div class="row g-2">
             <div class="col-md-4"><div class="small text-muted">IVA Vendite (movimenti)</div><div class="fw-bold">€ ${moneyIt(sumVendIva)}</div></div>
             <div class="col-md-4"><div class="small text-muted">IVA Acquisti (movimenti)</div><div class="fw-bold">€ ${moneyIt(sumAcqIva)}</div></div>
             <div class="col-md-4"><div class="small text-muted">IVA da versare (movimenti)</div><div class="fw-bold">€ ${moneyIt(diff)}</div></div>
           </div>
           <div class="small text-muted mt-2">Qui vedi i documenti che compongono i totali del periodo selezionato. Nota: le Note di Credito hanno importi negativi.</div>`
        );

        function sortMov(a, b) {
          const da = String(a.date || '');
          const db = String(b.date || '');
          if (da !== db) return da.localeCompare(db);
          return String(a.number || '').localeCompare(String(b.number || ''));
        }
        vendite = vendite.slice().sort(sortMov);
        acquisti = acquisti.slice().sort(sortMov);

        function renderMovTable(rows, kind) {
          if (!rows.length) {
            return '<div class="alert alert-info">Nessun movimento per i filtri selezionati.</div>';
          }

          const hasScad = (kind === 'acquisti');
          const head = hasScad
            ? `<tr><th>Data</th><th>Numero</th><th>Fornitore</th><th>Tipo</th><th class="text-end">Imponibile</th><th class="text-end">IVA</th><th class="text-end">Totale</th><th>Stato</th><th>Scadenza</th></tr>`
            : `<tr><th>Data</th><th>Numero</th><th>Cliente</th><th>Tipo</th><th class="text-end">Imponibile</th><th class="text-end">IVA</th><th class="text-end">Totale</th><th>Stato</th></tr>`;

          const body = rows
            .map(m => {
              const impon = parseFloat(m.imponibile) || 0;
              const iva = parseFloat(m.iva) || 0;
              const tot = parseFloat(m.totale) || 0;
              const isNeg = (tot < 0 || iva < 0 || impon < 0);
              const trClass = isNeg ? 'table-warning' : '';
              const base = `
                <td>${escapeHtml(formatDateIT(m.date || ''))}</td>
                <td><a href="#" class="iva-open-doc" data-kind="${kind}" data-id="${escapeHtml(m.id || '')}" title="Apri dettaglio">${escapeHtml(m.number || m.id || '')} <i class="fas fa-external-link-alt ms-1"></i></a></td>
                <td>${escapeHtml(m.counterparty || '')}</td>
                <td>${escapeHtml(m.docType || '')}</td>
                <td class="text-end">€ ${moneyIt(impon)}</td>
                <td class="text-end">€ ${moneyIt(iva)}</td>
                <td class="text-end">€ ${moneyIt(tot)}</td>
                <td>${escapeHtml(m.status || '')}</td>
              `;
              if (hasScad) {
                return `<tr class="${trClass}">${base}<td>${escapeHtml(formatDateIT(m.dataScadenza || ''))}</td></tr>`;
              }
              return `<tr class="${trClass}">${base}</tr>`;
            })
            .join('');

          return `<div class="table-responsive">
            <table class="table table-sm table-hover align-middle">
              <thead>${head}</thead>
              <tbody>${body}</tbody>
            </table>
          </div>`;
        }

        $('#iva-movements-vendite').html(renderMovTable(vendite, 'vendite'));
        $('#iva-movements-acquisti').html(renderMovTable(acquisti, 'acquisti'));

        // show modal
        const el = document.getElementById('ivaMovementsModal');
        if (el && window.bootstrap && bootstrap.Modal) {
          const m = bootstrap.Modal.getOrCreateInstance(el);
          m.show();
        }
      } catch (e) {
        console.error('showIvaMovementsModal error:', e);
        alert('Errore apertura dettaglio movimenti.');
      }
    }

    $('#registri-iva')
      .off('click.registriIvaMov', '.iva-show-movements')
      .on('click.registriIvaMov', '.iva-show-movements', function () {
        const k = String($(this).attr('data-period') || '').trim();
        if (!k) return;
        showIvaMovementsModal(k);
      });

    // Shortcut: vai agli elenchi
    $(document)
      .off('click.registriIvaNav', '#iva-go-elenco-fatture-btn')
      .on('click.registriIvaNav', '#iva-go-elenco-fatture-btn', function () {
        try {
          const el = document.getElementById('ivaMovementsModal');
          if (el && window.bootstrap && bootstrap.Modal) {
            const m = bootstrap.Modal.getInstance(el);
            if (m) m.hide();
          }
        } catch (e) {}
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
      });

    
    // Click su numero documento: apri dettaglio (fattura/acquisto)
    function openInvoiceDetailById(id) {
      const iid = String(id || '').trim();
      if (!iid) return;

      const tryOpen = () => {
        const $body = $('#invoices-table-body');
        if (!$body.length) return false;
        const $tmp = $('<button type="button" class="btn-view-invoice d-none"></button>').attr('data-id', iid);
        $body.append($tmp);
        $tmp.trigger('click');
        $tmp.remove();
        return true;
      };

      if (tryOpen()) return;

      // Fallback: vai all'elenco fatture e riprova dopo un attimo
      $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
      setTimeout(function(){ tryOpen(); }, 250);
    }

    $(document)
      .off('click.registriIvaOpenDoc', '#ivaMovementsModal .iva-open-doc')
      .on('click.registriIvaOpenDoc', '#ivaMovementsModal .iva-open-doc', function (e) {
        e.preventDefault();
        const kind = String($(this).attr('data-kind') || '').toLowerCase();
        const id = String($(this).attr('data-id') || '').trim();
        if (!id) return;

        // Chiudi la modale movimenti (per evitare sovrapposizioni)
        try {
          const el = document.getElementById('ivaMovementsModal');
          if (el && window.bootstrap && bootstrap.Modal) {
            const m = bootstrap.Modal.getInstance(el);
            if (m) m.hide();
          }
        } catch (err) {}

        if (kind === 'acquisti') {
          if (typeof window.showPurchaseDetailModalById === 'function') {
            window.showPurchaseDetailModalById(id);
          } else {
            // Fallback: vai a elenco acquisti
            $('.sidebar .nav-link[data-target="elenco-acquisti"]').click();
          }
          return;
        }

        // Vendite
        openInvoiceDetailById(id);
      });
$(document)
      .off('click.registriIvaNav2', '#iva-go-elenco-acquisti-btn')
      .on('click.registriIvaNav2', '#iva-go-elenco-acquisti-btn', function () {
        try {
          const el = document.getElementById('ivaMovementsModal');
          if (el && window.bootstrap && bootstrap.Modal) {
            const m = bootstrap.Modal.getInstance(el);
            if (m) m.hide();
          }
        } catch (e) {}
        $('.sidebar .nav-link[data-target="elenco-acquisti"]').click();
      });

  }

  window.AppModules.registriIva.bind = bind;
})();
