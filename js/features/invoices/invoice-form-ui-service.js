(function () {
  window.InvoiceFormUiService = window.InvoiceFormUiService || {};

  function getProducts() {
    if (typeof window.getData === 'function') return window.getData('products') || [];
    return [];
  }

  function isLineEligibleForScorporo(line) {
    if (typeof window.isLineEligibleForScorporo === 'function') return !!window.isLineEligibleForScorporo(line);
    if (!line) return false;
    const desc = String(line.productName || '').trim().toLowerCase();
    return desc !== 'rivalsa bollo' && line.isCosto !== true;
  }

  function isScorporoEnabledForCustomer(customer) {
    if (typeof window.isScorporoRivalsaEnabledForCustomer === 'function') {
      return !!window.isScorporoRivalsaEnabledForCustomer(customer);
    }
    return false;
  }

  function buildLineFromProductInputs(input) {
    const data = input || {};
    const selectedProductId = String(data.selectedProductId || '');
    const description = String(data.description || '').trim();
    if (!description) {
      return { ok: false, message: 'Descrizione riga mancante.' };
    }

    let isCosto = false;
    if (selectedProductId && selectedProductId !== 'manual') {
      const product = getProducts().find(function (p) { return String(p.id) === selectedProductId; }) || null;
      isCosto = product ? (product.isCosto === true || product.isCosto === 'true') : false;
    }

    const wantsScorporo = isScorporoEnabledForCustomer(data.customer) && !isCosto && description.toLowerCase() !== 'rivalsa bollo';
    if (!window.InvoiceLineService || typeof window.InvoiceLineService.createLineFromForm !== 'function') {
      return { ok: false, message: 'InvoiceLineService non disponibile.' };
    }

    return {
      ok: true,
      line: window.InvoiceLineService.createLineFromForm({
        description: description,
        qty: data.qty,
        price: data.price,
        iva: data.iva,
        esenzioneIva: data.esenzioneIva,
        isLavoro: !isCosto,
        isCosto: isCosto,
        priceType: wantsScorporo ? 'gross' : 'net'
      })
    };
  }

  function applyRowEditorChanges(input) {
    const data = input || {};
    const lines = Array.isArray(data.lines) ? data.lines : [];
    const idx = parseInt(data.idx, 10);
    if (isNaN(idx) || !lines[idx]) {
      return { ok: false, message: 'Riga documento non trovata.' };
    }

    const currentLine = lines[idx];
    let iva = String(data.iva || '');
    const isBollo = String(currentLine.productName || '').trim().toLowerCase() === 'rivalsa bollo';
    if (isBollo) iva = '0';

    const natura = iva === '0' && !isBollo ? String(data.esenzioneIva || '') : '';
    const wantsScorporo = isScorporoEnabledForCustomer(data.customer) && isLineEligibleForScorporo(currentLine);

    if (!window.InvoiceLineService || typeof window.InvoiceLineService.updateLineFromEditor !== 'function') {
      return { ok: false, message: 'InvoiceLineService non disponibile.' };
    }

    const nextLine = window.InvoiceLineService.updateLineFromEditor(currentLine, {
      qty: data.qty,
      price: data.price,
      iva: iva,
      esenzioneIva: natura,
      priceType: wantsScorporo ? 'gross' : undefined,
      clearPriceType: !wantsScorporo
    });

    const out = lines.slice();
    out[idx] = nextLine;
    return { ok: true, lines: out, line: nextLine, normalizedIva: iva, normalizedNatura: natura, isBollo: isBollo };
  }

  function updateDescription(lines, idx, value) {
    const arr = Array.isArray(lines) ? lines.slice() : [];
    const i = parseInt(idx, 10);
    if (isNaN(i) || !arr[i]) return { ok: false, lines: arr };
    arr[i] = Object.assign({}, arr[i], {
      productName: String(value || '').replace(/\r\n/g, '\n'),
      descriptionEdited: true
    });
    return { ok: true, lines: arr };
  }

  function removeLine(lines, idx) {
    const arr = Array.isArray(lines) ? lines.slice() : [];
    const i = parseInt(idx, 10);
    if (!isNaN(i) && i >= 0 && i < arr.length) arr.splice(i, 1);
    return arr;
  }

  window.InvoiceFormUiService.buildLineFromProductInputs = buildLineFromProductInputs;
  window.InvoiceFormUiService.applyRowEditorChanges = applyRowEditorChanges;
  window.InvoiceFormUiService.updateDescription = updateDescription;
  window.InvoiceFormUiService.removeLine = removeLine;
})();
