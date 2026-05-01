(function () {
  const H = window.TestHarness;
  const M = window.InvoiceXMLMapper;

  function buildContext(overrides) {
    const base = {
      invoice: {
        number: '15',
        date: '2025-04-20',
        type: 'Fattura',
        modalitaPagamento: 'Bonifico Bancario',
        bankChoice: '1',
        condizioniPagamento: 'TP02',
        dataRiferimento: '2025-04-20',
        giorniTermini: 30,
        lines: [
          { productName: 'Consulenza fiscale aprile', qty: 2, price: 100, subtotal: 200, iva: 22 }
        ]
      },
      company: {
        name: 'Studio Rossi SRL',
        piva: '12345678901',
        codiceFiscale: '12345678901',
        codiceRegimeFiscale: 'RF01',
        address: 'Via Verdi 10',
        numeroCivico: '10',
        cap: '00100',
        comune: 'Roma',
        provincia: 'RM',
        banca1: 'Banca Uno',
        iban1: 'IT60X0542811101000000123456',
        banca2: 'Banca Due',
        iban2: 'IT82 A030 6909 6061 0000 1234 56',
        aliquotaIva: 22,
        aliquotaRitenuta: 20,
        aliquotaInps: 4
      },
      customer: {
        name: 'ACME SRL',
        piva: '01234567890',
        codiceFiscale: '01234567890',
        address: 'Corso Italia 20',
        cap: '20100',
        comune: 'Milano',
        provincia: 'MI',
        sdi: 'ABC1234'
      },
      calc: {
        totPrest: 200,
        riv: 0,
        totDoc: 244,
        impBollo: 0,
        ritenuta: 0,
        nettoDaPagare: 244,
        isForfettario: false,
        factorScorporo: 1,
        vatMap: new Map([
          ['22', { aliquota: 22, natura: null, imponibile: 200, imposta: 44 }]
        ])
      },
      bolloAcaricoEmittente: false
    };
    const o = overrides || {};
    return {
      invoice: Object.assign({}, base.invoice, o.invoice || {}),
      company: Object.assign({}, base.company, o.company || {}),
      customer: Object.assign({}, base.customer, o.customer || {}),
      calc: Object.assign({}, base.calc, o.calc || {}),
      bolloAcaricoEmittente: 'bolloAcaricoEmittente' in o ? o.bolloAcaricoEmittente : base.bolloAcaricoEmittente
    };
  }

  H.test('genera XML ordinario con header, riepilogo IVA e dati pagamento attesi', function () {
    const result = M.buildInvoiceXmlPayload(buildContext());
    H.assertMatch(result.filename, /^IT12345678901_[a-z0-9]{5}\.xml$/i, 'Nome file XML inatteso');
    H.assertIncludes(result.xml, '<TipoDocumento>TD01</TipoDocumento>');
    H.assertIncludes(result.xml, '<AliquotaIVA>22.00</AliquotaIVA>');
    H.assertIncludes(result.xml, '<EsigibilitaIVA>I</EsigibilitaIVA>');
    H.assertIncludes(result.xml, '<Denominazione>Studio Rossi SRL</Denominazione>');
    H.assertIncludes(result.xml, '<Denominazione>ACME SRL</Denominazione>');
    H.assertIncludes(result.xml, '<CodiceDestinatario>ABC1234</CodiceDestinatario>');
    H.assertIncludes(result.xml, '<IBAN>IT60X0542811101000000123456</IBAN>');
  });

  H.test('forfettario aggiunge Natura N2.2 e riferimento normativo nel riepilogo', function () {
    const ctx = buildContext({
      company: { codiceRegimeFiscale: 'RF19' },
      calc: {
        totDoc: 200,
        nettoDaPagare: 200,
        isForfettario: true,
        vatMap: new Map([
          ['n22', { aliquota: 0, natura: 'N2.2', imponibile: 200, imposta: 0 }]
        ])
      },
      invoice: {
        lines: [{ productName: 'Prestazione forfettaria', qty: 1, price: 200, subtotal: 200, iva: 0 }]
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<Natura>N2.2</Natura>');
    H.assertIncludes(result.xml, '<RiferimentoNormativo>Operazione in franchigia da IVA ai sensi dell&apos;art. 1, commi 54-89, L. 190/2014</RiferimentoNormativo>');
  });

  H.test('nota di credito usa TD04 e rende negativi totale documento, pagamento e quantità', function () {
    const ctx = buildContext({
      invoice: {
        type: 'Nota di Credito',
        linkedInvoice: 'FAT-2025-001',
        reason: 'Storno parziale',
        lines: [{ productName: 'Rettifica parcella', qty: 1, price: 100, subtotal: 100, iva: 22 }]
      },
      calc: {
        totPrest: 100,
        totDoc: 122,
        nettoDaPagare: 122,
        vatMap: new Map([
          ['22', { aliquota: 22, natura: null, imponibile: 100, imposta: 22 }]
        ])
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<TipoDocumento>TD04</TipoDocumento>');
    H.assertIncludes(result.xml, '<ImportoTotaleDocumento>-122.00</ImportoTotaleDocumento>');
    H.assertIncludes(result.xml, '<ImportoPagamento>-122.00</ImportoPagamento>');
    H.assertIncludes(result.xml, '<Quantita>-1.00</Quantita>');
    H.assertIncludes(result.xml, '<Causale>Nota di credito collegata al documento FAT-2025-001</Causale>');
    H.assertIncludes(result.xml, '<Causale>Storno parziale</Causale>');
  });

  H.test('usa Nome/Cognome per persona fisica cliente', function () {
    const ctx = buildContext({
      customer: {
        name: '', ragioneSociale: '',
        nome: 'Mario', cognome: 'Rossi',
        piva: '', codiceFiscale: 'RSSMRA80A01F205X'
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<Nome>Mario</Nome>');
    H.assertIncludes(result.xml, '<Cognome>Rossi</Cognome>');
  });

  H.test('bankChoice=2 usa banca e IBAN secondari ripulendo gli spazi', function () {
    const ctx = buildContext({ invoice: { bankChoice: '2' } });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<IstitutoFinanziario>Banca Due</IstitutoFinanziario>');
    H.assertIncludes(result.xml, '<IBAN>IT82A0306909606100000123456</IBAN>');
  });

  H.test('esclude dalla sezione linee la voce Rivalsa Bollo ma mantiene DatiBollo', function () {
    const ctx = buildContext({
      invoice: {
        lines: [
          { productName: 'Consulenza', qty: 1, price: 100, subtotal: 100, iva: 0 },
          { productName: 'Rivalsa Bollo', qty: 1, price: 2, subtotal: 2, iva: 0 }
        ]
      },
      calc: {
        totPrest: 100,
        totDoc: 102,
        impBollo: 2,
        nettoDaPagare: 102,
        vatMap: new Map([
          ['n22', { aliquota: 0, natura: 'N2.2', imponibile: 100, imposta: 0 }]
        ])
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<ImportoBollo>2.00</ImportoBollo>');
    H.assertIncludes(result.xml, '<Descrizione>Consulenza</Descrizione>');
    if (result.xml.includes('<Descrizione>Rivalsa Bollo</Descrizione>')) {
      throw new Error('La voce Rivalsa Bollo non deve essere esportata come DettaglioLinee autonomo');
    }
  });

  H.test('rivalsa previdenziale genera DatiCassaPrevidenziale coerenti', function () {
    const ctx = buildContext({
      calc: {
        totPrest: 1000,
        riv: 40,
        totDoc: 1268.8,
        nettoDaPagare: 1268.8,
        vatMap: new Map([
          ['22', { aliquota: 22, natura: null, imponibile: 1040, imposta: 228.8 }]
        ])
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<DatiCassaPrevidenziale>');
    H.assertIncludes(result.xml, '<TipoCassa>TC22</TipoCassa>');
    H.assertIncludes(result.xml, '<AlCassa>4.00</AlCassa>');
    H.assertIncludes(result.xml, '<ImportoContributoCassa>40.00</ImportoContributoCassa>');
  });

  H.test('priceType gross con factorScorporo valorizzato esporta imponibile di riga scorporato', function () {
    const ctx = buildContext({
      invoice: {
        lines: [
          { productName: 'Prestazione lorda', qty: 1, price: 122, subtotal: 122, iva: 22, priceType: 'gross' }
        ]
      },
      calc: {
        totPrest: 100,
        totDoc: 122,
        nettoDaPagare: 122,
        factorScorporo: 1.22,
        vatMap: new Map([
          ['22', { aliquota: 22, natura: null, imponibile: 100, imposta: 22 }]
        ])
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<PrezzoUnitario>100.00000000</PrezzoUnitario>');
    H.assertIncludes(result.xml, '<PrezzoTotale>100.00</PrezzoTotale>');
  });

  H.test('causale lunga viene spezzata su più elementi XML da massimo 200 caratteri', function () {
    const longReason = 'A'.repeat(210) + 'B'.repeat(30);
    const ctx = buildContext({
      company: { codiceRegimeFiscale: 'RF19' },
      invoice: { type: 'Nota di Credito', linkedInvoice: 'FAT-2025-050', reason: longReason },
      calc: {
        isForfettario: true,
        totDoc: 0,
        nettoDaPagare: 0,
        vatMap: new Map([
          ['n22', { aliquota: 0, natura: 'N2.2', imponibile: 0, imposta: 0 }]
        ])
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    const matches = result.xml.match(/<Causale>/g) || [];
    H.assertEqual(matches.length >= 3, true, 'Attesi almeno 3 elementi Causale tra riferimento, causale spezzata e nota forfettario');
    H.assertIncludes(result.xml, '<Causale>' + 'A'.repeat(200) + '</Causale>');
    H.assertIncludes(result.xml, '<Causale>' + 'A'.repeat(10) + 'B'.repeat(30) + '</Causale>');
  });

  H.test('nota di credito con documento collegato e data collegata esporta DatiFattureCollegate', function () {
    const ctx = buildContext({
      invoice: {
        type: 'Nota di Credito',
        linkedDocument: 'FAT-2025-050',
        linkedDocumentDate: '2025-03-15',
        causale: 'Storno parziale'
      },
      calc: {
        totDoc: 0,
        nettoDaPagare: 0,
        vatMap: new Map([
          ['22', { aliquota: 22, natura: null, imponibile: 0, imposta: 0 }]
        ])
      }
    });
    const result = M.buildInvoiceXmlPayload(ctx);
    H.assertIncludes(result.xml, '<DatiFattureCollegate>');
    H.assertIncludes(result.xml, '<IdDocumento>FAT-2025-050</IdDocumento>');
    H.assertIncludes(result.xml, '<Data>2025-03-15</Data>');
  });


  window.addEventListener('load', function () {
    H.renderResults('test-results');
  });
})();
