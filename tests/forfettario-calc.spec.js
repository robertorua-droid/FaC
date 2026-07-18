(function () {
  const h = window.TestHarness;
  const F = window.ForfettarioCalc;

  h.test('ForfettarioCalc.listAvailableYears estrae anni unici in ordine decrescente', function () {
    const years = F.listAvailableYears({
      invoices: [
        { date: '2024-01-10' },
        { date: '2025-03-01' },
        { date: '2024-06-20' },
        { date: '2023-12-31' }
      ]
    });
    h.assertDeepEqual(years, [2025, 2024, 2023]);
  });

  h.test('ForfettarioCalc.computeYearlySummary calcola compensi netti con nota di credito e bollo opzionale', function () {
    const backup = {
      companyInfo: {
        coefficienteRedditivita: 78,
        aliquotaSostitutiva: 15,
        aliquotaContributi: 26,
        nazione: 'Italia'
      },
      invoices: [
        {
          date: '2025-01-15', type: 'Fattura', status: 'Pagata',
          totalePrestazioni: 1000, totaleImponibile: 1040, importoBollo: 2, total: 1042,
          rivalsa: { importo: 40 }
        },
        {
          date: '2025-02-20', type: 'Nota di Credito', status: 'Pagata',
          totalePrestazioni: 200, totaleImponibile: 208, importoBollo: 0, total: 208,
          rivalsa: { importo: 8 }
        }
      ]
    };

    const out = F.computeYearlySummary(backup, { year: 2025, includeBolloInCompensi: true });
    h.assertEqual(out.meta.countryCodeCompany, 'IT');
    h.assertApprox(out.totals.totalePrestazioni.netto, 800, 0.001, 'prestazioni nette');
    h.assertApprox(out.totals.rivalsaINPS.netto, 32, 0.001, 'rivalsa netta');
    h.assertApprox(out.totals.totaleImponibile.netto, 832, 0.001, 'imponibile netto');
    h.assertApprox(out.totals.bollo.netto, 2, 0.001, 'bollo netto');
    h.assertApprox(out.totals.compensiNettiConBollo, 834, 0.001, 'compensi con bollo');
    h.assertApprox(out.forfettarioSimulation.baseCompensi, 834, 0.001, 'base compensi simulazione');
  });

  h.test('ForfettarioCalc.computeYearlySummary filtra per stato pagata quando onlyPaid=true', function () {
    const backup = {
      companyInfo: { coefficienteRedditivita: 78, aliquotaSostitutiva: 15, aliquotaContributi: 26 },
      invoices: [
        { date: '2025-01-10', type: 'Fattura', status: 'Pagata', totalePrestazioni: 500, totaleImponibile: 500, importoBollo: 2, total: 502 },
        { date: '2025-01-11', type: 'Fattura', status: 'Bozza', totalePrestazioni: 700, totaleImponibile: 700, importoBollo: 2, total: 702 }
      ]
    };
    const out = F.computeYearlySummary(backup, { year: 2025, onlyPaid: true });
    h.assertEqual(out.totals.fattureCount, 1);
    h.assertApprox(out.totals.compensiNettiBase, 500, 0.001);
  });

  h.test('ForfettarioCalc.computeYearlySummary usa mappe anno-specifiche per contributi, acconti e crediti', function () {
    const backup = {
      companyInfo: {
        coefficienteRedditivita: 78,
        aliquotaSostitutiva: 15,
        aliquotaContributi: 26,
        contributiVersatiByYear: { '2025': 1000 },
        accontiVersatiByYear: { '2025': 400 },
        creditiImpostaByYear: { '2025': 50 }
      },
      invoices: [
        { date: '2025-04-01', type: 'Fattura', status: 'Pagata', totalePrestazioni: 10000, totaleImponibile: 10000, importoBollo: 2, total: 10002 }
      ]
    };
    const out = F.computeYearlySummary(backup, { year: 2025, includeBolloInCompensi: false });
    h.assertApprox(out.companyParams.contributiVersati, 1000, 0.001);
    h.assertApprox(out.companyParams.accontiImpostaVersati, 400, 0.001);
    h.assertApprox(out.companyParams.creditiImposta, 50, 0.001);
    h.assertApprox(out.forfettarioSimulation.redditoForfettario, 7800, 0.001);
    h.assertApprox(out.forfettarioSimulation.contributiINPSStimati, 2028, 0.001);
    h.assertApprox(out.forfettarioSimulation.impostaSostitutivaStimata, 865.8, 0.001);
    h.assertApprox(out.forfettarioSimulation.versamenti.imposta.saldoNettoDaVersare, 415.8, 0.001);
  });


  h.test('ForfettarioCalc.computeYearlySummary legge taxAdjustmentsByYear per LM e RR/PXX', function () {
    const backup = {
      companyInfo: {
        coefficienteRedditivita: 67,
        aliquotaSostitutiva: 15,
        aliquotaContributi: 26.07,
        taxAdjustmentsByYear: {
          '2025': {
            lm: {
              contributiDeducibiliVersati: 3267.75,
              accontiImpostaVersati: 100,
              creditiImposta: 50,
              saldoF24: 229
            },
            inps: {
              versatiAnno: 3267.75,
              saldoF24: 516
            }
          },
          '2026': {
            lm: { acconto1F24: 229, acconto2F24: 229 },
            inps: { acconto1F24: 1513.52, acconto2F24: 1513.52 }
          }
        }
      },
      invoices: [
        { date: '2025-04-01', type: 'Fattura', status: 'Pagata', totalePrestazioni: 21180, totaleImponibile: 21662.40, importoBollo: 28, total: 21690.40, rivalsa: { importo: 482.40 } }
      ]
    };
    const out = F.computeYearlySummary(backup, { year: 2025, includeBolloInCompensi: false });
    const sim = out.forfettarioSimulation;
    h.assertApprox(sim.redditoForfettario, 14513.808, 0.001);
    h.assertApprox(sim.contributiINPSStimati, 3783.7497456, 0.001);
    h.assertApprox(sim.contributiDaVersareStimati, 515.9997456, 0.001);
    h.assertEqual(sim.usaContributiDeducibiliManuali, true);
    h.assertApprox(sim.contributiDeducibiliPerImposta, 3267.75, 0.001);
    h.assertApprox(sim.versamenti.inps.saldoF24, 516, 0.001);
    h.assertApprox(sim.versamenti.inps.accontoAnnoSuccessivo1F24, 1513.52, 0.001);
    h.assertApprox(sim.versamenti.imposta.accontoAnnoSuccessivo1F24, 229, 0.001);
  });


  h.test('ForfettarioCalc normalizza importi F24 con virgola e separatore migliaia', function () {
    const backup = {
      companyInfo: {
        coefficienteRedditivita: '67',
        aliquotaSostitutiva: '15',
        aliquotaContributi: '26,07',
        taxAdjustmentsByYear: {
          '2025': {
            lm: { contributiDeducibiliVersati: '3.267,75' },
            inps: { versatiAnno: '3.267,75', saldoF24: '516,00' }
          },
          '2026': {
            lm: { acconto1F24: '229,00', acconto2F24: '229,00' },
            inps: { acconto1F24: '1.513,52', acconto2F24: '1.513,52' }
          }
        }
      },
      invoices: [
        { date: '2025-04-01', type: 'Fattura', status: 'Pagata', totalePrestazioni: 21180, totaleImponibile: 21662.40, importoBollo: 28, total: 21690.40, rivalsa: { importo: 482.40 } }
      ]
    };
    const out = F.computeYearlySummary(backup, { year: 2025, includeBolloInCompensi: false });
    h.assertApprox(out.companyParams.inpsVersatiAnno, 3267.75, 0.001);
    h.assertApprox(out.companyParams.inpsSaldoF24, 516, 0.001);
    h.assertApprox(out.companyParams.accontoInpsAnnoSuccessivo1F24, 1513.52, 0.001);
    h.assertApprox(out.companyParams.accontoImpostaAnnoSuccessivo1F24, 229, 0.001);
  });


  h.test('ForfettarioCalc non applica più i vecchi versamenti globali senza anno', function () {
    const backup = {
      companyInfo: {
        coefficienteRedditivita: 67,
        aliquotaSostitutiva: 15,
        aliquotaContributi: 26.07,
        contributiVersati: 9999,
        accontiImpostaVersati: 9999,
        creditiImposta: 9999
      },
      invoices: [
        { date: '2026-01-10', type: 'Fattura', status: 'Pagata', totalePrestazioni: 1000, totaleImponibile: 1000, importoBollo: 0, total: 1000 }
      ]
    };
    const out = F.computeYearlySummary(backup, { year: 2026 });
    h.assertApprox(out.companyParams.inpsVersatiAnno, 0, 0.001);
    h.assertApprox(out.companyParams.accontiImpostaVersati, 0, 0.001);
    h.assertApprox(out.companyParams.creditiImposta, 0, 0.001);
  });


  h.test('ForfettarioCalc mantiene gli acconti F24 dell’anno senza applicarli automaticamente come versati', function () {
    const backup = {
      companyInfo: {
        coefficienteRedditivita: 67,
        aliquotaSostitutiva: 15,
        aliquotaContributi: 26.07,
        taxAdjustmentsByYear: {
          '2026': {
            lm: { acconto1F24: 229, acconto2F24: 229 },
            inps: { acconto1F24: 1513.52, acconto2F24: 1513.52 }
          }
        }
      },
      invoices: [
        { date: '2026-01-10', type: 'Fattura', status: 'Pagata', totalePrestazioni: 1000, totaleImponibile: 1000, importoBollo: 0, total: 1000 }
      ]
    };
    const out = F.computeYearlySummary(backup, { year: 2026 });
    h.assertApprox(out.companyParams.accontiImpostaVersati, 0, 0.001);
    h.assertApprox(out.companyParams.inpsVersatiAnno, 0, 0.001);
    h.assertApprox(out.companyParams.fiscalAdjustments.incomeYearData.lm.acconto1F24, 229, 0.001);
    h.assertApprox(out.companyParams.fiscalAdjustments.incomeYearData.lm.acconto2F24, 229, 0.001);
    h.assertApprox(out.companyParams.fiscalAdjustments.incomeYearData.inps.acconto1F24, 1513.52, 0.001);
    h.assertApprox(out.companyParams.fiscalAdjustments.incomeYearData.inps.acconto2F24, 1513.52, 0.001);
  });



  h.run();
})();
