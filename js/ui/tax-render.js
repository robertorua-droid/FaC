// =========================================================
// UI Tax Render - Fase 2B (estrazione cauta)
// Simulazioni Ordinario / Quadro LM e filtri anno dedicati
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
        $out.html('<div class="alert alert-info mb-0">La simulazione Quadro LM è disponibile solo per il regime <b>Forfettario</b>.</div>');
        return;
    }

    if (typeof ForfettarioCalc === 'undefined' || !ForfettarioCalc.computeYearlySummary) {
        $out.html('<div class="alert alert-warning mb-0">Motore LM non disponibile (file forfettario-calc.js non caricato).</div>');
        return;
    }

    const yearVal = $('#lm-year-select').val() || String(new Date().getFullYear());
    const onlyPaid = $('#lm-only-paid').is(':checked');
    const includeBollo = $('#lm-include-bollo').is(':checked');

    // backup minimo dal globalData
    const backup = {
        companyInfo: getData('companyInfo') || {},
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

    const money = (v) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '0.00';
    const numVal = (v) => (v === null || v === undefined || v === '') ? '' : String(v);

    // Versamenti (stima realistica)
    const v = (s.versamenti || {});
    const vImp = (v.imposta || {});
    const vInps = (v.inps || {});

    const metaYear = (summary.meta && summary.meta.year) ? summary.meta.year : yearVal;
    const yearNum = (String(metaYear) !== 'all' && !isNaN(parseInt(metaYear, 10))) ? parseInt(metaYear, 10) : null;
    const nextYear = (yearNum !== null) ? (yearNum + 1) : null;

    const yearLocked = (yearNum === null);
    const disAttr = yearLocked ? 'disabled' : '';
    const yearLockNote = yearLocked
        ? `<div class="text-muted" style="font-size:0.9em;">Seleziona un anno specifico (non “Tutti”) per inserire e salvare i valori di versamento per-anno.</div>`
        : `<div class="text-muted" style="font-size:0.9em;">Valori memorizzati per l’anno selezionato: <b>${yearNum}</b>.</div>`;

    // Sezione acconti (mostra sia lordi che "netti" dopo compensazione credito)
    let accontiHtml = '';
    if (vImp && typeof vImp.accontoTotaleStimato === 'number') {
        const a1 = vImp.acconto1Stimato || 0;
        const a2 = vImp.acconto2Stimato || 0;
        const unica = vImp.accontoUnicaRataStimata || 0;
        const a1n = vImp.acconto1NettoDaVersare || 0;
        const a2n = vImp.acconto2NettoDaVersare || 0;
        const thNo = (vImp.soglieAcconti && vImp.soglieAcconti.noAcconto) ? vImp.soglieAcconti.noAcconto : 51.65;
        const thTwo = (vImp.soglieAcconti && vImp.soglieAcconti.dueRate) ? vImp.soglieAcconti.dueRate : 257.52;

        if ((a1 + a2) <= 0) {
            accontiHtml = `<div class="mt-2 text-muted"><b>Acconti imposta:</b> nessun acconto (sotto € ${money(thNo)})</div>`;
        } else if (unica > 0 && a1 === 0) {
            accontiHtml = `<div class="mt-2"><b>Acconto imposta (unica rata):</b> € ${money(unica)} <span class="text-muted">(sotto € ${money(thTwo)})</span> — <b>Netto dopo crediti:</b> € ${money(a2n)}</div>`;
        } else {
            accontiHtml = `<div class="mt-2"><b>Acconti imposta:</b> 1° (40%) € ${money(a1)} — 2° (60%) € ${money(a2)} — <b>Netti dopo crediti:</b> € ${money(a1n)} + € ${money(a2n)}</div>`;
        }
    }

    // Box versamenti (F24) con input modificabili e persistiti su companyInfo
    const versamentiHtml = `
      <div class="mt-3 p-2 border rounded">
        <div class="mb-1"><span class="badge bg-warning text-dark">VERSAMENTI (stima)</span></div>
        ${yearLockNote}

        <div class="row g-2">
          <div class="col-md-4">
            <label class="form-label mb-0">Contributi INPS già versati (€)</label>
            <input class="form-control form-control-sm" id="lm-contributi-versati" type="number" step="0.01" value="${numVal(params.contributiVersati)}" ${disAttr}/>
            <div class="form-text">Usato per stimare il saldo RR (dovuti − versati).</div>
          </div>
          <div class="col-md-4">
            <label class="form-label mb-0">Acconti imposta già versati (€)</label>
            <input class="form-control form-control-sm" id="lm-acconti-imposta-versati" type="number" step="0.01" value="${numVal(params.accontiImpostaVersati)}" ${disAttr}/>
            <div class="form-text">Riduce il saldo dell’anno (RX).</div>
          </div>
          <div class="col-md-4">
            <label class="form-label mb-0">Crediti/compensazioni disponibili (€)</label>
            <input class="form-control form-control-sm" id="lm-crediti-imposta" type="number" step="0.01" value="${numVal(params.creditiImposta)}" ${disAttr}/>
            <div class="form-text">Credito compensabile in F24 (RX).</div>
          </div>
        </div>

        <button class="btn btn-sm btn-outline-primary mt-2" id="lm-save-versamenti-btn" type="button" ${yearLocked ? "disabled" : ""}>
          <i class="fas fa-save"></i> Salva e ricalcola
        </button>

        <hr class="my-2"/>

        <div><b>Saldo imposta (anno ${escapeXML(String(metaYear))}):</b> € ${money(vImp.saldoNettoDaVersare || 0)}</div>
        <div class="text-muted" style="font-size:0.9em;">
          Dovuta € ${money(vImp.dovutaAnno || 0)} — Acconti versati € ${money(vImp.accontiVersatiAnno || 0)} — Crediti € ${money(vImp.creditiDisponibili || 0)}
          ${((vImp.creditoResiduoDopoSaldo || 0) > 0) ? ` — Credito residuo dopo saldo € ${money(vImp.creditoResiduoDopoSaldo)}` : ``}
        </div>

        <div class="mt-2"><b>INPS (saldo stimato):</b> € ${money(vInps.saldoNettoDaVersareStimato || 0)}</div>
        <div class="text-muted" style="font-size:0.9em;">Dovuti € ${money(vInps.dovutiStimati || 0)} — Versati € ${money(vInps.versatiAnno || 0)}</div>

        ${nextYear ? `
          <div class="mt-2"><b>Acconti imposta stimati (anno ${nextYear}):</b></div>
          ${accontiHtml}

          <div class="mt-2">
            <b>Scadenze tipiche (stima):</b>
            <ul class="mb-0">
              <li><b>30/06/${nextYear}:</b> saldo imposta (anno ${yearNum}) + 1° acconto (anno ${nextYear}) → € ${money((vImp.saldoNettoDaVersare || 0) + (vImp.acconto1NettoDaVersare || 0))}</li>
              <li><b>30/11/${nextYear}:</b> 2° acconto (anno ${nextYear}) → € ${money(vImp.acconto2NettoDaVersare || 0)}</li>
            </ul>
            <div class="text-muted" style="font-size:0.9em;">Nota: scadenze/percentuali possono variare per annualità e casi particolari; questa è una simulazione didattica.</div>
          </div>
        ` : `<div class="mt-2 text-muted" style="font-size:0.9em;">Seleziona un anno specifico (non “Tutti”) per vedere la stima acconti e scadenze.</div>`}
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
          <div class="mb-1"><span class="badge bg-success">PREVIDENZA</span></div>
          <div><b>Contributi INPS stimati:</b> € ${money(s.contributiINPSStimati)} (${escapeXML(String(s.aliquotaContributi || ''))}%)</div>
          <div class="text-muted" style="font-size:0.9em;">Questa voce è deducibile e riduce la base su cui si calcola l’imposta.</div>
        </div>

        <div class="mt-3 p-2 border rounded">
          <div class="mb-1"><span class="badge bg-primary">FISCO</span></div>
          <div><b>Imponibile imposta:</b> € ${money(s.imponibileImposta)}</div>
          <div><b>Imposta sostitutiva stimata:</b> € ${money(s.impostaSostitutivaStimata)} (${escapeXML(String(s.aliquotaSostitutiva || ''))}%)</div>
        </div>

        ${versamentiHtml}
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
                <td>Contributi previdenziali (stimati)</td>
                <td>€ ${money(s.contributiINPSStimati)}</td>
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
        <div class="text-muted mt-2" style="font-size: 0.9em;">
          Nota: questa è una <b>mappa didattica</b> basata sui valori calcolati dal gestionale (una sola attività).
        </div>

    `);

    // Salva i parametri di versamento (persistenza su companyInfo) e ricalcola
    $('#lm-save-versamenti-btn').off('click').on('click', async function () {
        const c = getData('companyInfo') || {};
        const inpsV = $('#lm-contributi-versati').val();
        const accV = $('#lm-acconti-imposta-versati').val();
        const credV = $('#lm-crediti-imposta').val();

        if (yearNum === null) {
            alert('Seleziona un anno specifico (non “Tutti”) per salvare i versamenti per-anno.');
            return;
        }

        const yKey = String(yearNum);
        const toNum = (x) => {
            const n = parseFloat(x);
            return isNaN(n) ? 0 : n;
        };

        const patch = {
            contributiVersatiByYear: { ...(c.contributiVersatiByYear || {}), [yKey]: toNum(inpsV) },
            accontiVersatiByYear: { ...(c.accontiVersatiByYear || {}), [yKey]: toNum(accV) },
            creditiImpostaByYear: { ...(c.creditiImpostaByYear || {}), [yKey]: toNum(credV) }
        };

        if (typeof saveDataToCloud !== 'function') {
            alert('Funzione saveDataToCloud non disponibile.');
            return;
        }

        await saveDataToCloud('companyInfo', patch);
        // Rinfresca form azienda e ricalcola LM
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
