(function () {
  window.InvoiceExportService = window.InvoiceExportService || {};

  function getInvoiceContext(invoiceId) {
    if (!window.InvoiceService || typeof window.InvoiceService.getInvoiceContextById !== 'function') {
      throw new Error('InvoiceService non disponibile.');
    }
    const ctx = window.InvoiceService.getInvoiceContextById(invoiceId);
    if (!ctx || !ctx.invoice) throw new Error('Fattura non trovata.');
    return ctx;
  }

  function validateExportability(ctx) {
    const invoice = ctx.invoice || {};
    if (invoice.isDraft === true || String(invoice.status || '').toLowerCase() === 'bozza') {
      return { ok: false, message: 'Questo documento è in BOZZA. Finalizzalo prima di esportare XML.' };
    }
    if (!window.InvoiceXMLValidator || typeof window.InvoiceXMLValidator.validateExportContext !== 'function') {
      return { ok: false, message: 'Modulo InvoiceXMLValidator non disponibile.' };
    }
    return window.InvoiceXMLValidator.validateExportContext(ctx);
  }

  function buildTimesheetAttachment(ctx) {
    const invoice = (ctx && ctx.invoice) || {};
    if (!invoice.attachTimesheetPdf) return { ok: true, attachments: [] };

    if (!window.InvoiceTimesheetAttachmentService || typeof window.InvoiceTimesheetAttachmentService.buildAttachmentDataset !== 'function') {
      return { ok: false, message: 'Modulo InvoiceTimesheetAttachmentService non disponibile.' };
    }
    if (!window.InvoiceTimesheetPdfService || typeof window.InvoiceTimesheetPdfService.createAttachment !== 'function') {
      return { ok: false, message: 'Modulo InvoiceTimesheetPdfService non disponibile.' };
    }

    const dataset = window.InvoiceTimesheetAttachmentService.buildAttachmentDataset(ctx, {
      includeNotes: invoice.attachTimesheetNotes !== false
    });
    if (!dataset || !dataset.ok) {
      return { ok: false, message: (dataset && dataset.message) || 'Impossibile costruire il dettaglio timesheet da allegare.' };
    }

    const filename = window.InvoiceTimesheetAttachmentService.buildAttachmentFileName(dataset);
    const attachment = window.InvoiceTimesheetPdfService.createAttachment(dataset, filename);
    return { ok: true, attachments: [attachment], dataset: dataset };
  }

  function calculateXmlTotals(ctx) {
    if (!window.InvoiceCalculator || typeof window.InvoiceCalculator.calculateTotals !== 'function') {
      throw new Error('Modulo InvoiceCalculator non disponibile.');
    }
    const invoice = ctx.invoice || {};
    const company = ctx.company || {};
    const customer = ctx.customer || {};
    const bolloAcaricoEmittente = (typeof window.resolveBolloAcaricoEmittente === 'function')
      ? window.resolveBolloAcaricoEmittente(invoice, customer)
      : false;

    const calc = window.InvoiceCalculator.calculateTotals(
      invoice.lines,
      company,
      customer,
      invoice.type,
      { includeBolloInTotale: !bolloAcaricoEmittente }
    );
    const totalsInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceTotalsInfo === 'function')
      ? window.DomainNormalizers.normalizeInvoiceTotalsInfo(invoice, customer, calc)
      : null;

    return {
      bolloAcaricoEmittente: bolloAcaricoEmittente,
      calc: calc,
      totalsInfo: totalsInfo
    };
  }

  function buildXmlPayload(invoiceId) {
    const ctx = getInvoiceContext(invoiceId);
    const validation = validateExportability(ctx);
    if (!validation.ok) return validation;

    if (!window.InvoiceXMLMapper || typeof window.InvoiceXMLMapper.buildInvoiceXmlPayload !== 'function') {
      return { ok: false, message: 'Modulo InvoiceXMLMapper non disponibile.' };
    }

    const totals = calculateXmlTotals(ctx);
    const attachmentResult = buildTimesheetAttachment(ctx);
    if (!attachmentResult.ok) return attachmentResult;
    const payload = window.InvoiceXMLMapper.buildInvoiceXmlPayload({
      invoice: ctx.invoice,
      company: ctx.company,
      customer: ctx.customer,
      calc: totals.calc,
      bolloAcaricoEmittente: totals.bolloAcaricoEmittente,
      attachments: attachmentResult.attachments || []
    });
    return { ok: true, payload: payload, context: ctx, totals: totals, attachments: attachmentResult.attachments || [] };
  }

  function triggerDownload(payload) {
    const blob = new Blob([payload.xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = payload.filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  window.InvoiceExportService.getInvoiceContext = getInvoiceContext;
  window.InvoiceExportService.validateExportability = validateExportability;
  window.InvoiceExportService.calculateXmlTotals = calculateXmlTotals;
  window.InvoiceExportService.buildXmlPayload = buildXmlPayload;
  window.InvoiceExportService.triggerDownload = triggerDownload;
})();
