(function () {
  window.InvoiceLineService = window.InvoiceLineService || {};

  function round2Safe(v) {
    if (typeof window.round2 === 'function') return window.round2(v);
    return Math.round((parseFloat(v) || 0) * 100) / 100;
  }

  function createLineFromForm(input) {
    const data = input || {};
    const description = String(data.description || '');
    const qty = parseFloat(data.qty) || 1;
    const price = parseFloat(data.price) || 0;
    return {
      productName: description,
      qty: qty,
      price: price,
      subtotal: round2Safe(qty * price),
      iva: String(data.iva != null ? data.iva : '0'),
      esenzioneIva: String(data.esenzioneIva || ''),
      isLavoro: !!data.isLavoro,
      isCosto: !!data.isCosto,
      priceType: data.priceType || 'net'
    };
  }

  function updateLineFromEditor(line, input) {
    const current = Object.assign({}, line || {});
    const data = input || {};
    current.qty = parseFloat(data.qty) || 0;
    current.price = parseFloat(data.price) || 0;
    current.iva = String(data.iva != null ? data.iva : current.iva || '0');
    current.esenzioneIva = String(data.esenzioneIva != null ? data.esenzioneIva : current.esenzioneIva || '');
    current.subtotal = current.qty * current.price;
    if (data.priceType) current.priceType = data.priceType;
    if (data.clearPriceType) delete current.priceType;
    return current;
  }

  function extractImportedWorklogIds(lines) {
    const out = new Set();
    (lines || []).forEach(function (l) {
      if (!l || l.tsImport !== true) return;
      const ids = l.tsWorklogIds || (l.tsMeta && l.tsMeta.worklogIds);
      if (Array.isArray(ids)) ids.forEach(function (x) { out.add(String(x)); });
      else if (typeof ids === 'string' && ids) ids.split(',').forEach(function (x) { out.add(String(x).trim()); });
    });
    return Array.from(out).filter(Boolean);
  }

  window.InvoiceLineService.createLineFromForm = createLineFromForm;
  window.InvoiceLineService.updateLineFromEditor = updateLineFromEditor;
  window.InvoiceLineService.extractImportedWorklogIds = extractImportedWorklogIds;
})();
