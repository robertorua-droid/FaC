(function () {
  function pickFirst() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  }

  function normalizeCompanyInfo(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const normalized = Object.assign({}, src);

    const address = pickFirst(src.address, src.indirizzo, src.street);
    const zip = pickFirst(src.zip, src.cap, src.postalCode);
    const comune = pickFirst(src.comune, src.city, src.town);
    const province = pickFirst(src.province, src.provincia, src.siglaProvincia);
    const country = pickFirst(src.country, src.nazione, src.nation, 'IT');
    const banca1 = pickFirst(src.banca1, src.banca);
    const iban1 = pickFirst(src.iban1, src.iban);
    const banca2 = pickFirst(src.banca2);
    const iban2 = pickFirst(src.iban2);

    normalized.address = address;
    normalized.indirizzo = pickFirst(src.indirizzo, address);
    normalized.street = pickFirst(src.street, address);

    normalized.zip = zip;
    normalized.cap = pickFirst(src.cap, zip);
    normalized.postalCode = pickFirst(src.postalCode, zip);

    normalized.comune = comune;
    normalized.city = pickFirst(src.city, comune);
    normalized.town = pickFirst(src.town, comune);

    normalized.province = province;
    normalized.provincia = pickFirst(src.provincia, province);
    normalized.siglaProvincia = pickFirst(src.siglaProvincia, province);

    normalized.country = country;
    normalized.nazione = pickFirst(src.nazione, country);
    normalized.nation = pickFirst(src.nation, country);

    normalized.banca1 = banca1;
    normalized.banca = pickFirst(src.banca, banca1);
    normalized.iban1 = iban1;
    normalized.iban = pickFirst(src.iban, iban1);
    normalized.banca2 = banca2;
    normalized.iban2 = iban2;

    if (window.TaxRegimePolicy && typeof window.TaxRegimePolicy.resolve === 'function') {
      const regime = window.TaxRegimePolicy.resolve(src);
      if (regime) normalized.taxRegime = regime;
    }

    return normalized;
  }

  function normalizeCustomerInfo(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const normalized = Object.assign({}, src);

    const nome = pickFirst(src.nome, src.firstName);
    const cognome = pickFirst(src.cognome, src.lastName);
    const denominazione = pickFirst(src.name, src.ragioneSociale, [nome, cognome].filter(Boolean).join(' ').trim());
    const address = pickFirst(src.address, src.indirizzo, src.street);
    const cap = pickFirst(src.cap, src.zip, src.postalCode);
    const comune = pickFirst(src.comune, src.city, src.town);
    const provincia = pickFirst(src.provincia, src.province, src.siglaProvincia);
    const nazione = pickFirst(src.nazione, src.country, src.nation, 'IT');
    const piva = pickFirst(src.piva, src.partitaIva, src.vatNumber);
    const codiceFiscale = pickFirst(src.codiceFiscale, src.cf, src.taxCode);

    normalized.nome = nome;
    normalized.firstName = pickFirst(src.firstName, nome);
    normalized.cognome = cognome;
    normalized.lastName = pickFirst(src.lastName, cognome);

    normalized.name = denominazione;
    normalized.ragioneSociale = pickFirst(src.ragioneSociale, denominazione);

    normalized.address = address;
    normalized.indirizzo = pickFirst(src.indirizzo, address);
    normalized.street = pickFirst(src.street, address);

    normalized.cap = cap;
    normalized.zip = pickFirst(src.zip, cap);
    normalized.postalCode = pickFirst(src.postalCode, cap);

    normalized.comune = comune;
    normalized.city = pickFirst(src.city, comune);
    normalized.town = pickFirst(src.town, comune);

    normalized.provincia = provincia;
    normalized.province = pickFirst(src.province, provincia);
    normalized.siglaProvincia = pickFirst(src.siglaProvincia, provincia);

    normalized.nazione = nazione;
    normalized.country = pickFirst(src.country, nazione);
    normalized.nation = pickFirst(src.nation, nazione);

    normalized.piva = piva;
    normalized.partitaIva = pickFirst(src.partitaIva, piva);
    normalized.vatNumber = pickFirst(src.vatNumber, piva);

    normalized.codiceFiscale = codiceFiscale;
    normalized.cf = pickFirst(src.cf, codiceFiscale);
    normalized.taxCode = pickFirst(src.taxCode, codiceFiscale);

    return normalized;
  }


  function normalizeCreditNoteInfo(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const normalized = Object.assign({}, src);

    const typeRaw = pickFirst(src.type, src.documentType, src.tipoDocumento, 'Fattura');
    const linkedInvoice = pickFirst(
      src.linkedInvoice,
      src.linkedDocument,
      src.linkedInvoiceNumber,
      src.relatedInvoice,
      src.relatedInvoiceNumber,
      src.invoiceReference,
      src.linkedDocumentNumber
    );
    const linkedInvoiceDate = pickFirst(
      src.linkedInvoiceDate,
      src.linkedDocumentDate,
      src.relatedInvoiceDate,
      src.invoiceReferenceDate,
      src.documentReferenceDate
    );
    const reason = pickFirst(src.reason, src.causale, src.noteReason, src.creditNoteReason, src.description);
    const typeNorm = String(typeRaw || '').trim().toLowerCase().includes('nota') ? 'Nota di Credito' : typeRaw;

    normalized.type = typeNorm || 'Fattura';
    normalized.documentType = pickFirst(src.documentType, normalized.type);
    normalized.tipoDocumento = pickFirst(src.tipoDocumento, normalized.type);
    normalized.linkedInvoice = linkedInvoice;
    normalized.linkedDocument = pickFirst(src.linkedDocument, linkedInvoice);
    normalized.linkedInvoiceNumber = pickFirst(src.linkedInvoiceNumber, linkedInvoice);
    normalized.relatedInvoice = pickFirst(src.relatedInvoice, linkedInvoice);
    normalized.relatedInvoiceNumber = pickFirst(src.relatedInvoiceNumber, linkedInvoice);
    normalized.invoiceReference = pickFirst(src.invoiceReference, linkedInvoice);
    normalized.linkedInvoiceDate = linkedInvoiceDate;
    normalized.linkedDocumentDate = pickFirst(src.linkedDocumentDate, linkedInvoiceDate);
    normalized.relatedInvoiceDate = pickFirst(src.relatedInvoiceDate, linkedInvoiceDate);
    normalized.invoiceReferenceDate = pickFirst(src.invoiceReferenceDate, linkedInvoiceDate);
    normalized.reason = reason;
    normalized.causale = pickFirst(src.causale, reason);
    normalized.noteReason = pickFirst(src.noteReason, reason);
    normalized.creditNoteReason = pickFirst(src.creditNoteReason, reason);

    return normalized;
  }

  function normalizeInvoicePaymentInfo(rawInvoice, rawCompany) {
    const invoice = rawInvoice && typeof rawInvoice === 'object' ? rawInvoice : {};
    const company = normalizeCompanyInfo(rawCompany && typeof rawCompany === 'object' ? rawCompany : {});
    const normalized = Object.assign({}, invoice);

    const methodRaw = pickFirst(invoice.modalitaPagamento, invoice.paymentMethod, 'Bonifico Bancario');
    const methodKey = String(methodRaw).trim().toLowerCase();
    const modalitaPagamento = methodKey === 'rimessa diretta' ? 'Bonifico Bancario' : methodRaw;
    const isBonifico = methodKey.includes('bonifico') || methodKey === 'rimessa diretta';

    let bankChoice = String(pickFirst(invoice.bankChoice, invoice.bank, '1')).trim();
    bankChoice = bankChoice === '2' ? '2' : '1';

    const banca1 = pickFirst(company.banca1, company.banca);
    const iban1 = pickFirst(company.iban1, company.iban);
    const banca2 = pickFirst(company.banca2);
    const iban2 = pickFirst(company.iban2);
    const hasBank2 = !!pickFirst(banca2, iban2);

    const bankChoiceRequested = isBonifico ? bankChoice : '1';
    const bankChoiceEffective = bankChoiceRequested === '2' && hasBank2 ? '2' : '1';
    const bancaSelezionata = bankChoiceEffective === '2' ? banca2 : banca1;
    const ibanSelezionato = bankChoiceEffective === '2' ? iban2 : iban1;

    normalized.modalitaPagamento = modalitaPagamento;
    normalized.paymentMethod = pickFirst(invoice.paymentMethod, modalitaPagamento);
    normalized.isBonifico = isBonifico;
    normalized.bankChoice = bankChoiceRequested;
    normalized.bankChoiceRequested = bankChoiceRequested;
    normalized.bankChoiceEffective = bankChoiceEffective;
    normalized.hasBank2 = hasBank2;
    normalized.bancaSelezionata = bancaSelezionata;
    normalized.ibanSelezionato = ibanSelezionato;
    normalized.selectedBankName = bancaSelezionata;
    normalized.selectedIban = ibanSelezionato;

    return normalized;
  }


  function normalizeTimesheetImportInfo(rawState, rawLines) {
    const src = rawState && typeof rawState === 'object' ? rawState : {};
    const lines = Array.isArray(rawLines) ? rawLines : [];
    const normalized = Object.assign({}, src);

    const lineIds = [];
    lines.forEach(function (line) {
      if (!line || line.tsImport !== true) return;
      const ids = line.tsWorklogIds || (line.tsMeta && line.tsMeta.worklogIds);
      if (Array.isArray(ids)) ids.forEach(function (id) { if (String(id || '').trim()) lineIds.push(String(id).trim()); });
      else if (typeof ids === 'string' && ids) ids.split(',').forEach(function (id) { if (String(id || '').trim()) lineIds.push(String(id).trim()); });
    });

    const stateIds = [];
    const srcIds = src.worklogIds || src.importedWorklogIds || src.ids || [];
    if (Array.isArray(srcIds)) srcIds.forEach(function (id) { if (String(id || '').trim()) stateIds.push(String(id).trim()); });
    else if (typeof srcIds === 'string' && srcIds) srcIds.split(',').forEach(function (id) { if (String(id || '').trim()) stateIds.push(String(id).trim()); });

    const groupsSrc = Array.isArray(src.groups) ? src.groups : (Array.isArray(src.items) ? src.items : []);
    const groups = groupsSrc.map(function (g) {
      const group = g && typeof g === 'object' ? g : {};
      const groupIdsRaw = group.worklogIds || group.ids || [];
      const groupIds = [];
      if (Array.isArray(groupIdsRaw)) groupIdsRaw.forEach(function (id) { if (String(id || '').trim()) groupIds.push(String(id).trim()); });
      else if (typeof groupIdsRaw === 'string' && groupIdsRaw) groupIdsRaw.split(',').forEach(function (id) { if (String(id || '').trim()) groupIds.push(String(id).trim()); });
      return Object.assign({}, group, {
        key: pickFirst(group.key, group.groupKey, [pickFirst(group.projectId, group.progettoId), pickFirst(group.periodLabel, group.periodo)].filter(Boolean).join('__')),
        commessaId: pickFirst(group.commessaId, group.jobId),
        projectId: pickFirst(group.projectId, group.progettoId),
        periodLabel: pickFirst(group.periodLabel, group.periodo),
        minutes: parseInt(group.minutes, 10) || 0,
        hours: parseFloat(group.hours) || 0,
        productId: pickFirst(group.productId, group.serviceId, group.prodottoId),
        rate: parseFloat(group.rate) || 0,
        amount: parseFloat(group.amount) || 0,
        tipo: pickFirst(group.tipo, group.type),
        worklogIds: Array.from(new Set(groupIds))
      });
    });

    const allIds = Array.from(new Set([].concat(stateIds, lineIds, groups.reduce(function (acc, g) { return acc.concat(g.worklogIds || []); }, [])).map(String).filter(Boolean)));
    const batchId = pickFirst(src.batchId, src.tsImportBatchId, src.importBatchId);
    const importedAt = pickFirst(src.importedAt, src.createdAt, src.updatedAt);

    normalized.batchId = batchId;
    normalized.tsImportBatchId = pickFirst(src.tsImportBatchId, batchId);
    normalized.importBatchId = pickFirst(src.importBatchId, batchId);
    normalized.importedAt = importedAt;
    normalized.worklogIds = allIds;
    normalized.importedWorklogIds = pickFirst(src.importedWorklogIds, allIds.join(',')) ? allIds : allIds;
    normalized.groups = groups;
    normalized.items = Array.isArray(src.items) ? groups : groups;
    normalized.hasImportedLines = allIds.length > 0 || lines.some(function (line) { return !!(line && line.tsImport === true); });
    normalized.importedLineCount = lines.filter(function (line) { return !!(line && line.tsImport === true); }).length;

    return normalized.hasImportedLines || groups.length || allIds.length ? normalized : null;
  }


  function normalizePurchaseInfo(rawPurchase) {
    const src = rawPurchase && typeof rawPurchase === 'object' ? rawPurchase : {};
    const normalized = Object.assign({}, src);

    const supplierId = pickFirst(src.supplierId, src.fornitoreId, src.vendorId, src.supplierID);
    const number = pickFirst(src.number, src.numero, src.documentNumber, src.docNumber);
    const date = pickFirst(src.date, src.data, src.documentDate);
    const dataRiferimento = pickFirst(src.dataRiferimento, src.refDate, src.referenceDate, date);
    const giorniTermini = parseInt(pickFirst(src.giorniTermini, src.paymentDays, src.termsDays, src.paymentTermsDays, 0), 10) || 0;
    const dataScadenza = pickFirst(src.dataScadenza, src.dueDate, src.scadenza);
    const statusRaw = pickFirst(src.status, src.stato, 'Da Pagare');
    const statusKey = String(statusRaw || '').trim().toLowerCase();
    const status = statusKey === 'pagata' ? 'Pagata' : 'Da Pagare';
    const notes = pickFirst(src.notes, src.note, src.description);

    const sf = (typeof window.safeFloat === 'function')
      ? window.safeFloat
      : function (v) {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };

    const rawLines = Array.isArray(src.lines) ? src.lines : (Array.isArray(src.righe) ? src.righe : []);
    const lines = rawLines.map(function (line) {
      const l = line && typeof line === 'object' ? line : {};
      const qty = sf(pickFirst(l.qty, l.quantity, l.qta, 0));
      const price = sf(pickFirst(l.price, l.unitPrice, l.prezzoUnitario, 0));
      const iva = String(pickFirst(l.iva, l.ivaPerc, l.vatRate, l.aliquotaIVA, '0'));
      const natura = pickFirst(l.natura, l.vatNature, l.naturaIva, l.esenzioneIva);
      const subtotal = sf(l.subtotal != null ? l.subtotal : qty * price);
      return Object.assign({}, l, {
        description: pickFirst(l.description, l.descrizione, l.label),
        descrizione: pickFirst(l.descrizione, l.description, l.label),
        qty: qty,
        quantity: qty,
        qta: qty,
        price: price,
        unitPrice: price,
        prezzoUnitario: price,
        iva: iva,
        ivaPerc: pickFirst(l.ivaPerc, iva),
        vatRate: pickFirst(l.vatRate, iva),
        natura: natura,
        vatNature: pickFirst(l.vatNature, natura),
        subtotal: subtotal
      });
    });

    const imponibile = sf(pickFirst(src.imponibile, src.imponibileTotale, src.subtotal, src.linesSubtotal));
    const ivaTotale = sf(pickFirst(src.ivaTotale, src.ivaTot, src.vatTotal, src.taxTotal));
    const totaleDocumento = sf(pickFirst(src.totaleDocumento, src.total, src.totale, src.documentTotal));
    const calcImponibile = lines.reduce(function (acc, l) { return acc + sf(l.subtotal); }, 0);
    const calcIvaTotale = lines.reduce(function (acc, l) { return acc + (sf(l.subtotal) * (sf(l.iva) / 100)); }, 0);
    const effectiveImponibile = imponibile || calcImponibile;
    const effectiveIvaTotale = ivaTotale || calcIvaTotale;
    const effectiveTotaleDocumento = totaleDocumento || (effectiveImponibile + effectiveIvaTotale);

    normalized.supplierId = supplierId;
    normalized.fornitoreId = pickFirst(src.fornitoreId, supplierId);
    normalized.vendorId = pickFirst(src.vendorId, supplierId);
    normalized.number = number;
    normalized.numero = pickFirst(src.numero, number);
    normalized.documentNumber = pickFirst(src.documentNumber, number);
    normalized.date = date;
    normalized.data = pickFirst(src.data, date);
    normalized.documentDate = pickFirst(src.documentDate, date);
    normalized.dataRiferimento = dataRiferimento;
    normalized.refDate = pickFirst(src.refDate, dataRiferimento);
    normalized.referenceDate = pickFirst(src.referenceDate, dataRiferimento);
    normalized.giorniTermini = giorniTermini;
    normalized.paymentDays = parseInt(pickFirst(src.paymentDays, giorniTermini), 10) || giorniTermini;
    normalized.termsDays = parseInt(pickFirst(src.termsDays, giorniTermini), 10) || giorniTermini;
    normalized.dataScadenza = dataScadenza;
    normalized.dueDate = pickFirst(src.dueDate, dataScadenza);
    normalized.scadenza = pickFirst(src.scadenza, dataScadenza);
    normalized.status = status;
    normalized.stato = pickFirst(src.stato, status);
    normalized.notes = notes;
    normalized.note = pickFirst(src.note, notes);
    normalized.lines = lines;
    normalized.righe = lines;
    normalized.imponibile = effectiveImponibile;
    normalized.imponibileTotale = pickFirst(src.imponibileTotale, effectiveImponibile);
    normalized.ivaTotale = effectiveIvaTotale;
    normalized.ivaTot = pickFirst(src.ivaTot, effectiveIvaTotale);
    normalized.vatTotal = pickFirst(src.vatTotal, effectiveIvaTotale);
    normalized.totaleDocumento = effectiveTotaleDocumento;
    normalized.total = pickFirst(src.total, effectiveTotaleDocumento);
    normalized.totale = pickFirst(src.totale, effectiveTotaleDocumento);
    normalized.documentTotal = pickFirst(src.documentTotal, effectiveTotaleDocumento);

    return normalized;
  }



  function normalizeInvoiceStatusInfo(rawInvoice) {
    const src = rawInvoice && typeof rawInvoice === 'object' ? rawInvoice : {};
    const normalized = Object.assign({}, src);

    const typeRaw = pickFirst(src.type, src.documentType, src.tipoDocumento, 'Fattura');
    const typeNorm = String(typeRaw || '').trim().toLowerCase().includes('nota') ? 'Nota di Credito' : typeRaw;
    const statusRaw = pickFirst(src.status, src.stato, src.documentStatus, src.paymentStatus, src.isPaid === true ? 'Pagata' : (src.isDraft === true ? 'Bozza' : 'Emessa'));
    const statusKey = String(statusRaw || '').trim().toLowerCase();

    let status = 'Emessa';
    if (['bozza', 'draft'].includes(statusKey)) status = 'Bozza';
    else if (['pagata', 'pagato', 'paid'].includes(statusKey)) status = 'Pagata';
    else if (['inviata', 'inviato', 'sent'].includes(statusKey)) status = 'Inviata';
    else if (['da incassare', 'non pagata', 'open'].includes(statusKey)) status = 'Emessa';

    const sentToAgenzia = src.sentToAgenzia === true || String(src.sentToAgenzia).toLowerCase() === 'true' || status === 'Inviata';
    const isDraft = src.isDraft === true || String(src.isDraft).toLowerCase() === 'true' || status === 'Bozza';

    normalized.type = typeNorm || 'Fattura';
    normalized.documentType = pickFirst(src.documentType, normalized.type);
    normalized.tipoDocumento = pickFirst(src.tipoDocumento, normalized.type);
    normalized.status = isDraft ? 'Bozza' : (status === 'Inviata' ? 'Emessa' : status);
    normalized.stato = pickFirst(src.stato, normalized.status);
    normalized.documentStatus = pickFirst(src.documentStatus, normalized.status);
    normalized.sentToAgenzia = sentToAgenzia;
    normalized.isDraft = isDraft;
    normalized.isPaid = normalized.status === 'Pagata';
    normalized.isCreditNote = normalized.type === 'Nota di Credito';
    normalized.exportStatus = isDraft ? 'Bozza' : (sentToAgenzia ? 'Inviata' : normalized.status);
    normalized.paymentDate = pickFirst(src.paymentDate, src.dataPagamento, src.paidAt);
    normalized.issueDate = pickFirst(src.issueDate, src.dataInvio, src.sentAt);

    return normalized;
  }

  function normalizeInvoiceTotalsInfo(rawInvoice, rawCustomer, rawCalc) {
    const invoice = rawInvoice && typeof rawInvoice === 'object' ? rawInvoice : {};
    const customer = rawCustomer && typeof rawCustomer === 'object' ? rawCustomer : {};
    const calc = rawCalc && typeof rawCalc === 'object' ? rawCalc : {};
    const normalized = Object.assign({}, invoice);

    const sf = (typeof window.safeFloat === 'function')
      ? window.safeFloat
      : function (v) {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };

    const bolloAcaricoEmittente = (typeof window.resolveBolloAcaricoEmittente === 'function')
      ? !!window.resolveBolloAcaricoEmittente(invoice, customer)
      : !!invoice.bolloAcaricoEmittente;

    const totPrest = sf(calc.totPrest != null ? calc.totPrest : invoice.totalePrestazioni);
    const riv = sf(calc.riv != null ? calc.riv : ((invoice.rivalsa && invoice.rivalsa.importo) != null ? invoice.rivalsa.importo : invoice.rivalsaImporto));
    const impBollo = sf(calc.impBollo != null ? calc.impBollo : invoice.importoBollo);
    const totImp = sf(calc.totImp != null ? calc.totImp : invoice.totaleImponibile);
    const ivaTot = sf(calc.ivaTot != null ? calc.ivaTot : invoice.ivaTotale);
    const ritenuta = sf(calc.ritenuta != null ? calc.ritenuta : invoice.ritenutaAcconto);
    const totDoc = sf(calc.totDoc != null ? calc.totDoc : invoice.total);
    const nettoDaPagare = sf(calc.nettoDaPagare != null ? calc.nettoDaPagare : invoice.nettoDaPagare);

    normalized.totalePrestazioni = totPrest;
    normalized.rivalsa = Object.assign({}, invoice.rivalsa || {}, { importo: riv });
    normalized.rivalsaImporto = riv;
    normalized.importoBollo = impBollo;
    normalized.totaleImponibile = totImp;
    normalized.ivaTotale = ivaTot;
    normalized.ritenutaAcconto = ritenuta;
    normalized.total = totDoc;
    normalized.nettoDaPagare = nettoDaPagare;
    normalized.bolloAcaricoEmittente = bolloAcaricoEmittente;
    normalized.bolloIncludedInTotale = calc.bolloIncludedInTotale != null
      ? !!calc.bolloIncludedInTotale
      : !bolloAcaricoEmittente;
    normalized.hasRivalsa = riv > 0;
    normalized.hasBollo = impBollo > 0;
    normalized.hasIva = ivaTot > 0;
    normalized.hasRitenuta = ritenuta > 0;
    normalized.vatMap = calc.vatMap || invoice.vatMap || new Map();

    return normalized;
  }


  window.DomainNormalizers = window.DomainNormalizers || {};
  window.DomainNormalizers.pickFirst = pickFirst;
  window.DomainNormalizers.normalizeCompanyInfo = normalizeCompanyInfo;
  window.DomainNormalizers.normalizeCustomerInfo = normalizeCustomerInfo;
  window.DomainNormalizers.normalizeCreditNoteInfo = normalizeCreditNoteInfo;
  window.DomainNormalizers.normalizeInvoicePaymentInfo = normalizeInvoicePaymentInfo;
  window.DomainNormalizers.normalizeTimesheetImportInfo = normalizeTimesheetImportInfo;
  window.DomainNormalizers.normalizePurchaseInfo = normalizePurchaseInfo;
  window.DomainNormalizers.normalizeInvoiceStatusInfo = normalizeInvoiceStatusInfo;
  window.DomainNormalizers.normalizeInvoiceTotalsInfo = normalizeInvoiceTotalsInfo;
  window.normalizeCompanyInfo = normalizeCompanyInfo;
  window.normalizeCustomerInfo = normalizeCustomerInfo;
  window.normalizeCreditNoteInfo = normalizeCreditNoteInfo;
  window.normalizeInvoicePaymentInfo = normalizeInvoicePaymentInfo;
  window.normalizeTimesheetImportInfo = normalizeTimesheetImportInfo;
  window.normalizePurchaseInfo = normalizePurchaseInfo;
  window.normalizeInvoiceStatusInfo = normalizeInvoiceStatusInfo;
  window.normalizeInvoiceTotalsInfo = normalizeInvoiceTotalsInfo;
})();
