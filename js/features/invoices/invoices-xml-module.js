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

    window.generateInvoiceXML = generateInvoiceXML;
    window.copyInvoiceXML = copyInvoiceXML;
  }

  window.AppModules.invoicesXML.bind = bind;
})();
