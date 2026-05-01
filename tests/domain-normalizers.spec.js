(function () {
  const h = window.TestHarness;
  if (!h) {
    alert('TestHarness non disponibile.');
    return;
  }

  h.test('normalizeCompanyInfo allinea banca/IBAN principali tra alias legacy e campi canonici', function () {
    const raw = {
      banca: 'Credito Agricole',
      iban: 'IT60X0542811101000000123456',
      indirizzo: 'Via Roma 1',
      cap: '10100',
      comune: 'Torino',
      provincia: 'TO'
    };
    const out = window.normalizeCompanyInfo(raw);
    h.assertEqual(out.banca1, 'Credito Agricole');
    h.assertEqual(out.banca, 'Credito Agricole');
    h.assertEqual(out.iban1, 'IT60X0542811101000000123456');
    h.assertEqual(out.iban, 'IT60X0542811101000000123456');
    h.assertEqual(out.address, 'Via Roma 1');
    h.assertEqual(out.zip, '10100');
    h.assertEqual(out.city, 'Torino');
    h.assertEqual(out.province, 'TO');
  });

  h.test('normalizeCompanyInfo preserva campi canonici già valorizzati', function () {
    const raw = {
      banca1: 'Banca Uno',
      iban1: 'IT11A0000000000000000000001',
      banca: 'Legacy Banca',
      iban: 'LEGACY',
      address: 'Corso Francia 10',
      zip: '20100',
      city: 'Milano',
      province: 'MI'
    };
    const out = window.normalizeCompanyInfo(raw);
    h.assertEqual(out.banca1, 'Banca Uno');
    h.assertEqual(out.iban1, 'IT11A0000000000000000000001');
    h.assertEqual(out.address, 'Corso Francia 10');
    h.assertEqual(out.zip, '20100');
    h.assertEqual(out.city, 'Milano');
    h.assertEqual(out.province, 'MI');
  });

  h.test('normalizeCustomerInfo allinea denominazione, dati fiscali e indirizzo tra alias legacy e campi canonici', function () {
    const raw = {
      ragioneSociale: 'Cliente Test SRL',
      partitaIva: '01234560012',
      cf: 'ABCDEF12G34H567I',
      indirizzo: 'Via Milano 8',
      zip: '20100',
      city: 'Milano',
      province: 'MI'
    };
    const out = window.normalizeCustomerInfo(raw);
    h.assertEqual(out.name, 'Cliente Test SRL');
    h.assertEqual(out.ragioneSociale, 'Cliente Test SRL');
    h.assertEqual(out.piva, '01234560012');
    h.assertEqual(out.codiceFiscale, 'ABCDEF12G34H567I');
    h.assertEqual(out.address, 'Via Milano 8');
    h.assertEqual(out.cap, '20100');
    h.assertEqual(out.comune, 'Milano');
    h.assertEqual(out.provincia, 'MI');
  });

  h.test('normalizeCustomerInfo ricompone cliente persona fisica da nome e cognome legacy', function () {
    const raw = {
      firstName: 'Mario',
      lastName: 'Rossi',
      taxCode: 'RSSMRA80A01H501U',
      street: 'Via Roma 1',
      postalCode: '10100',
      town: 'Torino'
    };
    const out = window.normalizeCustomerInfo(raw);
    h.assertEqual(out.nome, 'Mario');
    h.assertEqual(out.cognome, 'Rossi');
    h.assertEqual(out.name, 'Mario Rossi');
    h.assertEqual(out.codiceFiscale, 'RSSMRA80A01H501U');
    h.assertEqual(out.address, 'Via Roma 1');
    h.assertEqual(out.cap, '10100');
    h.assertEqual(out.comune, 'Torino');
  });

  h.test('normalizeInvoicePaymentInfo mantiene bankChoice richiesto ma fa fallback coerente al conto 1 se il conto 2 non e configurato', function () {
    const invoice = { modalitaPagamento: 'Bonifico Bancario', bankChoice: '2' };
    const company = { banca1: 'Banca Uno', iban1: 'IT11A0000000000000000000001' };
    const out = window.normalizeInvoicePaymentInfo(invoice, company);
    h.assertEqual(out.bankChoice, '2');
    h.assertEqual(out.bankChoiceEffective, '1');
    h.assertEqual(out.bancaSelezionata, 'Banca Uno');
    h.assertEqual(out.ibanSelezionato, 'IT11A0000000000000000000001');
  });

  h.test('normalizeInvoicePaymentInfo normalizza Rimessa Diretta come bonifico e usa il conto 2 quando configurato', function () {
    const invoice = { modalitaPagamento: 'Rimessa Diretta', bankChoice: '2' };
    const company = {
      banca1: 'Banca Uno', iban1: 'IT11A0000000000000000000001',
      banca2: 'Banca Due', iban2: 'IT22A0000000000000000000002'
    };
    const out = window.normalizeInvoicePaymentInfo(invoice, company);
    h.assertEqual(out.modalitaPagamento, 'Bonifico Bancario');
    h.assertEqual(out.isBonifico, true);
    h.assertEqual(out.bankChoiceEffective, '2');
    h.assertEqual(out.bancaSelezionata, 'Banca Due');
    h.assertEqual(out.ibanSelezionato, 'IT22A0000000000000000000002');
  });

  h.test('normalizeCreditNoteInfo allinea alias legacy di documento collegato e causale', function () {
    const raw = {
      documentType: 'Nota di Credito',
      linkedDocument: 'FAT-2024-015',
      linkedDocumentDate: '2024-10-31',
      causale: 'Storno parziale per rettifica importi'
    };
    const out = window.normalizeCreditNoteInfo(raw);
    h.assertEqual(out.type, 'Nota di Credito');
    h.assertEqual(out.linkedInvoice, 'FAT-2024-015');
    h.assertEqual(out.linkedInvoiceDate, '2024-10-31');
    h.assertEqual(out.reason, 'Storno parziale per rettifica importi');
  });

  h.test('normalizeCreditNoteInfo mantiene i campi canonici gia valorizzati', function () {
    const raw = {
      type: 'Nota di Credito',
      linkedInvoice: 'NC-REF-01',
      linkedInvoiceDate: '2024-11-05',
      reason: 'Abbuono commerciale'
    };
    const out = window.normalizeCreditNoteInfo(raw);
    h.assertEqual(out.linkedInvoice, 'NC-REF-01');
    h.assertEqual(out.linkedInvoiceDate, '2024-11-05');
    h.assertEqual(out.reason, 'Abbuono commerciale');
    h.assertEqual(out.causale, 'Abbuono commerciale');
  });


  h.test('normalizePurchaseInfo riallinea alias legacy di acquisto e calcola fallback totali dalle righe', function () {
    const raw = {
      fornitoreId: '12',
      numero: 'A-55',
      data: '2025-04-10',
      dueDate: '2025-05-10',
      stato: 'pagata',
      note: 'Import legacy',
      righe: [
        { descrizione: 'Licenza software', qta: 2, prezzoUnitario: 50, ivaPerc: 22 },
        { description: 'Canone', qty: 1, price: 100, iva: 0, naturaIva: 'N2.2' }
      ]
    };
    const out = window.normalizePurchaseInfo(raw);
    h.assertEqual(out.supplierId, '12');
    h.assertEqual(out.number, 'A-55');
    h.assertEqual(out.date, '2025-04-10');
    h.assertEqual(out.dataScadenza, '2025-05-10');
    h.assertEqual(out.status, 'Pagata');
    h.assertApprox(out.imponibile, 200, 0.001, 'imponibile da righe');
    h.assertApprox(out.ivaTotale, 22, 0.001, 'iva da righe');
    h.assertApprox(out.totaleDocumento, 222, 0.001, 'totale da righe');
    h.assertEqual(out.lines[0].description, 'Licenza software');
    h.assertEqual(out.lines[1].natura, 'N2.2');
  });

  h.test('normalizePurchaseInfo preserva i totali persistiti quando gia presenti', function () {
    const raw = {
      supplierId: '8',
      number: 'F-88',
      date: '2025-06-01',
      imponibile: 500,
      ivaTot: 110,
      total: 610,
      lines: [{ description: 'Servizio', qty: 1, price: 10, iva: 22 }]
    };
    const out = window.normalizePurchaseInfo(raw);
    h.assertApprox(out.imponibile, 500, 0.001, 'imponibile persistito');
    h.assertApprox(out.ivaTotale, 110, 0.001, 'iva persistita');
    h.assertApprox(out.totaleDocumento, 610, 0.001, 'totale persistito');
    h.assertEqual(out.ivaTot, 110);
    h.assertEqual(out.total, 610);
  });

  h.test('normalizeInvoiceTotalsInfo riallinea totali documento e flag derivati', function () {
    const out = window.DomainNormalizers.normalizeInvoiceTotalsInfo(
      { importoBollo: '2.00', bolloAcaricoEmittente: false },
      {},
      { totPrest: 100, riv: 4, impBollo: 2, totImp: 104, ivaTot: 22.88, ritenuta: 20.8, totDoc: 128.88, nettoDaPagare: 108.08, vatMap: new Map([['22', { label: 'IVA 22%' }]]) }
    );
    h.assertApprox(out.totalePrestazioni, 100, 0.001, 'totale prestazioni canonico');
    h.assertApprox(out.rivalsa.importo, 4, 0.001, 'rivalsa canonica');
    h.assertApprox(out.total, 128.88, 0.001, 'totale documento canonico');
    h.assertApprox(out.nettoDaPagare, 108.08, 0.001, 'netto canonico');
    h.assertTrue(out.hasBollo, 'flag bollo');
    h.assertTrue(out.hasIva, 'flag iva');
    h.assertTrue(out.hasRitenuta, 'flag ritenuta');
  });

  h.test('normalizeInvoiceTotalsInfo usa fallback persistiti quando il calc manca', function () {
    const out = window.DomainNormalizers.normalizeInvoiceTotalsInfo(
      { totalePrestazioni: '50', total: '52', ivaTotale: '2', importoBollo: '0', ritenutaAcconto: '0', nettoDaPagare: '52', rivalsa: { importo: '0' } },
      {},
      null
    );
    h.assertApprox(out.totalePrestazioni, 50, 0.001, 'fallback prestazioni');
    h.assertApprox(out.total, 52, 0.001, 'fallback totale');
    h.assertFalse(out.hasBollo, 'nessun bollo');
  });

  h.test('normalizeTimesheetImportInfo unifica worklogIds tra stato import e righe fattura importate', function () {
    const state = { batchId: 'B1', groups: [{ groupKey: 'P1__2025-01', ids: ['10', '11'] }], importedWorklogIds: ['12'] };
    const lines = [
      { tsImport: true, tsWorklogIds: ['11', '13'] },
      { tsImport: true, tsMeta: { worklogIds: ['14'] } }
    ];
    const out = window.normalizeTimesheetImportInfo(state, lines);
    h.assertEqual(out.batchId, 'B1');
    h.assertEqual(out.groups[0].key, 'P1__2025-01');
    h.assertEqual(out.groups[0].worklogIds.join(','), '10,11');
    h.assertEqual(out.worklogIds.join(','), '12,11,13,14,10');
    h.assertEqual(out.hasImportedLines, true);
    h.assertEqual(out.importedLineCount, 2);
  });

  h.run();
})();


window.TestHarness.test('normalizeInvoiceStatusInfo canonicalizza bozza, pagata e inviata', function () {
  const nDraft = window.DomainNormalizers.normalizeInvoiceStatusInfo({ type: 'Fattura', status: 'draft' });
  TestHarness.assertEqual(nDraft.status, 'Bozza');
  TestHarness.assertEqual(nDraft.exportStatus, 'Bozza');

  const nPaid = window.DomainNormalizers.normalizeInvoiceStatusInfo({ type: 'Fattura', stato: 'Pagato' });
  TestHarness.assertEqual(nPaid.status, 'Pagata');
  TestHarness.assertTrue(nPaid.isPaid);

  const nSent = window.DomainNormalizers.normalizeInvoiceStatusInfo({ type: 'Fattura', status: 'Inviata' });
  TestHarness.assertEqual(nSent.status, 'Emessa');
  TestHarness.assertTrue(nSent.sentToAgenzia);
  TestHarness.assertEqual(nSent.exportStatus, 'Inviata');
});
