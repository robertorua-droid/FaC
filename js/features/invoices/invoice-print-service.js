// js/features/invoices/invoice-print-service.js
// Renderer read-only per stampa singola/massiva documenti emessi.

(function () {
  function getDataSafe(key) {
    if (typeof window.getData !== 'function') return key === 'companyInfo' ? {} : [];
    return window.getData(key) || (key === 'companyInfo' ? {} : []);
  }

  function normalizeCompany(rawCompany) {
    return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function')
      ? window.DomainNormalizers.normalizeCompanyInfo(rawCompany || {})
      : (rawCompany || {});
  }

  function normalizeCustomer(rawCustomer) {
    return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCustomerInfo === 'function')
      ? window.DomainNormalizers.normalizeCustomerInfo(rawCustomer || {})
      : (rawCustomer || {});
  }

  function normalizeInvoice(rawInvoice) {
    return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceStatusInfo === 'function')
      ? window.DomainNormalizers.normalizeInvoiceStatusInfo(rawInvoice || {})
      : (rawInvoice || {});
  }

  function normalizePayment(inv, company) {
    return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoicePaymentInfo === 'function')
      ? window.DomainNormalizers.normalizeInvoicePaymentInfo(inv || {}, company || {})
      : (inv || {});
  }

  function normalizeTotals(inv, customer, calc) {
    return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceTotalsInfo === 'function')
      ? window.DomainNormalizers.normalizeInvoiceTotalsInfo(inv || {}, customer || {}, calc || {})
      : null;
  }

  function esc(value) {
    if (typeof window.escapeXML === 'function') return window.escapeXML(value == null ? '' : value);
    const raw = String(value == null ? '' : value);
    return raw.replace(/[&<>'"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function fmtDate(value) {
    if (typeof window.formatDateForDisplay === 'function') return window.formatDateForDisplay(value);
    return String(value || '');
  }

  function sf(value, fallback) {
    if (typeof window.safeFloat === 'function') return window.safeFloat(value);
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function isForfettarioCompany(company) {
    return !!(window.TaxRegimePolicy && typeof window.TaxRegimePolicy.isForfettario === 'function' && window.TaxRegimePolicy.isForfettario(company || {}));
  }

  function isDraft(inv) {
    return !!(inv && (inv.isDraft === true || String(inv.status || '') === 'Bozza'));
  }

  function calculateTotals(inv, company, customer) {
    const bolloAcaricoEmittente = (typeof window.resolveBolloAcaricoEmittente === 'function')
      ? window.resolveBolloAcaricoEmittente(inv, customer)
      : false;

    const calc = (window.AppModules && window.AppModules.invoicesCommonCalc && typeof window.AppModules.invoicesCommonCalc.calculateInvoiceTotals === 'function')
      ? window.AppModules.invoicesCommonCalc.calculateInvoiceTotals(inv.lines || [], company, customer, inv.type, { includeBolloInTotale: !bolloAcaricoEmittente })
      : { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, ivaTot: 0, ritenuta: 0, totDoc: 0, nettoDaPagare: 0, vatMap: new Map(), factorScorporo: 1, bolloIncludedInTotale: true };

    const totalsInfo = normalizeTotals(inv, customer, calc) || {};

    return {
      bolloAcaricoEmittente: bolloAcaricoEmittente,
      calc: calc,
      totalePrestazioni: totalsInfo.totalePrestazioni != null ? totalsInfo.totalePrestazioni : calc.totPrest,
      rivalsaImporto: totalsInfo.rivalsaImporto != null ? totalsInfo.rivalsaImporto : calc.riv,
      totaleImponibile: totalsInfo.totaleImponibile != null ? totalsInfo.totaleImponibile : calc.totImp,
      ivaTotale: totalsInfo.ivaTotale != null ? totalsInfo.ivaTotale : calc.ivaTot,
      importoBollo: totalsInfo.importoBollo != null ? totalsInfo.importoBollo : calc.impBollo,
      total: totalsInfo.total != null ? totalsInfo.total : calc.totDoc,
      ritenutaAcconto: totalsInfo.ritenutaAcconto != null ? totalsInfo.ritenutaAcconto : calc.ritenuta,
      nettoDaPagare: totalsInfo.nettoDaPagare != null ? totalsInfo.nettoDaPagare : calc.nettoDaPagare,
      hasRivalsa: totalsInfo.hasRivalsa != null ? totalsInfo.hasRivalsa : (calc.riv > 0),
      hasBollo: totalsInfo.hasBollo != null ? totalsInfo.hasBollo : (calc.impBollo > 0),
      hasIva: totalsInfo.hasIva != null ? totalsInfo.hasIva : (calc.ivaTot > 0),
      hasRitenuta: totalsInfo.hasRitenuta != null ? totalsInfo.hasRitenuta : (calc.ritenuta > 0)
    };
  }

  function getCustomerForInvoice(inv) {
    const customers = getDataSafe('customers') || [];
    const rawCustomer = customers.find(function (item) { return String(item.id) === String(inv.customerId); }) || {};
    return normalizeCustomer(rawCustomer);
  }

  function buildInvoiceHtml(rawInvoice, options) {
    const inv = normalizeInvoice(rawInvoice || {});
    const rawCompany = getDataSafe('companyInfo') || {};
    const company = normalizeCompany(rawCompany);
    const customer = getCustomerForInvoice(inv);
    const isForfettario = isForfettarioCompany(company);
    const showVatSection = !isForfettario;
    const totals = calculateTotals(inv, company, customer);
    const calc = totals.calc || {};
    const paymentInfo = normalizePayment(inv, company);
    const printOptions = options || {};

    const documentTitle = (inv.type || 'Fattura') + ' ' + (inv.number || '');
    const draftLabel = isDraft(inv) ? ' <span class="badge bg-secondary">BOZZA</span>' : '';
    let h = '';

    if (printOptions.includeDocumentTitle !== false) {
      h += '<div class="d-flex justify-content-between align-items-start mb-3">'
        + '<div><h4 class="mb-1">' + esc(documentTitle) + draftLabel + '</h4>'
        + '<div class="text-muted small">Documento generato per stampa/PDF dal gestionale FAC</div></div>'
        + '<div class="text-end small"><strong>Data documento</strong><br>' + fmtDate(inv.date) + '</div>'
        + '</div>';
    }

    h += `
      <div class="row mb-3">
        <div class="col-6">
          <h5 class="mb-1">Cedente / Prestatore</h5>
          <div><strong>${esc(company.name || '')}</strong></div>
          ${company.piva ? `<div>P.IVA: ${esc(company.piva)}</div>` : ''}
          ${company.codiceFiscale ? `<div>C.F.: ${esc(company.codiceFiscale)}</div>` : ''}
          ${company.address ? `<div>${esc(company.address)}${company.numeroCivico ? ', ' + esc(company.numeroCivico) : ''}</div>` : ''}
          ${(company.zip || company.city || company.province) ? `<div>${esc(company.zip || '')} ${esc(company.city || '')} ${esc(company.province || '')}</div>` : ''}
        </div>
        <div class="col-6 text-end">
          <h5 class="mb-1">Cessionario / Committente</h5>
          <div><strong>${esc(customer.name || '')}</strong></div>
          ${customer.piva ? `<div>P.IVA: ${esc(customer.piva)}</div>` : ''}
          ${customer.codiceFiscale ? `<div>C.F.: ${esc(customer.codiceFiscale)}</div>` : ''}
          ${customer.address ? `<div>${esc(customer.address)}</div>` : ''}
          ${(customer.cap || customer.comune || customer.provincia) ? `<div>${esc(customer.cap || '')} ${esc(customer.comune || '')} ${esc(customer.provincia || '')}</div>` : ''}
        </div>
      </div>

      <div class="row mb-3">
        <div class="col-6">
          <div><strong>Numero:</strong> ${esc(inv.number || '')}</div>
          <div><strong>Data:</strong> ${fmtDate(inv.date)}</div>
        </div>
        <div class="col-6 text-end">
          <div><strong>Tipo documento:</strong> ${esc(inv.type || 'Fattura')}</div>
        </div>
      </div>

      <table class="table table-sm invoice-print-table ${showVatSection ? 'invoice-print-table--with-vat' : 'invoice-print-table--no-vat'}">
        <thead>
          <tr>
            <th class="invoice-col-desc">Descrizione</th>
            <th class="text-end invoice-col-qty">Q.tà</th>
            <th class="text-end invoice-col-price">Prezzo</th>
            ${showVatSection ? '<th class="text-end invoice-col-vat">IVA</th>' : ''}
            <th class="text-end invoice-col-total">Totale</th>
          </tr>
        </thead>
        <tbody>
    `;

    (inv.lines || []).forEach(function (line) {
      const qty = typeof line.qty === 'number' ? line.qty : parseFloat(line.qty || 0) || 0;
      const price = typeof line.price === 'number' ? line.price : parseFloat(line.price || 0) || 0;
      const subtotal = typeof line.subtotal === 'number' ? line.subtotal : parseFloat(line.subtotal || 0) || qty * price;
      const isBollo = String(line.productName || '').trim().toLowerCase() === 'rivalsa bollo';

      let ivaPerc = 0;
      if (!isForfettario) {
        const ivaDefault = parseFloat(company.aliquotaIva || company.aliquotaIVA || 22) || 22;
        ivaPerc = line.iva === 0 || line.iva === '0' ? 0 : parseFloat(line.iva);
        if (isNaN(ivaPerc) && (line.iva === null || line.iva === undefined || line.iva === '')) ivaPerc = ivaDefault;
        if (isBollo) ivaPerc = 0;
      }

      let imponibile = subtotal;
      if (line.priceType === 'gross' && calc.factorScorporo > 1) {
        imponibile = subtotal / calc.factorScorporo;
      }

      const ivaLabel = isBollo ? 'Bollo' : ivaPerc > 0 ? `${ivaPerc.toFixed(0)}%` : `0% (${esc(line.esenzioneIva || 'N2.2')})`;
      const ivaAmt = ivaPerc > 0 ? imponibile * (ivaPerc / 100) : 0;
      const lineTotal = subtotal + ivaAmt;

      h += `
        <tr>
          <td class="invoice-line-desc">${esc(line.productName || '')}</td>
          <td class="text-end invoice-num invoice-col-qty">${qty.toFixed(2)}</td>
          <td class="text-end invoice-num invoice-col-price"><span class="invoice-money">€&nbsp;${price.toFixed(2)}</span></td>
          ${showVatSection ? `<td class="text-end invoice-col-vat">${ivaLabel}</td>` : ''}
          <td class="text-end invoice-num invoice-col-total"><span class="invoice-money">€&nbsp;${lineTotal.toFixed(2)}</span></td>
        </tr>
      `;
    });

    h += '</tbody></table>';

    const vatMap = calc.vatMap || new Map();
    let vatRowsHtml = '';
    if (vatMap.size > 0) {
      vatRowsHtml = Array.from(vatMap.values())
        .sort(function (a, b) { return String(a.label || '').localeCompare(String(b.label || '')); })
        .map(function (group) {
          return '<tr><td>' + esc(group.label || '') + '</td><td class="text-end">€ ' + (group.imponibile || 0).toFixed(2) + '</td><td class="text-end">€ ' + (group.imposta || 0).toFixed(2) + '</td></tr>';
        })
        .join('');
    } else {
      vatRowsHtml = '<tr><td colspan="3" class="text-muted">Nessun riepilogo IVA disponibile</td></tr>';
    }

    h += `
      <div class="row justify-content-end">
        <div class="col-md-5">
          <table class="table table-sm mb-0">
            <tbody>
              <tr><th>Totale Prestazioni</th><td class="text-end">€ ${totals.totalePrestazioni.toFixed(2)}</td></tr>
              ${totals.rivalsaImporto > 0 ? `<tr><th>Rivalsa INPS</th><td class="text-end">€ ${totals.rivalsaImporto.toFixed(2)}</td></tr>` : ''}
              <tr><th>Totale Imponibile</th><td class="text-end">€ ${totals.totaleImponibile.toFixed(2)}</td></tr>
              ${showVatSection && totals.hasIva ? `<tr><th>IVA</th><td class="text-end">€ ${totals.ivaTotale.toFixed(2)}</td></tr>` : ''}
              ${totals.hasBollo ? `<tr><th>Marca da bollo</th><td class="text-end">€ ${totals.importoBollo.toFixed(2)}${totals.bolloAcaricoEmittente ? ' <span class=\"text-muted\">(a carico studio)</span>' : ''}</td></tr>` : ''}
              <tr class="table-light fw-bold"><th>Totale Documento</th><td class="text-end">€ ${totals.total.toFixed(2)}</td></tr>
              ${totals.hasRitenuta ? `<tr><th>Ritenuta d'acconto</th><td class="text-end">€ ${totals.ritenutaAcconto.toFixed(2)}</td></tr>` : ''}
              <tr class="fw-bold border-top border-dark" style="font-size: 1.1rem;"><th>Netto da incassare</th><td class="text-end">€ ${totals.nettoDaPagare.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      ${showVatSection ? `
      <div class="mt-3">
        <h6 class="mb-2">Riepilogo IVA</h6>
        <table class="table table-sm">
          <thead>
            <tr><th>Aliquota / Natura</th><th class="text-end">Imponibile</th><th class="text-end">Imposta</th></tr>
          </thead>
          <tbody>${vatRowsHtml}</tbody>
        </table>
      </div>` : ''}
    `;

    const condizioni = inv.condizioniPagamento || '';
    const modalita = paymentInfo.modalitaPagamento || inv.modalitaPagamento || '';
    const scadenza = inv.dataScadenza ? fmtDate(inv.dataScadenza) : '';
    const isBonifico = !!paymentInfo.isBonifico || /bonifico/i.test(String(modalita || ''));
    let banca = '';
    let iban = '';
    if (isBonifico) {
      banca = paymentInfo.bancaSelezionata || '';
      iban = paymentInfo.ibanSelezionato || '';
    }

    const aliqRitenuta = sf(company.aliquotaRitenuta || 20);
    const fiscalBits = [];
    if (isForfettario) {
      fiscalBits.push('Regime forfettario: operazione non soggetta ad IVA (N2.2).');
    } else {
      fiscalBits.push(totals.hasIva ? 'Operazione soggetta a IVA.' : 'Operazione senza addebito IVA (verificare natura IVA).');
    }
    if (totals.rivalsaImporto > 0) fiscalBits.push('Rivalsa INPS applicata (' + (company.aliquotaInps || 0) + '%).');
    if (totals.hasRitenuta) fiscalBits.push("Ritenuta d'acconto applicata (" + aliqRitenuta.toFixed(2) + "%) perche il cliente e sostituto d'imposta.");
    const fiscalText = fiscalBits.join(' ');

    if (inv.notes) {
      h += '<div class="mt-3 alert alert-secondary p-2 mb-2"><small><strong>Note:</strong> ' + esc(inv.notes) + '</small></div>';
    }

    h += `
      ${fiscalText ? `<div class="mt-3 small"><p>${esc(fiscalText)}</p></div>` : ''}
      <div class="mt-2">
        <h6>Dati di pagamento</h6>
        <table class="table table-sm mb-0">
          <tbody>
            <tr><th>Netto da incassare</th><td>€ ${totals.nettoDaPagare.toFixed(2)}</td></tr>
            ${condizioni ? `<tr><th>Condizioni</th><td>${esc(condizioni)}</td></tr>` : ''}
            ${modalita ? `<tr><th>Modalita</th><td>${esc(modalita)}</td></tr>` : ''}
            ${scadenza ? `<tr><th>Scadenza</th><td>${scadenza}</td></tr>` : ''}
            ${isBonifico ? `<tr><th>Banca</th><td>${esc(banca)}</td></tr><tr><th>IBAN</th><td>${esc(iban)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `;

    return h;
  }

  function buildBulkPrintHtml(invoices, options) {
    const opts = options || {};
    const docs = (invoices || []).map(function (invoice) {
      const inv = normalizeInvoice(invoice || {});
      const draftClass = isDraft(inv) ? ' invoice-print-draft' : '';
      return '<section class="bulk-pdf-document' + draftClass + '">' + buildInvoiceHtml(inv, { includeDocumentTitle: true }) + '</section>';
    }).join('\n');

    const title = opts.title || 'Fascicolo documenti emessi';
    const period = opts.periodLabel || '';
    const generatedAt = fmtDate(new Date().toISOString().slice(0, 10));

    return '<div class="bulk-pdf-cover">'
      + '<h2>' + esc(title) + '</h2>'
      + (period ? '<p class="lead mb-1">Periodo: ' + esc(period) + '</p>' : '')
      + '<p class="text-muted">Generato da FAC il ' + esc(generatedAt) + '</p>'
      + '<p>Documenti inclusi: <strong>' + (invoices || []).length + '</strong></p>'
      + '<p class="small text-muted mb-0">Usa la finestra di stampa del browser e scegli “Salva come PDF” per ottenere un unico file PDF.</p>'
      + '</div>'
      + docs;
  }

  window.InvoicePrintService = {
    buildInvoiceHtml: buildInvoiceHtml,
    buildBulkPrintHtml: buildBulkPrintHtml,
    isDraft: isDraft
  };
})();
