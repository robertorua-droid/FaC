(function () {
  window.InvoiceValidationService = window.InvoiceValidationService || {};

  function getCustomers() {
    if (typeof window.getData === 'function') return window.getData('customers') || [];
    return [];
  }

  function hasMeaningfulLines(lines) {
    return (Array.isArray(lines) ? lines : []).some(function (line) {
      if (!line) return false;
      const desc = String(line.productName || '').trim().toLowerCase();
      if (!desc) return false;
      return desc !== 'rivalsa bollo';
    });
  }

  function validateDocumentForm(input) {
    const data = input || {};
    const customerId = String(data.customerId || '').trim();
    const creditInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCreditNoteInfo === 'function')
      ? window.DomainNormalizers.normalizeCreditNoteInfo(data)
      : data;
    const type = String(creditInfo.type || data.type || 'Fattura');
    const lines = Array.isArray(data.lines) ? data.lines : [];

    if (!customerId) {
      return {
        ok: false,
        field: 'customerId',
        message: 'Cliente obbligatorio: seleziona un cliente prima di salvare la fattura.'
      };
    }

    if (!lines.length || !hasMeaningfulLines(lines)) {
      return {
        ok: false,
        field: 'lines',
        message: 'Inserisci almeno una riga documento valida prima di salvare la fattura.'
      };
    }

    if (type === 'Nota di Credito') {
      const linkedInvoice = String(creditInfo.linkedInvoice || '').trim();
      const reason = String(creditInfo.reason || '').trim();
      if (!linkedInvoice && !reason) {
        return {
          ok: false,
          field: 'reason',
          message: 'Per una nota di credito indica almeno il documento collegato o una causale sintetica.'
        };
      }
    }

    return { ok: true };
  }

  function findPotentialDuplicates(input) {
    const data = input || {};
    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    const currentInvoiceId = data.currentInvoiceId != null ? String(data.currentInvoiceId) : null;
    const number = String(data.number || '').trim();
    const dateStr = String(data.date || '');
    const year = (dateStr && dateStr.length >= 4) ? dateStr.substring(0, 4) : '';

    if (!number || !year) return [];

    return invoices.filter(function (x) {
      if (!x) return false;
      if (currentInvoiceId && String(x.id) === currentInvoiceId) return false;
      if (x.isDraft === true || String(x.status || '') === 'Bozza') return false;

      const xNum = String(x.number || '').trim();
      const xYear = x.date ? String(x.date).substring(0, 4) : '';

      return (
        String(x.customerId || '') === String(data.customerId || '') &&
        String(x.type || '') === String(data.type || '') &&
        xNum.toLowerCase() === number.toLowerCase() &&
        xYear === year
      );
    });
  }

  function buildDuplicateConfirmMessage(input, duplicates) {
    const data = input || {};
    const existing = Array.isArray(duplicates) ? duplicates : [];
    const rawCust = getCustomers().find(function (c) {
      return String(c.id) === String(data.customerId || '');
    }) || {};
    const cust = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCustomerInfo === 'function')
      ? window.DomainNormalizers.normalizeCustomerInfo(rawCust)
      : rawCust;
    const label = cust.name || cust.ragioneSociale || 'Cliente';
    const number = String(data.number || '').trim();
    const year = String(data.date || '').substring(0, 4);
    return `Possibile duplicato: esiste già un ${data.type} n. ${number} (${year}) per ${label} (${existing.length} record).\n\nVuoi salvare comunque?`;
  }

  function validateXmlContext(input) {
    const data = input || {};
    const company = data.company || {};
    const invoice = data.invoice || {};

    if (!invoice || !invoice.id && !invoice.number) {
      return { ok: false, message: 'Documento non valido per export XML.' };
    }

    if (!company || (!company.piva && !company.codiceFiscale)) {
      return {
        ok: false,
        message: 'Compila i dati azienda: serve almeno P.IVA o Codice Fiscale per generare la fattura elettronica (IdTrasmittente/IdCodice).'
      };
    }

    if (!Array.isArray(invoice.lines) || !invoice.lines.length) {
      return { ok: false, message: 'Il documento non contiene righe esportabili in XML.' };
    }

    return { ok: true };
  }

  window.InvoiceValidationService.hasMeaningfulLines = hasMeaningfulLines;
  window.InvoiceValidationService.validateDocumentForm = validateDocumentForm;
  window.InvoiceValidationService.findPotentialDuplicates = findPotentialDuplicates;
  window.InvoiceValidationService.buildDuplicateConfirmMessage = buildDuplicateConfirmMessage;
  window.InvoiceValidationService.validateXmlContext = validateXmlContext;
})();
