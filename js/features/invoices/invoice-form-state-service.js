(function () {
  window.InvoiceFormStateService = window.InvoiceFormStateService || {};

  function getCurrentInvoiceId() {
    if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.getCurrentInvoiceId === 'function') {
      return window.InvoiceFormSessionService.getCurrentInvoiceId();
    }
    return (typeof window.CURRENT_EDITING_INVOICE_ID !== 'undefined' && window.CURRENT_EDITING_INVOICE_ID != null)
      ? window.CURRENT_EDITING_INVOICE_ID
      : null;
  }

  function getSelectedCustomer(customerId) {
    const customers = (typeof window.getData === 'function' ? window.getData('customers') : null) || [];
    return customers.find(function (c) { return String(c.id) === String(customerId || ''); }) || {};
  }

  function getPreviousInvoice(invoiceId) {
    if (!invoiceId) return null;
    const invoices = (typeof window.getData === 'function' ? window.getData('invoices') : null) || [];
    return invoices.find(function (i) { return String(i.id) === String(invoiceId); }) || null;
  }

  function collectSubmitState(options) {
    const opts = options || {};
    const currentInvoiceId = opts.currentInvoiceId != null ? opts.currentInvoiceId : getCurrentInvoiceId();
    const customerId = $('#invoice-customer-select').val();
    const rawState = {
      currentInvoiceId: currentInvoiceId,
      customerId: customerId,
      customer: getSelectedCustomer(customerId),
      previousInvoice: getPreviousInvoice(currentInvoiceId),
      type: $('#document-type').val(),
      number: $('#invoice-number').val(),
      date: $('#invoice-date').val(),
      lines: Array.isArray(opts.lines) ? opts.lines : ((window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.getLines === 'function') ? window.InvoiceFormSessionService.getLines() : (window.tempInvoiceLines || [])),
      calcs: opts.calcs || null,
      dataScadenza: $('#invoice-dataScadenza').val(),
      dataRiferimento: $('#invoice-dataRiferimento').val(),
      giorniTermini: $('#invoice-giorniTermini').val(),
      bankChoice: $('#invoice-bank-select').val() || '1',
      fineMese: $('#invoice-fineMese').length ? $('#invoice-fineMese').is(':checked') : false,
      giornoFissoEnabled: $('#invoice-giornoFissoEnabled').length ? $('#invoice-giornoFissoEnabled').is(':checked') : false,
      giornoFissoValue: $('#invoice-giornoFissoValue').val(),
      condizioniPagamento: $('#invoice-condizioniPagamento').val(),
      modalitaPagamento: $('#invoice-modalitaPagamento').val(),
      linkedInvoice: $('#linked-invoice').val(),
      reason: $('#reason').val(),
      timesheetImport: (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.getTimesheetImportState === 'function') ? window.InvoiceFormSessionService.getTimesheetImportState() : ((window.App && window.App.invoices) ? (window.App.invoices.timesheetImportState || null) : null),
      attachTimesheetPdf: $('#invoice-attach-timesheet-pdf').length ? $('#invoice-attach-timesheet-pdf').is(':checked') : false,
      attachTimesheetNotes: $('#invoice-attach-timesheet-notes').length ? $('#invoice-attach-timesheet-notes').is(':checked') : true,
      isDraft: $('#invoice-isDraft').length ? $('#invoice-isDraft').is(':checked') : false
    };
    const company = (window.InvoiceService && typeof window.InvoiceService.getCompanyInfo === 'function')
      ? window.InvoiceService.getCompanyInfo()
      : ((typeof window.getData === 'function' ? window.getData('companyInfo') : null) || {});
    let normalized = rawState;
    if (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCreditNoteInfo === 'function') {
      normalized = window.DomainNormalizers.normalizeCreditNoteInfo(normalized);
    }
    if (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoicePaymentInfo === 'function') {
      normalized = window.DomainNormalizers.normalizeInvoicePaymentInfo(normalized, company);
    }
    if (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeTimesheetImportInfo === 'function') {
      normalized.timesheetImport = window.DomainNormalizers.normalizeTimesheetImportInfo(normalized.timesheetImport, normalized.lines);
    }
    return normalized;
  }

  window.InvoiceFormStateService.getSelectedCustomer = getSelectedCustomer;
  window.InvoiceFormStateService.getPreviousInvoice = getPreviousInvoice;
  window.InvoiceFormStateService.collectSubmitState = collectSubmitState;
})();
