(function () {
  window.InvoiceTimesheetAttachmentService = window.InvoiceTimesheetAttachmentService || {};

  function getCollection(name) {
    if (typeof window.getData === 'function') return window.getData(name) || [];
    return [];
  }

  function safeText(v) { return v == null ? '' : String(v); }
  function safeInt(v) { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  function pickNameById(collection, id, field) {
    const row = (collection || []).find(function (x) { return String(x.id) === String(id || ''); }) || null;
    return row ? safeText(row[field] || '') : '';
  }

  function formatHours(minutes) {
    const mins = safeInt(minutes);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h) + ':' + String(m).padStart(2, '0');
  }

  function collectWorklogIds(invoice) {
    const ids = [];
    const importState = invoice && invoice.timesheetImport ? invoice.timesheetImport : null;
    const fromState = importState && (importState.worklogIds || importState.importedWorklogIds || []);
    if (Array.isArray(fromState)) fromState.forEach(function (id) { if (String(id || '').trim()) ids.push(String(id).trim()); });
    else if (typeof fromState === 'string' && fromState) fromState.split(',').forEach(function (id) { if (String(id || '').trim()) ids.push(String(id).trim()); });

    (invoice && Array.isArray(invoice.lines) ? invoice.lines : []).forEach(function (line) {
      if (!line || line.tsImport !== true) return;
      const raw = line.tsWorklogIds || (line.tsMeta && line.tsMeta.worklogIds) || [];
      if (Array.isArray(raw)) raw.forEach(function (id) { if (String(id || '').trim()) ids.push(String(id).trim()); });
      else if (typeof raw === 'string' && raw) raw.split(',').forEach(function (id) { if (String(id || '').trim()) ids.push(String(id).trim()); });
    });

    return Array.from(new Set(ids));
  }

  function buildAttachmentDataset(ctx, options) {
    const opts = options || {};
    const invoice = (ctx && ctx.invoice) || {};
    const customer = (ctx && ctx.customer) || {};
    const worklogIds = collectWorklogIds(invoice);
    if (!worklogIds.length) {
      return { ok: false, message: 'Nessun worklog collegato disponibile per l\'allegato timesheet.' };
    }

    const worklogs = getCollection('worklogs');
    const projects = getCollection('projects');
    const commesse = getCollection('commesse');
    const rows = worklogIds.map(function (id) {
      return worklogs.find(function (wl) { return String(wl.id) === String(id); }) || null;
    }).filter(Boolean).map(function (wl) {
      const projectName = pickNameById(projects, wl.projectId, 'name');
      const commessaName = pickNameById(commesse, wl.commessaId, 'name');
      return {
        id: String(wl.id),
        date: safeText(wl.date),
        commessa: commessaName,
        progetto: projectName,
        ore: formatHours(wl.minutes),
        minutes: safeInt(wl.minutes),
        note: opts.includeNotes === false ? '' : safeText(wl.note || ''),
        billable: wl.billable !== false,
        customerFinale: safeText(wl.endCustomerName || wl.customerFinale || '')
      };
    }).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date)) || String(a.commessa).localeCompare(String(b.commessa)) || String(a.progetto).localeCompare(String(b.progetto));
    });

    if (!rows.length) {
      return { ok: false, message: 'Nessun dettaglio timesheet disponibile per l\'allegato.' };
    }

    const dates = rows.map(function (r) { return r.date; }).filter(Boolean).sort();
    const totalMinutes = rows.reduce(function (sum, row) { return sum + safeInt(row.minutes); }, 0);
    return {
      ok: true,
      invoiceId: invoice.id,
      invoiceNumber: safeText(invoice.number || ''),
      invoiceDate: safeText(invoice.date || ''),
      invoiceType: safeText(invoice.type || 'Fattura'),
      customerName: safeText(customer.name || customer.ragioneSociale || [customer.nome, customer.cognome].filter(Boolean).join(' ')),
      includeNotes: opts.includeNotes !== false,
      totalMinutes: totalMinutes,
      totalHoursText: formatHours(totalMinutes),
      fromDate: dates[0] || '',
      toDate: dates[dates.length - 1] || '',
      rows: rows
    };
  }

  function buildAttachmentFileName(dataset) {
    const rawNum = safeText((dataset && dataset.invoiceNumber) || 'documento').replace(/[^A-Za-z0-9._-]+/g, '_');
    return 'Dettaglio_Timesheet_' + rawNum + '.pdf';
  }

  window.InvoiceTimesheetAttachmentService.collectWorklogIds = collectWorklogIds;
  window.InvoiceTimesheetAttachmentService.buildAttachmentDataset = buildAttachmentDataset;
  window.InvoiceTimesheetAttachmentService.buildAttachmentFileName = buildAttachmentFileName;
})();
