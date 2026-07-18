// =========================================================
// UI Tax Render - Fase 2B (estrazione cauta)
// Simulazioni Ordinario / Quadro LM + Quadro RR/PXX e filtri anno dedicati
// =========================================================
(function (window) {
    'use strict';

// =========================================================
// 3.W SIMULAZIONE REDDITI (ORDINARIO) - SOLO UI
// (NON modifica fatture/XML: usa solo i dati gia' caricati)
// =========================================================

function refreshOrdinarioYearFilter() {
    const $select = $('#ord-year-select');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const invoices = getData('invoices') || [];
    const purchases = getData('purchases') || [];
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv && inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    purchases.forEach(p => {
        if (p && p.date && typeof p.date === 'string' && p.date.length >= 4) {
            const y = p.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));
    $select.append('<option value="all">Tutti</option>');

    if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (previous && ($select.find(`option[value="${previous}"]`).length)) {
        $select.val(previous);
    } else if (years.length) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}

function renderOrdinarioSimPage() {
    const $out = $('#ord-output');
    if (!$out.length) return;

    const company = getData('companyInfo') || {};
    const isOrd = getTaxRegimeCapabilities(company).canUseOrdinarioSimulation;
    if (!isOrd) {
        $out.html('<div class="alert alert-info mb-0">La simulazione ordinario e\' disponibile solo se in <b>Azienda</b> hai selezionato <b>Ordinario</b>.</div>');
        return;
    }

    if (typeof OrdinarioCalc === 'undefined' || !OrdinarioCalc.computeYearlySummary) {
        $out.html('<div class="alert alert-warning mb-0">Motore ordinario non disponibile (file ordinario-calc.js non caricato).</div>');
        return;
    }

    const yearVal = $('#ord-year-select').val() || String(new Date().getFullYear());
    const onlyPaid = $('#ord-only-paid').is(':checked');
    const includeBollo = $('#ord-include-bollo').is(':checked');

    // Aliquota Gestione Separata: input -> azienda -> default 26.07
    const readAliquota = () => {
        const v = String($('#ord-inps-aliquota').val() || '').trim();
        const n = parseFloat(v.replace(',', '.'));
        if (isFinite(n)) return n;
        const cv = String(company.aliquotaGestioneSeparata || '').trim();
        const cn = parseFloat(cv.replace(',', '.'));
        if (isFinite(cn)) return cn;
        return 26.07;
    };

    const aliquotaGS = readAliquota();
    if (!String($('#ord-inps-aliquota').val() || '').trim()) {
        $('#ord-inps-aliquota').val(String(aliquotaGS));
    }

    const inpsVersati = safeFloat($('#ord-inps-versati').val());
    const detrazioni = safeFloat($('#ord-detrazioni').val());
    const crediti = safeFloat($('#ord-crediti').val());
    const accontiIrpefVersati = safeFloat($('#ord-acconti-irpef').val());

    const backup = {
        companyInfo: company,
        invoices: getData('invoices') || [],
        purchases: getData('purchases') || []
    };

    const summary = OrdinarioCalc.computeYearlySummary(backup, {
        year: yearVal === 'all' ? 'all' : parseInt(yearVal, 10),
        onlyPaid: !!onlyPaid,
        includeBolloInCompensi: !!includeBollo,
        aliquotaGestioneSeparata: aliquotaGS,
        inpsVersati: inpsVersati,
        detrazioniIrpef: detrazioni,
        creditiIrpef: crediti,
        accontiIrpefVersati: accontiIrpefVersati
    });

    const money = (v) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '0.00';

    const t = summary.totals || {};
    const inps = summary.inps || {};
    const irpef = summary.irpef || {};
    const ac = summary.acconti || {};

    const notePaidHint = onlyPaid
        ? '<div class="text-muted small">Nota: il filtro "solo pagate" si applica alle fatture (status=Pagata) e agli acquisti (status=Pagata). Le note di credito vengono considerate come rettifica dell\'anno.</div>'
        : '';

    let acIrpefHtml = '<span class="text-muted">Nessun acconto stimato</span>';
    if (ac && ac.irpef && ac.irpef.totale && ac.irpef.totale > 0) {
        if (ac.irpef.rate && ac.irpef.rate.length === 1) {
            acIrpefHtml = `Unica rata: € ${money(ac.irpef.rate[0].importo)}`;
        } else if (ac.irpef.rate && ac.irpef.rate.length === 2) {
            acIrpefHtml = `1ª rata: € ${money(ac.irpef.rate[0].importo)} — 2ª rata: € ${money(ac.irpef.rate[1].importo)}`;
        } else {
            acIrpefHtml = `Totale: € ${money(ac.irpef.totale)}`;
        }
    }

    let acInpsHtml = '<span class="text-muted">Nessun acconto stimato</span>';
    if (ac && ac.inps && ac.inps.totale && ac.inps.totale > 0) {
        if (ac.inps.rate && ac.inps.rate.length === 2) {
            acInpsHtml = `1ª rata: € ${money(ac.inps.rate[0].importo)} — 2ª rata: € ${money(ac.inps.rate[1].importo)}`;
        } else {
            acInpsHtml = `Totale: € ${money(ac.inps.totale)}`;
        }
    }

    $out.html(`
      <div class="mb-2"><b>Anno:</b> ${escapeXML(String(summary.meta && summary.meta.year ? summary.meta.year : yearVal))}</div>
      <div class="mb-2"><b>Modalita\':</b> ${onlyPaid ? 'Solo Pagate' : 'Tutti i documenti'} | ${includeBollo ? 'Bollo incluso nei compensi' : 'Bollo escluso dai compensi'}</div>
      ${notePaidHint}
      <hr/>

      <div class="row g-3">
        <div class="col-md-6">
          <div class="p-2 border rounded bg-white">
            <div class="mb-1"><span class="badge bg-primary">REDDITO</span></div>
            <div><b>Compensi (imponibile):</b> € ${money(t.compensiImponibile)}</div>
            <div><b>Bollo considerato:</b> € ${money(t.bolloConsiderato)}</div>
            <div><b>Spese deducibili (imponibile acquisti):</b> € ${money(t.speseImponibile)}</div>
            <div class="mt-1"><b>Reddito ante INPS:</b> € ${money(t.redditoAnteInps)}</div>
            <div class="text-muted small">Ritenute d'acconto subite: € ${money(t.ritenuteSubite)}</div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="p-2 border rounded bg-white">
            <div class="mb-1"><span class="badge bg-success">INPS</span></div>
            <div><b>Aliquota Gestione Separata:</b> ${escapeXML(String(inps.aliquota || aliquotaGS))}%</div>
            <div><b>Contributi stimati:</b> € ${money(inps.contributiDovuti)}</div>
            <div><b>Versati (input):</b> € ${money(inps.versati)}</div>
            <div class="mt-1"><b>Saldo INPS:</b> € ${money(inps.saldo)}</div>
            <div class="text-muted small">Stima acconti INPS: ${acInpsHtml}</div>
          </div>
        </div>
      </div>

      <div class="row g-3 mt-1">
        <div class="col-md-12">
          <div class="p-2 border rounded bg-white">
            <div class="mb-1"><span class="badge bg-dark">IRPEF</span></div>
            <div><b>Base imponibile IRPEF (dopo deduzione INPS):</b> € ${money(irpef.baseImponibile)}</div>
            <div><b>IRPEF lorda:</b> € ${money(irpef.irpefLorda)}</div>
            <div><b>Detrazioni (input):</b> € ${money(irpef.detrazioni)}</div>
            <div><b>Crediti (input):</b> € ${money(irpef.crediti)}</div>
            <div class="mt-1"><b>IRPEF netta stimata:</b> € ${money(irpef.irpefNetta)}</div>
            <div><b>Ritenute subite:</b> € ${money(irpef.ritenute)}</div>
            <div><b>Acconti IRPEF gia\' versati (input):</b> € ${money(irpef.accontiVersati)}</div>
            <div class="mt-1"><b>Saldo IRPEF:</b> € ${money(irpef.saldo)}</div>
            <div class="text-muted small">Stima acconti IRPEF: ${acIrpefHtml}</div>
          </div>
        </div>
      </div>

      <hr/>
      <h5 class="mt-2">Mappa quadri (indicativa)</h5>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th style="width:110px;">Quadro</th>
              <th>Campo (descrizione)</th>
              <th style="width:220px;" class="text-end">Valore</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><b>RE</b></td><td>Compensi (imponibile)</td><td class="text-end">€ ${money(t.compensiImponibile)}</td></tr>
            <tr><td><b>RE</b></td><td>Spese deducibili (imponibile acquisti)</td><td class="text-end">€ ${money(t.speseImponibile)}</td></tr>
            <tr><td><b>RE</b></td><td>Reddito (ante INPS)</td><td class="text-end">€ ${money(t.redditoAnteInps)}</td></tr>
            <tr><td><b>RN</b></td><td>Base imponibile IRPEF (dopo INPS)</td><td class="text-end">€ ${money(irpef.baseImponibile)}</td></tr>
            <tr><td><b>RN</b></td><td>IRPEF netta</td><td class="text-end">€ ${money(irpef.irpefNetta)}</td></tr>
            <tr><td><b>RN</b></td><td>Ritenute subite</td><td class="text-end">€ ${money(irpef.ritenute)}</td></tr>
            <tr><td><b>RN</b></td><td>Saldo IRPEF</td><td class="text-end">€ ${money(irpef.saldo)}</td></tr>
            <tr><td><b>RN</b></td><td>Acconti IRPEF (stimati)</td><td class="text-end">€ ${money((ac.irpef && ac.irpef.totale) || 0)}</td></tr>
            <tr><td><b>RR</b></td><td>Contributi Gestione Separata (dovuti)</td><td class="text-end">€ ${money(inps.contributiDovuti)}</td></tr>
            <tr><td><b>RR</b></td><td>Saldo INPS</td><td class="text-end">€ ${money(inps.saldo)}</td></tr>
            <tr><td><b>RR</b></td><td>Acconti INPS (stimati)</td><td class="text-end">€ ${money((ac.inps && ac.inps.totale) || 0)}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="mt-2 text-muted small">
        <b>Nota:</b> la numerazione dei righi e le regole degli acconti possono variare per annualita\' e casistiche (detrazioni, crediti, addizionali, altre imposte).
      </div>
    `);
}
// =========================================================
// 3.X SIMULAZIONE FISCALE (QUADRO LM) - SOLO UI
// (NON modifica fatture/XML: usa solo i dati già caricati)
// =========================================================

function refreshLMYearFilter() {
    const $select = $('#lm-year-select');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const invoices = getData('invoices') || [];
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv && inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));
    $select.append('<option value="all">Tutti</option>');

    // Default: anno corrente se presente; altrimenti ripristina precedente; altrimenti primo
    if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (previous && ($select.find(`option[value="${previous}"]`).length)) {
        $select.val(previous);
    } else if (years.length) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}

function renderLMPage() {
    const $out = $('#lm-output');
    if (!$out.length) return;

    const companyLM = (getData('companyInfo') || {});
    const isForf = getTaxRegimeCapabilities(companyLM).canUseLmSimulation;
    if (!isForf) {
        $out.html('<div class="alert alert-info mb-0">La simulazione Quadro LM + Quadro RR/PXX è disponibile solo per il regime <b>Forfettario</b>.</div>');
        return;
    }

    if (typeof ForfettarioCalc === 'undefined' || !ForfettarioCalc.computeYearlySummary) {
        $out.html('<div class="alert alert-warning mb-0">Motore LM/RR non disponibile (file forfettario-calc.js non caricato).</div>');
        return;
    }

    const yearVal = $('#lm-year-select').val() || String(new Date().getFullYear());
    const onlyPaid = $('#lm-only-paid').is(':checked');
    const includeBollo = $('#lm-include-bollo').is(':checked');

    // backup minimo dal globalData
    const backup = {
        companyInfo: companyLM,
        invoices: getData('invoices') || []
    };

    const summary = ForfettarioCalc.computeYearlySummary(backup, {
        year: yearVal === 'all' ? 'all' : parseInt(yearVal, 10),
        onlyPaid: !!onlyPaid,
        includeBolloInCompensi: !!includeBollo
    });

    const t = summary.totals || {};
    const s = summary.forfettarioSimulation || {};
    const params = summary.companyParams || {};
    const v = (s.versamenti || {});
    const vImp = (v.imposta || {});
    const vInps = (v.inps || {});
    const adj = params.fiscalAdjustments || {};

    const money = (value) => {
        const n = (typeof value === 'number') ? value : parseFloat(String(value || '0').replace(',', '.'));
        return (isFinite(n) ? n : 0).toFixed(2);
    };
    const numVal = (value) => {
        if (value === null || value === undefined || value === '') return '';
        const n = parseFloat(String(value).replace(',', '.'));
        return (!isFinite(n) || n === 0) ? '' : String(value);
    };
    const diffHtml = (sim, f24, hasF24) => {
        if (!hasF24) return '<span class="text-muted">—</span>';
        const d = (parseFloat(sim || 0) - parseFloat(f24 || 0));
        const cls = Math.abs(d) < 0.05 ? 'text-success' : 'text-danger';
        return `<span class="${cls}">€ ${money(d)}</span>`;
    };

    const metaYear = (summary.meta && summary.meta.year) ? summary.meta.year : yearVal;
    const yearNum = (String(metaYear) !== 'all' && !isNaN(parseInt(metaYear, 10))) ? parseInt(metaYear, 10) : null;
    const nextYear = (yearNum !== null) ? (yearNum + 1) : null;
    const yearLocked = (yearNum === null);
    const disAttr = yearLocked ? 'disabled' : '';

    const incomeNotes = adj.incomeYearNotes || '';
    const nextNotes = adj.nextYearNotes || '';

    const incomeYearData = (adj.incomeYearData && typeof adj.incomeYearData === 'object') ? adj.incomeYearData : {};
    const incomeYearLm = (incomeYearData.lm && typeof incomeYearData.lm === 'object') ? incomeYearData.lm : {};
    const incomeYearInps = (incomeYearData.inps && typeof incomeYearData.inps === 'object') ? incomeYearData.inps : {};
    const carryoverAccontoImposta1 = safeFloat(incomeYearLm.acconto1F24);
    const carryoverAccontoImposta2 = safeFloat(incomeYearLm.acconto2F24);
    const carryoverAccontiImpostaTotale = carryoverAccontoImposta1 + carryoverAccontoImposta2;
    const carryoverAccontoInps1 = safeFloat(incomeYearInps.acconto1F24);
    const carryoverAccontoInps2 = safeFloat(incomeYearInps.acconto2F24);
    const carryoverAccontiInpsTotale = carryoverAccontoInps1 + carryoverAccontoInps2;
    const hasCarryoverAccontiImposta = carryoverAccontiImpostaTotale > 0;
    const hasCarryoverAccontiInps = carryoverAccontiInpsTotale > 0;
    const hasCarryoverHint = !yearLocked && (hasCarryoverAccontiImposta || hasCarryoverAccontiInps);
    const accontiImpostaAlreadyApplied = hasCarryoverAccontiImposta && Math.abs(safeFloat(params.accontiImpostaVersati) - carryoverAccontiImpostaTotale) < 0.005;
    const accontiInpsAlreadyApplied = hasCarryoverAccontiInps && Math.abs(safeFloat(params.inpsVersatiAnno) - carryoverAccontiInpsTotale) < 0.005;

    const yearLockNote = yearLocked
        ? `<div class="alert alert-warning py-2 mb-2">Seleziona un anno specifico (non “Tutti”) per inserire e salvare i dati dichiarativi annuali.</div>`
        : `<div class="text-muted small mb-2">I dati inseriti qui vengono salvati per anno: il saldo si riferisce all’anno redditi <b>${yearNum}</b>; gli acconti si riferiscono all’anno successivo <b>${nextYear}</b>.</div>`;

    const accontiImpostaStimatiHtml = (vImp.accontoUnicaRataStimata || 0) > 0 && (vImp.acconto1Stimato || 0) === 0
        ? `Unica rata: € ${money(vImp.accontoUnicaRataStimata)}`
        : `1ª rata: € ${money(vImp.acconto1Stimato || 0)} — 2ª rata: € ${money(vImp.acconto2Stimato || 0)}`;

    const hasManualImpAcconti = (safeFloat(vImp.accontoAnnoSuccessivo1F24) > 0 || safeFloat(vImp.accontoAnnoSuccessivo2F24) > 0);
    const hasManualInpsAcconti = (safeFloat(vInps.accontoAnnoSuccessivo1F24) > 0 || safeFloat(vInps.accontoAnnoSuccessivo2F24) > 0);

    const riepilogoSaldoImposta = vImp.hasSaldoF24 ? vImp.saldoF24 : (vImp.saldoNettoDaVersare || 0);
    const riepilogoSaldoInps = vInps.hasSaldoF24 ? vInps.saldoF24 : (vInps.saldoNettoDaVersareStimato || 0);
    const riepilogoAccontoImp1 = hasManualImpAcconti ? (vImp.accontoAnnoSuccessivo1F24 || 0) : (vImp.acconto1NettoDaVersare || 0);
    const riepilogoAccontoImp2 = hasManualImpAcconti ? (vImp.accontoAnnoSuccessivo2F24 || 0) : (vImp.acconto2NettoDaVersare || 0);
    const riepilogoAccontoInps1 = hasManualInpsAcconti ? (vInps.accontoAnnoSuccessivo1F24 || 0) : (vInps.acconto1Stimato || 0);
    const riepilogoAccontoInps2 = hasManualInpsAcconti ? (vInps.accontoAnnoSuccessivo2F24 || 0) : (vInps.acconto2Stimato || 0);
    const riepilogoPrimaScadenza = riepilogoSaldoImposta + riepilogoAccontoImp1 + riepilogoSaldoInps + riepilogoAccontoInps1;
    const riepilogoSecondaScadenza = riepilogoAccontoImp2 + riepilogoAccontoInps2;

    const sourceBadge = (hasManual) => hasManual
        ? '<span class="badge bg-info text-dark ms-1">F24 inserito</span>'
        : '<span class="badge bg-secondary ms-1">stima FAC</span>';

    const paymentSummaryHtml = yearLocked ? `
      <div class="mt-3 p-3 border rounded bg-white">
        <div class="mb-2"><span class="badge bg-warning text-dark">Versamenti stimati FAC</span></div>
        <div class="alert alert-warning py-2 mb-0">Seleziona un anno specifico per visualizzare il riepilogo operativo dei versamenti stimati.</div>
      </div>
    ` : `
      <div class="mt-3 p-3 border rounded bg-white">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div>
            <span class="badge bg-warning text-dark">Versamenti stimati FAC</span>
            <span class="text-muted small ms-1">riepilogo operativo LM + RR/PXX</span>
          </div>
          <span class="text-muted small">Anno redditi: <b>${yearNum}</b> · Acconti: <b>${nextYear}</b></span>
        </div>
        <div class="text-muted small mb-2">
          Il riquadro usa i valori F24/manuali se inseriti; in assenza di dati manuali mostra la stima FAC. Le scadenze sono indicative e non sostituiscono il prospetto del commercialista.
        </div>

        <div class="row g-3">
          <div class="col-lg-6">
            <div class="border rounded p-2 h-100">
              <div><b>Saldo imposta sostitutiva anno ${yearNum}:</b> € ${money(riepilogoSaldoImposta)} ${sourceBadge(vImp.hasSaldoF24)}</div>
              <div class="text-muted small">Dovuta € ${money(vImp.dovutaAnno || 0)} — Acconti versati € ${money(vImp.accontiVersatiAnno || 0)} — Crediti € ${money(vImp.creditiDisponibili || 0)}</div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="border rounded p-2 h-100">
              <div><b>Saldo RR/PXX anno ${yearNum}:</b> € ${money(riepilogoSaldoInps)} ${sourceBadge(vInps.hasSaldoF24)}</div>
              <div class="text-muted small">Dovuti € ${money(vInps.dovutiStimati || 0)} — Versati € ${money(vInps.versatiAnno || 0)}</div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="border rounded p-2 h-100">
              <div><b>Acconti imposta anno ${nextYear}:</b> 1ª € ${money(riepilogoAccontoImp1)} — 2ª € ${money(riepilogoAccontoImp2)} ${sourceBadge(hasManualImpAcconti)}</div>
              <div class="text-muted small">Stima FAC teorica: ${accontiImpostaStimatiHtml}</div>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="border rounded p-2 h-100">
              <div><b>Acconti RR/PXX anno ${nextYear}:</b> 1ª € ${money(riepilogoAccontoInps1)} — 2ª € ${money(riepilogoAccontoInps2)} ${sourceBadge(hasManualInpsAcconti)}</div>
              <div class="text-muted small">Metodo FAC teorico: ${escapeXML(String(vInps.accontoMetodoStimato || 'stima'))}</div>
            </div>
          </div>
        </div>

        <div class="mt-3">
          <b>Scadenze tipiche riepilogative:</b>
          <ul class="mb-1">
            <li><b>30/06/${nextYear}</b>: saldo imposta ${yearNum} + 1ª rata imposta ${nextYear} + saldo RR/PXX ${yearNum} + 1ª rata PXX ${nextYear} → € ${money(riepilogoPrimaScadenza)}</li>
            <li><b>30/11/${nextYear}</b>: 2ª rata imposta ${nextYear} + 2ª rata PXX ${nextYear} → € ${money(riepilogoSecondaScadenza)}</li>
          </ul>
          <div class="text-muted small">Se il commercialista applica proroghe, maggiorazioni, rateazioni o compensazioni F24, inserisci i valori effettivi nei campi dichiarativi annuali e usa il prospetto F24 come riferimento finale.</div>
        </div>
      </div>
    `;

    const carryoverHintHtml = hasCarryoverHint ? `
      <div class="alert alert-info mt-3 mb-3 small" id="lm-f24-carryover-hint">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h6 class="alert-heading mb-1"><i class="fas fa-arrow-right-arrow-left"></i> Acconti F24 già registrati per l’anno ${yearNum}</h6>
            <div>
              Sono presenti acconti F24 salvati sull’anno selezionato. Puoi copiarli nei campi “già versati” solo dopo verifica, evitando applicazioni automatiche e doppi conteggi.
            </div>
          </div>
        </div>
        <div class="row g-2 mt-2">
          <div class="col-lg-6">
            <div class="border rounded bg-white p-2 h-100">
              <div><b>LM / imposta:</b> 1790 € ${money(carryoverAccontoImposta1)} + 1791 € ${money(carryoverAccontoImposta2)} = <b>€ ${money(carryoverAccontiImpostaTotale)}</b></div>
              <button class="btn btn-sm btn-outline-primary mt-2" id="lm-use-acconti-imposta-carryover" type="button" ${(!hasCarryoverAccontiImposta || accontiImpostaAlreadyApplied) ? 'disabled' : ''}>
                <i class="fas fa-copy"></i> Usa per acconti imposta ${yearNum}
              </button>
              ${accontiImpostaAlreadyApplied ? '<div class="text-success mt-1">Già riportati nel campo “Acconti imposta già versati”.</div>' : '<div class="text-muted mt-1">Il pulsante compila il campo, poi premi “Salva e ricalcola”.</div>'}
            </div>
          </div>
          <div class="col-lg-6">
            <div class="border rounded bg-white p-2 h-100">
              <div><b>RR/PXX:</b> 1ª rata € ${money(carryoverAccontoInps1)} + 2ª rata € ${money(carryoverAccontoInps2)} = <b>€ ${money(carryoverAccontiInpsTotale)}</b></div>
              <button class="btn btn-sm btn-outline-primary mt-2" id="lm-use-inps-carryover" type="button" ${(!hasCarryoverAccontiInps || accontiInpsAlreadyApplied) ? 'disabled' : ''}>
                <i class="fas fa-copy"></i> Usa per contributi RR/PXX ${yearNum}
              </button>
              ${accontiInpsAlreadyApplied ? '<div class="text-success mt-1">Già riportati nel campo “Contributi RR/PXX già versati”.</div>' : '<div class="text-muted mt-1">Il pulsante compila il campo, poi premi “Salva e ricalcola”.</div>'}
            </div>
          </div>
        </div>
        <div class="text-muted mt-2">Il suggerimento non modifica dati finché non premi i pulsanti e poi <b>Salva e ricalcola</b>.</div>
      </div>
    ` : '';

    const declarativeHtml = `
      <div class="mt-3 p-3 border rounded bg-white">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div>
            <span class="badge bg-primary">Dati dichiarativi annuali</span>
            <span class="text-muted small ms-1">Quadro LM + Quadro RR/PXX</span>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-sm btn-outline-secondary" id="lm-f24-help-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#lm-f24-help" aria-expanded="false" aria-controls="lm-f24-help">
              <i class="fas fa-circle-question"></i> Help compilazione F24
            </button>
            <button class="btn btn-sm btn-outline-primary" id="lm-save-tax-adjustments-btn" type="button" ${yearLocked ? 'disabled' : ''}>
              <i class="fas fa-save"></i> Salva e ricalcola
            </button>
          </div>
        </div>
        ${yearLockNote}
        ${carryoverHintHtml}

        <div class="collapse" id="lm-f24-help">
          <div class="alert alert-secondary small mb-3">
            <h6 class="alert-heading mb-2"><i class="fas fa-circle-info"></i> Guida rapida: dove leggere i dati nei documenti del commercialista</h6>
            <ol class="mb-2 ps-3">
              <li>Seleziona l’<b>anno redditi</b> nel filtro sopra. Esempio: per la dichiarazione 2026 sui redditi 2025, seleziona <b>2025</b>.</li>
              <li>Nel prospetto <b>Quadro LM</b>, inserisci in <b>LM35 contributi deducibili versati</b> il valore dei contributi previdenziali effettivamente versati e dedotti dal commercialista.</li>
              <li>Nell’F24, se trovi il codice <b>1792</b>, riportalo in <b>Saldo F24 imposta 1792</b>. I codici <b>1790</b> e <b>1791</b> sono invece acconti dell’anno successivo e vanno nei campi acconti sotto.</li>
              <li>Nella sezione INPS dell’F24, usa le righe con causale <b>PXX</b>: il <b>periodo di riferimento</b> indica a quale anno appartiene il dato.</li>
              <li>Se la riga PXX ha periodo ${yearNum || 'anno redditi'}, è saldo/conguaglio dell’anno redditi; se ha periodo ${nextYear || 'anno successivo'}, è acconto dell’anno successivo.</li>
            </ol>
            <div class="mb-1"><b>Regola pratica:</b> i valori di saldo restano sull’anno selezionato; gli acconti 1790/1791/PXX dell’anno successivo vengono salvati sull’anno successivo per non contaminare il 2024, 2025, 2026, ecc.</div>
            <div class="mb-1"><b>Anno dopo:</b> quando visualizzi l’anno degli acconti, FAC può proporti di copiarli nei campi “già versati”, ma lo fa solo con pulsante esplicito per evitare doppi conteggi.</div>
            <div class="text-muted">I campi accettano decimali con punto o virgola. Se copi importi F24 con separatore migliaia, il salvataggio normalizza anche formati come <code>1.513,52</code>.</div>
          </div>
        </div>

        <div class="row g-3">
          <div class="col-lg-6">
            <div class="border rounded p-2 h-100">
              <h6 class="mb-2">Anno redditi ${escapeXML(String(metaYear))} — LM / Imposta sostitutiva</h6>
              <div class="row g-2">
                <div class="col-md-6">
                  <label class="form-label small mb-0">LM35 contributi deducibili versati (€)</label>
                  <input class="form-control form-control-sm" id="lm-dich-contributi-deducibili" type="text" inputmode="decimal" value="${numVal(params.contributiDeducibiliVersati)}" ${disAttr}/>
                  <div class="form-text">Se compilato, sostituisce la deduzione teorica INPS.</div>
                </div>
                <div class="col-md-6">
                  <label class="form-label small mb-0">Acconti imposta già versati (€)</label>
                  <input class="form-control form-control-sm" id="lm-dich-acconti-imposta" type="text" inputmode="decimal" value="${numVal(params.accontiImpostaVersati)}" ${disAttr}/>
                </div>
                <div class="col-md-6">
                  <label class="form-label small mb-0">Crediti/compensazioni imposta (€)</label>
                  <input class="form-control form-control-sm" id="lm-dich-crediti-imposta" type="text" inputmode="decimal" value="${numVal(params.creditiImposta)}" ${disAttr}/>
                </div>
                <div class="col-md-6">
                  <label class="form-label small mb-0">Saldo F24 imposta 1792 (€)</label>
                  <input class="form-control form-control-sm" id="lm-dich-saldo-imposta-f24" type="text" inputmode="decimal" value="${numVal(params.saldoImpostaF24)}" ${disAttr}/>
                  <div class="form-text">Opzionale: solo confronto con commercialista.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-6">
            <div class="border rounded p-2 h-100">
              <h6 class="mb-2">Anno redditi ${escapeXML(String(metaYear))} — Quadro RR / INPS-PXX</h6>
              <div class="row g-2">
                <div class="col-md-6">
                  <label class="form-label small mb-0">Contributi RR/PXX già versati per l’anno (€)</label>
                  <input class="form-control form-control-sm" id="lm-dich-inps-versati-anno" type="text" inputmode="decimal" value="${numVal(params.inpsVersatiAnno)}" ${disAttr}/>
                  <div class="form-text">Riduce il saldo RR/PXX stimato.</div>
                </div>
                <div class="col-md-6">
                  <label class="form-label small mb-0">Saldo F24 PXX anno redditi (€)</label>
                  <input class="form-control form-control-sm" id="lm-dich-inps-saldo-f24" type="text" inputmode="decimal" value="${numVal(params.inpsSaldoF24)}" ${disAttr}/>
                  <div class="form-text">Opzionale: importo indicato dal commercialista.</div>
                </div>
                <div class="col-12">
                  <label class="form-label small mb-0">Note anno redditi</label>
                  <input class="form-control form-control-sm" id="lm-dich-income-notes" type="text" value="${escapeXML(incomeNotes)}" ${disAttr}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${nextYear ? `
        <div class="border rounded p-2 mt-3">
          <h6 class="mb-2">Acconti anno successivo ${nextYear} da F24/commercialista</h6>
          <div class="row g-2">
            <div class="col-md-3">
              <label class="form-label small mb-0">1790 acconto imposta 1ª rata (€)</label>
              <input class="form-control form-control-sm" id="lm-dich-acconto-imposta-next-1" type="text" inputmode="decimal" value="${numVal(params.accontoImpostaAnnoSuccessivo1F24)}" ${disAttr}/>
            </div>
            <div class="col-md-3">
              <label class="form-label small mb-0">1791 acconto imposta 2ª rata (€)</label>
              <input class="form-control form-control-sm" id="lm-dich-acconto-imposta-next-2" type="text" inputmode="decimal" value="${numVal(params.accontoImpostaAnnoSuccessivo2F24)}" ${disAttr}/>
            </div>
            <div class="col-md-3">
              <label class="form-label small mb-0">PXX acconto INPS 1ª rata (€)</label>
              <input class="form-control form-control-sm" id="lm-dich-acconto-inps-next-1" type="text" inputmode="decimal" value="${numVal(params.accontoInpsAnnoSuccessivo1F24)}" ${disAttr}/>
            </div>
            <div class="col-md-3">
              <label class="form-label small mb-0">PXX acconto INPS 2ª rata (€)</label>
              <input class="form-control form-control-sm" id="lm-dich-acconto-inps-next-2" type="text" inputmode="decimal" value="${numVal(params.accontoInpsAnnoSuccessivo2F24)}" ${disAttr}/>
            </div>
            <div class="col-12">
              <label class="form-label small mb-0">Note acconti ${nextYear}</label>
              <input class="form-control form-control-sm" id="lm-dich-next-notes" type="text" value="${escapeXML(nextNotes)}" ${disAttr}/>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="table-responsive mt-3">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Area</th>
                <th>FAC stimato/rettificato</th>
                <th>Dato F24/manuale</th>
                <th>Scostamento</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Saldo imposta sostitutiva anno ${escapeXML(String(metaYear))}</td>
                <td>€ ${money(vImp.saldoNettoDaVersare || 0)}</td>
                <td>${vImp.hasSaldoF24 ? '€ ' + money(vImp.saldoF24) : '<span class="text-muted">non inserito</span>'}</td>
                <td>${diffHtml(vImp.saldoNettoDaVersare || 0, vImp.saldoF24 || 0, vImp.hasSaldoF24)}</td>
              </tr>
              <tr>
                <td>Saldo RR/PXX anno ${escapeXML(String(metaYear))}</td>
                <td>€ ${money(vInps.saldoNettoDaVersareStimato || 0)}</td>
                <td>${vInps.hasSaldoF24 ? '€ ' + money(vInps.saldoF24) : '<span class="text-muted">non inserito</span>'}</td>
                <td>${diffHtml(vInps.saldoNettoDaVersareStimato || 0, vInps.saldoF24 || 0, vInps.hasSaldoF24)}</td>
              </tr>
              <tr>
                <td>Acconti imposta anno ${nextYear || 'successivo'}</td>
                <td>${accontiImpostaStimatiHtml}</td>
                <td>€ ${money(vImp.accontoAnnoSuccessivo1F24 || 0)} + € ${money(vImp.accontoAnnoSuccessivo2F24 || 0)}</td>
                <td>—</td>
              </tr>
              <tr>
                <td>Acconti RR/PXX anno ${nextYear || 'successivo'}</td>
                <td>1ª rata € ${money(vInps.acconto1Stimato || 0)} — 2ª rata € ${money(vInps.acconto2Stimato || 0)}</td>
                <td>€ ${money(vInps.accontoAnnoSuccessivo1F24 || 0)} + € ${money(vInps.accontoAnnoSuccessivo2F24 || 0)}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="form-text mt-2">I valori manuali sono opzionali. Se non compili nulla, resta visibile la simulazione FAC teorica.</div>
      </div>
    `;

    $out.html(`
        <div class="mb-2"><b>Anno:</b> ${escapeXML(String(summary.meta && summary.meta.year ? summary.meta.year : yearVal))}</div>
        <div class="mb-2"><b>Modalità:</b> ${onlyPaid ? 'Solo Pagate' : 'Tutti i documenti'} | ${includeBollo ? 'Bollo incluso nei compensi' : 'Bollo escluso dai compensi'}</div>
        <hr>
        <div><b>Fatture:</b> ${t.fattureCount || 0} | <b>Note di credito:</b> ${t.noteCreditoCount || 0}</div>
        <div><b>Imponibile netto:</b> € ${money(t.totaleImponibile && t.totaleImponibile.netto)}</div>
        <div><b>Bollo netto:</b> € ${money(t.bollo && t.bollo.netto)}</div>
        <div><b>Totale documento netto:</b> € ${money(t.totaleDocumento && t.totaleDocumento.netto)}</div>
        <hr>
        <div><b>Base compensi (LM22 col.3):</b> € ${money(s.baseCompensi)}</div>
        <div><b>Coefficiente redditività (LM22 col.2):</b> ${escapeXML(String(s.coefficienteRedditivita || ''))}%</div>
        <div><b>Reddito forfettario (LM22 col.5):</b> € ${money(s.redditoForfettario)}</div>

        <div class="mt-3 p-2 border rounded">
          <div class="mb-1"><span class="badge bg-success">Quadro RR / PXX</span></div>
          <div><b>Contributi INPS stimati:</b> € ${money(s.contributiINPSStimati)} (${escapeXML(String(s.aliquotaContributi || ''))}%)</div>
          <div><b>Contributi RR/PXX già versati anno:</b> € ${money(s.inpsVersatiAnno || 0)}</div>
          <div><b>Saldo RR/PXX stimato:</b> € ${money(s.contributiDaVersareStimati || 0)}</div>
          <div class="text-muted small">La parte RR/PXX è una simulazione previdenziale; i valori F24 del commercialista possono essere inseriti nel prospetto dichiarativo sotto.</div>
        </div>

        <div class="mt-3 p-2 border rounded">
          <div class="mb-1"><span class="badge bg-primary">LM / Imposta sostitutiva</span></div>
          <div><b>Contributi dedotti dal reddito:</b> € ${money(s.contributiDeducibiliPerImposta || 0)} ${s.usaContributiDeducibiliManuali ? '<span class="text-muted small">(LM35 manuale)</span>' : '<span class="text-muted small">(stima teorica INPS)</span>'}</div>
          <div><b>Imponibile imposta:</b> € ${money(s.imponibileImposta)}</div>
          <div><b>Imposta sostitutiva stimata:</b> € ${money(s.impostaSostitutivaStimata)} (${escapeXML(String(s.aliquotaSostitutiva || ''))}%)</div>
          <div><b>Saldo imposta stimato dopo acconti/crediti:</b> € ${money(vImp.saldoNettoDaVersare || 0)}</div>
        </div>

        ${paymentSummaryHtml}
        ${declarativeHtml}
        <hr>
        <h5 class="mt-2">Quadro LM (mappa righi/colonne)</h5>
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width:90px;">Rigo</th>
                <th style="width:90px;">Col.</th>
                <th>Campo</th>
                <th style="width:220px;">Valore</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>LM22</b></td>
                <td>1</td>
                <td>Codice attività (ATECO)</td>
                <td>${escapeXML(String((backup.companyInfo && (backup.companyInfo.ateco || backup.companyInfo.codiceAteco || backup.companyInfo.codiceAttivita || backup.companyInfo.ATECO)) || ''))}</td>
              </tr>
              <tr>
                <td><b>LM22</b></td>
                <td>2</td>
                <td>Coefficiente di redditività</td>
                <td>${escapeXML(String(s.coefficienteRedditivita || ''))}%</td>
              </tr>
              <tr>
                <td><b>LM22</b></td>
                <td>3</td>
                <td>Compensi/ricavi (base di calcolo)</td>
                <td>€ ${money(s.baseCompensi)}</td>
              </tr>
              <tr>
                <td><b>LM22</b></td>
                <td>5</td>
                <td>Reddito forfettario</td>
                <td>€ ${money(s.redditoForfettario)}</td>
              </tr>
              <tr>
                <td><b>LM34</b></td>
                <td>—</td>
                <td>Reddito lordo (totale attività)</td>
                <td>€ ${money(s.redditoForfettario)}</td>
              </tr>
              <tr>
                <td><b>LM35</b></td>
                <td>—</td>
                <td>Contributi previdenziali dedotti</td>
                <td>€ ${money(s.contributiDeducibiliPerImposta || 0)}</td>
              </tr>
              <tr>
                <td><b>LM36</b></td>
                <td>—</td>
                <td>Reddito netto (base imposta)</td>
                <td>€ ${money(s.imponibileImposta)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h5 class="mt-3">Quadro RR / PXX (mappa didattica)</h5>
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width:120px;">Area</th>
                <th>Campo</th>
                <th style="width:220px;">Valore</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>RR/PXX</b></td>
                <td>Reddito previdenziale stimato</td>
                <td>€ ${money(s.redditoForfettario)}</td>
              </tr>
              <tr>
                <td><b>RR/PXX</b></td>
                <td>Aliquota INPS applicata</td>
                <td>${escapeXML(String(s.aliquotaContributi || ''))}%</td>
              </tr>
              <tr>
                <td><b>RR/PXX</b></td>
                <td>Contributi INPS stimati</td>
                <td>€ ${money(s.contributiINPSStimati)}</td>
              </tr>
              <tr>
                <td><b>RR/PXX</b></td>
                <td>Contributi/acconti già versati per l’anno redditi</td>
                <td>€ ${money(s.inpsVersatiAnno || 0)}</td>
              </tr>
              <tr>
                <td><b>RR/PXX</b></td>
                <td>Saldo RR/PXX stimato</td>
                <td>€ ${money(s.contributiDaVersareStimati || 0)}</td>
              </tr>
              <tr>
                <td><b>F24 PXX</b></td>
                <td>Saldo/confronto F24 PXX anno redditi</td>
                <td>${vInps.hasSaldoF24 ? '€ ' + money(vInps.saldoF24) : '<span class="text-muted">non inserito</span>'}</td>
              </tr>
              <tr>
                <td><b>F24 PXX</b></td>
                <td>Acconti PXX anno ${nextYear || 'successivo'}</td>
                <td>€ ${money(vInps.accontoAnnoSuccessivo1F24 || 0)} + € ${money(vInps.accontoAnnoSuccessivo2F24 || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="text-muted mt-2 small">
          Nota: questa è una <b>mappa didattica</b> basata sui valori calcolati dal gestionale. I campi F24/manuali servono solo per rendere la simulazione più vicina al prospetto del commercialista e non sostituiscono i quadri ufficiali.
        </div>

    `);

    $('#lm-use-acconti-imposta-carryover').off('click').on('click', function () {
        $('#lm-dich-acconti-imposta').val(money(carryoverAccontiImpostaTotale));
        $('#lm-dich-acconti-imposta').trigger('input').focus();
    });

    $('#lm-use-inps-carryover').off('click').on('click', function () {
        $('#lm-dich-inps-versati-anno').val(money(carryoverAccontiInpsTotale));
        $('#lm-dich-inps-versati-anno').trigger('input').focus();
    });

    // Salva i dati dichiarativi annuali e ricalcola
    $('#lm-save-tax-adjustments-btn').off('click').on('click', async function () {
        const c = getData('companyInfo') || {};

        if (yearNum === null || nextYear === null) {
            alert('Seleziona un anno specifico (non “Tutti”) per salvare i dati dichiarativi annuali.');
            return;
        }

        const parseMoney = (selector) => {
            let raw = String($(selector).val() || '').trim();
            if (!raw) return 0;
            raw = raw.replace(/\s/g, '');
            if (raw.indexOf(',') >= 0) {
                raw = raw.replace(/\./g, '').replace(',', '.');
            }
            const n = parseFloat(raw);
            return isNaN(n) ? 0 : n;
        };

        const yKey = String(yearNum);
        const nextKey = String(nextYear);
        const previousByYear = (c.taxAdjustmentsByYear && typeof c.taxAdjustmentsByYear === 'object') ? c.taxAdjustmentsByYear : {};
        const currentYearData = previousByYear[yKey] && typeof previousByYear[yKey] === 'object' ? previousByYear[yKey] : {};
        const nextYearData = previousByYear[nextKey] && typeof previousByYear[nextKey] === 'object' ? previousByYear[nextKey] : {};

        const patch = {
            taxAdjustmentsByYear: {
                ...previousByYear,
                [yKey]: {
                    ...currentYearData,
                    lm: {
                        ...(currentYearData.lm || {}),
                        contributiDeducibiliVersati: parseMoney('#lm-dich-contributi-deducibili'),
                        accontiImpostaVersati: parseMoney('#lm-dich-acconti-imposta'),
                        creditiImposta: parseMoney('#lm-dich-crediti-imposta'),
                        saldoF24: parseMoney('#lm-dich-saldo-imposta-f24')
                    },
                    inps: {
                        ...(currentYearData.inps || {}),
                        versatiAnno: parseMoney('#lm-dich-inps-versati-anno'),
                        saldoF24: parseMoney('#lm-dich-inps-saldo-f24')
                    },
                    notes: String($('#lm-dich-income-notes').val() || '').trim()
                },
                [nextKey]: {
                    ...nextYearData,
                    lm: {
                        ...(nextYearData.lm || {}),
                        acconto1F24: parseMoney('#lm-dich-acconto-imposta-next-1'),
                        acconto2F24: parseMoney('#lm-dich-acconto-imposta-next-2')
                    },
                    inps: {
                        ...(nextYearData.inps || {}),
                        acconto1F24: parseMoney('#lm-dich-acconto-inps-next-1'),
                        acconto2F24: parseMoney('#lm-dich-acconto-inps-next-2')
                    },
                    sourceIncomeYear: yKey,
                    notes: String($('#lm-dich-next-notes').val() || '').trim()
                }
            }
        };

        if (typeof saveDataToCloud !== 'function') {
            alert('Funzione saveDataToCloud non disponibile.');
            return;
        }

        await saveDataToCloud('companyInfo', patch);
        try { if (typeof renderCompanyInfoForm === 'function') renderCompanyInfoForm(); } catch (e) { }
        renderLMPage();
    });
}

    window.TaxRender = window.TaxRender || {};
    window.TaxRender.refreshOrdinarioYearFilter = refreshOrdinarioYearFilter;
    window.TaxRender.renderOrdinarioSimPage = renderOrdinarioSimPage;
    window.TaxRender.refreshLMYearFilter = refreshLMYearFilter;
    window.TaxRender.renderLMPage = renderLMPage;

    // Compatibilità legacy: manteniamo i nomi globali usati da navigation e dai moduli tax.
    window.refreshOrdinarioYearFilter = refreshOrdinarioYearFilter;
    window.renderOrdinarioSimPage = renderOrdinarioSimPage;
    window.refreshLMYearFilter = refreshLMYearFilter;
    window.renderLMPage = renderLMPage;
})(window);
