/*!
 * Forfettario Calculation Engine
 * --------------------------------
 * Input: backup JSON exported by the gestionale (Firebase/local export)
 * Output: yearly tax-relevant aggregates (ready to map to Quadro LM)
 *
 * Design goals:
 * - Pure functions (no DOM, no Firebase)
 * - No assumptions about UI
 * - Backward compatible with existing backup structure
 *
 * Works in:
 * - Browser (window.ForfettarioCalc)
 * - Node/CommonJS (module.exports)
 */

(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.ForfettarioCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // -----------------------------
  // Helpers
  // -----------------------------
  function safeFloat(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function yearFromISODate(isoDate) {
    // expected: YYYY-MM-DD
    if (!isoDate || typeof isoDate !== "string") return null;
    var m = isoDate.match(/^(\d{4})-\d{2}-\d{2}$/);
    return m ? parseInt(m[1], 10) : null;
  }

  function upper2CountryCode(nazione) {
    // Very small, safe normalizer:
    // - already 2 letters => uppercase
    // - "Italia" => "IT"
    // - otherwise returns trimmed string (uppercased) but you should map properly upstream
    if (!nazione) return "";
    var s = String(nazione).trim();
    if (s.length === 2) return s.toUpperCase();
    if (s.toLowerCase() === "italia") return "IT";
    return s.toUpperCase();
  }

  function normalizeDocType(inv) {
    var t = (inv && inv.type) ? String(inv.type).trim() : "";
    if (!t) return "Fattura";
    return t;
  }

  function isCreditNote(inv) {
    return normalizeDocType(inv) === "Nota di Credito";
  }

  function isInvoice(inv) {
    return !isCreditNote(inv);
  }

  function defaultCompanyParams(companyInfo) {
    companyInfo = companyInfo || {};
    return {
      coefficienteRedditivita: safeFloat(companyInfo.coefficienteRedditivita), // %
      aliquotaSostitutiva: safeFloat(companyInfo.aliquotaSostitutiva),        // %
      aliquotaContributi: safeFloat(companyInfo.aliquotaContributi),          // %
      contributiVersati: safeFloat(companyInfo.contributiVersati),            // €

      // Versamenti / crediti (per una simulazione più realistica)
      // - acconti imposta già versati sull'anno simulato (riduce il saldo)
      // - crediti/compensazioni disponibili (RX) utilizzabili anche sugli acconti, se desiderato in UI
      accontiImpostaVersati: safeFloat(companyInfo.accontiImpostaVersati),    // €
      creditiImposta: safeFloat(companyInfo.creditiImposta)                  // €
    };
  }

  function computeAccontiStorico(impostaDovuta) {
    // Regola standard (metodo storico) usata didatticamente:
    // - Se imposta < 51,65€: nessun acconto
    // - Se 51,65€ <= imposta < 257,52€: unica rata (di norma 30/11)
    // - Se imposta >= 257,52€: 40% (1°) + 60% (2°)
    // NB: soglie tipiche per acconti IRPEF; per imposta sostitutiva del forfettario è un'approssimazione realistica.
    var TH_NO = 51.65;
    var TH_TWO = 257.52;

    var imp = Math.max(0, safeFloat(impostaDovuta));
    var a1 = 0;
    var a2 = 0;
    var unica = 0;

    if (imp >= TH_TWO) {
      a1 = imp * 0.40;
      a2 = imp * 0.60;
    } else if (imp >= TH_NO) {
      unica = imp;
      a2 = imp; // la trattiamo come "seconda" per semplificare la UI (scadenza tipica 30/11)
    }

    return {
      soglie: { noAcconto: TH_NO, dueRate: TH_TWO },
      accontoTotale: (a1 + a2),
      acconto1: a1,
      acconto2: a2,
      accontoUnicaRata: unica
    };
  }

  // -----------------------------
  // Core aggregations
  // -----------------------------
  /**
   * Extracts all document years available in invoices (by invoice.date).
   * @param {object} backup
   * @returns {number[]} sorted desc
   */
  function listAvailableYears(backup) {
    var invs = (backup && backup.invoices) ? backup.invoices : [];
    var years = {};
    for (var i = 0; i < invs.length; i++) {
      var y = yearFromISODate(invs[i].date);
      if (y) years[y] = true;
    }
    return Object.keys(years).map(function (k) { return parseInt(k, 10); }).sort(function (a, b) { return b - a; });
  }

  /**
   * Filters documents by year based on invoice.date (document date).
   * @param {object[]} invoices
   * @param {number|null} year - e.g. 2025. If null/"all", returns all.
   * @returns {object[]}
   */
  function filterByYear(invoices, year) {
    if (year === null || year === undefined || year === "all") return invoices.slice();
    var y = parseInt(year, 10);
    return invoices.filter(function (inv) { return yearFromISODate(inv.date) === y; });
  }

  /**
   * Computes yearly totals suitable for Quadro LM prefill.
   *
   * Key accounting choice:
   * - "compensiBase" uses invoice.totaleImponibile (prestazioni + rivalsa INPS).
   * - Bollo (invoice.importoBollo) is reported separately and can optionally be included.
   *
   * @param {object} backup - gestionale backup JSON
   * @param {object} options
   * @param {number|"all"|null} options.year - default current year
   * @param {boolean} options.onlyPaid - if true, only status === "Pagata" (for cash-basis approximation)
   * @param {boolean} options.includeBolloInCompensi - if true, adds bollo to compensi
   * @returns {object} summary
   */
  function computeYearlySummary(backup, options) {
    options = options || {};
    var nowY = new Date().getFullYear();
    var year = (options.year === undefined) ? nowY : options.year;

    var invs = (backup && backup.invoices) ? backup.invoices : [];
    invs = filterByYear(invs, year);

    if (options.onlyPaid) {
      invs = invs.filter(function (inv) { return String(inv.status || "").toLowerCase() === "pagata"; });
    }

    var fatture = invs.filter(isInvoice);
    var noteCredito = invs.filter(isCreditNote);

    function sumField(arr, field) {
      var s = 0;
      for (var i = 0; i < arr.length; i++) s += safeFloat(arr[i][field]);
      return s;
    }

    var totPrestF = sumField(fatture, "totalePrestazioni");
    var totPrestNC = sumField(noteCredito, "totalePrestazioni");

    var rivF = fatture.reduce(function (s, inv) { return s + (inv.rivalsa ? safeFloat(inv.rivalsa.importo) : 0); }, 0);
    var rivNC = noteCredito.reduce(function (s, inv) { return s + (inv.rivalsa ? safeFloat(inv.rivalsa.importo) : 0); }, 0);

    var imponF = sumField(fatture, "totaleImponibile");
    var imponNC = sumField(noteCredito, "totaleImponibile");

    var bolloF = sumField(fatture, "importoBollo");
    var bolloNC = sumField(noteCredito, "importoBollo");

    // Base compensi: totaleImponibile (prestazioni + rivalsa)
    var compensiF = imponF;
    var compensiNC = imponNC;
    var compensiNetti = compensiF - compensiNC;

    // Optional: include bollo
    var bolloNetto = bolloF - bolloNC;
    var compensiNettiConBollo = compensiNetti + bolloNetto;

    // Total document (includes bollo already if stored in total)
    var totaleDocF = sumField(fatture, "total");
    var totaleDocNC = sumField(noteCredito, "total");
    var totaleDocNetto = totaleDocF - totaleDocNC;

    var company = (backup && backup.companyInfo) ? backup.companyInfo : {};
    var params = defaultCompanyParams(company);

    // Forfettario taxable income simulation
    var baseForCalc = options.includeBolloInCompensi ? compensiNettiConBollo : compensiNetti;
    var coeff = params.coefficienteRedditivita;
    var aliquotaInps = params.aliquotaContributi;
    var aliquotaImposta = params.aliquotaSostitutiva;

    var redditoForfettario = (coeff > 0) ? baseForCalc * (coeff / 100) : 0;
    var contributiINPS = (aliquotaInps > 0) ? redditoForfettario * (aliquotaInps / 100) : 0;

    // Deduct previously paid contributions if provided (optional policy)
    var contributiVersati = params.contributiVersati;
    var contributiDaVersareStimati = Math.max(0, contributiINPS - contributiVersati);

    var imponibileImposta = Math.max(0, redditoForfettario - contributiINPS);
    var impostaSostitutiva = (aliquotaImposta > 0) ? imponibileImposta * (aliquotaImposta / 100) : 0;

    // -----------------------------
    // Versamenti (stima) - più realistica
    // -----------------------------
    var accontiStorico = computeAccontiStorico(impostaSostitutiva);
    var accontiVersatiImposta = safeFloat(company.accontiImpostaVersati);
    var creditiImposta = safeFloat(company.creditiImposta);

    // Saldo imposta dell'anno (imposta dovuta - acconti già versati - crediti)
    var saldoDopoAcconti = Math.max(0, impostaSostitutiva - accontiVersatiImposta);
    var saldoNetto = Math.max(0, saldoDopoAcconti - creditiImposta);
    var creditoResiduoDopoSaldo = Math.max(0, creditiImposta - saldoDopoAcconti);

    // Uso del credito anche sugli acconti (comune in F24 tramite compensazione)
    var creditoTmp = creditoResiduoDopoSaldo;
    var acconto1Netto = Math.max(0, accontiStorico.acconto1 - creditoTmp);
    creditoTmp = Math.max(0, creditoTmp - accontiStorico.acconto1);
    var acconto2Netto = Math.max(0, accontiStorico.acconto2 - creditoTmp);
    creditoTmp = Math.max(0, creditoTmp - accontiStorico.acconto2);

    var versamenti = {
      imposta: {
        dovutaAnno: impostaSostitutiva,
        accontiVersatiAnno: accontiVersatiImposta,
        creditiDisponibili: creditiImposta,
        saldoDopoAcconti: saldoDopoAcconti,
        saldoNettoDaVersare: saldoNetto,
        creditoResiduoDopoSaldo: creditoResiduoDopoSaldo,

        accontoTotaleStimato: accontiStorico.accontoTotale,
        acconto1Stimato: accontiStorico.acconto1,
        acconto2Stimato: accontiStorico.acconto2,
        accontoUnicaRataStimata: accontiStorico.accontoUnicaRata,
        soglieAcconti: accontiStorico.soglie,

        // Compensazione credito su acconti (stima)
        acconto1NettoDaVersare: acconto1Netto,
        acconto2NettoDaVersare: acconto2Netto,
        creditoResiduoDopoAcconti: creditoTmp
      },
      inps: {
        dovutiStimati: contributiINPS,
        versatiAnno: contributiVersati,
        saldoNettoDaVersareStimato: contributiDaVersareStimati
      }
    };

    return {
      meta: {
        year: year,
        onlyPaid: !!options.onlyPaid,
        includeBolloInCompensi: !!options.includeBolloInCompensi,
        availableYears: listAvailableYears(backup),
        countryCodeCompany: upper2CountryCode(company.nazione)
      },

      totals: {
        fattureCount: fatture.length,
        noteCreditoCount: noteCredito.length,

        totalePrestazioni: {
          fatture: totPrestF,
          noteCredito: totPrestNC,
          netto: totPrestF - totPrestNC
        },

        rivalsaINPS: {
          fatture: rivF,
          noteCredito: rivNC,
          netto: rivF - rivNC
        },

        totaleImponibile: {
          fatture: imponF,
          noteCredito: imponNC,
          netto: compensiNetti
        },

        bollo: {
          fatture: bolloF,
          noteCredito: bolloNC,
          netto: bolloNetto
        },

        totaleDocumento: {
          fatture: totaleDocF,
          noteCredito: totaleDocNC,
          netto: totaleDocNetto
        },

        // Two "views" of compensi for fiscal discussion
        compensiNettiBase: compensiNetti,
        compensiNettiConBollo: compensiNettiConBollo
      },

      companyParams: params,

      forfettarioSimulation: {
        baseCompensi: baseForCalc,
        coefficienteRedditivita: coeff,
        redditoForfettario: redditoForfettario,
        aliquotaContributi: aliquotaInps,
        contributiINPSStimati: contributiINPS,
        contributiVersati: contributiVersati,
        contributiDaVersareStimati: contributiDaVersareStimati,
        imponibileImposta: imponibileImposta,
        aliquotaSostitutiva: aliquotaImposta,
        impostaSostitutivaStimata: impostaSostitutiva,

        // Nuovo: versamenti/saldi/acconti (stima)
        versamenti: versamenti
      }
    };
  }

  // -----------------------------
  // Public API
  // -----------------------------
  return {
    safeFloat: safeFloat,
    yearFromISODate: yearFromISODate,
    listAvailableYears: listAvailableYears,
    computeYearlySummary: computeYearlySummary
  };
});
