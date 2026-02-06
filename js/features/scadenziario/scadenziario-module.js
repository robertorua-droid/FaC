// js/features/scadenziario/scadenziario-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.scadenziario = window.AppModules.scadenziario || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    // SCADENZIARIO
    $('#scadenziario').on('change', '#scad-from, #scad-to, #scad-show-incassi, #scad-show-pagamenti, #scad-show-iva, #scad-show-iva-crediti, #scad-show-chiuse', function () {
      try {
        if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
      } catch (e2) {}
    });

    $('#scadenziario-table-body').on('click', '.btn-scad-mark-invoice-paid', async function () {
      const id = $(this).attr('data-id');
      const invObj = getData('invoices').find((i) => String(i.id) === String(id));
      if (!invObj) return;
      if (invObj.type === 'Nota di Credito') return;
      if (invObj.status === 'Pagata') return;

      await saveDataToCloud('invoices', { status: 'Pagata' }, String(id));
      try {
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
      } catch (e2) {}
      try {
        if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
      } catch (e2) {}
    });

    $('#scadenziario-table-body').on('click', '.btn-scad-toggle-purchase-status', async function () {
      const id = $(this).attr('data-id');
      const p = getData('purchases').find((x) => String(x.id) === String(id));
      if (!p) return;
      const newStatus = p.status === 'Pagata' ? 'Da Pagare' : 'Pagata';

      await saveDataToCloud('purchases', { ...p, status: newStatus }, String(id));
      try {
        if (typeof renderAll === 'function') renderAll();
      } catch (e2) {}
      try {
        if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
      } catch (e2) {}
    });
  }



    // Export CSV
    $('#scadenziario').on('click', '#scad-export-csv-btn', function () {
      try {
        const items = (window._lastScadenziarioItems || []).slice();
        if (!items.length) {
          alert('Nessun dato da esportare per il periodo selezionato.');
          return;
        }

        const from = String($('#scad-from').val() || '').trim();
        const to = String($('#scad-to').val() || '').trim();

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

        const header = ['Date', 'Tipo', 'Soggetto', 'Documento', 'Importo', 'Stato'];
        const lines = [header.join(';')];

        items.forEach(it => {
          const amount = (typeof it.amount === 'number')
            ? it.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : cleanText(it.amount);
          const row = [
            formatDateIT(it.date || ''),
            cleanText(it.kind || ''),
            cleanText(it.soggetto || ''),
            cleanText(it.doc || ''),
            amount,
            cleanText(it.status || '')
          ].map(escapeCsvField).join(';');
          lines.push(row);
        });

        const fn = `scadenziario_${from || 'da'}_${to || 'a'}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        downloadCsv(lines.join('\r\n'), fn);
      } catch (e) {
        console.error('Export scadenziario CSV error:', e);
        alert('Errore export CSV.');
      }
    });
  window.AppModules.scadenziario.bind = bind;
})();
