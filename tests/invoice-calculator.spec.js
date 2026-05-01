(function () {
  const H = window.TestHarness;
  const C = window.InvoiceCalculator;

  function labelsFromVatMap(vatMap) {
    return Array.from(vatMap.values()).map(function (entry) {
      return { label: entry.label, imponibile: entry.imponibile, imposta: entry.imposta, natura: entry.natura || '' };
    });
  }

  H.test('getInvoiceDefaults usa la TaxRegimePolicy per il forfettario', function () {
    const d = C.getInvoiceDefaults({ taxRegime: 'forfettario', aliquotaIVA: 22 });
    H.assertEqual(d.isForfettario, true);
    H.assertEqual(d.defaultIva, '0');
    H.assertEqual(d.vatNatureDefault, 'N2.2');
  });

  H.test('getEffectiveCompanyVatRate restituisce 0 in forfettario', function () {
    H.assertEqual(C.getEffectiveCompanyVatRate({ taxRegime: 'forfettario', aliquotaIva: 22 }), 0);
  });

  H.test('getEffectiveCompanyVatRate usa aliquota aziendale o fallback ordinario', function () {
    H.assertEqual(C.getEffectiveCompanyVatRate({ taxRegime: 'ordinario', aliquotaIva: 10 }), 10);
    H.assertEqual(C.getEffectiveCompanyVatRate({ taxRegime: 'ordinario', aliquotaIVA: 4 }), 4);
    H.assertEqual(C.getEffectiveCompanyVatRate({ taxRegime: 'ordinario' }), 22);
  });

  H.test('calculateTotals lancia errore se il motore comune non è disponibile', function () {
    const previous = window.AppModules && window.AppModules.invoicesCommonCalc;
    window.AppModules = window.AppModules || {};
    delete window.AppModules.invoicesCommonCalc;
    let thrown = false;
    try {
      C.calculateTotals([], {}, {}, 'Fattura');
    } catch (err) {
      thrown = true;
      H.assertEqual(err.message, 'Modulo invoicesCommonCalc non disponibile');
    } finally {
      if (previous) window.AppModules.invoicesCommonCalc = previous;
    }
    H.assertEqual(thrown, true);
  });

  H.test('calculateTotals calcola una fattura ordinaria semplice con IVA 22%', function () {
    const totals = C.calculateTotals([
      { qty: 1, price: 100, iva: 22, productName: 'Consulenza' }
    ], { taxRegime: 'ordinario', aliquotaIva: 22 }, {}, 'Fattura');

    H.assertApprox(totals.totPrest, 100, 0.0001);
    H.assertApprox(totals.totImp, 100, 0.0001);
    H.assertApprox(totals.ivaTot, 22, 0.0001);
    H.assertApprox(totals.impBollo, 0, 0.0001);
    H.assertApprox(totals.totDoc, 122, 0.0001);
    H.assertApprox(totals.nettoDaPagare, 122, 0.0001);
    H.assertEqual(totals.isForfettario, false);
    H.assertDeepEqual(labelsFromVatMap(totals.vatMap), [
      { label: 'IVA 22%', imponibile: 100, imposta: 22, natura: '' }
    ]);
  });

  H.test('calculateTotals in forfettario forza IVA zero e bollo automatico sopra soglia', function () {
    const totals = C.calculateTotals([
      { qty: 1, price: 100, iva: 22, productName: 'Compenso professionale' }
    ], { taxRegime: 'forfettario', aliquotaIva: 22 }, {}, 'Fattura');

    H.assertApprox(totals.totPrest, 100, 0.0001);
    H.assertApprox(totals.ivaTot, 0, 0.0001);
    H.assertApprox(totals.impBollo, 2, 0.0001);
    H.assertApprox(totals.totDoc, 102, 0.0001);
    H.assertEqual(totals.isForfettario, true);
    H.assertDeepEqual(labelsFromVatMap(totals.vatMap), [
      { label: 'IVA 0% (N2.2)', imponibile: 100, imposta: 0, natura: 'N2.2' }
    ]);
  });

  H.test('calculateTotals gestisce rivalsa INPS e ritenuta in ordinario', function () {
    const totals = C.calculateTotals([
      { qty: 1, price: 100, iva: 22, productName: 'Prestazione professionale' }
    ], { taxRegime: 'ordinario', aliquotaIva: 22, aliquotaInps: 4, aliquotaRitenuta: 20 }, {
      rivalsaInps: true,
      sostitutoImposta: true
    }, 'Fattura');

    H.assertApprox(totals.riv, 4, 0.0001);
    H.assertApprox(totals.totImp, 104, 0.0001);
    H.assertApprox(totals.ivaTot, 22.88, 0.0001);
    H.assertApprox(totals.ritenuta, 20.8, 0.0001);
    H.assertApprox(totals.totDoc, 126.88, 0.0001);
    H.assertApprox(totals.nettoDaPagare, 106.08, 0.0001);
  });

  H.test('calculateTotals gestisce lo scorporo della rivalsa su prezzi lordi', function () {
    const totals = C.calculateTotals([
      { qty: 1, price: 104, subtotal: 104, priceType: 'gross', iva: 22, productName: 'Prestazione lorda' }
    ], { taxRegime: 'ordinario', aliquotaIva: 22, aliquotaInps: 4 }, {
      rivalsaInps: true,
      scorporoRivalsaInps: true
    }, 'Fattura');

    H.assertApprox(totals.factorScorporo, 1.04, 0.0001);
    H.assertApprox(totals.totPrest, 100, 0.0001);
    H.assertApprox(totals.riv, 4, 0.0001);
    H.assertApprox(totals.totImp, 104, 0.0001);
  });

  H.test('calculateTotals può escludere il bollo dal totale documento quando richiesto', function () {
    const totals = C.calculateTotals([
      { qty: 1, price: 100, productName: 'Compenso professionale' }
    ], { taxRegime: 'forfettario' }, {}, 'Fattura', { includeBolloInTotale: false });

    H.assertApprox(totals.impBollo, 2, 0.0001);
    H.assertApprox(totals.totDoc, 100, 0.0001);
    H.assertEqual(totals.bolloIncludedInTotale, false);
  });

  window.addEventListener('load', function () {
    H.renderResults('test-results');
  });
})();
