// js/features/tax/ordinario-calc.js
// Simulazione DIDATTICA (ma coerente) per Regime Ordinario / Professionista.
// Nota: NON sostituisce il parere di un professionista. Numerazioni righi/aliquote possono variare per annualita'.

(function () {
  function toNum(v) {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function getYearFromDate(d) {
    if (!d || typeof d !== 'string' || d.length < 4) return null;
    const y = d.substring(0, 4);
    return /^\d{4}$/.test(y) ? parseInt(y, 10) : null;
  }

  function isNotaCredito(inv) {
    const t = String(inv && inv.type ? inv.type : '').toLowerCase();
    return t.includes('credito');
  }

  function sumInvoiceImponibileFallback(inv) {
    const lines = Array.isArray(inv && inv.lines) ? inv.lines : [];
    return lines.reduce((acc, l) => acc + (toNum(l.qty) * toNum(l.price)), 0);
  }

  function getIrpefBrackets(year) {
    // DIDATTICO: scaglioni piu' comuni (IRPEF statale). Non include addizionali.
    // 2024+ (riforma a 3 aliquote): 23% fino a 28k, 35% fino a 50k, 43% oltre.
    // 2022-2023: 23% fino a 15k, 25% fino a 28k, 35% fino a 50k, 43% oltre.
    if (year && year >= 2024) {
      return [
        { upto: 28000, rate: 0.23 },
        { upto: 50000, rate: 0.35 },
        { upto: Infinity, rate: 0.43 }
      ];
    }
    if (year && year >= 2022) {
      return [
        { upto: 15000, rate: 0.23 },
        { upto: 28000, rate: 0.25 },
        { upto: 50000, rate: 0.35 },
        { upto: Infinity, rate: 0.43 }
      ];
    }
    // fallback prudente
    return [
      { upto: 28000, rate: 0.23 },
      { upto: 50000, rate: 0.35 },
      { upto: Infinity, rate: 0.43 }
    ];
  }

  function computeIrpefLord(year, taxable) {
    let remaining = Math.max(0, taxable);
    let prev = 0;
    let imposta = 0;
    const brackets = getIrpefBrackets(year);

    for (const b of brackets) {
      const cap = Math.max(0, b.upto - prev);
      const chunk = Math.min(remaining, cap);
      if (chunk <= 0) break;
      imposta += chunk * b.rate;
      remaining -= chunk;
      prev = b.upto;
    }
    return imposta;
  }

  function computeAccontiIrpef(baseAcconto) {
    // DIDATTICO: regole soglia comuni
    // - sotto 51,65 => niente acconti
    // - 51,65 - 257,52 => unica rata
    // - >= 257,52 => 40% + 60%
    const v = Math.max(0, baseAcconto);
    if (v < 51.65) {
      return { total: 0, mode: 'none', first: 0, second: 0 };
    }
    if (v < 257.52) {
      return { total: v, mode: 'single', first: v, second: 0 };
    }
    return { total: v, mode: 'two', first: v * 0.40, second: v * 0.60 };
  }

  function computeAccontiInps(contributiDovuti, percent = 0.80) {
    const p = Math.max(0, Math.min(1, percent));
    const total = Math.max(0, contributiDovuti) * p;
    // DIDATTICO: spesso 40% + 40% (acconto 80%)
    return { total, first: total * 0.50, second: total * 0.50, percent: p };
  }

  function computeYearlySummary(backup, opts) {
    const options = opts || {};
    const yearOpt = options.year === 'all' ? 'all' : parseInt(options.year, 10);
    const onlyPaid = !!options.onlyPaid;
    const includeBollo = !!options.includeBolloInCompensi;

    const inpsAliquota = toNum(options.aliquotaGestioneSeparata ?? options.inpsAliquotaPercent ?? options.aliquotaGS ?? options.aliquota);
    const inpsVersati = toNum(options.inpsVersati);
    const detrazioni = toNum(options.detrazioniIrpef ?? options.detrazioni);
    const crediti = toNum(options.creditiIrpef ?? options.crediti);
    const accontiIrpefVersati = toNum(options.accontiIrpefVersati);
    const accontoInpsPercent = (options.accontoInpsPercent === undefined || options.accontoInpsPercent === null)
      ? 0.80
      : toNum(options.accontoInpsPercent) / 100;

    const invoices = Array.isArray(backup && backup.invoices) ? backup.invoices : [];
    const purchases = Array.isArray(backup && backup.purchases) ? backup.purchases : [];

    // --- INCOMES (Fatture / Note Credito)
    let compensi = 0;
    let bollo = 0;
    let ritenute = 0;
    let fattureCount = 0;
    let noteCreditoCount = 0;

    invoices.forEach(inv => {
      if (!inv || !inv.date) return;
      const y = getYearFromDate(inv.date);
      if (yearOpt !== 'all' && y !== yearOpt) return;

      const nota = isNotaCredito(inv);
      const sign = nota ? -1 : 1;

      if (!nota) {
        // Fattura: se onlyPaid, considera solo Pagata
        if (onlyPaid && String(inv.status || '').toLowerCase() !== 'pagata') return;
        fattureCount += 1;
      } else {
        // Nota credito: in mancanza di uno stato "pagata" dedicato, la includiamo comunque
        // (didattico: rappresenta storno/variazione del periodo)
        noteCreditoCount += 1;
      }

      const imponibile = (inv.totaleImponibile !== undefined && inv.totaleImponibile !== null)
        ? toNum(inv.totaleImponibile)
        : sumInvoiceImponibileFallback(inv);

      const invBollo = toNum(inv.importoBollo);
      const invRit = toNum(inv.ritenutaAcconto);

      compensi += sign * imponibile;
      bollo += sign * invBollo;
      ritenute += sign * invRit;
    });

    const baseCompensi = compensi + (includeBollo ? bollo : 0);

    // --- EXPENSES (Acquisti)
    let spese = 0;
    let acquistiCount = 0;
    purchases.forEach(p => {
      if (!p || !p.date) return;
      const y = getYearFromDate(p.date);
      if (yearOpt !== 'all' && y !== yearOpt) return;
      if (onlyPaid && String(p.status || '').toLowerCase() !== 'pagata') return;
      acquistiCount += 1;
      spese += toNum(p.imponibile);
    });

    const redditoPrimaInps = baseCompensi - spese;

    // --- INPS Gestione Separata (stima)
    const baseInps = Math.max(0, redditoPrimaInps);
    const contributiDovuti = baseInps * (Math.max(0, inpsAliquota) / 100);
    const saldoInps = contributiDovuti - inpsVersati;
    const accontiInps = computeAccontiInps(contributiDovuti, accontoInpsPercent);

    // --- IRPEF (statale) - base dedotta INPS
    const baseIrpef = Math.max(0, redditoPrimaInps - contributiDovuti);
    const yearForBrackets = (yearOpt === 'all') ? new Date().getFullYear() : yearOpt;

    const irpefLord = computeIrpefLord(yearForBrackets, baseIrpef);
    const irpefNetAfterDetr = Math.max(0, irpefLord - detrazioni - crediti);

    // DIDATTICO: differenza dopo ritenute e acconti versati
    const differenza = irpefNetAfterDetr - ritenute - accontiIrpefVersati;
    const saldoIrpef = Math.max(0, differenza);
    const creditoIrpef = Math.max(0, -differenza);

    // Base acconti: spesso correlata a "imposta netta" al netto delle ritenute
    const baseAccontoIrpef = Math.max(0, irpefNetAfterDetr - ritenute);
    const accontiIrpef = computeAccontiIrpef(baseAccontoIrpef);

    const bolloConsiderato = includeBollo ? bollo : 0;

    const accontiOut = {
      irpef: {
        totale: accontiIrpef.total,
        rate: accontiIrpef.mode === 'none' ? [] : (accontiIrpef.mode === 'single' ? [{ n: 1, importo: accontiIrpef.first }] : [{ n: 1, importo: accontiIrpef.first }, { n: 2, importo: accontiIrpef.second }])
      },
      inps: {
        totale: accontiInps.total,
        rate: accontiInps.total <= 0 ? [] : [{ n: 1, importo: accontiInps.first }, { n: 2, importo: accontiInps.second }],
        percent: accontiInps.percent
      }
    };

    return {
      meta: {
        year: yearOpt,
        onlyPaid,
        includeBollo
      },
      totals: {
        fattureCount,
        noteCreditoCount,
        acquistiCount,
        compensiImponibile: compensi,
        bollo,
        bolloConsiderato,
        baseCompensi,
        spese,
        speseImponibile: spese,
        redditoPrimaInps,
        redditoAnteInps: redditoPrimaInps,
        ritenute,
        ritenuteSubite: ritenute
      },
      inps: {
        aliquota: inpsAliquota,
        aliquotaPercent: inpsAliquota,
        baseInps,
        contributiDovuti,
        versati: inpsVersati,
        saldo: saldoInps
      },
      irpef: {
        baseIrpef,
        baseImponibile: baseIrpef,
        irpefLorda: irpefLord,
        irpefLord,
        detrazioni,
        crediti,
        irpefNetta: irpefNetAfterDetr,
        irpefNetAfterDetr,
        ritenute,
        accontiVersati: accontiIrpefVersati,
        differenza,
        saldo: saldoIrpef,
        credito: creditoIrpef
      },
      acconti: accontiOut,
      // Mappa quadri (didattica, senza numerazione rigida)
      quadri: {
        RE: {
          compensi: baseCompensi,
          spese,
          reddito: redditoPrimaInps
        },
        RN: {
          base: baseIrpef,
          impostaLorda: irpefLord,
          detrazioni,
          crediti,
          impostaNetta: irpefNetAfterDetr,
          ritenute,
          saldo: saldoIrpef,
          credito: creditoIrpef,
          acconto: accontiIrpef
        },
        RR: {
          aliquota: inpsAliquota,
          base: baseInps,
          dovuti: contributiDovuti,
          saldo: saldoInps,
          acconti: accontiInps
        }
      }
    };
  }

  window.OrdinarioCalc = {
    computeYearlySummary
  };
})();
