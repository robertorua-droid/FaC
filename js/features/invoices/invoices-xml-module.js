// js/features/invoices/invoices-xml-module.js
// Export XML Fattura/Nota di Credito (FPR12)

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.invoicesXML = window.AppModules.invoicesXML || {};

  let _bound = false;
  const C = window.DomainConstants || {};
  const INVOICE_NATURE_FORFETTARIO = (C.INVOICE_NATURES && C.INVOICE_NATURES.FORFETTARIO) || 'N2.2';
  const DEFAULT_IVA_ORDINARIO = (C.COMPANY_DEFAULTS && C.COMPANY_DEFAULTS.IVA_ORDINARIO) || 22;

  function openExternalXmlValidator(url) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      alert('Impossibile aprire il validatore esterno.');
    }
  }

  function copyInvoiceXML(invoiceId) {
    if (!window.InvoiceExportService || typeof window.InvoiceExportService.buildXmlPayload !== 'function') {
      alert('Modulo InvoiceExportService non disponibile. Impossibile copiare XML.');
      return;
    }

    let result;
    try {
      result = window.InvoiceExportService.buildXmlPayload(invoiceId);
    } catch (err) {
      console.error(err);
      alert(err && err.message ? err.message : 'Errore nella generazione dell\'XML.');
      return;
    }

    if (!result || !result.ok || !result.payload || !result.payload.xml) {
      alert((result && result.message) || 'Dati insufficienti per copiare il file XML.');
      return;
    }

    const xml = result.payload.xml;
    const fallbackCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = xml;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        alert('XML copiato negli appunti.');
      } catch (copyErr) {
        console.error(copyErr);
        alert('Impossibile copiare l\'XML negli appunti.');
      } finally {
        document.body.removeChild(ta);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(xml)
        .then(() => alert('XML copiato negli appunti.'))
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  }


  function generateInvoiceXML(invoiceId) {
    if (!window.InvoiceExportService || typeof window.InvoiceExportService.buildXmlPayload !== 'function') {
      alert('Modulo InvoiceExportService non disponibile. Impossibile generare XML.');
      return;
    }

    let result;
    try {
      result = window.InvoiceExportService.buildXmlPayload(invoiceId);
    } catch (err) {
      console.error(err);
      alert(err && err.message ? err.message : 'Errore nella generazione del file XML.');
      return;
    }

    if (!result || !result.ok) {
      alert((result && result.message) || 'Dati insufficienti per generare il file XML.');
      return;
    }

    try {
      window.InvoiceExportService.triggerDownload(result.payload);
    } catch (err) {
      console.error(err);
      alert('Errore nel download del file XML.');
    }
  }


  const BULK_XML_WARN_THRESHOLD = 25;
  const BULK_XML_DOWNLOAD_DELAY_MS = 350;

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

  function setBulkXmlStatus(message, tone) {
    const $status = $('#bulk-xml-export-status');
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

  function setBulkXmlDefaultPeriod(force) {
    const $start = $('#bulk-xml-start-date');
    const $end = $('#bulk-xml-end-date');
    if (!$start.length || !$end.length) return;
    if (!force && $start.val() && $end.val()) return;
    const range = getSelectedInvoiceYearRange();
    $start.val(range.start);
    $end.val(range.end);
  }

  function updateBulkXmlExportPanel() {
    const $panel = $('#bulk-xml-export-panel');
    if (!$panel.length) return;

    const enabled = isCurrentRegimeForfettario();
    $panel.toggleClass('d-none', !enabled);
    if (!enabled) {
      setBulkXmlStatus('', 'info');
      return;
    }
    setBulkXmlDefaultPeriod(false);
  }

  function getBulkXmlOptions() {
    return {
      startDate: String($('#bulk-xml-start-date').val() || '').trim(),
      endDate: String($('#bulk-xml-end-date').val() || '').trim(),
      includeInvoices: $('#bulk-xml-include-invoices').prop('checked') !== false,
      includeCreditNotes: $('#bulk-xml-include-credit-notes').prop('checked') !== false
    };
  }

  function validateBulkXmlOptions(options) {
    if (!isCurrentRegimeForfettario()) {
      return { ok: false, message: 'Export massivo XML disponibile solo in regime Forfettario in questo step.' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(options.endDate)) {
      return { ok: false, message: 'Seleziona una data iniziale e una data finale valide.' };
    }
    if (options.startDate > options.endDate) {
      return { ok: false, message: 'La data iniziale non può essere successiva alla data finale.' };
    }
    if (!options.includeInvoices && !options.includeCreditNotes) {
      return { ok: false, message: 'Seleziona almeno un tipo documento da esportare.' };
    }
    if (!window.InvoiceExportService || typeof window.InvoiceExportService.buildXmlPayload !== 'function' || typeof window.InvoiceExportService.triggerDownload !== 'function') {
      return { ok: false, message: 'Modulo InvoiceExportService non disponibile. Impossibile eseguire l\'export massivo.' };
    }
    return { ok: true };
  }

  function isBulkXmlInvoiceEligibleByType(invoice, options) {
    const type = String(invoice.type || 'Fattura');
    const isCredit = type === 'Nota di Credito';
    if (isCredit) return !!options.includeCreditNotes;
    return !!options.includeInvoices;
  }

  function getBulkXmlCandidates(options) {
    return getInvoiceList()
      .filter(function (invoice) {
        const date = String(invoice.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
        if (date < options.startDate || date > options.endDate) return false;
        return isBulkXmlInvoiceEligibleByType(invoice, options);
      })
      .slice()
      .sort(function (a, b) {
        const da = String(a.date || '');
        const db = String(b.date || '');
        if (da !== db) return da.localeCompare(db);
        return String(a.number || '').localeCompare(String(b.number || ''));
      });
  }

  function buildBulkXmlPayloads(candidates) {
    const payloads = [];
    const skipped = [];

    candidates.forEach(function (invoice) {
      const number = String(invoice.number || invoice.id || 'senza numero');
      if (!invoice.id) {
        skipped.push({ invoice: invoice, reason: 'Documento senza ID interno: ' + number });
        return;
      }
      try {
        const result = window.InvoiceExportService.buildXmlPayload(invoice.id);
        if (result && result.ok && result.payload && result.payload.xml) {
          payloads.push({ invoice: invoice, payload: result.payload });
        } else {
          skipped.push({ invoice: invoice, reason: (result && result.message) || 'Dati insufficienti per generare XML.' });
        }
      } catch (err) {
        skipped.push({ invoice: invoice, reason: (err && err.message) || 'Errore nella generazione XML.' });
      }
    });

    return { payloads: payloads, skipped: skipped };
  }

  function renderBulkXmlSummary(totalCandidates, downloadedCount, skipped) {
    const skippedRows = (skipped || []).map(function (item) {
      const invoice = item.invoice || {};
      const label = [invoice.type || 'Documento', invoice.number || invoice.id || 'senza numero', invoice.date || ''].join(' ').trim();
      return '<li><strong>' + escapeHtmlLocal(label) + '</strong>: ' + escapeHtmlLocal(item.reason || 'scartato') + '</li>';
    }).join('');

    let html = '<div><strong>Export XML completato.</strong> File scaricati: ' + downloadedCount + ' su ' + totalCandidates + ' documenti trovati.</div>';
    if (skippedRows) {
      html += '<details class="mt-1"><summary>Documenti saltati (' + skipped.length + ')</summary><ul class="mb-0 mt-1">' + skippedRows + '</ul></details>';
    }
    return html;
  }

  function downloadBulkXmlPayloads(payloads, skipped, totalCandidates, index) {
    const currentIndex = index || 0;
    if (currentIndex >= payloads.length) {
      const tone = skipped && skipped.length ? 'warning' : 'success';
      setBulkXmlStatus(renderBulkXmlSummary(totalCandidates, payloads.length, skipped), tone);
      return;
    }

    const current = payloads[currentIndex];
    try {
      window.InvoiceExportService.triggerDownload(current.payload);
    } catch (err) {
      const invoice = current.invoice || {};
      skipped.push({ invoice: invoice, reason: 'Errore nel download del file XML.' });
    }

    setBulkXmlStatus(
      'Download XML in corso: ' + (currentIndex + 1) + ' / ' + payloads.length + '. Non chiudere questa scheda finché il riepilogo non risulta completato.',
      'info'
    );

    setTimeout(function () {
      downloadBulkXmlPayloads(payloads, skipped, totalCandidates, currentIndex + 1);
    }, BULK_XML_DOWNLOAD_DELAY_MS);
  }

  function bulkExportXML() {
    const options = getBulkXmlOptions();
    const validation = validateBulkXmlOptions(options);
    if (!validation.ok) {
      setBulkXmlStatus(escapeHtmlLocal(validation.message), 'warning');
      return;
    }

    const candidates = getBulkXmlCandidates(options);
    if (!candidates.length) {
      setBulkXmlStatus('Nessun documento trovato nel periodo selezionato.', 'warning');
      return;
    }

    if (candidates.length > BULK_XML_WARN_THRESHOLD) {
      const ok = confirm('Stai per scaricare ' + candidates.length + ' file XML separati. Il browser potrebbe chiedere conferma per download multipli. Vuoi continuare?');
      if (!ok) return;
    }

    const built = buildBulkXmlPayloads(candidates);
    if (!built.payloads.length) {
      setBulkXmlStatus(renderBulkXmlSummary(candidates.length, 0, built.skipped), 'danger');
      return;
    }

    if (built.skipped.length) {
      const okPartial = confirm('Saranno scaricati ' + built.payloads.length + ' file XML. ' + built.skipped.length + ' documenti verranno saltati per errori o dati mancanti. Continuare?');
      if (!okPartial) {
        setBulkXmlStatus(renderBulkXmlSummary(candidates.length, 0, built.skipped), 'warning');
        return;
      }
    }

    downloadBulkXmlPayloads(built.payloads, built.skipped, candidates.length, 0);
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    // XML
    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function () {
      const id = $(this).attr('id') === 'export-xml-btn' ? $('#export-xml-btn').data('invoiceId') : $(this).attr('data-id');
      if (id) generateInvoiceXML(id);
    });

    $('#invoiceDetailModal').on('click', '#copy-xml-btn', function () {
      const id = $('#export-xml-btn').data('invoiceId');
      if (id) copyInvoiceXML(id);
    });

    $('#invoiceDetailModal').on('click', '.xml-validator-link', function () {
      const url = $(this).data('url');
      if (url) openExternalXmlValidator(url);
    });

    $('#bulk-xml-export-btn').on('click', function () {
      bulkExportXML();
    });

    $('#bulk-xml-start-date, #bulk-xml-end-date, #bulk-xml-include-invoices, #bulk-xml-include-credit-notes').on('change input', function () {
      setBulkXmlStatus('', 'info');
    });

    updateBulkXmlExportPanel();

    window.generateInvoiceXML = generateInvoiceXML;
    window.copyInvoiceXML = copyInvoiceXML;
    window.bulkExportInvoiceXML = bulkExportXML;
    window.updateBulkXmlExportPanel = updateBulkXmlExportPanel;
  }

  window.AppModules.invoicesXML.bind = bind;
})();
