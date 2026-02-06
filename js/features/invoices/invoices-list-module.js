// js/features/invoices/invoices-list-module.js
// Azioni su elenco documenti + view dettaglio

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.invoicesList = window.AppModules.invoicesList || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function () {
      const id = $(this).attr('data-id');
      const inv = getData('invoices').find((i) => String(i.id) === String(id));
      if (!inv) return;

      if (inv.status === 'Pagata') {
        alert('Non e possibile modificare una fattura gia pagata.');
        return;
      }
      if (inv.sentToAgenzia === true) {
        alert("Non e possibile modificare una fattura marcata come inviata all'Agenzia delle Entrate.");
        return;
      }

      $('.sidebar .nav-link').removeClass('active');
      $('.sidebar .nav-link[data-target="nuova-fattura-accompagnatoria"]').addClass('active');
      $('.content-section').addClass('d-none');
      $('#nuova-fattura-accompagnatoria').removeClass('d-none');
      if (typeof window.loadInvoiceForEditing === 'function') window.loadInvoiceForEditing(id, false);
    });

    $('#invoices-table-body').on('click', '.btn-delete-invoice', function () {
      const id = $(this).attr('data-id');
      const inv = getData('invoices').find((i) => String(i.id) === String(id));
      if (!inv) return;

      if (inv.status === 'Pagata') {
        alert('Non e possibile cancellare una fattura pagata.');
        return;
      }
      if (inv.sentToAgenzia === true) {
        alert("Non e possibile cancellare una fattura marcata come inviata all'Agenzia delle Entrate.");
        return;
      }

      // Step 2: avviso se ci sono worklog collegati
      if (inv.timesheetImport && Array.isArray(inv.timesheetImport.worklogIds) && inv.timesheetImport.worklogIds.length) {
        const n = inv.timesheetImport.worklogIds.length;
        const msg = 'Attenzione: questa fattura risulta collegata a ' + n + ' worklog del Timesheet.\n\nEliminandola, i worklog NON verranno sbloccati automaticamente.\nVuoi continuare comunque?';
        if (!confirm(msg)) return;
      }

      deleteDataFromCloud('invoices', id);
    });

    $('#invoices-table-body').on('click', '.btn-mark-paid', async function () {
      const id = $(this).attr('data-id');
      const inv = getData('invoices').find((i) => String(i.id) === String(id));
      if (!inv) return;

      // Bozza: non puo essere marcata come Pagata/Inviata o esportata XML
      if (inv.isDraft === true || String(inv.status || '') === 'Bozza') {
        alert('Questo documento è in BOZZA. Finalizzalo prima di marcarlo come Pagato/Inviato o esportare XML.');
        return;
      }

      // Le note di credito non hanno lo stato "Pagata"
      if (inv.type === 'Nota di Credito') {
        alert("Le note di credito non possono essere marcate come 'Pagata'.");
        return;
      }

      if (inv.status === 'Pagata') return;

      const msg =
        "Sei sicuro? Una volta marcata come PAGATA, la fattura non potra piu essere modificata.\n\nLo stato 'Inviata' (se presente) non viene modificato.";
      if (!confirm(msg)) return;

      await saveDataToCloud('invoices', { status: 'Pagata' }, id);
      if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    });

    // Flag "Inviata ad ADE": blocca modifica/cancellazione
    $('#invoices-table-body').on('click', '.btn-mark-sent', async function () {
      const id = $(this).attr('data-id');
      const inv = getData('invoices').find((i) => String(i.id) === String(id));
      if (!inv) return;

      if (inv.isDraft === true || String(inv.status || '') === 'Bozza') {
        alert('Questo documento è in BOZZA. Finalizzalo prima di marcarlo come Inviato.');
        return;
      }

      if (inv.sentToAgenzia === true) {
        alert(
          "Questo documento e gia marcato come inviato all'Agenzia delle Entrate. L'operazione e irreversibile."
        );
        return;
      }

      const msg =
        "Sei sicuro? Una volta inviata la fattura/nota di credito non potra piu essere modificata o eliminata.";
      if (!confirm(msg)) return;

      await saveDataToCloud('invoices', { sentToAgenzia: true }, id);
      if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    });

    // VIEW (Dettaglio Fattura)
    $('#invoices-table-body').on('click', '.btn-view-invoice', function () {
      const id = $(this).attr('data-id');
      const inv = getData('invoices').find((i) => String(i.id) === String(id));
      if (!inv) return;

      const company = getData('companyInfo') || {};
      const customer = getData('customers').find((x) => String(x.id) === String(inv.customerId)) || {};

      // Regime fiscale: in Forfettario non esiste IVA (N2.2). In ordinario il dettaglio IVA resta visibile.
      // IMPORTANT:
      // In FatturaPA many "RegimeFiscale" codes start with "RF" (including Ordinario RF01).
      // Therefore, NEVER infer "forfettario" from the RF* prefix.
      // We rely on the gestionale field `taxRegime`; for backward compatibility,
      // when it is missing we infer forfettario only if the codice is exactly RF19.
      const taxRegimeGest = String(company.taxRegime || '').trim().toLowerCase();
      const isForfettario =
        (typeof window.isForfettario === 'function')
          ? window.isForfettario(company)
          : (taxRegimeGest === 'forfettario' ||
            (!taxRegimeGest && String(company.codiceRegimeFiscale || '').trim().toUpperCase() === 'RF19'));
const showVatSection = !isForfettario;

      // Imposta il pulsante XML sul documento corrente
      $('#export-xml-btn').data('invoiceId', inv.id);
      const _isDraft = (inv.isDraft === true || String(inv.status || '') === 'Bozza');
      $('#export-xml-btn').prop('disabled', _isDraft);
      $('#invoiceDetailModalTitle').text(`${inv.type} ${inv.number}${_isDraft ? ' (BOZZA)' : ''}`);

      const sf = typeof safeFloat === 'function'
        ? safeFloat
        : (v) => {
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
          };

      const linesAll = inv.lines || [];
      const bolloLines = linesAll.filter(
        (l) => String(l.productName || '').trim().toLowerCase() === 'rivalsa bollo'
      );
      const impBolloLine = bolloLines.reduce(
        (s, l) => s + sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price)),
        0
      );

      const baseLines = linesAll.filter(
        (l) => String(l.productName || '').trim().toLowerCase() !== 'rivalsa bollo'
      );
      const totPrest = baseLines.reduce(
        (s, l) => s + sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price)),
        0
      );

      const aliqIva = isForfettario ? 0 : sf(company.aliquotaIva || company.aliquotaIVA || 22);
      const aliquotaInps = sf(company.aliquotaInps || company.aliquotaContributi || 0);
      const aliqRitenuta = sf(company.aliquotaRitenuta || 20);

      const hasRivInpsFlag = !!(customer && customer.rivalsaInps);
      const rivInps = hasRivInpsFlag ? totPrest * (aliquotaInps / 100) : 0;
      const totImponibile = totPrest + rivInps;

      // IVA totale e riepilogo per aliquota/Natura
      let ivaTot = 0;
      const vatMap = new Map();

      baseLines.forEach((l) => {
        const imponibile = sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price));

        // In forfettario: IVA sempre 0 e Natura N2.2
        if (isForfettario) {
          const nat = 'N2.2';
          const label = `IVA 0% (${nat})`;
          const g = vatMap.get(label) || { label, imponibile: 0, imposta: 0 };
          g.imponibile += imponibile;
          vatMap.set(label, g);
          return;
        }

        let ivaPerc = l.iva === 0 || l.iva === '0' ? 0 : sf(l.iva != null ? l.iva : aliqIva);
        if (!ivaPerc && ivaPerc !== 0) ivaPerc = aliqIva;

        if (ivaPerc > 0) {
          const imposta = imponibile * (ivaPerc / 100);
          ivaTot += imposta;
          const label = `IVA ${ivaPerc.toFixed(0)}%`;
          const g = vatMap.get(label) || { label, imponibile: 0, imposta: 0 };
          g.imponibile += imponibile;
          g.imposta += imposta;
          vatMap.set(label, g);
        } else {
          const nat = l.esenzioneIva || 'N2.2';
          const label = `IVA 0% (${nat})`;
          const g = vatMap.get(label) || { label, imponibile: 0, imposta: 0 };
          g.imponibile += imponibile;
          vatMap.set(label, g);
        }
      });

      // Rivalsa INPS: in ordinario qui era soggetta IVA (didattico). In forfettario NON si applica IVA.
      if (!isForfettario && rivInps > 0 && aliqIva > 0) {
        const imposta = rivInps * (aliqIva / 100);
        ivaTot += imposta;
        const label = `IVA ${aliqIva.toFixed(0)}%`;
        const g = vatMap.get(label) || { label, imponibile: 0, imposta: 0 };
        g.imponibile += rivInps;
        g.imposta += imposta;
        vatMap.set(label, g);
      }

      // Importo bollo:
      // - se presente riga "Rivalsa Bollo" uso quel valore
      // - in regime forfettario, se non c'e la riga bollo, lo calcolo automaticamente (2.00) se importo > 77,47
      let impBollo = impBolloLine;
      if (impBollo === 0 && isForfettario) {
        const baseAbs = Math.abs(totImponibile + ivaTot);
        if (baseAbs > 77.47) impBollo = 2.00;
      }

      let impBolloEff = impBollo;
      const baseForBollo = totImponibile + ivaTot;
      const baseAbsForBollo = Math.abs(baseForBollo);
      if (impBolloEff === 0 && isForfettario && baseAbsForBollo > 77.47) {
        impBolloEff = 2.00;
        if (inv.type === 'Nota di Credito' && baseAbsForBollo <= 77.47) impBolloEff = 0;
      }

      const totDocumento = baseForBollo + impBolloEff;

      // Ritenuta d'acconto (su imponibile + rivalsa) se cliente sostituto d'imposta
      const ritenuta =
        customer.sostitutoImposta === true || customer.sostitutoImposta === 'true'
          ? totImponibile * (aliqRitenuta / 100)
          : 0;

      const nettoDaPagare = totDocumento - ritenuta;

      const hasRivInps = hasRivInpsFlag && rivInps > 0;
      const hasBollo = impBolloEff > 0;
      const hasIva = ivaTot > 0;
      const hasRitenuta = ritenuta > 0;

      let h = '';

      // --- HEADER: CEDENTE / CESSIONARIO ---
      h += `
        <div class="row mb-3">
          <div class="col-6">
            <h5 class="mb-1">Cedente / Prestatore</h5>
            <div><strong>${escapeXML(company.name || '')}</strong></div>
            ${company.piva ? `<div>P.IVA: ${escapeXML(company.piva)}</div>` : ''}
            ${company.codiceFiscale ? `<div>C.F.: ${escapeXML(company.codiceFiscale)}</div>` : ''}
            ${company.address ? `<div>${escapeXML(company.address)}${company.numeroCivico ? ', ' + escapeXML(company.numeroCivico) : ''}</div>` : ''}
            ${(company.zip || company.city || company.province) ? `<div>${escapeXML(company.zip || '')} ${escapeXML(company.city || '')} ${escapeXML(company.province || '')}</div>` : ''}
          </div>
          <div class="col-6 text-end">
            <h5 class="mb-1">Cessionario / Committente</h5>
            <div><strong>${escapeXML(customer.name || '')}</strong></div>
            ${customer.piva ? `<div>P.IVA: ${escapeXML(customer.piva)}</div>` : ''}
            ${customer.codiceFiscale ? `<div>C.F.: ${escapeXML(customer.codiceFiscale)}</div>` : ''}
            ${customer.address ? `<div>${escapeXML(customer.address)}</div>` : ''}
            ${(customer.cap || customer.comune || customer.provincia) ? `<div>${escapeXML(customer.cap || '')} ${escapeXML(customer.comune || '')} ${escapeXML(customer.provincia || '')}</div>` : ''}
          </div>
        </div>
      `;

      // --- DATI DOCUMENTO ---
      h += `
        <div class="row mb-3">
          <div class="col-6">
            <div><strong>Numero:</strong> ${escapeXML(inv.number || '')}</div>
            <div><strong>Data:</strong> ${formatDateForDisplay(inv.date)}</div>
          </div>
          <div class="col-6 text-end">
            <div><strong>Tipo documento:</strong> ${inv.type || 'Fattura'}</div>
          </div>
        </div>
      `;

      // --- DETTAGLIO RIGHE ---
      h += `
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th class="text-end">Q.tà</th>
              <th class="text-end">Prezzo</th>
              ${showVatSection ? '<th class="text-end">IVA</th>' : ''}
              <th class="text-end">Totale</th>
            </tr>
          </thead>
          <tbody>
      `;

      (inv.lines || []).forEach((l) => {
        const qty = typeof l.qty === 'number' ? l.qty : parseFloat(l.qty || 0) || 0;
        const price = typeof l.price === 'number' ? l.price : parseFloat(l.price || 0) || 0;
        const subtotal = typeof l.subtotal === 'number' ? l.subtotal : parseFloat(l.subtotal || 0) || qty * price;

        const isBollo = String(l.productName || '').trim().toLowerCase() === 'rivalsa bollo';

        let ivaPerc = 0;
        if (!isForfettario) {
          const ivaDefault = parseFloat(company.aliquotaIva || company.aliquotaIVA || 22) || 22;
          ivaPerc = l.iva === 0 || l.iva === '0' ? 0 : parseFloat(l.iva);
          if (isNaN(ivaPerc)) ivaPerc = ivaDefault;
          if (isBollo) ivaPerc = 0;
        }

        const ivaLabel = isBollo ? 'Bollo' : ivaPerc > 0 ? `${ivaPerc.toFixed(0)}%` : `0% (${escapeXML(l.esenzioneIva || 'N2.2')})`;
        const ivaAmt = ivaPerc > 0 ? subtotal * (ivaPerc / 100) : 0;
        const lineTotal = subtotal + ivaAmt;

        h += `
          <tr>
            <td>${escapeXML(l.productName || '')}</td>
            <td class="text-end">${qty.toFixed(2)}</td>
            <td class="text-end">€ ${price.toFixed(2)}</td>
            ${showVatSection ? `<td class="text-end">${ivaLabel}</td>` : ''}
            <td class="text-end">€ ${lineTotal.toFixed(2)}</td>
          </tr>
        `;
      });

      h += `
          </tbody>
        </table>
      `;

      const vatRows = Array.from(vatMap.values())
        .map(
          (g) => `
            <tr>
              <td>${escapeXML(g.label)}</td>
              <td class="text-end">€ ${g.imponibile.toFixed(2)}</td>
              <td class="text-end">€ ${(g.imposta || 0).toFixed(2)}</td>
            </tr>
          `
        )
        .join('');

      h += `
        <div class="row justify-content-end">
          <div class="col-md-5">
            <table class="table table-sm mb-0">
              <tbody>
                <tr><th>Totale Prestazioni</th><td class="text-end">€ ${totPrest.toFixed(2)}</td></tr>
                ${hasRivInps ? `<tr><th>Rivalsa INPS</th><td class="text-end">€ ${rivInps.toFixed(2)}</td></tr>` : ''}
                <tr><th>Totale Imponibile</th><td class="text-end">€ ${totImponibile.toFixed(2)}</td></tr>
                ${showVatSection && hasIva ? `<tr><th>IVA</th><td class="text-end">€ ${ivaTot.toFixed(2)}</td></tr>` : ''}
                ${hasBollo ? `<tr><th>Marca da bollo</th><td class="text-end">€ ${impBolloEff.toFixed(2)}</td></tr>` : ''}
                <tr class="table-light fw-bold"><th>Totale Documento</th><td class="text-end">€ ${totDocumento.toFixed(2)}</td></tr>
                ${hasRitenuta ? `<tr><th>Ritenuta d'acconto</th><td class="text-end">€ ${ritenuta.toFixed(2)}</td></tr><tr class="fw-bold"><th>Netto da incassare</th><td class="text-end">€ ${nettoDaPagare.toFixed(2)}</td></tr>` : ''}
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
            <tbody>
              ${vatRows || `<tr><td colspan="3" class="text-muted">Nessun riepilogo IVA disponibile</td></tr>`}
            </tbody>
          </table>
        </div>
        ` : ''}
      `;

      // --- FOOTER: TESTO FISCALE + DATI PAGAMENTO ---
      const condizioni = inv.condizioniPagamento || '';
      const modalita = inv.modalitaPagamento || '';
      const scadenza = inv.dataScadenza ? formatDateForDisplay(inv.dataScadenza) : '';

      const isBonifico = /bonifico/i.test(String(modalita || ''));
      const bankChoice = String(inv.bankChoice || '1');

      let banca = '';
      let iban = '';
      if (isBonifico) {
        const banca1 = company.banca1 || company.banca || '';
        const iban1 = company.iban1 || company.iban || '';
        const banca2 = company.banca2 || '';
        const iban2 = company.iban2 || '';

        if (bankChoice === '2' && (banca2 || iban2)) {
          banca = banca2;
          iban = iban2;
        } else {
          banca = banca1;
          iban = iban1;
        }
      }

      const fiscalBits = [];
      if (isForfettario) {
        fiscalBits.push('Regime forfettario: operazione non soggetta ad IVA (N2.2).');
      } else {
        fiscalBits.push(
          hasIva
            ? `Operazione soggetta a IVA (${aliqIva.toFixed(2)}%).`
            : 'Operazione senza addebito IVA (verificare natura IVA).'
        );
      }
      if (hasRivInps) fiscalBits.push(`Rivalsa INPS applicata (${aliquotaInps.toFixed(2)}%).`);
      if (hasRitenuta)
        fiscalBits.push(
          `Ritenuta d'acconto applicata (${aliqRitenuta.toFixed(2)}%) perche il cliente e sostituto d'imposta.`
        );
      const fiscalText = fiscalBits.join(' ');

      h += `
        ${fiscalText ? `<div class="mt-3 small"><p>${escapeXML(fiscalText)}</p></div>` : ''}
        <div class="mt-2">
          <h6>Dati di pagamento</h6>
          <table class="table table-sm mb-0">
            <tbody>
              <tr><th>Netto da incassare</th><td>€ ${nettoDaPagare.toFixed(2)}</td></tr>
              <tr><th>Condizioni</th><td>${escapeXML(condizioni)}</td></tr>
              <tr><th>Modalita</th><td>${escapeXML(modalita)}</td></tr>
              <tr><th>Scadenza</th><td>${scadenza}</td></tr>
              ${isBonifico ? `<tr><th>Banca</th><td>${escapeXML(banca)}</td></tr><tr><th>IBAN</th><td>${escapeXML(iban)}</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      `;

      $('#invoiceDetailModalBody').html(h);

      // apertura sicura della modale
      const modalEl = document.getElementById('invoiceDetailModal');
      if (modalEl && window.bootstrap && bootstrap.Modal) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.show();
      }
    });
    $('#print-invoice-btn').click(() => window.print());
  }

  window.AppModules.invoicesList.bind = bind;
})();
