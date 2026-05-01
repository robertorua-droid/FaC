// js/features/invoices/invoices-form-module.js
// Gestione form documento (Fattura / Nota di Credito) + righe + totali

(function () {
  window.AppModules = window.AppModules || {};
  const C = window.DomainConstants || {};
  const INVOICE_NATURE_DEFAULT = (C.INVOICE_NATURES && C.INVOICE_NATURES.VAT_EXEMPT_DEFAULT) || 'N2.2';
  window.AppModules.invoicesForm = window.AppModules.invoicesForm || {};
  window.App = window.App || {};
  window.App.invoices = window.App.invoices || {};

  let _bound = false;

  function getCurrentInvoiceIdSafe() {
    if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.getCurrentInvoiceId === 'function') {
      return window.InvoiceFormSessionService.getCurrentInvoiceId();
    }
    return window.CURRENT_EDITING_INVOICE_ID || null;
  }

  function setCurrentInvoiceIdSafe(invoiceId) {
    if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.setCurrentInvoiceId === 'function') {
      return window.InvoiceFormSessionService.setCurrentInvoiceId(invoiceId);
    }
    window.CURRENT_EDITING_INVOICE_ID = invoiceId != null ? String(invoiceId) : null;
    return window.CURRENT_EDITING_INVOICE_ID;
  }

  function getInvoiceLinesSafe() {
    if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.getLines === 'function') {
      return window.InvoiceFormSessionService.getLines();
    }
    return window.tempInvoiceLines || [];
  }

  function setInvoiceLinesSafe(lines) {
    if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.setLines === 'function') {
      return window.InvoiceFormSessionService.setLines(lines);
    }
    window.tempInvoiceLines = Array.isArray(lines) ? lines : [];
    return window.tempInvoiceLines;
  }

  // Flag interno per evitare side effects mentre carico una fattura in edit/copia
  let _isLoadingInvoice = false;

  // Stato UI: editing descrizione riga (indice riga) - usato per edit inline (textarea)
  window.__invoiceDescEditingIdx = window.__invoiceDescEditingIdx || null;

  function isInvoiceLockedForEditing() {
    try {
      // Se sto creando una nuova fattura, non è lockata
      if (!getCurrentInvoiceIdSafe()) return false;
      const inv = (getData('invoices') || []).find((x) => String(x.id) === String(getCurrentInvoiceIdSafe()));
      if (!inv) return false;

      // Bozze sempre modificabili
      if (inv.isDraft === true || String(inv.status || '').toLowerCase() === 'bozza') return false;

      const st = String(inv.status || '').toLowerCase();
      if (st === 'inviata' || st === 'pagata') return true;
      if (inv.sentToAgenzia === true) return true;

      return false;
    } catch (e) {
      return false;
    }
  }


  // =========================================================
  // Step 2 Commesse: collegamento Timesheet -> Fattura
  // - memorizza metadati import nel documento
  // - marca i worklog come fatturati al salvataggio fattura
  // =========================================================

  // =========================================
  // TIMESHEET -> FATTURA (Step 2)
  // - Collega i worklog importati ad una fattura dopo il salvataggio
  // - Evita doppie fatturazioni (non sovrascrive invoiceId se diverso)

  function extractImportedWorklogIds(lines) {
    if (window.InvoicePersistenceService && typeof window.InvoicePersistenceService.extractImportedWorklogIds === 'function') {
      return window.InvoicePersistenceService.extractImportedWorklogIds(lines);
    }
    if (window.InvoiceLineService && typeof window.InvoiceLineService.extractImportedWorklogIds === 'function') {
      return window.InvoiceLineService.extractImportedWorklogIds(lines);
    }
    return [];
  }

  async function markWorklogsAsInvoiced(worklogIds, invoiceId, invoiceNumber) {
    if (window.InvoicePersistenceService && typeof window.InvoicePersistenceService.markWorklogsAsInvoiced === 'function') {
      return window.InvoicePersistenceService.markWorklogsAsInvoiced(worklogIds, invoiceId, invoiceNumber);
    }
    return Promise.resolve();
  }


  async function unmarkWorklogsFromInvoice(invoiceId) {
    if (window.InvoicePersistenceService && typeof window.InvoicePersistenceService.unmarkWorklogsFromInvoice === 'function') {
      return window.InvoicePersistenceService.unmarkWorklogsFromInvoice(invoiceId);
    }
    return Promise.resolve();
  }

  // Calcolo automatico data di scadenza (solo Bonifico)
  // Supporta (didattico):
  // - Giorni Scadenza
  // - Fine Mese (es. 30gg FM)
  // - Giorno Fisso (es. "15") = prima data del mese con giorno = 15 successiva alla maturazione
  function parseDateUTC(ymd) {
    if (!ymd) return null;
    const parts = String(ymd).split('-').map((x) => parseInt(x, 10));
    if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
    const [y, m, d] = parts;
    return new Date(Date.UTC(y, m - 1, d));
  }

  function fmtDateUTC(d) {
    try {
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return '';
    }
  }

  function addDaysUTC(d, days) {
    const x = new Date(d.getTime());
    x.setUTCDate(x.getUTCDate() + days);
    return x;
  }

  function endOfMonthUTC(d) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth(); // 0-11
    return new Date(Date.UTC(y, m + 1, 0));
  }

  function firstFixedDayOnOrAfterUTC(d, fixedDay) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();

    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const candDay = Math.min(Math.max(1, fixedDay), lastDay);
    let cand = new Date(Date.UTC(y, m, candDay));

    if (d.getTime() <= cand.getTime()) return cand;

    // prossimo mese
    let ny = y;
    let nm = m + 1;
    if (nm > 11) {
      nm = 0;
      ny = y + 1;
    }

    const lastDay2 = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    const candDay2 = Math.min(Math.max(1, fixedDay), lastDay2);
    cand = new Date(Date.UTC(ny, nm, candDay2));
    return cand;
  }

  function recalcInvoiceDueDate() {
    const method = $('#invoice-modalitaPagamento').val();
    if (method && method !== 'Bonifico Bancario') return;

    // se i campi sono disabilitati (non bonifico), non ricalcolo
    if ($('#invoice-giorniTermini').prop('disabled')) return;

    const refDateStr = $('#invoice-dataRiferimento').val();
    const giorni = parseInt($('#invoice-giorniTermini').val(), 10);
    if (!refDateStr || isNaN(giorni)) return;

    const refDate = parseDateUTC(refDateStr);
    if (!refDate) return;

    const fineMese = $('#invoice-fineMese').length ? $('#invoice-fineMese').is(':checked') : false;
    const fixedEnabled = $('#invoice-giornoFissoEnabled').length ? $('#invoice-giornoFissoEnabled').is(':checked') : false;
    const fixedValRaw = $('#invoice-giornoFissoValue').length ? parseInt($('#invoice-giornoFissoValue').val(), 10) : NaN;
    const fixedVal = (!isNaN(fixedValRaw) && fixedValRaw >= 1 && fixedValRaw <= 31) ? fixedValRaw : null;

    // Base: data riferimento, oppure fine mese della data riferimento
    let base = refDate;
    if (fineMese) base = endOfMonthUTC(refDate);

    // Maturazione = base + giorni
    let maturity = addDaysUTC(base, giorni);

    // Giorno fisso: prima data con giorno = N (>= maturity)
    let due = maturity;
    if (fixedEnabled && fixedVal != null) {
      due = firstFixedDayOnOrAfterUTC(maturity, fixedVal);
    }

    $('#invoice-dataScadenza').val(fmtDateUTC(due));
  }

  // Opzioni banca (Banca 1 / Banca 2) in base ai dati azienda
  function populateInvoiceBankSelect(selectedVal) {
    const rawCompany = getData('companyInfo') || {};
    const company = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function')
      ? window.DomainNormalizers.normalizeCompanyInfo(rawCompany)
      : rawCompany;
    const paymentInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoicePaymentInfo === 'function')
      ? window.DomainNormalizers.normalizeInvoicePaymentInfo({ bankChoice: selectedVal, modalitaPagamento: 'Bonifico Bancario' }, company)
      : null;
    const bank1Name = (company.banca1 || company.banca || '').trim();
    const bank2Name = (company.banca2 || '').trim();

    const needBank2 = Boolean(bank2Name) || String((paymentInfo && paymentInfo.bankChoice) || selectedVal) === '2';

    const esc = (s) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    let html = `<option value="1">Banca 1${bank1Name ? ' - ' + esc(bank1Name) : ''}</option>`;
    if (needBank2) {
      html += `<option value="2">Banca 2${bank2Name ? ' - ' + esc(bank2Name) : ' (non configurata)'}</option>`;
    }

    $('#invoice-bank-select').html(html);
    if (selectedVal) $('#invoice-bank-select').val(String(selectedVal));
  }

  // Show/hide campi pagamento avanzati
  function updatePaymentUI() {
    const method = $('#invoice-modalitaPagamento').val() || 'Bonifico Bancario';
    const isBonifico = method === 'Bonifico Bancario';

    if ($('#invoice-bank-container').length) {
      $('#invoice-bank-container').toggleClass('d-none', !isBonifico);
      $('#invoice-bank-select').prop('disabled', !isBonifico);
    }

    if ($('#invoice-due-days-container').length) {
      $('#invoice-due-days-container').toggleClass('d-none', !isBonifico);
      $('#invoice-giorniTermini').prop('disabled', !isBonifico);
    }

    if ($('#invoice-finemese-container').length) {
      $('#invoice-finemese-container').toggleClass('d-none', !isBonifico);
      $('#invoice-fineMese').prop('disabled', !isBonifico);
    }

    if ($('#invoice-giornofisso-container').length) {
      $('#invoice-giornofisso-container').toggleClass('d-none', !isBonifico);
      $('#invoice-giornoFissoEnabled').prop('disabled', !isBonifico);
      const fixedEnabled = $('#invoice-giornoFissoEnabled').is(':checked');
      $('#invoice-giornoFissoValue').prop('disabled', !isBonifico || !fixedEnabled);
    }

    if (isBonifico) {
      const cur = $('#invoice-bank-select').val() || '1';
      populateInvoiceBankSelect(cur);
      const rawCompany = getData('companyInfo') || {};
      const normalizedPayment = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoicePaymentInfo === 'function')
        ? window.DomainNormalizers.normalizeInvoicePaymentInfo({ bankChoice: cur, modalitaPagamento: method }, rawCompany)
        : { bankChoice: cur };
      $('#invoice-bank-select').val(String(normalizedPayment.bankChoice || '1'));
      if (!$('#invoice-bank-select').val()) $('#invoice-bank-select').val('1');

      if (!$('#invoice-giorniTermini').val()) $('#invoice-giorniTermini').val(30);
      recalcInvoiceDueDate();
    }
  }

  // Applica (se presenti) i termini pagamento impostati in anagrafica Cliente
  // Nota: mantiene la possibilita' di modifica manuale nel documento.
  function applyCustomerPaymentDefaults(cust) {
    if (!cust) return;

    // Giorni termine
    if ($('#invoice-giorniTermini').length) {
      const raw = (cust.giorniTermini != null) ? String(cust.giorniTermini).trim() : '';
      if (raw !== '') {
        const n = parseInt(raw, 10);
        if (!isNaN(n)) $('#invoice-giorniTermini').val(n);
      }
    }

    // Fine Mese
    if ($('#invoice-fineMese').length) {
      const fm = (cust.fineMese === true || cust.fineMese === 'true');
      $('#invoice-fineMese').prop('checked', fm);
    }

    // Giorno Fisso
    const gfEnabled = (cust.giornoFissoEnabled === true || cust.giornoFissoEnabled === 'true');
    if ($('#invoice-giornoFissoEnabled').length) {
      $('#invoice-giornoFissoEnabled').prop('checked', gfEnabled);
    }
    if ($('#invoice-giornoFissoValue').length) {
      const vRaw = (cust.giornoFissoValue != null) ? String(cust.giornoFissoValue).trim() : '';
      const v = parseInt(vRaw, 10);
      if (gfEnabled && !isNaN(v) && v >= 1 && v <= 31) {
        $('#invoice-giornoFissoValue').val(v);
      } else {
        $('#invoice-giornoFissoValue').val('');
      }
      // l'abilitazione reale la gestisce updatePaymentUI in base al metodo
    }

    // Ricalcolo UI e scadenza
    updatePaymentUI();
    recalcInvoiceDueDate();
  }

  function updateInvoiceNumber(type, year) {
    if (getCurrentInvoiceIdSafe()) return;
    const invs = getData('invoices').filter(
      (i) => (i.type === type || (type === 'Fattura' && !i.type)) && i.date && i.date.substring(0, 4) === String(year)
    );
    let next = 1;
    if (invs.length > 0) {
      next =
        Math.max(
          ...invs.map((i) => {
            const parts = String(i.number || '').split('-');
            const last = parts[parts.length - 1];
            return parseInt(last) || 0;
          })
        ) + 1;
    }
    $('#invoice-number').val(`${type === 'Fattura' ? 'FATT' : 'NC'}-${year}-${String(next).padStart(2, '0')}`);
  }

  function renderLocalInvoiceLines() {
    const t = $('#invoice-lines-tbody').empty();
    (getInvoiceLinesSafe()).forEach((l, i) => {
      // Nota: la tabella in index.html ha le colonne:
      // Descrizione | Qtà | Prezzo | IVA | Totale | Del
      // Qui renderizziamo in modo coerente e permettiamo l'editing inline.
      const qty = parseFloat(l.qty) || 0;
      const price = parseFloat(l.price) || 0;
      const ivaVal = l.iva != null && l.iva !== '' ? String(l.iva) : '22';
      const naturaVal = l.esenzioneIva || INVOICE_NATURE_DEFAULT;
      const subtotal = l.subtotal != null ? parseFloat(l.subtotal) || 0 : qty * price;

      // Riga speciale: "Rivalsa Bollo" (non soggetta a IVA/ritenuta nel modello didattico)
      const isBollo = String(l.productName || '').trim().toLowerCase() === 'rivalsa bollo';
      const ivaEff = isBollo ? '0' : ivaVal;

      // Totale riga IVA inclusa
      const ivaPercNum = (() => {
        const n = parseFloat(String(ivaEff).replace('%', ''));
        return isNaN(n) ? 0 : n;
      })();
      const ivaAmt = ivaPercNum > 0 ? subtotal * (ivaPercNum / 100) : 0;
      const lineTotal = subtotal + ivaAmt;

      const safeDescText = (typeof window.escapeHtml === 'function') ? window.escapeHtml(l.productName || '') : (l.productName || '');
      const badgeTs = (l.tsImport === true) ? '<span class="badge bg-info me-1">TS</span>' : '';
      const isLocked = isInvoiceLockedForEditing();

      let descCellInner = '';
      if (!isLocked && window.__invoiceDescEditingIdx === i) {
        // Modalità edit: textarea multilinea
        const rawVal = String(l.productName || '');
        const escVal = (typeof window.escapeHtml === 'function') ? window.escapeHtml(rawVal) : rawVal;
        descCellInner = `${badgeTs}<textarea class="form-control form-control-sm line-desc-edit" data-i="${i}" rows="2">${escVal}</textarea><div class="small text-muted mt-1">Ctrl+Invio per salvare · Esc per annullare</div>`;
      } else {
        // Modalità display: testo con a-capo (pre-line)
        const hint = (!isLocked) ? ' title="Clicca per modificare la descrizione"' : '';
        const cursor = (!isLocked) ? ' style="cursor:pointer; white-space: pre-line;"' : ' style="white-space: pre-line;"';
        descCellInner = `${badgeTs}<span class="line-desc-display" data-i="${i}"${cursor}${hint}>${safeDescText}</span>`;
      }


      t.append(`
        <tr>
          <td class="line-desc-cell" data-i="${i}">${descCellInner}</td>
          <td class="text-end" style="width: 90px;">
            <input type="number" step="0.01" class="form-control form-control-sm text-end line-qty" data-i="${i}" value="${qty}">
          </td>
          <td class="text-end" style="width: 120px;">
            <input type="number" step="0.01" class="form-control form-control-sm text-end line-price" data-i="${i}" value="${price.toFixed(2)}">
          </td>
          <td class="text-end" style="width: 130px;">
            <select class="form-select form-select-sm text-end d-inline-block line-iva" data-i="${i}" style="width: 90px;" ${isBollo ? 'disabled' : ''}>
              <option value="0" ${ivaEff === '0' ? 'selected' : ''}>0%</option>
              <option value="4" ${ivaEff === '4' ? 'selected' : ''}>4%</option>
              <option value="5" ${ivaEff === '5' ? 'selected' : ''}>5%</option>
              <option value="10" ${ivaEff === '10' ? 'selected' : ''}>10%</option>
              <option value="22" ${ivaEff === '22' ? 'selected' : ''}>22%</option>
            </select>
            <select class="form-select form-select-sm mt-1 line-natura ${(ivaEff === '0' && !isBollo) ? '' : 'd-none'}" data-i="${i}" style="width: 90px;" ${isBollo ? 'disabled' : ''}>
              <option value="N2.1" ${naturaVal === 'N2.1' ? 'selected' : ''}>N2.1</option>
              <option value="${INVOICE_NATURE_DEFAULT}" ${naturaVal === INVOICE_NATURE_DEFAULT ? 'selected' : ''}>${INVOICE_NATURE_DEFAULT}</option>
              <option value="N4" ${naturaVal === 'N4' ? 'selected' : ''}>N4</option>
            </select>
          </td>
          <td class="text-end">€ ${lineTotal.toFixed(2)}</td>
          <td class="text-center" style="width: 50px;">
            <button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button>
          </td>
        </tr>
      `);
    });

    // UI: mostra/nasconde il pulsante 'Rimuovi import'
    try {
      if (window.App && window.App.invoices && typeof window.App.invoices.updateTimesheetImportUI === 'function') {
        window.App.invoices.updateTimesheetImportUI();
      }
    } catch (e) { /* no-op */ }
  }

  function updateTotalsDisplay() {
    const cid = $('#invoice-customer-select').val();
    const cust = getData('customers').find((c) => String(c.id) === String(cid));
    const comp = getData('companyInfo');

    // Reset UI se mancano dati base
    if (!comp) {
      $('#invoice-total').text('€ 0.00');
      $('#invoice-tax-details').text('');
      if ($('#invoice-netto').length) $('#invoice-netto').text('€ 0.00');
      if ($('#invoice-iva-breakdown').length) $('#invoice-iva-breakdown').html('');
      return { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, ivaTot: 0, ritenuta: 0, totDoc: 0, nettoDaPagare: 0 };
    }

    const lines = getInvoiceLinesSafe();
    const docType = $('#document-type').val();

    if (!window.InvoiceCalculator || typeof window.InvoiceCalculator.calculateTotals !== 'function') {
      console.error('Modulo InvoiceCalculator non caricato correttamente.');
      return { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, ivaTot: 0, ritenuta: 0, totDoc: 0, nettoDaPagare: 0 };
    }

    // Bollo: override sul documento (se presente) altrimenti su anagrafica cliente
    const _invForBollo = getCurrentInvoiceIdSafe() ? (getData('invoices') || []).find((i) => String(i.id) === String(getCurrentInvoiceIdSafe())) : null;
    const bolloAcaricoEmittente = (typeof window.resolveBolloAcaricoEmittente === 'function') ? window.resolveBolloAcaricoEmittente(_invForBollo, cust) : false;

    const calc = window.InvoiceCalculator.calculateTotals(lines, comp, cust, docType, { includeBolloInTotale: !bolloAcaricoEmittente });
    const totalsInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceTotalsInfo === 'function')
      ? window.DomainNormalizers.normalizeInvoiceTotalsInfo(_invForBollo || { type: docType }, cust, calc)
      : null;
    const totals = totalsInfo || calc;

    // Aggiornamento UI
    $('#invoice-total').text(`€ ${totals.total != null ? totals.total.toFixed(2) : calc.totDoc.toFixed(2)}`);
    if ($('#invoice-netto').length) $('#invoice-netto').text(`€ ${totals.nettoDaPagare != null ? totals.nettoDaPagare.toFixed(2) : calc.nettoDaPagare.toFixed(2)}`);
    const bolloImporto = totals.importoBollo != null ? totals.importoBollo : calc.impBollo;
    const bolloTxt = ((totals.bolloAcaricoEmittente != null ? totals.bolloAcaricoEmittente : bolloAcaricoEmittente) && bolloImporto > 0)
      ? `€ ${bolloImporto.toFixed(2)} (a carico studio)`
      : `€ ${bolloImporto.toFixed(2)}`;

    $('#invoice-tax-details').text(
      `(Imponibile: € ${(totals.totaleImponibile != null ? totals.totaleImponibile : calc.totImp).toFixed(2)} [di cui Rivalsa: € ${(totals.rivalsaImporto != null ? totals.rivalsaImporto : calc.riv).toFixed(2)}] - IVA: € ${(totals.ivaTotale != null ? totals.ivaTotale : calc.ivaTot).toFixed(2)} - Ritenuta: € ${(totals.ritenutaAcconto != null ? totals.ritenutaAcconto : calc.ritenuta).toFixed(2)} - Bollo: ${bolloTxt})`
    );

    // Riepilogo IVA (per aliquota / Natura) nella UI
    if ($('#invoice-iva-breakdown').length) {
      const map = totals.vatMap || calc.vatMap || new Map();
      const rows = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));

      if (rows.length === 0) {
        $('#invoice-iva-breakdown').html('');
      } else {
        const html = `
          <div class="border-top pt-2">
            <div class="fw-bold mb-1">Riepilogo IVA</div>
            ${rows
            .map(
              (r) => `
                  <div class="d-flex justify-content-between">
                    <span>${r.label}</span>
                    <span>Imponibile € ${r.imponibile.toFixed(2)}${r.imposta > 0 ? ` — Imposta € ${r.imposta.toFixed(2)}` : ''}</span>
                  </div>`
            )
            .join('')}
          </div>`;
        $('#invoice-iva-breakdown').html(html);
      }
    }

    return calc;
  }

  // =========================================================
  // Scorporo Rivalsa INPS (tariffa comprensiva) – per cliente
  // - Se attivo su cliente: le tariffe/righe vengono considerate LORDE (comprensive di rivalsa)
  // - Rivalsa viene poi ricalcolata sul totale imponibile inverso.
  // =========================================================

  // =========================================================
  // Helper Functions per Scorporo Rivalsa e altro
  // =========================================================

  function getSelectedCustomerSafe() {
    const cid = $('#invoice-customer-select').val();
    if (!cid) return null;
    return (getData('customers') || []).find((c) => String(c.id) === String(cid));
  }

  function isScorporoRivalsaEnabledForCustomer(cust) {
    if (!cust) return false;
    // Check Rivalsa INPS flag (must be ON) AND Scorporo flag (must be ON)
    const hasRiv = (cust.rivalsaInps === true || cust.rivalsaInps === 'true');
    const wantsScorporo = (cust.scorporoRivalsaInps === true || cust.scorporoRivalsaInps === 'true');
    return hasRiv && wantsScorporo;
  }

  function isLineEligibleForScorporo(line) {
    if (!line) return false;
    // Non scorporare se è una spesa/costo
    if (line.isCosto === true || line.isCosto === 'true') return false;
    // Non scorporare la riga "Rivalsa Bollo"
    if (String(line.productName || '').trim().toLowerCase() === 'rivalsa bollo') return false;
    return true;
  }

  function _sf(v) {
    const f = (typeof safeFloat === 'function') ? safeFloat : (x) => {
      const n = parseFloat(x);
      return isNaN(n) ? 0 : n;
    };
    return f(v);
  }

  function round2(n) {
    const x = parseFloat(n);
    if (isNaN(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  function getSelectedCustomerSafe() {
    const cid = String($('#invoice-customer-select').val() || '').trim();
    if (!cid) return null;
    return (getData('customers') || []).find((c) => String(c.id) === cid) || null;
  }

  function isScorporoRivalsaEnabledForCustomer(cust) {
    if (!cust) return false;
    const hasRivalsa = (cust.rivalsaInps === true || cust.rivalsaInps === 'true');
    const wants = (cust.scorporoRivalsaInps === true || cust.scorporoRivalsaInps === 'true');
    return hasRivalsa && wants;
  }

  function getScorporoFactorFromCompany() {
    const comp = getData('companyInfo') || {};
    const aliqInps = _sf(comp.aliquotaInps || comp.aliquotaContributi || 0);
    if (!aliqInps || aliqInps <= 0) return 1;
    return 1 + (aliqInps / 100);
  }

  function isLineEligibleForScorporo(line) {
    if (!line) return false;
    const name = String(line.productName || '').trim().toLowerCase();
    if (name === 'rivalsa bollo') return false;
    const isCosto = (line.isCosto === true || line.isCosto === 'true');
    return !isCosto;
  }

  function applyScorporoToLineInPlace(line) {
    // NUOVO APPROCCIO: Non modifico il prezzo unitario (lo lascio LORDO), ma segno che va scorporato
    // Il calcolo avverrà sul totale, per evitare errori di arrotondamento linea per linea.
    if (!line || !isLineEligibleForScorporo(line)) return;

    // Se è già marcato, non faccio nulla
    if (line.priceType === 'gross') return;

    // Marca come lordo (prezzo include rivalsa)
    line.priceType = 'gross';
    // Nota: line.price rimane quello inserito (Lordo)
    // line.subtotal rimane qty * price (Lordo)
  }

  function refreshScorporoHint(cust) {
    if (!$('#invoice-scorporo-hint').length) return;
    const on = isScorporoRivalsaEnabledForCustomer(cust);
    $('#invoice-scorporo-hint').toggleClass('d-none', !on);
    if (on) {
      $('#invoice-scorporo-hint').text('Scorporo Rivalsa INPS attivo: il calcolo avverrà sul totale.');
    }
  }

  function maybeApplyScorporoToExistingLines(cust) {
    if (!isScorporoRivalsaEnabledForCustomer(cust)) return;

    // Con il nuovo approccio (calcolo su totale), basta marcare le linee come gross.
    // Non serve dividere i prezzi, ma confermiamo l'intenzione all'utente.

    const lines = getInvoiceLinesSafe();
    const eligible = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => isLineEligibleForScorporo(l) && l && l.priceType !== 'gross');

    if (!eligible.length) return;

    const ok = confirm(
      `Il cliente ha attivo lo “Scorporo Rivalsa INPS”.\n\nVuoi considerare le ${eligible.length} righe già presenti come LORDE (comprensive di rivalsa)?\nIl calcolo avverrà sul totale.`
    );
    if (!ok) return;

    eligible.forEach(({ l }) => applyScorporoToLineInPlace(l));

    // Non serve renderLocalInvoiceLines perché i prezzi visibili non cambiano (sono lordi),
    // ma serve updateTotalsDisplay per ricalcolare imponibile e rivalsa corretti.
    if (typeof window.updateTotalsDisplay === 'function') window.updateTotalsDisplay();
  }

  function setInvoiceFormAlert(msg, kind = 'warning') {
    const $a = $('#invoice-form-alert');
    if (!$a.length) return;
    if (!msg) {
      $a.addClass('d-none').removeClass('alert-info alert-warning alert-danger alert-success');
      $a.html('');
      return;
    }
    $a.removeClass('d-none alert-info alert-warning alert-danger alert-success').addClass(`alert-${kind}`);
    $a.html(msg);
  }

  function prepareDocumentForm(type) {
    setCurrentInvoiceIdSafe(null);

    // reset form e stato
    const _f = $('#new-invoice-form')[0];
    if (_f && typeof _f.reset === 'function') _f.reset();

    // reset validazioni/avvisi UI
    setInvoiceFormAlert('');
    $('#new-invoice-form').removeClass('was-validated');
    $('#invoice-customer-select').removeClass('is-invalid');
    refreshScorporoHint(null);

    const state = (window.InvoiceService && typeof window.InvoiceService.createNewDocumentState === 'function')
      ? window.InvoiceService.createNewDocumentState(type)
      : null;
    const _ivaField = $('#invoice-product-iva');
    _ivaField.val(state ? state.defaultIva : '22');
    if (state) {
      _ivaField.prop('disabled', state.disableIvaField);
    }
    if (typeof window.toggleEsenzioneIvaField === 'function') {
      window.toggleEsenzioneIvaField('invoice', $('#invoice-product-iva').val());
    }

    $('#invoice-id').val(state ? state.invoiceIdLabel : 'Nuovo');
    $('#document-type').val(type);
    $('#invoice-lines-tbody').empty();
    setInvoiceLinesSafe(state ? state.lines : []);

    if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.startFromDocumentState === 'function') {
      window.InvoiceFormSessionService.startFromDocumentState({ currentInvoiceId: null, lines: state ? state.lines : [], timesheetImportState: state ? state.timesheetImportState || null : null });
    } else if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.setTimesheetImportState === 'function') window.InvoiceFormSessionService.setTimesheetImportState(state ? state.timesheetImportState || null : null);
    else if (window.App && window.App.invoices) window.App.invoices.timesheetImportState = state ? state.timesheetImportState || null : null;

    if (typeof populateDropdowns === 'function') populateDropdowns();
    $('#invoice-product-price, #invoice-product-qty, #invoice-giornoFissoValue').attr('step', '0.01');

    const today = state ? state.today : new Date().toISOString().slice(0, 10);
    $('#invoice-date').val(state ? state.date : today);
    $('#invoice-condizioniPagamento').val(state ? state.condizioniPagamento : 'Pagamento Completo');
    $('#invoice-modalitaPagamento').val(state ? state.modalitaPagamento : 'Bonifico Bancario');
    if ($('#invoice-attach-timesheet-pdf').length) $('#invoice-attach-timesheet-pdf').prop('checked', !!(state && state.attachTimesheetPdf));
    if ($('#invoice-attach-timesheet-notes').length) {
      $('#invoice-attach-timesheet-notes').prop('checked', state ? (state.attachTimesheetNotes !== false) : true);
      $('#invoice-attach-timesheet-notes').prop('disabled', !(state && state.attachTimesheetPdf));
    }

    if ($('#invoice-fineMese').length) $('#invoice-fineMese').prop('checked', !!(state && state.fineMese));
    if ($('#invoice-giornoFissoEnabled').length) $('#invoice-giornoFissoEnabled').prop('checked', !!(state && state.giornoFissoEnabled));
    if ($('#invoice-giornoFissoValue').length) {
      $('#invoice-giornoFissoValue').val(state ? state.giornoFissoValue : '');
      $('#invoice-giornoFissoValue').prop('disabled', state ? !state.giornoFissoEnabled : true);
    }

    if ($('#invoice-bank-select').length) {
      const bankChoice = state ? state.bankChoice : '1';
      populateInvoiceBankSelect(bankChoice);
      $('#invoice-bank-select').val(bankChoice);
    }
    updatePaymentUI();

    $('#invoice-dataRiferimento').val(state ? state.dataRiferimento : today);
    $('#invoice-giorniTermini').val(state ? state.giorniTermini : 30);
    recalcInvoiceDueDate();

    if (type === 'Nota di Credito') {
      $('#document-title').text(state ? state.title : 'Nuova Nota di Credito');
      $('#credit-note-fields').removeClass('d-none');
    } else {
      $('#document-title').text(state ? state.title : 'Nuova Fattura');
      $('#credit-note-fields').addClass('d-none');
    }

    updateInvoiceNumber(type, state ? state.numberYear : today.substring(0, 4));
    updateTotalsDisplay();
  }

  function loadInvoiceForEditing(id, isCopy) {
    const inv = getData('invoices').find((i) => String(i.id) === String(id));
    if (!inv) return;

    _isLoadingInvoice = true;

    const state = (window.InvoiceService && typeof window.InvoiceService.createEditingState === 'function')
      ? window.InvoiceService.createEditingState(inv, isCopy)
      : null;
    const type = state ? state.type : (isCopy ? 'Fattura' : inv.type || 'Fattura');
    prepareDocumentForm(type);

    if (state && state.currentInvoiceId) {
      setCurrentInvoiceIdSafe(state.currentInvoiceId);
      $('#invoice-id').val(state.invoiceIdLabel);
      $('#document-title').text(state.title);
    }

    $('#invoice-customer-select').val(state ? state.customerId : inv.customerId);
    $('#invoice-date').val(state ? state.date : (isCopy ? new Date().toISOString().slice(0, 10) : inv.date));
    if (state && state.number) $('#invoice-number').val(state.number);
    try {
      if ($('#invoice-isDraft').length) $('#invoice-isDraft').prop('checked', !!(state && state.isDraft));
      if ($('#invoice-attach-timesheet-pdf').length) $('#invoice-attach-timesheet-pdf').prop('checked', !!(state && state.attachTimesheetPdf));
      if ($('#invoice-attach-timesheet-notes').length) {
        $('#invoice-attach-timesheet-notes').prop('checked', state ? (state.attachTimesheetNotes !== false) : true);
        $('#invoice-attach-timesheet-notes').prop('disabled', !(state && state.attachTimesheetPdf));
      }
    } catch (e) { }

    $('#invoice-condizioniPagamento').val(state ? state.condizioniPagamento : inv.condizioniPagamento);
    $('#invoice-modalitaPagamento').val(state ? state.modalitaPagamento : (inv.modalitaPagamento || 'Bonifico Bancario'));
    $('#invoice-dataRiferimento').val(state ? state.dataRiferimento : (inv.dataRiferimento || inv.date || new Date().toISOString().slice(0, 10)));
    if (state && state.giorniTermini != null && String(state.giorniTermini) !== '') {
      $('#invoice-giorniTermini').val(state.giorniTermini);
    }

    if ($('#invoice-fineMese').length) $('#invoice-fineMese').prop('checked', !!(state && state.fineMese));
    if ($('#invoice-giornoFissoEnabled').length) $('#invoice-giornoFissoEnabled').prop('checked', !!(state && state.giornoFissoEnabled));
    if ($('#invoice-giornoFissoValue').length) {
      $('#invoice-giornoFissoValue').val(state ? state.giornoFissoValue : '');
    }

    if ($('#invoice-bank-select').length) {
      const bankChoice = state ? state.bankChoice : String(inv.bankChoice || '1');
      populateInvoiceBankSelect(bankChoice);
      $('#invoice-bank-select').val(bankChoice);
    }

    $('#invoice-dataScadenza').val(state ? state.dataScadenza : inv.dataScadenza);
    updatePaymentUI();

    if (type === 'Nota di Credito') {
      $('#linked-invoice').val(state ? state.linkedInvoice : inv.linkedInvoice);
      $('#reason').val(state ? state.reason : inv.reason);
    }

    setInvoiceLinesSafe(state ? state.lines : JSON.parse(JSON.stringify(inv.lines || [])));

    if (window.App && window.App.invoices) {
      if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.startFromDocumentState === 'function') {
        window.InvoiceFormSessionService.startFromDocumentState({
          currentInvoiceId: isCopy ? null : inv.id,
          lines: state ? state.lines : (inv.lines || []),
          timesheetImportState: state ? (state.timesheetImportState || null) : (isCopy ? null : (inv.timesheetImport || null))
        });
      } else if (window.InvoiceFormSessionService && typeof window.InvoiceFormSessionService.setTimesheetImportState === 'function') window.InvoiceFormSessionService.setTimesheetImportState(state ? (state.timesheetImportState || null) : (isCopy ? null : (inv.timesheetImport || null)));
      else window.App.invoices.timesheetImportState = state ? (state.timesheetImportState || null) : (isCopy ? null : (inv.timesheetImport || null));
    }

    renderLocalInvoiceLines();
    updateTotalsDisplay();

    _isLoadingInvoice = false;
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    // Espongo API (usate da navigazione e da altri pezzi)
    window.prepareDocumentForm = prepareDocumentForm;
    window.loadInvoiceForEditing = loadInvoiceForEditing;
    window.updateTotalsDisplay = updateTotalsDisplay;
    window.renderLocalInvoiceLines = renderLocalInvoiceLines;

    window.App.invoices.prepareDocumentForm = prepareDocumentForm;
    window.App.invoices.loadInvoiceForEditing = loadInvoiceForEditing;


    // Per il modulo Importa ore: sapere se stiamo modificando una fattura esistente
    window.App.invoices.getCurrentInvoiceId = function () { return getCurrentInvoiceIdSafe(); };

    // Draft helper: permette alla navigazione di capire se c'è una bozza in corso (nuovo documento)
    window.App.invoices.hasUnsavedDraft = function () {
      if (getCurrentInvoiceIdSafe()) return false; // stiamo modificando un documento salvato
      const lines = (getInvoiceLinesSafe()).length;
      const hasCustomer = !!String($('#invoice-customer-select').val() || '').trim();
      const hasManualDraft = !!String($('#invoice-product-description').val() || '').trim() || !!String($('#invoice-product-price').val() || '').trim();
      const hasCreditNote = !!String($('#linked-invoice').val() || '').trim() || !!String($('#reason').val() || '').trim();
      return (lines > 0) || hasCustomer || hasManualDraft || hasCreditNote;
    };

    window.App.invoices.restoreDraftUI = function () {
      try { renderLocalInvoiceLines(); } catch (e) { }
      try {
        const cust = getSelectedCustomerSafe();
        refreshScorporoHint(cust);
      } catch (e) { }
      try { updateTotalsDisplay(); } catch (e) { }
    };

    $('#invoice-attach-timesheet-pdf').on('change', function () {
      const enabled = $(this).is(':checked');
      $('#invoice-attach-timesheet-notes').prop('disabled', !enabled);
    });

    // Aggiungi riga
    $('#add-product-to-invoice-btn').click(() => {
      const built = (window.InvoiceFormUiService && typeof window.InvoiceFormUiService.buildLineFromProductInputs === 'function')
        ? window.InvoiceFormUiService.buildLineFromProductInputs({
          selectedProductId: $('#invoice-product-select').val(),
          description: $('#invoice-product-description').val(),
          qty: parseFloat($('#invoice-product-qty').val()) || 1,
          price: parseFloat($('#invoice-product-price').val()) || 0,
          iva: $('#invoice-product-iva').val(),
          esenzioneIva: $('#invoice-product-esenzioneIva').val(),
          customer: getSelectedCustomerSafe()
        })
        : { ok: false, message: 'InvoiceFormUiService non disponibile.' };

      if (!built.ok || !built.line) {
        if (built && built.message) setInvoiceFormAlert(built.message, 'warning');
        return;
      }

      setInvoiceFormAlert('');
      setInvoiceLinesSafe(getInvoiceLinesSafe().concat([built.line]));
      renderLocalInvoiceLines();
      updateTotalsDisplay();
    });

    // Editing inline righe fattura
    $('#invoice-lines-tbody').on('change', '.line-qty, .line-price, .line-iva, .line-natura', function () {
      const idx = parseInt($(this).attr('data-i'), 10);
      if (isNaN(idx) || !getInvoiceLinesSafe() || !getInvoiceLinesSafe()[idx]) return;

      const row = $(this).closest('tr');
      const applied = (window.InvoiceFormUiService && typeof window.InvoiceFormUiService.applyRowEditorChanges === 'function')
        ? window.InvoiceFormUiService.applyRowEditorChanges({
          lines: getInvoiceLinesSafe(),
          idx: idx,
          qty: parseFloat(row.find('.line-qty').val()) || 0,
          price: parseFloat(row.find('.line-price').val()) || 0,
          iva: String(row.find('.line-iva').val() || ''),
          esenzioneIva: String(row.find('.line-natura').val() || INVOICE_NATURE_DEFAULT),
          customer: getSelectedCustomerSafe()
        })
        : { ok: false, message: 'InvoiceFormUiService non disponibile.' };

      if (!applied.ok || !applied.lines) {
        if (applied && applied.message) setInvoiceFormAlert(applied.message, 'warning');
        return;
      }

      setInvoiceLinesSafe(applied.lines);
      if (applied.isBollo) row.find('.line-iva').val('0');
      if (applied.normalizedIva === '0' && !applied.isBollo) row.find('.line-natura').removeClass('d-none');
      else row.find('.line-natura').addClass('d-none');

      renderLocalInvoiceLines();
      updateTotalsDisplay();
    });


    
    // Editing inline descrizione riga (anche righe importate da Timesheet)
    $('#invoice-lines-tbody').on('click', '.line-desc-cell, .line-desc-display', function (e) {
      // Evito che click durante edit chiuda/apra di nuovo
      const idx = parseInt($(this).attr('data-i') || $(this).data('i'), 10);
      if (isNaN(idx)) return;
      if (isInvoiceLockedForEditing()) return;
      // Se è già in edit, non fare nulla
      if (window.__invoiceDescEditingIdx === idx) return;
      window.__invoiceDescEditingIdx = idx;
      renderLocalInvoiceLines();
      // Focus textarea
      setTimeout(() => {
        const ta = $('#invoice-lines-tbody').find(`textarea.line-desc-edit[data-i="${idx}"]`);
        if (ta.length) {
          ta.trigger('focus');
          try {
            const v = ta.val();
            ta[0].setSelectionRange(v.length, v.length);
          } catch (ex) { /* no-op */ }
        }
      }, 0);
    });

    // Salvataggio/annullo descrizione
    $('#invoice-lines-tbody').on('keydown', 'textarea.line-desc-edit', function (e) {
      const idx = parseInt($(this).attr('data-i'), 10);
      if (isNaN(idx)) return;

      // Esc = annulla
      if (e.key === 'Escape') {
        e.preventDefault();
        window.__invoiceDescEditingIdx = null;
        renderLocalInvoiceLines();
        return;
      }

      // Ctrl+Enter = salva e chiude
      if ((e.key === 'Enter' || e.keyCode === 13) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        $(this).trigger('blur');
      }
    });

    $('#invoice-lines-tbody').on('blur', 'textarea.line-desc-edit', function () {
      const idx = parseInt($(this).attr('data-i'), 10);
      if (isNaN(idx) || !getInvoiceLinesSafe() || !getInvoiceLinesSafe()[idx]) {
        window.__invoiceDescEditingIdx = null;
        renderLocalInvoiceLines();
        return;
      }
      const updated = (window.InvoiceFormUiService && typeof window.InvoiceFormUiService.updateDescription === 'function')
        ? window.InvoiceFormUiService.updateDescription(getInvoiceLinesSafe(), idx, $(this).val())
        : { ok: false, lines: getInvoiceLinesSafe() };
      if (updated && updated.ok && updated.lines) setInvoiceLinesSafe(updated.lines);
      window.__invoiceDescEditingIdx = null;
      renderLocalInvoiceLines();
      updateTotalsDisplay();
    });

    $('#invoice-lines-tbody').on('click', '.del-line', function () {
      const idx = parseInt($(this).data('i'), 10);
      if (isNaN(idx)) return;
      const nextLines = (window.InvoiceFormUiService && typeof window.InvoiceFormUiService.removeLine === 'function')
        ? window.InvoiceFormUiService.removeLine(getInvoiceLinesSafe(), idx)
        : getInvoiceLinesSafe();
      setInvoiceLinesSafe(nextLines);
      renderLocalInvoiceLines();
      updateTotalsDisplay();
    });

    // Cambio cliente: aggiorno totali e precompilo (se presenti) i termini pagamento da anagrafica
    $('#invoice-customer-select').on('change', function () {
      // Validazione UI: rimuovo evidenza errore appena seleziono
      $('#invoice-customer-select').removeClass('is-invalid');
      setInvoiceFormAlert('');

      if (_isLoadingInvoice) {
        const _cid = $(this).val();
        const _cust = (getData('customers') || []).find((c) => String(c.id) === String(_cid)) || null;
        refreshScorporoHint(_cust);
        updateTotalsDisplay();
        return;
      }

      const cid = $(this).val();
      const cust = (getData('customers') || []).find((c) => String(c.id) === String(cid));
      if (cust) applyCustomerPaymentDefaults(cust);
      refreshScorporoHint(cust);
      // Se il cliente richiede scorporo, offro di applicarlo alle righe già presenti
      try { maybeApplyScorporoToExistingLines(cust); } catch (e) { }

      updateTotalsDisplay();
    });

    // Ricalcolo automatico Date di pagamento
    $('#invoice-date').on('change', function () {
      const d = $(this).val();
      if (!d) return;
      $('#invoice-dataRiferimento').val(d);
      recalcInvoiceDueDate();
    });

    $('#invoice-dataRiferimento, #invoice-giorniTermini, #invoice-fineMese, #invoice-giornoFissoEnabled, #invoice-giornoFissoValue').on('change keyup', function () {
      recalcInvoiceDueDate();
    });

    $('#invoice-giornoFissoEnabled').on('change', function () {
      const isBonifico = ($('#invoice-modalitaPagamento').val() === 'Bonifico Bancario');
      $('#invoice-giornoFissoValue').prop('disabled', !isBonifico || !$(this).is(':checked'));
      recalcInvoiceDueDate();
    });

    // Quando seleziono un servizio dalla tendina, compilo automaticamente la riga
    $('#invoice-product-select').on('change', function () {
      const selectedId = $(this).val();
      const descInput = $('#invoice-product-description');
      const priceInput = $('#invoice-product-price');
      const qtyInput = $('#invoice-product-qty');
      const ivaSelect = $('#invoice-product-iva');
      const esenzioneSelect = $('#invoice-product-esenzioneIva');

      const ci = getData('companyInfo') || {};
      const isForf = window.TaxRegimePolicy ? window.TaxRegimePolicy.getCapabilities(ci).isForfettario : false;

      if (!selectedId) {
        // Nessuna scelta: reset campi
        descInput.val('');
        priceInput.val('');
        qtyInput.val(1);
        ivaSelect.val('0');
        esenzioneSelect.val('N2.1');
        descInput.prop('readonly', true);
        ivaSelect.prop('disabled', true);
        esenzioneSelect.prop('disabled', true);
        if (typeof window.toggleEsenzioneIvaField === 'function') window.toggleEsenzioneIvaField('invoice', ivaSelect.val());
        return;
      }

      if (selectedId === 'manual') {
        // Modalita manuale: sblocco descrizione/prezzo, IVA libera
        descInput.val('');
        priceInput.val('');
        qtyInput.val(1);
        ivaSelect.val('0');
        esenzioneSelect.val('N2.1');
        descInput.prop('readonly', false);
        ivaSelect.prop('disabled', isForf);
        esenzioneSelect.prop('disabled', false);
        if (typeof window.toggleEsenzioneIvaField === 'function') window.toggleEsenzioneIvaField('invoice', ivaSelect.val());
        return;
      }

      // Altrimenti e un prodotto standard
      const product = getData('products').find((p) => String(p.id) === String(selectedId));
      if (!product) return;

      descInput.val(product.description || '');
      priceInput.val(product.salePrice || 0);
      qtyInput.val(1);

      ivaSelect.val(isForf ? '0' : (product.iva || '0'));
      esenzioneSelect.val(product.esenzioneIva || 'N2.1');

      ivaSelect.prop('disabled', isForf);
      esenzioneSelect.prop('disabled', false);
      if (typeof window.toggleEsenzioneIvaField === 'function') window.toggleEsenzioneIvaField('invoice', ivaSelect.val());
    });

    // Quando cambia l'IVA (se manuale), aggiorno Natura UI
    $('#invoice-product-iva').on('change', function () {
      if (typeof window.toggleEsenzioneIvaField === 'function') window.toggleEsenzioneIvaField('invoice', $(this).val());
    });

    // Pagamenti: cambio modalità = show/hide banca + giorni
    $('#invoice-modalitaPagamento').on('change', function () {
      updatePaymentUI();
    });

    $('#new-invoice-form').submit(async function (e) {
      e.preventDefault();

      $('#new-invoice-form').addClass('was-validated');
      $('#invoice-customer-select').removeClass('is-invalid');
      setInvoiceFormAlert('');

      let calcs;
      try {
        calcs = updateTotalsDisplay();
      } catch (err) {
        alert('Errore nel calcolo totali: ' + err.message);
        console.error(err);
        return;
      }

      const formState = (window.InvoiceFormStateService && typeof window.InvoiceFormStateService.collectSubmitState === 'function')
        ? window.InvoiceFormStateService.collectSubmitState({
          currentInvoiceId: getCurrentInvoiceIdSafe(),
          lines: getInvoiceLinesSafe(),
          calcs: calcs
        })
        : {
          currentInvoiceId: getCurrentInvoiceIdSafe(),
          customerId: $('#invoice-customer-select').val(),
          type: $('#document-type').val(),
          lines: getInvoiceLinesSafe(),
          calcs: calcs
        };

      const validation = (window.InvoiceSubmitService && typeof window.InvoiceSubmitService.validateFormState === 'function')
        ? window.InvoiceSubmitService.validateFormState(formState)
        : { ok: !!formState.customerId && (formState.lines || []).length > 0 };

      if (!validation.ok) {
        if (validation.field === 'customerId') {
          $('#invoice-customer-select').addClass('is-invalid');
          $('#invoice-customer-select').focus();
        } else if (validation.field === 'reason') {
          $('#reason').focus();
        }
        setInvoiceFormAlert(validation.message || 'Controlla i dati del documento prima del salvataggio.', 'warning');
        return;
      }

      try {
        const result = (window.InvoiceSubmitService && typeof window.InvoiceSubmitService.submitDocument === 'function')
          ? await window.InvoiceSubmitService.submitDocument(formState)
          : { ok: false, stage: 'missing-submit-service' };

        if (!result.ok) {
          if (result.stage === 'duplicate-confirm-cancelled') return;
          const message = (result.validation && result.validation.message) || 'Impossibile salvare il documento.';
          setInvoiceFormAlert(message, 'warning');
          return;
        }
      } catch (err) {
        console.error('Errore salvataggio documento:', err);
        alert('Errore nel salvataggio del documento.');
        return;
      }
      if (window.UiRefresh && typeof window.UiRefresh.refreshInvoicesAndAnalysis === 'function') window.UiRefresh.refreshInvoicesAndAnalysis();
      alert('Salvato!');
      $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });
  }

  window.AppModules.invoicesForm.bind = bind;
  window.AppModules.invoicesForm.unmarkWorklogsFromInvoice = unmarkWorklogsFromInvoice;
  window.AppModules.invoicesForm.markWorklogsAsInvoiced = markWorklogsAsInvoiced;
  window.AppModules.invoicesForm.setInvoiceFormAlert = setInvoiceFormAlert;
})();
