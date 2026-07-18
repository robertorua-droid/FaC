// js/features/invoices/invoices-pdf-module.js
// Stampa massiva PDF come fascicolo unico browser-based, senza librerie PDF esterne.

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.invoicesPDF = window.AppModules.invoicesPDF || {};

  let _bound = false;
  const BULK_PDF_WARN_THRESHOLD = 40;

  function getCurrentCompanyInfo() {
    const rawCompany = (typeof window.getData === 'function') ? (window.getData('companyInfo') || {}) : {};
    return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function')
      ? window.DomainNormalizers.normalizeCompanyInfo(rawCompany)
      : rawCompany;
  }

  function isCurrentRegimeForfettario() {
    const company = getCurrentCompanyInfo();
    return !!(window.TaxRegimePolicy && typeof window.TaxRegimePolicy.isForfettario === 'function' && window.TaxRegimePolicy.isForfettario(company));
  }

  function escapeHtmlLocal(value) {
    const raw = String(value == null ? '' : value);
    return raw.replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function formatDateLocal(value) {
    if (typeof window.formatDateForDisplay === 'function') return window.formatDateForDisplay(value);
    return String(value || '');
  }

  function getInvoiceList() {
    return (typeof window.getData === 'function') ? (window.getData('invoices') || []) : [];
  }

  function getSelectedInvoiceYearRange() {
    const selectedYear = String($('#invoice-year-filter').val() || '').trim();
    if (/^\d{4}$/.test(selectedYear)) {
      return { start: selectedYear + '-01-01', end: selectedYear + '-12-31' };
    }

    const dates = getInvoiceList()
      .map(function (inv) { return String(inv.date || '').slice(0, 10); })
      .filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); })
      .sort();

    if (dates.length) return { start: dates[0], end: dates[dates.length - 1] };

    const currentYear = String(new Date().getFullYear());
    return { start: currentYear + '-01-01', end: currentYear + '-12-31' };
  }

  function setBulkPdfStatus(message, tone) {
    const $status = $('#bulk-pdf-export-status');
    if (!$status.length) return;
    const alertClass = tone === 'danger'
      ? 'alert-danger'
      : (tone === 'warning' ? 'alert-warning' : (tone === 'success' ? 'alert-success' : 'alert-info'));
    if (!message) {
      $status.empty().removeClass('alert alert-info alert-success alert-warning alert-danger py-2 mb-0');
      return;
    }
    $status
      .removeClass('alert-info alert-success alert-warning alert-danger')
      .addClass('alert ' + alertClass + ' py-2 mb-0')
      .html(message);
  }

  function setBulkPdfDefaultPeriod(force) {
    const $start = $('#bulk-pdf-start-date');
    const $end = $('#bulk-pdf-end-date');
    if (!$start.length || !$end.length) return;
    if (!force && $start.val() && $end.val()) return;
    const range = getSelectedInvoiceYearRange();
    $start.val(range.start);
    $end.val(range.end);
  }

  function updateBulkPdfExportPanel() {
    const $panel = $('#bulk-pdf-export-panel');
    if (!$panel.length) return;

    const enabled = isCurrentRegimeForfettario();
    $panel.toggleClass('d-none', !enabled);
    if (!enabled) {
      setBulkPdfStatus('', 'info');
      return;
    }
    setBulkPdfDefaultPeriod(false);
  }

  function getBulkPdfOptions() {
    return {
      startDate: String($('#bulk-pdf-start-date').val() || '').trim(),
      endDate: String($('#bulk-pdf-end-date').val() || '').trim(),
      includeInvoices: $('#bulk-pdf-include-invoices').prop('checked') !== false,
      includeCreditNotes: $('#bulk-pdf-include-credit-notes').prop('checked') !== false
    };
  }

  function validateBulkPdfOptions(options) {
    if (!isCurrentRegimeForfettario()) {
      return { ok: false, message: 'Stampa massiva PDF disponibile solo in regime Forfettario in questo step.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(options.endDate)) {
      return { ok: false, message: 'Seleziona una data iniziale e una data finale valide.' };
    }
    if (options.startDate > options.endDate) {
      return { ok: false, message: 'La data iniziale non può essere successiva alla data finale.' };
    }
    if (!options.includeInvoices && !options.includeCreditNotes) {
      return { ok: false, message: 'Seleziona almeno un tipo documento da includere.' };
    }
    if (!window.InvoicePrintService || typeof window.InvoicePrintService.buildBulkPrintHtml !== 'function') {
      return { ok: false, message: 'Modulo InvoicePrintService non disponibile. Impossibile preparare il fascicolo PDF.' };
    }
    return { ok: true };
  }

  function isBulkPdfInvoiceEligibleByType(invoice, options) {
    const type = String(invoice.type || 'Fattura');
    const isCredit = type === 'Nota di Credito';
    if (isCredit) return !!options.includeCreditNotes;
    return !!options.includeInvoices;
  }

  function getBulkPdfCandidates(options) {
    return getInvoiceList()
      .filter(function (invoice) {
        const date = String(invoice.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
        if (date < options.startDate || date > options.endDate) return false;
        return isBulkPdfInvoiceEligibleByType(invoice, options);
      })
      .slice()
      .sort(function (a, b) {
        const da = String(a.date || '');
        const db = String(b.date || '');
        if (da !== db) return da.localeCompare(db);
        return String(a.number || '').localeCompare(String(b.number || ''));
      });
  }

  function splitPrintableAndSkipped(candidates) {
    const printable = [];
    const skipped = [];

    candidates.forEach(function (invoice) {
      const label = [invoice.type || 'Documento', invoice.number || invoice.id || 'senza numero', invoice.date || ''].join(' ').trim();
      if (!invoice.id) {
        skipped.push({ invoice: invoice, reason: 'Documento senza ID interno: ' + label });
        return;
      }
      if (window.InvoicePrintService && typeof window.InvoicePrintService.isDraft === 'function' && window.InvoicePrintService.isDraft(invoice)) {
        skipped.push({ invoice: invoice, reason: 'Documento in bozza non incluso nel fascicolo documenti emessi.' });
        return;
      }
      printable.push(invoice);
    });

    return { printable: printable, skipped: skipped };
  }

  function renderSkippedSummary(skipped) {
    const skippedRows = (skipped || []).map(function (item) {
      const invoice = item.invoice || {};
      const label = [invoice.type || 'Documento', invoice.number || invoice.id || 'senza numero', invoice.date || ''].join(' ').trim();
      return '<li><strong>' + escapeHtmlLocal(label) + '</strong>: ' + escapeHtmlLocal(item.reason || 'scartato') + '</li>';
    }).join('');

    if (!skippedRows) return '';
    return '<details class="mt-1"><summary>Documenti esclusi (' + skipped.length + ')</summary><ul class="mb-0 mt-1">' + skippedRows + '</ul></details>';
  }

  function cleanupBulkPdfPrintArea() {
    $('body').removeClass('bulk-pdf-print-mode');
    $('#bulkPdfPrintArea').empty().addClass('d-none');
    window.removeEventListener('afterprint', cleanupBulkPdfPrintArea);
  }

  function printBulkPdf(printable, options, skipped) {
    const $area = $('#bulkPdfPrintArea');
    if (!$area.length) {
      setBulkPdfStatus('Area di stampa massiva non trovata nel DOM.', 'danger');
      return;
    }

    const periodLabel = formatDateLocal(options.startDate) + ' - ' + formatDateLocal(options.endDate);
    const html = window.InvoicePrintService.buildBulkPrintHtml(printable, {
      title: 'Fascicolo documenti emessi',
      periodLabel: periodLabel
    });

    $area.html(html).removeClass('d-none');
    $('body').addClass('bulk-pdf-print-mode');
    window.addEventListener('afterprint', cleanupBulkPdfPrintArea);

    setTimeout(function () {
      try {
        window.print();
        setBulkPdfStatus(
          '<strong>Fascicolo pronto.</strong> Nella finestra di stampa scegli “Salva come PDF”. Documenti inclusi: ' + printable.length + '.' + renderSkippedSummary(skipped),
          skipped && skipped.length ? 'warning' : 'success'
        );
      } catch (err) {
        console.error(err);
        cleanupBulkPdfPrintArea();
        setBulkPdfStatus('Errore durante l’apertura della stampa browser.', 'danger');
      }
    }, 100);
  }

  function bulkPrintPDF() {
    const options = getBulkPdfOptions();
    const validation = validateBulkPdfOptions(options);
    if (!validation.ok) {
      setBulkPdfStatus(escapeHtmlLocal(validation.message), 'warning');
      return;
    }

    const candidates = getBulkPdfCandidates(options);
    if (!candidates.length) {
      setBulkPdfStatus('Nessun documento trovato nel periodo selezionato.', 'warning');
      return;
    }

    const split = splitPrintableAndSkipped(candidates);
    if (!split.printable.length) {
      setBulkPdfStatus('<strong>Nessun documento stampabile.</strong>' + renderSkippedSummary(split.skipped), 'warning');
      return;
    }

    if (split.printable.length > BULK_PDF_WARN_THRESHOLD) {
      const ok = confirm('Stai per preparare un fascicolo unico con ' + split.printable.length + ' documenti. La generazione della stampa potrebbe richiedere qualche secondo. Vuoi continuare?');
      if (!ok) return;
    }

    if (split.skipped.length) {
      const okPartial = confirm('Saranno inclusi ' + split.printable.length + ' documenti. ' + split.skipped.length + ' documenti verranno esclusi perché in bozza o non stampabili. Continuare?');
      if (!okPartial) {
        setBulkPdfStatus('<strong>Stampa massiva annullata.</strong>' + renderSkippedSummary(split.skipped), 'warning');
        return;
      }
    }

    printBulkPdf(split.printable, options, split.skipped);
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    $('#bulk-pdf-print-btn').on('click', function () {
      bulkPrintPDF();
    });

    $('#bulk-pdf-start-date, #bulk-pdf-end-date, #bulk-pdf-include-invoices, #bulk-pdf-include-credit-notes').on('change input', function () {
      setBulkPdfStatus('', 'info');
    });

    updateBulkPdfExportPanel();

    window.bulkPrintInvoicePDF = bulkPrintPDF;
    window.updateBulkPdfExportPanel = updateBulkPdfExportPanel;
  }

  window.AppModules.invoicesPDF.bind = bind;
})();
