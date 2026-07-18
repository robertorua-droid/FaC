/*! 
 * Forfettario Calculation Engine
 * --------------------------------
 * Input: backup JSON exported by the gestionale (Firebase/local export)
 * Output: yearly tax-relevant aggregates (ready to map to Quadro LM + Quadro RR/PXX)
 *
 * Design goals:
 * - Pure functions (no DOM, no Firebase)
 * - No assumptions about UI
 * - Backward compatible with existing backup structure
 * - V.13.20_step 02: annual declarative data are read by fiscal year and exposed as LM + RR/PXX comparison.
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
    if (v === null || v === undefined) return 0;
    var raw = String(v).trim().replace(/\s/g, '');
    if (!raw) return 0;
    // Supporta sia 1513.52/1513,52 sia importi F24 copiati come 1.513,52.
    if (raw.indexOf(',') >= 0) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    }
    var n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }

  function safeObj(o) {
    return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
  }

  function hasOwn(o, key) {
    return !!(o && Object.prototype.hasOwnProperty.call(o, key));
  }

  function hasMeaningfulValue(v) {
    return v !== undefined && v !== null && String(v).trim() !== "";
  }

  function getNested(obj, path) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (!cur || typeof cur !== "object" || !hasOwn(cur, path[i])) return undefined;
      cur = cur[path[i]];
    }
    return cur;
  }

  function parseYear(year) {
    if (year === null || year === undefined || year === "all") return null;
    var y = parseInt(year, 10);
    return isNaN(y) ? null : y;
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

  function getFiscalYearBucket(companyInfo, year) {
    var y = parseYear(year);
    if (y === null) return {};
    var byYear = safeObj(companyInfo && companyInfo.taxAdjustmentsByYear);
    return safeObj(byYear[String(y)]);
  }

  function getFiscalYearNumber(companyInfo, year, section, field) {
    var y = parseYear(year);
    if (y === null) return { value: 0, found: false };
    var value = getNested(safeObj(companyInfo && companyInfo.taxAdjustmentsByYear), [String(y), section, field]);
    if (hasMeaningfulValue(value)) return { value: safeFloat(value), found: true };
    return { value: 0, found: false };
  }

  // Reads a numeric value stored "per anno" inside legacy companyInfo maps like:
  // - contributiVersatiByYear: { "2025": 123.45 }
  // Falls back to a legacy/global field ONLY for the current year (to ease migration),
  // otherwise returns 0 when the year-specific value is missing.
  function getYearMapNumber(companyInfo, mapField, year, legacyField, useLegacyForCurrentYear) {
    companyInfo = companyInfo || {};
    var nowY = new Date().getFullYear();

    if (year === null || year === undefined || year === "all") {
      return safeFloat(companyInfo[legacyField]);
    }

    var y = parseInt(year, 10);
    if (isNaN(y)) return safeFloat(companyInfo[legacyField]);

    var map = safeObj(companyInfo[mapField]);
    var key = String(y);

    if (hasOwn(map, key)) return safeFloat(map[key]);

    if (useLegacyForCurrentYear && y === nowY &&
        companyInfo[legacyField] !== undefined &&
        companyInfo[legacyField] !== null &&
        String(companyInfo[legacyField]).trim() !== "") {
      return safeFloat(companyInfo[legacyField]);
    }

    return 0;
  }

  function getYearNumberWithFallback(companyInfo, year, section, field, legacyMapField, legacyField, useLegacyForCurrentYear) {
    var nested = getFiscalYearNumber(companyInfo, year, section, field);
    if (nested.found) return nested;

    if (legacyMapField || legacyField) {
      var legacy = getYearMapNumber(companyInfo, legacyMapField, year, legacyField, useLegacyForCurrentYear);
      return { value: legacy, found: legacy !== 0 };
    }

    return { value: 0, found: false };
  }

  function getYearString(companyInfo, year, field) {
    var y = parseYear(year);
    if (y === null) return "";
    var value = getNested(safeObj(companyInfo && companyInfo.taxAdjustmentsByYear), [String(y), field]);
    return hasMeaningfulValue(value) ? String(value) : "";
  }

  function defaultCompanyParams(companyInfo, year) {
    companyInfo = companyInfo || {};
    var y = parseYear(year);
    var nextY = y === null ? null : y + 1;

    var lmContribDed = getYearNumberWithFallback(
      companyInfo,
      y,
      "lm",
      "contributiDeducibiliVersati",
      "contributiDeducibiliByYear",
      "contributiDeducibiliVersati",
      false
    );

    var lmAcconti = getYearNumberWithFallback(
      companyInfo,
      y,
      "lm",
      "accontiImpostaVersati",
      "accontiVersatiByYear",
      "accontiImpostaVersati",
      false
    );

    var lmCrediti = getYearNumberWithFallback(
      companyInfo,
      y,
      "lm",
      "creditiImposta",
      "creditiImpostaByYear",
      "creditiImposta",
      false
    );

    var lmSaldoF24 = getYearNumberWithFallback(companyInfo, y, "lm", "saldoF24", "saldoImpostaF24ByYear", "saldoImpostaF24", false);

    var inpsVersati = getYearNumberWithFallback(
      companyInfo,
      y,
      "inps",
      "versatiAnno",
      "contributiVersatiByYear",
      "contributiVersati",
      false
    );

    var inpsSaldoF24 = getYearNumberWithFallback(companyInfo, y, "inps", "saldoF24", "saldoInpsF24ByYear", "saldoInpsF24", false);

    var lmNextA1 = getYearNumberWithFallback(companyInfo, nextY, "lm", "acconto1F24", "accontoImposta1F24ByYear", "", false);
    var lmNextA2 = getYearNumberWithFallback(companyInfo, nextY, "lm", "acconto2F24", "accontoImposta2F24ByYear", "", false);
    var inpsNextA1 = getYearNumberWithFallback(companyInfo, nextY, "inps", "acconto1F24", "accontoInps1F24ByYear", "", false);
    var inpsNextA2 = getYearNumberWithFallback(companyInfo, nextY, "inps", "acconto2F24", "accontoInps2F24ByYear", "", false);

    return {
      coefficienteRedditivita: safeFloat(companyInfo.coefficienteRedditivita), // %
      aliquotaSostitutiva: safeFloat(companyInfo.aliquotaSostitutiva),        // %
      aliquotaContributi: safeFloat(companyInfo.aliquotaContributi),          // %

      // LM / imposta sostitutiva - dati manuali per anno redditi
      contributiDeducibiliVersati: lmContribDed.value,
      hasContributiDeducibiliVersati: lmContribDed.found,
      accontiImpostaVersati: lmAcconti.value,
      creditiImposta: lmCrediti.value,
      saldoImpostaF24: lmSaldoF24.value,
      hasSaldoImpostaF24: lmSaldoF24.found,

      // INPS / PXX - dati manuali per anno redditi
      contributiVersati: inpsVersati.value, // alias legacy usato dalla UI precedente
      inpsVersatiAnno: inpsVersati.value,
      inpsSaldoF24: inpsSaldoF24.value,
      hasInpsSaldoF24: inpsSaldoF24.found,

      // Acconti dell'anno successivo, memorizzati nell'anno di competenza successivo
      accontoImpostaAnnoSuccessivo1F24: lmNextA1.value,
      accontoImpostaAnnoSuccessivo2F24: lmNextA2.value,
      accontoInpsAnnoSuccessivo1F24: inpsNextA1.value,
      accontoInpsAnnoSuccessivo2F24: inpsNextA2.value,

      fiscalAdjustments: {
        incomeYear: y,
        nextYear: nextY,
        incomeYearData: getFiscalYearBucket(companyInfo, y),
        nextYearData: getFiscalYearBucket(companyInfo, nextY),
        incomeYearNotes: getYearString(companyInfo, y, "notes"),
        nextYearNotes: getYearString(companyInfo, nextY, "notes")
      }
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

  function computeInpsAcconti(contributiDovutiStimati) {
    // Stima didattica prudente per PXX: 80% del contributo stimato, ripartito in due rate uguali.
    // Il valore reale può dipendere dal prospetto del commercialista/F24.
    var base = Math.max(0, safeFloat(contributiDovutiStimati));
    var totale = base * 0.80;
    return {
      metodo: "80% in due rate uguali (stima)",
      accontoTotale: totale,
      acconto1: totale / 2,
      acconto2: totale / 2
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
   * Computes yearly totals suitable for Quadro LM prefill and RR/PXX comparison.
   *
   * Key accounting choice:
   * - "compensiBase" uses invoice.totaleImponibile (prestazioni + rivalsa INPS).
   * - Bollo (invoice.importoBollo) is reported separately and can optionally be included.
   * - If annual LM35 contributions are manually inserted, the imposta sostitutiva uses them;
   *   otherwise it preserves the legacy theoretical estimate based on contributi INPS stimati.
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
    var params = defaultCompanyParams(company, year);

    // Forfettario taxable income simulation
    var baseForCalc = options.includeBolloInCompensi ? compensiNettiConBollo : compensiNetti;
    var coeff = params.coefficienteRedditivita;
    var aliquotaInps = params.aliquotaContributi;
    var aliquotaImposta = params.aliquotaSostitutiva;

    var redditoForfettario = (coeff > 0) ? baseForCalc * (coeff / 100) : 0;
    var contributiINPS = (aliquotaInps > 0) ? redditoForfettario * (aliquotaInps / 100) : 0;

    var inpsVersatiAnno = params.inpsVersatiAnno;
    var contributiDaVersareStimati = Math.max(0, contributiINPS - inpsVersatiAnno);

    // Legacy-preserving policy:
    // - without annual LM35 data, keep previous theoretical behavior (deduct estimated INPS);
    // - with annual LM35 data, use the manually inserted deductible paid contributions.
    var contributiDeducibiliPerImposta = params.hasContributiDeducibiliVersati ? params.contributiDeducibiliVersati : contributiINPS;
    var imponibileImposta = Math.max(0, redditoForfettario - contributiDeducibiliPerImposta);
    var impostaSostitutiva = (aliquotaImposta > 0) ? imponibileImposta * (aliquotaImposta / 100) : 0;

    // -----------------------------
    // Versamenti / confronto dichiarativo
    // -----------------------------
    var accontiStorico = computeAccontiStorico(impostaSostitutiva);
    var inpsAccontiStimati = computeInpsAcconti(contributiINPS);
    var accontiVersatiImposta = safeFloat(params.accontiImpostaVersati);
    var creditiImposta = safeFloat(params.creditiImposta);

    // Saldo imposta dell'anno (imposta dovuta - acconti già versati - crediti)
    var saldoDopoAcconti = Math.max(0, impostaSostitutiva - accontiVersatiImposta);
    var saldoNetto = Math.max(0, saldoDopoAcconti - creditiImposta);
    var creditoResiduoDopoSaldo = Math.max(0, creditiImposta - saldoDopoAcconti);

    // Uso del credito anche sugli acconti (stima)
    var creditoTmp = creditoResiduoDopoSaldo;
    var acconto1Netto = Math.max(0, accontiStorico.acconto1 - creditoTmp);
    creditoTmp = Math.max(0, creditoTmp - accontiStorico.acconto1);
    var acconto2Netto = Math.max(0, accontiStorico.acconto2 - creditoTmp);
    creditoTmp = Math.max(0, creditoTmp - accontiStorico.acconto2);

    var versamenti = {
      imposta: {
        dovutaAnno: impostaSostitutiva,
        contributiDeducibiliUsati: contributiDeducibiliPerImposta,
        contributiDeducibiliManuali: params.contributiDeducibiliVersati,
        usaContributiDeducibiliManuali: !!params.hasContributiDeducibiliVersati,
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
        creditoResiduoDopoAcconti: creditoTmp,

        saldoF24: params.saldoImpostaF24,
        hasSaldoF24: params.saldoImpostaF24 > 0,
        accontoAnnoSuccessivo1F24: params.accontoImpostaAnnoSuccessivo1F24,
        accontoAnnoSuccessivo2F24: params.accontoImpostaAnnoSuccessivo2F24
      },
      inps: {
        dovutiStimati: contributiINPS,
        versatiAnno: inpsVersatiAnno,
        saldoNettoDaVersareStimato: contributiDaVersareStimati,
        saldoF24: params.inpsSaldoF24,
        hasSaldoF24: params.inpsSaldoF24 > 0,
        accontoTotaleStimato: inpsAccontiStimati.accontoTotale,
        acconto1Stimato: inpsAccontiStimati.acconto1,
        acconto2Stimato: inpsAccontiStimati.acconto2,
        accontoMetodoStimato: inpsAccontiStimati.metodo,
        accontoAnnoSuccessivo1F24: params.accontoInpsAnnoSuccessivo1F24,
        accontoAnnoSuccessivo2F24: params.accontoInpsAnnoSuccessivo2F24
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
        contributiVersati: inpsVersatiAnno,
        inpsVersatiAnno: inpsVersatiAnno,
        contributiDaVersareStimati: contributiDaVersareStimati,
        contributiDeducibiliPerImposta: contributiDeducibiliPerImposta,
        usaContributiDeducibiliManuali: !!params.hasContributiDeducibiliVersati,
        imponibileImposta: imponibileImposta,
        aliquotaSostitutiva: aliquotaImposta,
        impostaSostitutivaStimata: impostaSostitutiva,

        // Versamenti/saldi/acconti (stima + confronto dichiarativo)
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
    getFiscalYearBucket: getFiscalYearBucket,
    computeYearlySummary: computeYearlySummary
  };
});
