(function () {
  const H = window.TestHarness;
  const P = window.TaxRegimePolicy;

  function withGetData(value, fn) {
    const previous = window.getData;
    window.getData = function (key) {
      return key === 'companyInfo' ? value : undefined;
    };
    try {
      fn();
    } finally {
      if (previous) window.getData = previous;
      else delete window.getData;
    }
  }

  H.test('normalizeTaxRegime accetta valori noti e normalizza il case', function () {
    H.assertEqual(P.normalizeTaxRegime(' Forfettario '), 'forfettario');
    H.assertEqual(P.normalizeTaxRegime('ORDINARIO'), 'ordinario');
    H.assertEqual(P.normalizeTaxRegime('rf19'), '');
  });

  H.test('extractRFCode estrae il codice RF anche da stringhe lunghe', function () {
    H.assertEqual(P.extractRFCode(' regime RF19 art.1 '), 'RF19');
    H.assertEqual(P.extractRFCode('rf01'), 'RF01');
    H.assertEqual(P.extractRFCode(''), '');
  });

  H.test('resolve usa taxRegime esplicito come fonte primaria', function () {
    H.assertEqual(P.resolve({ taxRegime: 'forfettario', codiceRegimeFiscale: 'RF01' }), 'forfettario');
    H.assertEqual(P.resolve({ taxRegime: 'ordinario', codiceRegimeFiscale: 'RF19' }), 'ordinario');
  });

  H.test('resolve usa il fallback codiceRegimeFiscale quando taxRegime manca', function () {
    H.assertEqual(P.resolve({ codiceRegimeFiscale: 'RF19' }), 'forfettario');
    H.assertEqual(P.resolve({ codiceRegimeFiscale: 'RF01' }), 'ordinario');
    H.assertEqual(P.resolve({ codiceRegimeFiscale: 'regime RF04 semplificato' }), 'ordinario');
  });

  H.test('resolveCompanyInfo usa getData(companyInfo) quando non riceve argomenti', function () {
    withGetData({ taxRegime: 'forfettario' }, function () {
      H.assertEqual(P.resolve(), 'forfettario');
      H.assertEqual(P.getCurrentCapabilities().isForfettario, true);
    });
  });

  H.test('getCapabilities espone capability coerenti per ordinario', function () {
    const caps = P.getCapabilities({ taxRegime: 'ordinario' });
    H.assertDeepEqual(caps, {
      regime: 'ordinario',
      hasTaxRegime: true,
      isForfettario: false,
      isOrdinario: true,
      canManagePurchases: true,
      canManageSuppliers: true,
      canUseVatRegisters: true,
      canUseLmSimulation: false,
      canUseOrdinarioSimulation: true,
      shouldShowPurchaseDelete: true
    });
  });

  H.test('getCapabilities espone capability coerenti per forfettario', function () {
    const caps = P.getCapabilities({ taxRegime: 'forfettario' });
    H.assertDeepEqual(caps, {
      regime: 'forfettario',
      hasTaxRegime: true,
      isForfettario: true,
      isOrdinario: false,
      canManagePurchases: false,
      canManageSuppliers: false,
      canUseVatRegisters: false,
      canUseLmSimulation: true,
      canUseOrdinarioSimulation: false,
      shouldShowPurchaseDelete: false
    });
  });

  H.test('getUiVisibility riflette le capability di regime', function () {
    const ui = P.getUiVisibility({ taxRegime: 'forfettario' });
    H.assertEqual(ui.showForfettarioFields, true);
    H.assertEqual(ui.showOrdinarioFields, false);
    H.assertEqual(ui.showPurchasesMenu, false);
    H.assertEqual(ui.scadenziario.showVatDeadlines, false);
  });

  H.test('getInvoiceDefaults forza IVA zero e natura N2.2 in forfettario', function () {
    const d = P.getInvoiceDefaults({ taxRegime: 'forfettario', aliquotaIVA: 22 });
    H.assertDeepEqual(d, {
      regime: 'forfettario',
      isForfettario: true,
      isOrdinario: false,
      defaultIva: '0',
      disableIvaFields: true,
      vatNatureDefault: 'N2.2'
    });
  });

  H.test('getInvoiceDefaults usa aliquota aziendale o default ordinario', function () {
    H.assertEqual(P.getInvoiceDefaults({ taxRegime: 'ordinario', aliquotaIva: 10 }).defaultIva, '10');
    H.assertEqual(P.getInvoiceDefaults({ taxRegime: 'ordinario', aliquotaIVA: 4 }).defaultIva, '4');
    H.assertEqual(P.getInvoiceDefaults({ taxRegime: 'ordinario' }).defaultIva, '22');
  });

  H.test('fromFormValues risolve il regime come la policy standard', function () {
    H.assertEqual(P.fromFormValues('forfettario', 'RF01'), 'forfettario');
    H.assertEqual(P.fromFormValues('', 'RF19'), 'forfettario');
    H.assertEqual(P.fromFormValues('', 'RF02'), 'ordinario');
  });

  H.test('assenza di regime restituisce capability vuote ma coerenti', function () {
    const caps = P.getCapabilities({});
    H.assertEqual(caps.regime, '');
    H.assertEqual(caps.hasTaxRegime, false);
    H.assertEqual(caps.canManagePurchases, false);
    H.assertEqual(caps.canUseLmSimulation, false);
  });

  window.addEventListener('load', function () {
    H.renderResults('test-results');
  });
})();
