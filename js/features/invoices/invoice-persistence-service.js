(function () {
  window.InvoicePersistenceService = window.InvoicePersistenceService || {};

  function saveRecord(collection, data, id) {
    if (typeof window.saveDataToCloud !== 'function') {
      throw new Error('saveDataToCloud non disponibile');
    }
    return window.saveDataToCloud(collection, data, id);
  }

  function batchSave(collection, updates) {
    if (!Array.isArray(updates) || !updates.length) return Promise.resolve();
    if (typeof window.batchSaveDataToCloud === 'function') {
      return window.batchSaveDataToCloud(collection, updates);
    }
    return updates.reduce(function (promise, update) {
      return promise.then(function () {
        return saveRecord(collection, update.data, update.id);
      });
    }, Promise.resolve());
  }

  function getCollection(name) {
    if (typeof window.getData === 'function') return window.getData(name) || [];
    return [];
  }

  function getNextInvoiceId(currentInvoiceId) {
    if (currentInvoiceId != null && String(currentInvoiceId).trim()) return String(currentInvoiceId);
    if (typeof window.getNextId === 'function') return String(window.getNextId(getCollection('invoices')));
    const items = getCollection('invoices');
    const maxId = items.reduce(function (acc, item) {
      const n = parseInt(item && item.id, 10);
      return isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    return String(maxId + 1);
  }

  function extractImportedWorklogIds(lines) {
    if (window.InvoiceLineService && typeof window.InvoiceLineService.extractImportedWorklogIds === 'function') {
      return window.InvoiceLineService.extractImportedWorklogIds(lines);
    }
    const out = new Set();
    (lines || []).forEach(function (line) {
      if (!line || line.tsImport !== true) return;
      const ids = line.tsWorklogIds || (line.tsMeta && line.tsMeta.worklogIds);
      if (Array.isArray(ids)) ids.forEach(function (id) { out.add(String(id)); });
      else if (typeof ids === 'string' && ids) ids.split(',').forEach(function (id) { out.add(String(id).trim()); });
    });
    return Array.from(out).filter(Boolean);
  }

  function buildMarkWorklogsUpdates(worklogIds, invoiceId, invoiceNumber) {
    const ids = Array.isArray(worklogIds) ? worklogIds.map(String).filter(Boolean) : [];
    if (!ids.length) return [];

    const nowIso = new Date().toISOString();
    const current = String(invoiceId || '');
    const worklogs = getCollection('worklogs');
    const updates = [];

    ids.forEach(function (id) {
      const wl = worklogs.find(function (x) { return String(x.id) === String(id); });
      if (!wl) return;
      if (wl.invoiceId && String(wl.invoiceId) !== current) return;
      updates.push({
        id: String(id),
        data: {
          invoiceId: current,
          invoiceNumber: String(invoiceNumber || ''),
          invoicedAt: nowIso
        }
      });
    });

    return updates;
  }

  function buildUnmarkWorklogsUpdates(invoiceId) {
    const current = String(invoiceId || '');
    if (!current) return [];
    return getCollection('worklogs')
      .filter(function (wl) { return wl && String(wl.invoiceId || '') === current; })
      .map(function (wl) {
        return {
          id: String(wl.id),
          data: {
            invoiceId: null,
            invoiceNumber: null,
            invoicedAt: null
          }
        };
      });
  }

  function markWorklogsAsInvoiced(worklogIds, invoiceId, invoiceNumber) {
    return batchSave('worklogs', buildMarkWorklogsUpdates(worklogIds, invoiceId, invoiceNumber));
  }

  function unmarkWorklogsFromInvoice(invoiceId) {
    return batchSave('worklogs', buildUnmarkWorklogsUpdates(invoiceId));
  }

  function syncWorklogsForInvoice(params) {
    const data = params || {};
    const invoiceId = String(data.invoiceId || '');
    if (!invoiceId) return Promise.resolve();

    return unmarkWorklogsFromInvoice(invoiceId).then(function () {
      if (data.isDraft) return null;
      const ids = extractImportedWorklogIds(data.lines || []);
      const fallbackIds = (data.timesheetImport && Array.isArray(data.timesheetImport.worklogIds)) ? data.timesheetImport.worklogIds.map(String).filter(Boolean) : [];
      const finalIds = ids.length ? ids : fallbackIds;
      if (!finalIds.length) return null;
      return markWorklogsAsInvoiced(finalIds, invoiceId, data.invoiceNumber);
    });
  }

  function saveInvoiceDocument(params) {
    const data = params || {};
    const invoicePayload = data.invoicePayload;
    if (!invoicePayload) throw new Error('Payload documento mancante');

    const invoiceId = getNextInvoiceId(data.currentInvoiceId);
    return saveRecord('invoices', invoicePayload, invoiceId).then(function () {
      return syncWorklogsForInvoice({
        invoiceId: invoiceId,
        invoiceNumber: invoicePayload.number,
        lines: data.lines || invoicePayload.lines || [],
        isDraft: !!invoicePayload.isDraft,
        timesheetImport: invoicePayload.timesheetImport || null
      }).then(function () {
        return { invoiceId: invoiceId, invoicePayload: invoicePayload };
      });
    });
  }

  window.InvoicePersistenceService.getNextInvoiceId = getNextInvoiceId;
  window.InvoicePersistenceService.extractImportedWorklogIds = extractImportedWorklogIds;
  window.InvoicePersistenceService.buildMarkWorklogsUpdates = buildMarkWorklogsUpdates;
  window.InvoicePersistenceService.buildUnmarkWorklogsUpdates = buildUnmarkWorklogsUpdates;
  window.InvoicePersistenceService.markWorklogsAsInvoiced = markWorklogsAsInvoiced;
  window.InvoicePersistenceService.unmarkWorklogsFromInvoice = unmarkWorklogsFromInvoice;
  window.InvoicePersistenceService.syncWorklogsForInvoice = syncWorklogsForInvoice;
  window.InvoicePersistenceService.saveInvoiceDocument = saveInvoiceDocument;
})();
