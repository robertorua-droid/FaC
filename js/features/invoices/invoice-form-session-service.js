(function () {
  window.InvoiceFormSessionService = window.InvoiceFormSessionService || {};

  const session = window.__invoiceFormSession = window.__invoiceFormSession || {
    currentInvoiceId: null,
    lines: [],
    timesheetImportState: null
  };

  function cloneLines(lines) {
    return JSON.parse(JSON.stringify(Array.isArray(lines) ? lines : []));
  }

  function syncLegacyGlobals() {
    window.tempInvoiceLines = cloneLines(session.lines);
    window.CURRENT_EDITING_INVOICE_ID = session.currentInvoiceId != null ? String(session.currentInvoiceId) : null;
    window.App = window.App || {};
    window.App.invoices = window.App.invoices || {};
    window.App.invoices.timesheetImportState = session.timesheetImportState || null;
  }

  function getLines() {
    if (!Array.isArray(session.lines) || !session.lines.length) {
      session.lines = cloneLines(Array.isArray(window.tempInvoiceLines) ? window.tempInvoiceLines : []);
    }
    syncLegacyGlobals();
    return cloneLines(session.lines);
  }

  function setLines(lines) {
    session.lines = cloneLines(lines);
    if (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeTimesheetImportInfo === 'function' && session.timesheetImportState) {
      session.timesheetImportState = window.DomainNormalizers.normalizeTimesheetImportInfo(session.timesheetImportState, session.lines);
    }
    syncLegacyGlobals();
    return cloneLines(session.lines);
  }

  function mutateLines(mutator) {
    const current = cloneLines(session.lines);
    const next = typeof mutator === 'function' ? mutator(current) : current;
    session.lines = Array.isArray(next) ? cloneLines(next) : current;
    syncLegacyGlobals();
    return cloneLines(session.lines);
  }

  function hasImportedLines() {
    return getLines().some(function (line) { return !!(line && line.tsImport === true); });
  }

  function getCurrentInvoiceId() {
    if (session.currentInvoiceId == null && window.CURRENT_EDITING_INVOICE_ID != null) {
      session.currentInvoiceId = String(window.CURRENT_EDITING_INVOICE_ID);
    }
    syncLegacyGlobals();
    return session.currentInvoiceId != null ? String(session.currentInvoiceId) : null;
  }

  function setCurrentInvoiceId(invoiceId) {
    session.currentInvoiceId = (invoiceId != null && String(invoiceId).trim()) ? String(invoiceId) : null;
    syncLegacyGlobals();
    return session.currentInvoiceId;
  }

  function getTimesheetImportState() {
    if (session.timesheetImportState == null) {
      window.App = window.App || {};
      window.App.invoices = window.App.invoices || {};
      session.timesheetImportState = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeTimesheetImportInfo === 'function')
        ? window.DomainNormalizers.normalizeTimesheetImportInfo(window.App.invoices.timesheetImportState || null, session.lines)
        : (window.App.invoices.timesheetImportState || null);
    }
    syncLegacyGlobals();
    return session.timesheetImportState || null;
  }

  function setTimesheetImportState(state) {
    session.timesheetImportState = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeTimesheetImportInfo === 'function')
      ? window.DomainNormalizers.normalizeTimesheetImportInfo(state, session.lines)
      : (state || null);
    syncLegacyGlobals();
    return session.timesheetImportState;
  }

  function clearTimesheetImportState() {
    return setTimesheetImportState(null);
  }

  function startFromDocumentState(state) {
    const data = state || {};
    setCurrentInvoiceId(data.currentInvoiceId || null);
    setLines(data.lines || []);
    setTimesheetImportState(data.timesheetImportState || null);
    return {
      currentInvoiceId: getCurrentInvoiceId(),
      lines: getLines(),
      timesheetImportState: getTimesheetImportState()
    };
  }

  function reset() {
    session.currentInvoiceId = null;
    session.lines = [];
    session.timesheetImportState = null;
    syncLegacyGlobals();
    return { currentInvoiceId: null, lines: [], timesheetImportState: null };
  }

  window.InvoiceFormSessionService.getLines = getLines;
  window.InvoiceFormSessionService.setLines = setLines;
  window.InvoiceFormSessionService.mutateLines = mutateLines;
  window.InvoiceFormSessionService.hasImportedLines = hasImportedLines;
  window.InvoiceFormSessionService.getCurrentInvoiceId = getCurrentInvoiceId;
  window.InvoiceFormSessionService.setCurrentInvoiceId = setCurrentInvoiceId;
  window.InvoiceFormSessionService.getTimesheetImportState = getTimesheetImportState;
  window.InvoiceFormSessionService.setTimesheetImportState = setTimesheetImportState;
  window.InvoiceFormSessionService.clearTimesheetImportState = clearTimesheetImportState;
  window.InvoiceFormSessionService.startFromDocumentState = startFromDocumentState;
  window.InvoiceFormSessionService.reset = reset;
})();
