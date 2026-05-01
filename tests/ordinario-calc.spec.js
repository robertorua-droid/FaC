(function () {
  const h = window.TestHarness;
  const O = window.OrdinarioCalc;

  h.test('OrdinarioCalc.computeYearlySummary calcola imponibile, spese e basi fiscali su anno selezionato', function () {
    const backup = {
      invoices: [
        { date: '2025-01-10', type: 'Fattura', status: 'Pagata', totaleImponibile: 1000, importoBollo: 2, ritenutaAcconto: 100 },
        { date: '2025-02-10', type: 'Nota di Credito', status: 'Pagata', totaleImponibile: 200, importoBollo: 0, ritenutaAcconto: 20 }
      ],
      purchases: [
        { date: '2025-01-20', status: 'Pagata', imponibile: 300 }
      ]
    };
    const out = O.computeYearlySummary(backup, {
      year: 2025,
      aliquotaGestioneSeparata: 26,
      detrazioniIrpef: 100,
      creditiIrpef: 50,
      accontiIrpefVersati: 200,
      inpsVersati: 100,
      includeBolloInCompensi: true
    });

    h.assertEqual(out.meta.year, 2025);
    h.assertApprox(out.totals.compensiImponibile, 800, 0.001);
    h.assertApprox(out.totals.bollo, 2, 0.001);
    h.assertApprox(out.totals.baseCompensi, 802, 0.001);
    h.assertApprox(out.totals.spese, 300, 0.001);
    h.assertApprox(out.totals.redditoPrimaInps, 502, 0.001);
    h.assertApprox(out.inps.contributiDovuti, 130.52, 0.001);
    h.assertApprox(out.irpef.baseIrpef, 371.48, 0.001);
    h.assertApprox(out.irpef.irpefLorda, 85.4404, 0.001);
    h.assertApprox(out.irpef.irpefNetta, 0, 0.001);
    h.assertApprox(out.irpef.credito, 280, 0.001);
  });

  h.test('OrdinarioCalc.computeYearlySummary rispetta onlyPaid per fatture e acquisti', function () {
    const backup = {
      invoices: [
        { date: '2025-01-10', type: 'Fattura', status: 'Pagata', totaleImponibile: 1000, importoBollo: 0, ritenutaAcconto: 0 },
        { date: '2025-02-10', type: 'Fattura', status: 'Bozza', totaleImponibile: 500, importoBollo: 0, ritenutaAcconto: 0 }
      ],
      purchases: [
        { date: '2025-01-20', status: 'Pagata', imponibile: 100 },
        { date: '2025-02-20', status: 'Da Pagare', imponibile: 50 }
      ]
    };
    const out = O.computeYearlySummary(backup, { year: 2025, onlyPaid: true, aliquotaGestioneSeparata: 0 });
    h.assertEqual(out.totals.fattureCount, 1);
    h.assertEqual(out.totals.acquistiCount, 1);
    h.assertApprox(out.totals.baseCompensi, 1000, 0.001);
    h.assertApprox(out.totals.spese, 100, 0.001);
  });

  h.test('OrdinarioCalc.computeYearlySummary usa fallback righe fattura se totaleImponibile manca', function () {
    const backup = {
      invoices: [
        {
          date: '2025-03-01', type: 'Fattura', status: 'Pagata', importoBollo: 0, ritenutaAcconto: 0,
          lines: [ { qty: 2, price: 100 }, { qty: 1, price: 50 } ]
        }
      ],
      purchases: []
    };
    const out = O.computeYearlySummary(backup, { year: 2025, aliquotaGestioneSeparata: 0 });
    h.assertApprox(out.totals.compensiImponibile, 250, 0.001);
    h.assertApprox(out.totals.baseCompensi, 250, 0.001);
  });

  h.test('OrdinarioCalc.computeYearlySummary applica scaglioni 2024+ e acconti IRPEF in due rate', function () {
    const backup = {
      invoices: [
        { date: '2025-01-10', type: 'Fattura', status: 'Pagata', totaleImponibile: 60000, importoBollo: 0, ritenutaAcconto: 0 }
      ],
      purchases: []
    };
    const out = O.computeYearlySummary(backup, { year: 2025, aliquotaGestioneSeparata: 0 });
    h.assertApprox(out.irpef.irpefLorda, 18440, 0.001);
    h.assertEqual(out.acconti.irpef.rate.length, 2);
    h.assertApprox(out.acconti.irpef.rate[0].importo, 7376, 0.001);
    h.assertApprox(out.acconti.irpef.rate[1].importo, 11064, 0.001);
  });

  h.run();
})();
