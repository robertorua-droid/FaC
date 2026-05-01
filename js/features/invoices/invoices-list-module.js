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
      const invRaw = getData('invoices').find((i) => String(i.id) === String(id));
      const inv = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceStatusInfo === 'function') ? window.DomainNormalizers.normalizeInvoiceStatusInfo(invRaw) : invRaw;
      if (!inv) return;

      if (inv.isPaid === true || inv.status === 'Pagata') {
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

    $('#invoices-table-body').on('click', '.btn-delete-invoice', async function () {
      const id = $(this).attr('data-id');
      const invRaw = getData('invoices').find((i) => String(i.id) === String(id));
      const inv = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceStatusInfo === 'function') ? window.DomainNormalizers.normalizeInvoiceStatusInfo(invRaw) : invRaw;
      if (!inv) return;

      if (inv.isPaid === true || inv.status === 'Pagata') {
        alert('Non e possibile cancellare una fattura pagata.');
        return;
      }
      if (inv.sentToAgenzia === true) {
        alert("Non e possibile cancellare una fattura marcata come inviata all'Agenzia delle Entrate.");
        return;
      }

      // Step 2: avviso se ci sono worklog collegati e sblocco automatico
      if (inv.timesheetImport && Array.isArray(inv.timesheetImport.worklogIds) && inv.timesheetImport.worklogIds.length) {
        const n = inv.timesheetImport.worklogIds.length;
        const msg = `Attenzione: questa fattura risulta collegata a ${n} record del Timesheet.\n\nEliminandola, i record verranno sbloccati per essere fatturati nuovamente.\nVuoi continuare?`;
        if (!confirm(msg)) return;

        try {
          if (window.InvoicePersistenceService && typeof window.InvoicePersistenceService.unmarkWorklogsFromInvoice === 'function') {
            await window.InvoicePersistenceService.unmarkWorklogsFromInvoice(id);
          }
        } catch (e) {
          console.error('Errore sblocco worklog durante eliminazione:', e);
        }
      }

if (window.deleteDataFromCloud) {
        window.deleteDataFromCloud('invoices', id, { skipRender: true }).then(() => {
          if (window.UiRefresh && typeof window.UiRefresh.refreshInvoicesAnalysisAndScadenziario === 'function') {
            window.UiRefresh.refreshInvoicesAnalysisAndScadenziario();
          } else if (window.UiRefresh && typeof window.UiRefresh.refreshInvoicesAndAnalysis === 'function') {
            window.UiRefresh.refreshInvoicesAndAnalysis();
          } else if (typeof renderInvoicesTable === 'function') {
            renderInvoicesTable();
          } else {
            if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
            if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
            if (typeof renderHomePage === 'function') renderHomePage();
          }
        });
      } else {
        deleteDataFromCloud('invoices', id);
      }
    });

    $('#invoices-table-body').on('click', '.btn-mark-paid', async function () {
      const id = $(this).attr('data-id');
      const invRaw = getData('invoices').find((i) => String(i.id) === String(id));
      const inv = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceStatusInfo === 'function') ? window.DomainNormalizers.normalizeInvoiceStatusInfo(invRaw) : invRaw;
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
      if (window.UiRefresh && typeof window.UiRefresh.refreshInvoicesAnalysisAndScadenziario === 'function') {
        window.UiRefresh.refreshInvoicesAnalysisAndScadenziario();
      } else if (window.UiRefresh && typeof window.UiRefresh.refreshInvoicesAndAnalysis === 'function') {
        window.UiRefresh.refreshInvoicesAndAnalysis();
      } else if (typeof renderInvoicesTable === 'function') {
        renderInvoicesTable();
      }
    });

    // Flag "Inviata ad ADE": blocca modifica/cancellazione
    $('#invoices-table-body').on('click', '.btn-mark-sent', async function () {
      const id = $(this).attr('data-id');
      const invRaw = getData('invoices').find((i) => String(i.id) === String(id));
      const inv = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceStatusInfo === 'function') ? window.DomainNormalizers.normalizeInvoiceStatusInfo(invRaw) : invRaw;
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
      if (window.UiRefresh && typeof window.UiRefresh.refreshInvoicesAnalysisAndScadenziario === 'function') {
        window.UiRefresh.refreshInvoicesAnalysisAndScadenziario();
      } else if (window.UiRefresh && typeof window.UiRefresh.refreshInvoicesAndAnalysis === 'function') {
        window.UiRefresh.refreshInvoicesAndAnalysis();
      } else if (typeof renderInvoicesTable === 'function') {
        renderInvoicesTable();
      }
    });

    // VIEW (Dettaglio Fattura)
    $('#invoices-table-body').on('click', '.btn-view-invoice', function () {
      try {
        const id = $(this).attr('data-id');
        const invRaw = getData('invoices').find((i) => String(i.id) === String(id));
      const inv = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceStatusInfo === 'function') ? window.DomainNormalizers.normalizeInvoiceStatusInfo(invRaw) : invRaw;
        if (!inv) return;

        const rawCompany = getData('companyInfo') || {};
      const company = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function')
        ? window.DomainNormalizers.normalizeCompanyInfo(rawCompany)
        : rawCompany;
        const rawCustomer = getData('customers').find((x) => String(x.id) === String(inv.customerId)) || {};
        const customer = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCustomerInfo === 'function')
          ? window.DomainNormalizers.normalizeCustomerInfo(rawCustomer)
          : rawCustomer;

        // Regime fiscale: in Forfettario non esiste IVA (N2.2). In ordinario il dettaglio IVA resta visibile.
        // La decisione passa dalla TaxRegimePolicy, che centralizza il fallback su taxRegime/codice RF.
        const isForfettario = window.TaxRegimePolicy
          ? window.TaxRegimePolicy.isForfettario(company)
          : false;
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

        // CALCOLO TOTALI CENTRALIZZATO
        const bolloAcaricoEmittente = (typeof window.resolveBolloAcaricoEmittente === 'function') ? window.resolveBolloAcaricoEmittente(inv, customer) : false;

        const calc = (window.AppModules.invoicesCommonCalc && typeof window.AppModules.invoicesCommonCalc.calculateInvoiceTotals === 'function')
          ? window.AppModules.invoicesCommonCalc.calculateInvoiceTotals(inv.lines, company, customer, inv.type, { includeBolloInTotale: !bolloAcaricoEmittente })
          : { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, ivaTot: 0, ritenuta: 0, totDoc: 0, nettoDaPagare: 0, vatMap: new Map(), factorScorporo: 1, bolloIncludedInTotale: true };
        const totalsInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoiceTotalsInfo === 'function')
          ? window.DomainNormalizers.normalizeInvoiceTotalsInfo(inv, customer, calc)
          : null;
        const totals = totalsInfo || {};

        const totPrest = totals.totalePrestazioni != null ? totals.totalePrestazioni : calc.totPrest;
        const rivInps = totals.rivalsaImporto != null ? totals.rivalsaImporto : calc.riv;
        const totImponibile = totals.totaleImponibile != null ? totals.totaleImponibile : calc.totImp;
        const ivaTot = totals.ivaTotale != null ? totals.ivaTotale : calc.ivaTot;
        const impBolloEff = totals.importoBollo != null ? totals.importoBollo : calc.impBollo;
        const totDocumento = totals.total != null ? totals.total : calc.totDoc;
        const ritenuta = totals.ritenutaAcconto != null ? totals.ritenutaAcconto : calc.ritenuta;
        const nettoDaPagare = totals.nettoDaPagare != null ? totals.nettoDaPagare : calc.nettoDaPagare;

        const hasRivInps = totals.hasRivalsa != null ? totals.hasRivalsa : (rivInps > 0);
        const hasBollo = totals.hasBollo != null ? totals.hasBollo : (impBolloEff > 0);
        const hasIva = totals.hasIva != null ? totals.hasIva : (ivaTot > 0);
        const hasRitenuta = totals.hasRitenuta != null ? totals.hasRitenuta : (ritenuta > 0);

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

        (inv.lines || []).forEach((l) => {
          const qty = typeof l.qty === 'number' ? l.qty : parseFloat(l.qty || 0) || 0;
          const price = typeof l.price === 'number' ? l.price : parseFloat(l.price || 0) || 0;
          const subtotal = typeof l.subtotal === 'number' ? l.subtotal : parseFloat(l.subtotal || 0) || qty * price;

          const isBollo = String(l.productName || '').trim().toLowerCase() === 'rivalsa bollo';

          // Logica IVA locale per display (deve corrispondere a common-calc)
          let ivaPerc = 0;
          if (!isForfettario) {
            const ivaDefault = parseFloat(company.aliquotaIva || company.aliquotaIVA || 22) || 22;
            ivaPerc = l.iva === 0 || l.iva === '0' ? 0 : parseFloat(l.iva);
            if (isNaN(ivaPerc) && (l.iva === null || l.iva === undefined || l.iva === '')) ivaPerc = ivaDefault;
            if (isBollo) ivaPerc = 0;
          }

          // Calcolo imponibile netto per calcolo IVA (gestione scorporo)
          let imponibile = subtotal;
          if (l.priceType === 'gross' && calc.factorScorporo > 1) {
            imponibile = subtotal / calc.factorScorporo;
          }

          const ivaLabel = isBollo ? 'Bollo' : ivaPerc > 0 ? `${ivaPerc.toFixed(0)}%` : `0% (${escapeXML(l.esenzioneIva || 'N2.2')})`;
          const ivaAmt = ivaPerc > 0 ? imponibile * (ivaPerc / 100) : 0;

          // Line Total = Subtotal (che sia netto o lordo) + IVA. 
          // Se priceType=gross, subtotal include già rivalsa, quindi Totale = Gross + IVA. Corretto.
          const lineTotal = subtotal + ivaAmt;

          h += `
          <tr>
            <td class="invoice-line-desc">${escapeXML(l.productName || '')}</td>
            <td class="text-end invoice-num invoice-col-qty">${qty.toFixed(2)}</td>
            <td class="text-end invoice-num invoice-col-price"><span class="invoice-money">€&nbsp;${price.toFixed(2)}</span></td>
            ${showVatSection ? `<td class="text-end invoice-col-vat">${ivaLabel}</td>` : ''}
            <td class="text-end invoice-num invoice-col-total"><span class="invoice-money">€&nbsp;${lineTotal.toFixed(2)}</span></td>
          </tr>
        `;
        });

        h += `
          </tbody>
        </table>
      `;

        // Generazione righe riepilogo IVA da calc.vatMap
        const vatMap = calc.vatMap || new Map();
        let vatRowsHtml = '';
        if (vatMap.size > 0) {
          vatRowsHtml = Array.from(vatMap.values())
            .sort((a, b) => a.label.localeCompare(b.label)) // Ordine alfabetico etichette
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
        } else {
          vatRowsHtml = `<tr><td colspan="3" class="text-muted">Nessun riepilogo IVA disponibile</td></tr>`;
        }

        h += `
        <div class="row justify-content-end">
          <div class="col-md-5">
            <table class="table table-sm mb-0">
              <tbody>
                <tr><th>Totale Prestazioni</th><td class="text-end">€ ${totPrest.toFixed(2)}</td></tr>
                ${rivInps > 0 ? `<tr><th>Rivalsa INPS</th><td class="text-end">€ ${rivInps.toFixed(2)}</td></tr>` : ''}
                <tr><th>Totale Imponibile</th><td class="text-end">€ ${totImponibile.toFixed(2)}</td></tr>
                ${showVatSection && hasIva ? `<tr><th>IVA</th><td class="text-end">€ ${ivaTot.toFixed(2)}</td></tr>` : ''}
                ${hasBollo ? `<tr><th>Marca da bollo</th><td class="text-end">€ ${impBolloEff.toFixed(2)}${bolloAcaricoEmittente ? ' <span class=\"text-muted\">(a carico studio)</span>' : ''}</td></tr>` : ''}
                <tr class="table-light fw-bold"><th>Totale Documento</th><td class="text-end">€ ${totDocumento.toFixed(2)}</td></tr>
                ${hasRitenuta ? `<tr><th>Ritenuta d'acconto</th><td class="text-end">€ ${ritenuta.toFixed(2)}</td></tr>` : ''}
                <tr class="fw-bold border-top border-dark" style="font-size: 1.1rem;"><th>Netto da incassare</th><td class="text-end">€ ${nettoDaPagare.toFixed(2)}</td></tr>
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
              ${vatRowsHtml}
            </tbody>
          </table>
        </div>
        ` : ''}
      `;

        // --- FOOTER: TESTO FISCALE + DATI PAGAMENTO ---
        const paymentInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoicePaymentInfo === 'function')
          ? window.DomainNormalizers.normalizeInvoicePaymentInfo(inv, company)
          : inv;
        const condizioni = inv.condizioniPagamento || '';
        const modalita = paymentInfo.modalitaPagamento || inv.modalitaPagamento || '';
        const scadenza = inv.dataScadenza ? formatDateForDisplay(inv.dataScadenza) : '';

        const isBonifico = !!paymentInfo.isBonifico || /bonifico/i.test(String(modalita || ''));
        const bankChoice = String(paymentInfo.bankChoice || inv.bankChoice || '1');

        let banca = '';
        let iban = '';
        if (isBonifico) {
          banca = paymentInfo.bancaSelezionata || '';
          iban = paymentInfo.ibanSelezionato || '';
        }

        // Calcola l'aliquota di ritenuta (necessaria per il testo fiscale)
        const aliqRitenuta = sf(company.aliquotaRitenuta || 20);

        const fiscalBits = [];
        if (isForfettario) {
          fiscalBits.push('Regime forfettario: operazione non soggetta ad IVA (N2.2).');
        } else {
          fiscalBits.push(
            hasIva
              ? `Operazione soggetta a IVA.`
              : 'Operazione senza addebito IVA (verificare natura IVA).'
          );
        }
        if (rivInps > 0) fiscalBits.push(`Rivalsa INPS applicata (${(company.aliquotaInps || 0)}%).`);
        if (hasRitenuta)
          fiscalBits.push(
            `Ritenuta d'acconto applicata (${aliqRitenuta.toFixed(2)}%) perche il cliente e sostituto d'imposta.`
          );
        const fiscalText = fiscalBits.join(' ');

        // Aggiunta: mostra note se presenti
        if (inv.notes) {
          h += `<div class="mt-3 alert alert-secondary p-2 mb-2"><small><strong>Note:</strong> ${escapeXML(inv.notes)}</small></div>`;
        }

        h += `
        ${fiscalText ? `<div class="mt-3 small"><p>${escapeXML(fiscalText)}</p></div>` : ''}
        <div class="mt-2">
          <h6>Dati di pagamento</h6>
          <table class="table table-sm mb-0">
            <tbody>
              <tr><th>Netto da incassare</th><td>€ ${nettoDaPagare.toFixed(2)}</td></tr>
              ${condizioni ? `<tr><th>Condizioni</th><td>${escapeXML(condizioni)}</td></tr>` : ''}
              ${modalita ? `<tr><th>Modalita</th><td>${escapeXML(modalita)}</td></tr>` : ''}
              ${scadenza ? `<tr><th>Scadenza</th><td>${scadenza}</td></tr>` : ''}
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

      } catch (err) {
        console.error("Errore Visualizzazione Fattura:", err);
        alert("Si è verificato un errore durante la visualizzazione della fattura: " + err.message);
      }
    });
    $('#print-invoice-btn').click(() => window.print());
  }

  window.AppModules.invoicesList.bind = bind;
})();
