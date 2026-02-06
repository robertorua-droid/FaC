// js/features/invoices/invoices-form-module.js
// Gestione form documento (Fattura / Nota di Credito) + righe + totali

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.invoicesForm = window.AppModules.invoicesForm || {};
  window.App = window.App || {};
  window.App.invoices = window.App.invoices || {};

  let _bound = false;

  // Flag interno per evitare side effects mentre carico una fattura in edit/copia
  let _isLoadingInvoice = false;

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
    const out = new Set();
    (lines || []).forEach((l) => {
      if (!l) return;
      if (l.tsImport === true) {
        const ids = l.tsWorklogIds || (l.tsMeta && l.tsMeta.worklogIds);
        if (Array.isArray(ids)) ids.forEach((x) => out.add(String(x)));
        else if (typeof ids === 'string' && ids) ids.split(',').forEach((x) => out.add(String(x).trim()));
      }
    });
    return Array.from(out).filter(Boolean);
  }

  async function markWorklogsAsInvoiced(worklogIds, invoiceId, invoiceNumber) {
    const ids = Array.isArray(worklogIds) ? worklogIds.map(String).filter(Boolean) : [];
    if (!ids.length) return;

    const nowIso = new Date().toISOString();
    const current = String(invoiceId || '');

    const updates = [];

    ids.forEach((id) => {
      const wl = (getData('worklogs') || []).find((x) => String(x.id) === String(id));
      if (!wl) return;

      // Non sovrascrivo se già fatturato su altra fattura
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

    if (!updates.length) return;

    // Batch (se disponibile) per evitare tanti roundtrip
    if (typeof window.batchSaveDataToCloud === 'function') {
      await window.batchSaveDataToCloud('worklogs', updates);
    } else {
      for (const u of updates) {
        await saveDataToCloud('worklogs', u.data, u.id);
      }
    }
  }


async function unmarkWorklogsFromInvoice(invoiceId) {
  const current = String(invoiceId || '');
  if (!current) return;

  const worklogs = getData('worklogs') || [];
  const toUpdate = [];

  worklogs.forEach((wl) => {
    if (!wl) return;
    if (String(wl.invoiceId || '') !== current) return;

    toUpdate.push({
      id: String(wl.id),
      data: {
        invoiceId: null,
        invoiceNumber: null,
        invoicedAt: null
      }
    });
  });

  if (!toUpdate.length) return;

  if (typeof window.batchSaveDataToCloud === 'function') {
    await window.batchSaveDataToCloud('worklogs', toUpdate);
  } else {
    for (const u of toUpdate) {
      await saveDataToCloud('worklogs', u.data, u.id);
    }
  }
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
    const company = getData('companyInfo') || {};
    const bank1Name = (company.banca || '').trim();
    const bank2Name = (company.banca2 || '').trim();

    const needBank2 = Boolean(bank2Name) || String(selectedVal) === '2';

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
    if (CURRENT_EDITING_INVOICE_ID) return;
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
    (window.tempInvoiceLines || []).forEach((l, i) => {
      // Nota: la tabella in index.html ha le colonne:
      // Descrizione | Qtà | Prezzo | IVA | Totale | Del
      // Qui renderizziamo in modo coerente e permettiamo l'editing inline.
      const qty = parseFloat(l.qty) || 0;
      const price = parseFloat(l.price) || 0;
      const ivaVal = l.iva != null && l.iva !== '' ? String(l.iva) : '22';
      const naturaVal = l.esenzioneIva || 'N2.2';
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

      const descHtml = `${(l.tsImport === true) ? '<span class="badge bg-info me-1">TS</span>' : ''}` +
        `${(typeof window.escapeHtml === 'function') ? window.escapeHtml(l.productName || '') : (l.productName || '')}`;

      t.append(`
        <tr>
          <td>${descHtml}</td>
          <td class="text-end" style="width: 90px;">
            <input type="number" step="0.01" class="form-control form-control-sm text-end line-qty" data-i="${i}" value="${qty}">
          </td>
          <td class="text-end" style="width: 120px;">
            <input type="number" step="0.01" class="form-control form-control-sm text-end line-price" data-i="${i}" value="${price}">
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
              <option value="N2.2" ${naturaVal === 'N2.2' ? 'selected' : ''}>N2.2</option>
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

    const sf = typeof safeFloat === 'function' ? safeFloat : (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };

    if (!cust || !comp) {
      $('#invoice-total').text('€ 0.00');
      $('#invoice-tax-details').text('');
      if ($('#invoice-netto').length) $('#invoice-netto').text('€ 0.00');
      if ($('#invoice-iva-breakdown').length) $('#invoice-iva-breakdown').html('');
      return { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, ivaTot: 0, ritenuta: 0, totDoc: 0, nettoDaPagare: 0 };
    }

    const taxRegimeGest = String(comp.taxRegime || '').trim().toLowerCase();
    const isForfettario = (typeof window.isForfettario === 'function') ? window.isForfettario(comp) : (taxRegimeGest === 'forfettario' || String(comp.codiceRegimeFiscale || '').trim().toUpperCase() === 'RF19');
    const aliqIva = isForfettario ? 0 : sf(comp.aliquotaIva || comp.aliquotaIVA || 22);
    const aliqInps = sf(comp.aliquotaInps || comp.aliquotaContributi || 0);
    const aliqRitenuta = sf(comp.aliquotaRitenuta || 20);

    const lines = window.tempInvoiceLines || [];

    // 1) Individuare riga "Rivalsa Bollo", se presente (NON entra in IVA e ritenuta)
    const bolloLines = lines.filter((l) => String(l.productName || '').trim().toLowerCase() === 'rivalsa bollo');
    const impBolloLine = bolloLines.reduce((s, l) => s + sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price)), 0);

    // 2) Linee prestazioni (escludo eventuale riga bollo)
    const baseLines = lines.filter((l) => String(l.productName || '').trim().toLowerCase() !== 'rivalsa bollo');
    // Totale righe (incluse eventuali voci di costo/rimborso)
    const totPrest = baseLines.reduce((s, l) => s + sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price)), 0);

    // Base Rivalsa INPS: escludo le righe marcate come 'Costo' (es. spese viaggio, rimborso km)
    const totPrestRivalsaBase = baseLines
      .filter((l) => !(l.isCosto === true || l.isCosto === 'true'))
      .reduce((s, l) => s + sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price)), 0);

    // 3) Rivalsa INPS (solo su base rivalsa) se attivata sul cliente
    const riv = (cust.rivalsaInps === true || cust.rivalsaInps === 'true') ? totPrestRivalsaBase * (aliqInps / 100) : 0;

    // 4) IVA su righe (aliquota per riga; default aliquota azienda) + IVA sulla rivalsa (didattico: soggetta IVA)
    let ivaTot = 0;
    baseLines.forEach((l) => {
      const imponibile = sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price));
      let ivaPerc = isForfettario ? 0 : sf(l.iva != null ? l.iva : aliqIva);
      if (!ivaPerc && ivaPerc !== 0) ivaPerc = aliqIva;
      if (ivaPerc > 0) ivaTot += imponibile * (ivaPerc / 100);
    });
    if (riv > 0 && aliqIva > 0) ivaTot += riv * (aliqIva / 100);

    // 5) Totale imponibile (prestazioni + rivalsa)
    const totImp = totPrest + riv;

    // 6) Importo bollo:
    // - se l'utente ha inserito la riga "Rivalsa Bollo" uso quel valore
    // - in regime forfettario, se non c'e la riga bollo, lo calcolo automaticamente (2.00) se importo > 77,47
    let impBollo = impBolloLine;
    if (impBollo === 0 && isForfettario) {
      const baseAbs = Math.abs(totImp + ivaTot);
      // Per Nota di Credito (TD04) manteniamo la soglia 77,47
      if (baseAbs > 77.47) impBollo = 2.00;
    }

    // 6) Bollo: in forfettario viene calcolato automaticamente (se > 77,47) anche senza riga "Rivalsa Bollo"
    let impBolloEff = impBollo;
    const baseForBollo = totImp + ivaTot;
    const baseAbsForBollo = Math.abs(baseForBollo);
    const docTypeSel = $('#document-type').val();
    const isNC = docTypeSel === 'Nota di Credito';
    if (impBolloEff === 0 && isForfettario && baseAbsForBollo > 77.47) {
      impBolloEff = 2.00;
      if (isNC && baseAbsForBollo <= 77.47) impBolloEff = 0;
    }

    // 7) Totale documento (imponibile + IVA + bollo)
    const totDoc = baseForBollo + impBolloEff;

    // 7) Ritenuta d'acconto (su prestazioni + rivalsa) se sostituto d'imposta
    const ritenuta = (cust.sostitutoImposta === true || cust.sostitutoImposta === 'true') ? totImp * (aliqRitenuta / 100) : 0;

    // 8) Netto da incassare
    const nettoDaPagare = totDoc - ritenuta;

    // UI
    $('#invoice-total').text(`€ ${totDoc.toFixed(2)}`);
    if ($('#invoice-netto').length) $('#invoice-netto').text(`€ ${nettoDaPagare.toFixed(2)}`);
    $('#invoice-tax-details').text(
      `(Imponibile: € ${totImp.toFixed(2)} - Rivalsa: € ${riv.toFixed(2)} - IVA: € ${ivaTot.toFixed(2)} - Ritenuta: € ${ritenuta.toFixed(2)} - Bollo: € ${impBolloEff.toFixed(2)})`
    );

    // Riepilogo IVA (per aliquota / Natura) nella UI
    if ($('#invoice-iva-breakdown').length) {
      const map = new Map();

      baseLines.forEach((l) => {
        const imponibile = sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price));
        let ivaPerc = isForfettario ? 0 : sf(l.iva != null ? l.iva : aliqIva);
        if (!ivaPerc && ivaPerc !== 0) ivaPerc = aliqIva;

        if (ivaPerc > 0) {
          const label = `IVA ${Math.round(ivaPerc)}%`;
          const g = map.get(label) || { label, imponibile: 0, imposta: 0 };
          g.imponibile += imponibile;
          g.imposta += imponibile * (ivaPerc / 100);
          map.set(label, g);
        } else {
          const nat = isForfettario ? 'N2.2' : (l.esenzioneIva || 'N2.2');
          const label = `IVA 0% (${nat})`;
          const g = map.get(label) || { label, imponibile: 0, imposta: 0 };
          g.imponibile += imponibile;
          map.set(label, g);
        }
      });

      // Rivalsa: in ordinario didattico soggetta IVA a aliquota azienda; in forfettario IVA=0 (N2.2)
      if (isForfettario && riv > 0) {
        const label = `IVA 0% (N2.2)`;
        const g = map.get(label) || { label, imponibile: 0, imposta: 0 };
        g.imponibile += riv;
        map.set(label, g);
      }

      // Rivalsa (didattico: soggetta IVA a aliquota azienda)
      if (riv > 0 && aliqIva > 0) {
        const label = `IVA ${Math.round(aliqIva)}%`;
        const g = map.get(label) || { label, imponibile: 0, imposta: 0 };
        g.imponibile += riv;
        g.imposta += riv * (aliqIva / 100);
        map.set(label, g);
      }

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

    return { totPrest, riv, impBollo: impBolloEff, totImp, ivaTot, ritenuta, totDoc, nettoDaPagare };
  }

  function prepareDocumentForm(type) {
    CURRENT_EDITING_INVOICE_ID = null;

    // reset form e stato
    const _f = $('#new-invoice-form')[0];
    if (_f && typeof _f.reset === 'function') _f.reset();

    // IVA di default: in forfettario sempre 0; in ordinario aliquota azienda (fallback 22)
    const _comp = getData('companyInfo') || {};
    const _isForf = String(_comp.taxRegime || '').toLowerCase() === 'forfettario';
    const _ivaDef = _isForf ? '0' : (_comp.aliquotaIva != null ? String(_comp.aliquotaIva) : '22');
    const _ivaField = $('#invoice-product-iva');
    _ivaField.val(_ivaDef);
    _ivaField.prop('disabled', _isForf ? true : _ivaField.prop('disabled'));
    if (typeof window.toggleEsenzioneIvaField === 'function') {
      window.toggleEsenzioneIvaField('invoice', $('#invoice-product-iva').val());
    }

    $('#invoice-id').val('Nuovo');
    $('#document-type').val(type);

    // righe fattura
    $('#invoice-lines-tbody').empty();
    window.tempInvoiceLines = [];

    // reset import timesheet state (step 2)
    if (window.App && window.App.invoices) window.App.invoices.timesheetImportState = null;

    if (typeof populateDropdowns === 'function') populateDropdowns();

    // data documento = oggi
    const today = new Date().toISOString().slice(0, 10);
    $('#invoice-date').val(today);

    // DEFAULT PAGAMENTO
    $('#invoice-condizioniPagamento').val('Pagamento Completo');
    $('#invoice-modalitaPagamento').val('Bonifico Bancario');

    // Termini pagamento avanzati (fine mese / giorno fisso)
    if ($('#invoice-fineMese').length) $('#invoice-fineMese').prop('checked', false);
    if ($('#invoice-giornoFissoEnabled').length) $('#invoice-giornoFissoEnabled').prop('checked', false);
    if ($('#invoice-giornoFissoValue').length) {
      $('#invoice-giornoFissoValue').val('');
      $('#invoice-giornoFissoValue').prop('disabled', true);
    }

    // Default banca (solo Bonifico)
    if ($('#invoice-bank-select').length) {
      populateInvoiceBankSelect('1');
      $('#invoice-bank-select').val('1');
    }
    updatePaymentUI();

    // DEFAULT DATE PAGAMENTO
    $('#invoice-dataRiferimento').val(today);
    $('#invoice-giorniTermini').val(30);
    recalcInvoiceDueDate();

    // Tipo documento / titolo
    if (type === 'Nota di Credito') {
      $('#document-title').text('Nuova Nota di Credito');
      $('#credit-note-fields').removeClass('d-none');
    } else {
      $('#document-title').text('Nuova Fattura');
      $('#credit-note-fields').addClass('d-none');
    }

    // Numero fattura e totali
    updateInvoiceNumber(type, today.substring(0, 4));
    updateTotalsDisplay();
  }

  function loadInvoiceForEditing(id, isCopy) {
    const inv = getData('invoices').find((i) => String(i.id) === String(id));
    if (!inv) return;

    _isLoadingInvoice = true;

    const type = isCopy ? 'Fattura' : inv.type || 'Fattura';
    prepareDocumentForm(type);

    if (!isCopy) {
      CURRENT_EDITING_INVOICE_ID = String(inv.id);
      $('#invoice-id').val(inv.id);
      $('#document-title').text(`Modifica ${type} ${inv.number}`);
    }

    $('#invoice-customer-select').val(inv.customerId);
    $('#invoice-date').val(isCopy ? new Date().toISOString().slice(0, 10) : inv.date);
    if (!isCopy) $('#invoice-number').val(inv.number);
    // Bozza (draft)
    try {
      const wasDraft = (!isCopy) && (inv.isDraft === true || String(inv.status || '') === 'Bozza');
      if ($('#invoice-isDraft').length) $('#invoice-isDraft').prop('checked', wasDraft);
    } catch (e) {}


    $('#invoice-condizioniPagamento').val(inv.condizioniPagamento);
    // Normalizzazione legacy: "Rimessa Diretta" non è più prevista come opzione UI.
    // Se presente su documenti storici, la trattiamo come Bonifico Bancario.
    const rawMetodo = inv.modalitaPagamento || 'Bonifico Bancario';
    const metodoNorm = String(rawMetodo).trim().toLowerCase() === 'rimessa diretta' ? 'Bonifico Bancario' : rawMetodo;
    $('#invoice-modalitaPagamento').val(metodoNorm);

    // Dati pagamento avanzati (step 2)
    const today = new Date().toISOString().slice(0, 10);
    $('#invoice-dataRiferimento').val(inv.dataRiferimento || inv.date || today);
    if (inv.giorniTermini != null && String(inv.giorniTermini) !== '') {
      $('#invoice-giorniTermini').val(inv.giorniTermini);
    }

    // Termini aggiuntivi: fine mese / giorno fisso
    if ($('#invoice-fineMese').length) $('#invoice-fineMese').prop('checked', !!inv.fineMese);
    if ($('#invoice-giornoFissoEnabled').length) $('#invoice-giornoFissoEnabled').prop('checked', !!inv.giornoFissoEnabled);
    if ($('#invoice-giornoFissoValue').length) {
      if (inv.giornoFissoValue != null && String(inv.giornoFissoValue) !== '') {
        $('#invoice-giornoFissoValue').val(inv.giornoFissoValue);
      } else {
        $('#invoice-giornoFissoValue').val('');
      }
    }

    if ($('#invoice-bank-select').length) {
      populateInvoiceBankSelect(String(inv.bankChoice || '1'));
      $('#invoice-bank-select').val(String(inv.bankChoice || '1'));
    }

    $('#invoice-dataScadenza').val(inv.dataScadenza);
    updatePaymentUI();

    if (type === 'Nota di Credito') {
      $('#linked-invoice').val(inv.linkedInvoice);
      $('#reason').val(inv.reason);
    }

    window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines || []));

    // ripristina metadati import timesheet (se presenti)
    if (window.App && window.App.invoices) {
      window.App.invoices.timesheetImportState = (isCopy ? null : (inv.timesheetImport || null));
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
    window.App.invoices.getCurrentInvoiceId = function () { return CURRENT_EDITING_INVOICE_ID; };

    // Aggiungi riga
    $('#add-product-to-invoice-btn').click(() => {
      const d = $('#invoice-product-description').val();
      if (!d) return;

      const qty = parseFloat($('#invoice-product-qty').val()) || 1;
      const price = parseFloat($('#invoice-product-price').val()) || 0;

      // Classificazione rivalsa INPS: se il servizio è marcato come 'Costo' non entra nella base rivalsa
      const selectedId = $('#invoice-product-select').val();
      let isCosto = false;
      if (selectedId && selectedId !== 'manual') {
        const pr = (getData('products') || []).find((p) => String(p.id) === String(selectedId));
        isCosto = pr ? (pr.isCosto === true || pr.isCosto === 'true') : false;
      }

      window.tempInvoiceLines.push({
        productName: d,
        qty: qty,
        price: price,
        subtotal: qty * price,
        iva: $('#invoice-product-iva').val(),
        esenzioneIva: $('#invoice-product-esenzioneIva').val(),
        isLavoro: !isCosto,
        isCosto: isCosto
      });

      renderLocalInvoiceLines();
      updateTotalsDisplay();
    });

    // Editing inline righe fattura
    $('#invoice-lines-tbody').on('change', '.line-qty, .line-price, .line-iva, .line-natura', function () {
      const idx = parseInt($(this).attr('data-i'), 10);
      if (isNaN(idx) || !window.tempInvoiceLines || !window.tempInvoiceLines[idx]) return;

      const row = $(this).closest('tr');
      const qty = parseFloat(row.find('.line-qty').val()) || 0;
      const price = parseFloat(row.find('.line-price').val()) || 0;
      let iva = String(row.find('.line-iva').val() || '');

      // Riga speciale: "Rivalsa Bollo" (forzo IVA = 0 nel modello didattico)
      const isBollo = String(window.tempInvoiceLines[idx].productName || '').trim().toLowerCase() === 'rivalsa bollo';
      if (isBollo) {
        iva = '0';
        row.find('.line-iva').val('0');
      }

      // Natura solo se IVA = 0 (ma non per la riga Bollo)
      let natura = '';
      if (iva === '0' && !isBollo) {
        row.find('.line-natura').removeClass('d-none');
        natura = String(row.find('.line-natura').val() || 'N2.2');
      } else {
        row.find('.line-natura').addClass('d-none');
        natura = '';
      }

      window.tempInvoiceLines[idx].qty = qty;
      window.tempInvoiceLines[idx].price = price;
      window.tempInvoiceLines[idx].iva = iva;
      window.tempInvoiceLines[idx].esenzioneIva = natura;
      window.tempInvoiceLines[idx].subtotal = qty * price;

      // Re-render per aggiornare Totale riga e mantenere coerenza colonne
      renderLocalInvoiceLines();
      updateTotalsDisplay();
    });

    // FIX BUG: handler del-line (nel file originale era corrotto)
    $('#invoice-lines-tbody').on('click', '.del-line', function () {
      const idx = parseInt($(this).data('i'), 10);
      if (isNaN(idx)) return;
      window.tempInvoiceLines.splice(idx, 1);
      renderLocalInvoiceLines();
      updateTotalsDisplay();
    });

    // Cambio cliente: aggiorno totali e precompilo (se presenti) i termini pagamento da anagrafica
    $('#invoice-customer-select').on('change', function () {
      if (_isLoadingInvoice) {
        updateTotalsDisplay();
        return;
      }

      const cid = $(this).val();
      const cust = (getData('customers') || []).find((c) => String(c.id) === String(cid));
      if (cust) {
        applyCustomerPaymentDefaults(cust);
      }

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
      const isForf = String(ci.taxRegime || '').toLowerCase() === 'forfettario';

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
      const cid = $('#invoice-customer-select').val();
      if (!cid || (window.tempInvoiceLines || []).length === 0) {
        alert('Dati incompleti.');
        return;
      }

      const type = $('#document-type').val();
      const calcs = updateTotalsDisplay();

      const data = {
        number: $('#invoice-number').val(),
        date: $('#invoice-date').val(),
        customerId: cid,
        type: type,
        lines: window.tempInvoiceLines,
        totalePrestazioni: calcs.totPrest,
        importoBollo: calcs.impBollo,
        rivalsa: { importo: calcs.riv },
        totaleImponibile: calcs.totImp,
        total: calcs.totDoc,
        ivaTotale: calcs.ivaTot,
        ritenutaAcconto: calcs.ritenuta,
        nettoDaPagare: calcs.nettoDaPagare,
        status: type === 'Fattura' ? 'Da Incassare' : 'Emessa',
        dataScadenza: $('#invoice-dataScadenza').val(),
        dataRiferimento: $('#invoice-dataRiferimento').val(),
        giorniTermini: ($('#invoice-modalitaPagamento').val() === 'Bonifico Bancario') ? (parseInt($('#invoice-giorniTermini').val(), 10) || 0) : null,
        bankChoice: ($('#invoice-modalitaPagamento').val() === 'Bonifico Bancario') ? ($('#invoice-bank-select').val() || '1') : null,
        fineMese: ($('#invoice-modalitaPagamento').val() === 'Bonifico Bancario') ? ($('#invoice-fineMese').length ? $('#invoice-fineMese').is(':checked') : false) : null,
        giornoFissoEnabled: ($('#invoice-modalitaPagamento').val() === 'Bonifico Bancario') ? ($('#invoice-giornoFissoEnabled').length ? $('#invoice-giornoFissoEnabled').is(':checked') : false) : null,
        giornoFissoValue: (($('#invoice-modalitaPagamento').val() === 'Bonifico Bancario') && ($('#invoice-giornoFissoEnabled').length ? $('#invoice-giornoFissoEnabled').is(':checked') : false)) ? (parseInt($('#invoice-giornoFissoValue').val(), 10) || null) : null,
        condizioniPagamento: $('#invoice-condizioniPagamento').val(),
        modalitaPagamento: $('#invoice-modalitaPagamento').val(),
        linkedInvoice: $('#linked-invoice').val(),
        reason: $('#reason').val()
      ,
        // Step 2: metadati import ore (se presenti)
        timesheetImport: (window.App && window.App.invoices) ? (window.App.invoices.timesheetImportState || null) : null
      };

      // Bozza (draft): visibile in elenco, ma non esportabile XML e non marcabile Inviata/Pagata
      const _isDraft = $('#invoice-isDraft').length ? $('#invoice-isDraft').is(':checked') : false;
      data.isDraft = _isDraft;

      let _old = null;
      let _oldWasDraft = false;

      if (CURRENT_EDITING_INVOICE_ID) {
        _old = getData('invoices').find((i) => String(i.id) === String(CURRENT_EDITING_INVOICE_ID));
        _oldWasDraft = !!(_old && (_old.isDraft === true || String(_old.status || '') === 'Bozza'));
      }

      if (_isDraft) {
        data.status = 'Bozza';
        data.sentToAgenzia = false;
      } else {
        // Se stiamo modificando: mantengo lo stato precedente (tranne uscita da bozza)
        if (_oldWasDraft) {
          // Uscita da bozza: ripristino stato standard
          data.status = (type === 'Fattura') ? 'Da Incassare' : 'Emessa';
          data.sentToAgenzia = false;
        } else if (_old) {
          data.status = _old.status;
        }
      }

// Controllo duplicati "soft" (non blocca: chiede conferma prima di salvare)
if (!data.isDraft) {
try {
  const num = String(data.number || '').trim();
  const dateStr = String(data.date || '');
  const year = (dateStr && dateStr.length >= 4) ? dateStr.substring(0, 4) : '';

  if (num && year) {
    const existing = (getData('invoices') || []).filter((x) => {
      if (!x) return false;
      if (CURRENT_EDITING_INVOICE_ID && String(x.id) === String(CURRENT_EDITING_INVOICE_ID)) return false;
      if (x.isDraft === true || String(x.status || '') === 'Bozza') return false;

      const xNum = String(x.number || '').trim();
      const xYear = x.date ? String(x.date).substring(0, 4) : '';

      return (
        String(x.customerId || '') === String(data.customerId || '') &&
        String(x.type || '') === String(data.type || '') &&
        xNum.toLowerCase() === num.toLowerCase() &&
        xYear === year
      );
    });

    if (existing.length) {
      const cust = (getData('customers') || []).find((c) => String(c.id) === String(data.customerId)) || {};
      const label = cust.name || cust.ragioneSociale || 'Cliente';
      const msg = `Possibile duplicato: esiste già un ${data.type} n. ${num} (${year}) per ${label} (${existing.length} record).\n\nVuoi salvare comunque?`;
      if (typeof confirm === 'function' && !confirm(msg)) return;
    }
  }
} catch (e) {
  console.warn('Duplicate check invoices:', e);
}


}


      let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices')));
      await saveDataToCloud('invoices', data, id);

      // Bozza: se sto passando da documento "reale" a bozza, sblocco eventuali worklog collegati
      try {
        if (data.isDraft && CURRENT_EDITING_INVOICE_ID && !_oldWasDraft) {
          await unmarkWorklogsFromInvoice(id);
        }
      } catch (e) {
        console.warn('Errore sblocco worklog (bozza):', e);
      }


      // Step 2: se la fattura deriva da import timesheet, marca i worklog come fatturati
      if (!data.isDraft) {
      try {
        const hasImportedLines = (window.tempInvoiceLines || []).some((l) => l && l.tsImport === true);
        const ids = (data.timesheetImport && Array.isArray(data.timesheetImport.worklogIds))
          ? data.timesheetImport.worklogIds
          : extractImportedWorklogIds(window.tempInvoiceLines || []);

        if (hasImportedLines && ids && ids.length) {
          await markWorklogsAsInvoiced(ids, id, data.number);
        }
      } catch (e) {
        console.error('Errore collegamento timesheet->fattura:', e);
      }
      }
      alert('Salvato!');
      $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });
  }

  window.AppModules.invoicesForm.bind = bind;
})();
