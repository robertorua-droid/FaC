(function () {
  const H = window.TestHarness;
  const V = window.InvoiceXMLValidator;

  function buildValidContext(overrides) {
    const base = {
      invoice: {
        id: 'inv-1',
        number: '12',
        date: '2025-04-15',
        type: 'Fattura',
        modalitaPagamento: 'Bonifico',
        bankChoice: '1',
        lines: [
          { productName: 'Consulenza professionale', qty: 1, price: 100 }
        ]
      },
      customer: {
        name: 'ACME SRL',
        piva: '01234567890',
        address: 'Via Roma 1',
        cap: '20100',
        comune: 'Milano'
      },
      company: {
        name: 'Studio Rossi',
        piva: '12345678901',
        codiceFiscale: 'RSSMRA80A01F205X',
        codiceRegimeFiscale: 'RF19',
        address: 'Via Verdi 10',
        cap: '00100',
        comune: 'Roma',
        iban1: 'IT60X0542811101000000123456'
      }
    };

    if (!overrides) return base;

    return {
      invoice: Object.assign({}, base.invoice, overrides.invoice || {}),
      customer: Object.assign({}, base.customer, overrides.customer || {}),
      company: Object.assign({}, base.company, overrides.company || {})
    };
  }

  H.test('validateExportContext accetta un contesto XML completo e coerente', function () {
    const result = V.validateExportContext(buildValidContext());
    H.assertEqual(result.ok, true);
  });

  H.test('blocca export se manca il numero documento', function () {
    const result = V.validateExportContext(buildValidContext({ invoice: { number: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Numero documento mancante: completa la fattura prima di esportare XML.');
  });

  H.test('blocca export se manca la data documento', function () {
    const result = V.validateExportContext(buildValidContext({ invoice: { date: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Data documento mancante: completa la fattura prima di esportare XML.');
  });

  H.test('blocca export se il cliente non ha denominazione o nome/cognome', function () {
    const result = V.validateExportContext(buildValidContext({ customer: { name: '', ragioneSociale: '', nome: '', cognome: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Cliente incompleto: manca la denominazione oppure il nome/cognome del cessionario/committente per il file XML.');
  });

  H.test('blocca export se manca un identificativo fiscale cliente', function () {
    const result = V.validateExportContext(buildValidContext({ customer: { piva: '', codiceFiscale: '', cf: '', taxCode: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, "Cliente incompleto: indica almeno un identificativo fiscale (P.IVA o Codice Fiscale) prima dell'export XML.");
  });

  H.test('accetta alias indirizzo cliente come zip/city/address', function () {
    const ctx = buildValidContext({
      customer: {
        address: '', cap: '', comune: '',
        street: 'Corso Italia 20', zip: '10100', city: 'Torino'
      }
    });
    const result = V.validateExportContext(ctx);
    H.assertEqual(result.ok, true);
  });

  H.test('blocca export se il cliente non ha indirizzo completo', function () {
    const result = V.validateExportContext(buildValidContext({ customer: { address: '', cap: '', comune: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Cliente incompleto: per il file XML servono indirizzo, CAP e comune del cessionario/committente.');
  });

  H.test('ignora una riga di solo rivalsa bollo e richiede almeno una riga esportabile', function () {
    const result = V.validateExportContext(buildValidContext({ invoice: { lines: [{ productName: 'Rivalsa Bollo' }] } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Il documento non contiene righe descrittive esportabili nel file XML.');
  });

  H.test('blocca export se manca il codice regime fiscale azienda', function () {
    const result = V.validateExportContext(buildValidContext({ company: { codiceRegimeFiscale: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Compila il codice regime fiscale azienda prima di esportare XML.');
  });

  H.test('accetta alias indirizzo azienda come postalCode/town/street', function () {
    const ctx = buildValidContext({
      company: {
        address: '', cap: '', comune: '',
        street: 'Via Po 5', postalCode: '50100', town: 'Firenze'
      }
    });
    const result = V.validateExportContext(ctx);
    H.assertEqual(result.ok, true);
  });

  H.test('blocca export con bonifico se manca IBAN aziendale selezionato', function () {
    const result = V.validateExportContext(buildValidContext({ company: { iban1: '' }, invoice: { modalitaPagamento: 'Bonifico bancario' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, "Dati pagamento incompleti: per l'XML con bonifico serve un IBAN aziendale valorizzato.");
  });

  H.test('usa l\'IBAN secondario quando bankChoice=2', function () {
    const ctx = buildValidContext({ company: { iban1: '', iban2: 'IT82A0306909606100000123456' }, invoice: { bankChoice: '2' } });
    const result = V.validateExportContext(ctx);
    H.assertEqual(result.ok, true);
  });

  H.test('nota di credito richiede almeno documento collegato o causale', function () {
    const result = V.validateExportContext(buildValidContext({ invoice: { type: 'Nota di Credito', linkedInvoice: '', reason: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, "Nota di credito incompleta: indica almeno il documento collegato o una causale prima dell'export XML.");
  });

  H.test('nota di credito con riferimento troppo corto viene bloccata', function () {
    const result = V.validateExportContext(buildValidContext({ invoice: { type: 'Nota di Credito', linkedInvoice: 'A1', reason: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Documento collegato troppo corto: per la nota di credito inserisci un riferimento riconoscibile (es. numero fattura).');
  });

  H.test('nota di credito con causale valida passa anche senza documento collegato', function () {
    const result = V.validateExportContext(buildValidContext({ invoice: { type: 'Nota di Credito', linkedInvoice: '', reason: 'Storno parziale per errore materiale' } }));
    H.assertEqual(result.ok, true);
  });

  H.test('eredita il blocco base se manca l\'identità fiscale azienda', function () {
    const result = V.validateExportContext(buildValidContext({ company: { piva: '', codiceFiscale: '' } }));
    H.assertEqual(result.ok, false);
    H.assertEqual(result.message, 'Compila i dati azienda: serve almeno P.IVA o Codice Fiscale per generare la fattura elettronica (IdTrasmittente/IdCodice).');
  });

  H.test('nota di credito valida anche con alias legacy di documento collegato e causale', function () {
    const input = buildInput({
      invoice: { documentType: 'Nota di Credito', linkedDocument: 'FAT-2025-050', causale: 'Storno parziale' }
    });
    const out = V.validateExportContext(input);
    H.assertEqual(out.ok, true);
  });


  window.addEventListener('load', function () {
    H.renderResults('test-results');
  });
})();
