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

  }

  window.AppModules.registriIva.bind = bind;
})();
