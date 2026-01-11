// ui-render.js

// 3. FUNZIONI DI RENDER UI
    // =========================================================

    function renderAll() {
    renderCompanyInfoForm();
    updateCompanyUI();
    renderProductsTable();
    renderCustomersTable();
    refreshInvoiceYearFilter();   // <- POPOLA / AGGIORNA LA COMBO ANNO
    renderInvoicesTable();        // <- USA IL VALORE SELEZIONATO
    populateDropdowns();
    refreshStatsYearFilter();     // <- POPOLA / AGGIORNA LA COMBO ANNO STATISTICHE
    renderStatisticsPage();
    renderHomePage();
}

        // Popola la combo "Anno" in Elenco Documenti
    function renderAll() {
    renderCompanyInfoForm();
    updateCompanyUI();
    renderProductsTable();
    renderCustomersTable();
    refreshInvoiceYearFilter();   // <- POPOLA / AGGIORNA LA COMBO ANNO
    renderInvoicesTable();        // <- USA IL VALORE SELEZIONATO
    populateDropdowns();
    refreshStatsYearFilter();
    renderStatisticsPage();
    renderHomePage();
}

// Popola la combo "Anno" in Elenco Documenti
function refreshInvoiceYearFilter() {
    const $select = $('#invoice-year-filter');
    if (!$select.length) return; // se per qualche motivo non esiste, esco

    const previous = $select.val(); // può essere null/undefined al primo load

    const invoices = getData('invoices');
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const years = Array.from(yearsSet).sort().reverse(); // anni decrescenti
    const currentYear = String(new Date().getFullYear());

    // Garantisco che l'anno corrente sia sempre selezionabile (anche se non ci sono documenti in quell'anno)
    if (!years.includes(currentYear)) years.unshift(currentYear);


    // Ricostruisco la combo mettendo PRIMA gli anni e SOLO ALLA FINE "Tutti".
    // Questo evita che al primo render (quando non c'è ancora una selezione) rimanga visivamente "Tutti".
    $select.empty();

    // Anni (incluso anno corrente già garantito sopra)
    years.forEach(y => {
        $select.append(`<option value="${y}">${y}</option>`);
    });

    // Opzione Tutti (in fondo)
    $select.append('<option value="all">Tutti</option>');

    // Default: anno corrente (se presente), altrimenti mantieni scelta precedente, altrimenti primo anno disponibile
    if (previous && previous !== 'all' && years.includes(previous)) {
        $select.val(previous);
    } else if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (years.length > 0) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }

    // Assicura che il cambio anno rinfreschi la tabella (namespace per non rompere altri handler)
    $select.off('change.invoiceYear').on('change.invoiceYear', function () {
        renderInvoicesTable();
    });
}




function refreshStatsYearFilter() {
    const $select = $('#stats-year-filter');
    if (!$select.length) return;

    const previous = $select.val() || '';

    const invoices = getData('invoices');
    const yearsSet = new Set();

    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            const y = inv.date.substring(0, 4);
            if (/^\d{4}$/.test(y)) yearsSet.add(y);
        }
    });

    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    const years = Array.from(yearsSet).sort().reverse();

    $select.empty();
    $select.append('<option value="all">Tutti</option>');
    years.forEach(y => $select.append(`<option value="${y}">${y}</option>`));

    // Default: anno corrente (se presente), altrimenti primo anno disponibile, altrimenti "Tutti"
    if (years.includes(previous) && previous !== '') {
        $select.val(previous);
    } else if (years.includes(currentYear)) {
        $select.val(currentYear);
    } else if (years.length > 0) {
        $select.val(years[0]);
    } else {
        $select.val('all');
    }
}



    function updateCompanyUI() { 
        const company = getData('companyInfo'); 
        if(company.name) $('#company-name-sidebar').text(company.name);
        if(currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
    }

    function renderHomePage() { 
        if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
        const note = getData('notes').find(n => n.userId === currentUser.uid);
        if(note) $('#notes-textarea').val(note.text);
        renderCalendar();
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        }));
        updateDateTime();
        dateTimeInterval = setInterval(updateDateTime, 1000);
    }

    function renderCalendar() {
        const c = $('#calendar-widget');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayDate = now.getDate();
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const totalDays = lastDay.getDate();
        let startingDay = firstDay.getDay(); 

        let html = `<div class="card shadow-sm border-0">
<div class="card-header bg-primary text-white text-center fw-bold">
${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}
</div>
<div class="card-body p-0">
<table class="table table-bordered text-center mb-0" style="table-layout: fixed;">
<thead class="table-light">
<tr>
<th class="text-danger">Dom</th><th>Lun</th><th>Mar</th><th>Mer</th>
<th>Gio</th><th>Ven</th><th>Sab</th>
</tr>
</thead>
<tbody><tr>`;

        for(let i = 0; i < startingDay; i++) { 
            html += '<td class="bg-light"></td>'; 
        }

        for(let day = 1; day <= totalDays; day++) {
            if (startingDay > 6) { 
                startingDay = 0; 
                html += '</tr><tr>'; 
            }
            const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
            html += `<td class="align-middle p-2"><div class="${isToday}" style="width:32px; height:32px; line-height:32px; margin:0 auto;">${day}</div></td>`;
            startingDay++;
        }
        while(startingDay <= 6) { 
            html += '<td class="bg-light"></td>'; 
            startingDay++; 
        }
        html += '</tr></tbody></table></div></div>';
        c.html(html);
    }

    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty();
        const selectedYear = ($('#stats-year-filter').length ? ($('#stats-year-filter').val() || 'all') : 'all');
        const inSelectedYear = (inv) => {
            if (selectedYear === 'all') return true;
            return (inv.date && typeof inv.date === 'string' && inv.date.substring(0,4) === String(selectedYear));
        };
        const facts = getData('invoices').filter(i => inSelectedYear(i) && (i.type === 'Fattura' || i.type === undefined || i.type === ''));
        const notes = getData('invoices').filter(i => inSelectedYear(i) && i.type === 'Nota di Credito');

        if(facts.length === 0) { 
            container.html('<div class="alert alert-info">Nessun dato.</div>'); 
            renderTaxSimulation(0,0); 
            return; 
        }

        const totF = facts.reduce((s,i)=>s+safeFloat(i.total),0);
        const totN = notes.reduce((s,i)=>s+safeFloat(i.total),0);
        const net = totF - totN;

        let cust = {};
        facts.forEach(i=>{
            const c=String(i.customerId); 
            if(!cust[c])cust[c]=0; 
            cust[c]+=safeFloat(i.total)
        });
        notes.forEach(i=>{
            const c=String(i.customerId); 
            if(cust[c])cust[c]-=safeFloat(i.total)
        });

        let h = `<h5>Dettaglio Clienti</h5><table class="table table-striped table-sm">
<thead><tr><th>Cliente</th><th>Fatturato Netto</th><th>% sul Totale</th></tr></thead><tbody>`;
        Object.keys(cust)
            .sort((a,b)=>cust[b]-cust[a])
            .forEach(cid=>{
                const c = getData('customers').find(x=>String(x.id)===String(cid))||{name:'?'};
                const tot = cust[cid];
                const perc = net > 0 ? (tot / net) * 100 : 0;
                h+=`<tr><td>${c.name}</td><td>€ ${tot.toFixed(2)}</td><td>${perc.toFixed(1)}%</td></tr>`;
            });
        h+=`<tr class="fw-bold"><td>TOTALE</td><td>€ ${net.toFixed(2)}</td><td>100%</td></tr></tbody></table>`;
        container.html(h);

        const impF = facts.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        const impN = notes.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        renderTaxSimulation(impF, impN);
    }

    function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
        const container = $('#tax-simulation-container').empty();
        const comp = getData('companyInfo');
        const coeff = safeFloat(comp.coefficienteRedditivita);
        const taxRate = safeFloat(comp.aliquotaSostitutiva);
        const inpsRate = safeFloat(comp.aliquotaContributi);

        if(!coeff || !taxRate || !inpsRate) {
            container.html('<div class="alert alert-warning">Dati mancanti.</div>');
            return;
        }

        const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
        const taxableIncome = grossRevenue * (coeff / 100);
        const socialSecurity = taxableIncome * (inpsRate / 100);
        const netTaxable = taxableIncome - socialSecurity;
        const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0;
        const totalDue = socialSecurity + tax;

        const html = `
<div class="row">
  <div class="col-md-6">
    <h5>Simulazione Contributi INPS</h5>
    <table class="table table-sm">
      <tr><th>Reddito Lordo Imponibile</th><td>€ ${taxableIncome.toFixed(2)}</td></tr>
      <tr><th>Aliquota Contributi INPS</th><td>${inpsRate}%</td></tr>
      <tr><th>Contributi Totali Previsti</th><td>€ ${socialSecurity.toFixed(2)}</td></tr>
      <tr><th>Stima Primo Acconto (40%)</th><td>€ ${(socialSecurity*0.4).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (40%)</th><td>€ ${(socialSecurity*0.4).toFixed(2)}</td></tr>
    </table>
  </div>
  <div class="col-md-6">
    <h5>Simulazione Imposta Sostitutiva (IRPEF)</h5>
    <table class="table table-sm">
      <tr><th>Reddito Lordo Imponibile</th><td>€ ${taxableIncome.toFixed(2)}</td></tr>
      <tr><th>Contributi INPS Deducibili</th><td>- € ${socialSecurity.toFixed(2)}</td></tr>
      <tr><th>Reddito Netto Imponibile</th><td>€ ${netTaxable.toFixed(2)}</td></tr>
      <tr><th>Aliquota Imposta</th><td>${taxRate}%</td></tr>
      <tr><th>Imposta Totale Prevista</th><td>€ ${tax.toFixed(2)}</td></tr>
      <tr><th>Stima Primo Acconto (50%)</th><td>€ ${(tax*0.5).toFixed(2)}</td></tr>
      <tr><th>Stima Secondo Acconto (50%)</th><td>€ ${(tax*0.5).toFixed(2)}</td></tr>
      <tr class="table-primary fw-bold"><th>Totale Uscite Stimate (Contributi + Imposte)</th><td>€ ${totalDue.toFixed(2)}</td></tr>
    </table>
  </div>
</div>`;
        container.html(html);
    }

    function renderCompanyInfoForm() {
        const c = getData('companyInfo') || {};
        for (const k in c) {
            $(`#company-${k}`).val(c[k]);
        }
    }

    function renderProductsTable() {
        const table = $('#products-table-body').empty();
        getData('products').forEach(p => {
            const price = parseFloat(p.salePrice || 0).toFixed(2);
            table.append(`
<tr>
  <td>${p.code || ''}</td>
  <td>${p.description || ''}</td>
  <td class="text-end-numbers col-price pe-5">€ ${price}</td>
  <td class="text-end-numbers">${p.iva || '0'}%</td>
  <td class="text-end col-actions">
    <button class="btn btn-sm btn-outline-secondary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
        });
    }

    function renderCustomersTable() {
        const table = $('#customers-table-body').empty();
        getData('customers').forEach(c => {
            table.append(`
<tr>
  <td>${c.name || ''}</td>
  <td>${c.piva || ''}</td>
  <td>${c.sdi || '-'}</td>
  <td>${c.address || ''}</td>
  <td class="text-end">
    <button class="btn btn-sm btn-outline-secondary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
        });
    }

    // Filtro anno per elenco fatture
    function getInvoiceFilterYear() {
        return $('#invoice-year-filter').val() || 'all';
    }

    function renderInvoicesTable() {
    const table = $('#invoices-table-body').empty();

    // Tutte le fatture ordinate per numero (come prima)
    const allInvoices = getData('invoices').sort(
        (a, b) => (b.number || '').localeCompare(a.number || '')
    );

    // Legge il filtro anno (se esiste la select)
    const yearSelect = $('#invoice-year-filter');
    const selectedYear = yearSelect.length ? (yearSelect.val() || 'all') : 'all';

    // Se è selezionato un anno specifico, filtra; altrimenti mostra tutte
    const invoices = selectedYear === 'all'
        ? allInvoices
        : allInvoices.filter(inv =>
            inv.date && String(inv.date).substring(0, 4) === String(selectedYear)
        );

    invoices.forEach(inv => {
        const c = getData('customers').find(
            cust => String(cust.id) === String(inv.customerId)
        ) || { name: 'Sconosciuto' };

        const isCredit = inv.type === 'Nota di Credito';
        const isPaid = (!isCredit) && (inv.status === 'Pagata');
        const isSent = inv.sentToAgenzia === true;

        // Blocchi:
        // - Modifica/Elimina: bloccati se Pagata (solo fatture) oppure se marcata Inviata ad ADE
        // - Pagata: deve restare cliccabile anche se "Inviata", finché non è Pagata. (Per NdC è sempre disabilitato)
        const lockEditDelete = isSent || ((!isCredit) && isPaid);
        const lockPaidButton = isCredit || isPaid;
const badge = inv.type === 'Nota di Credito'
            ? '<span class="badge bg-warning text-dark border border-dark">NdC</span>'
            : '<span class="badge bg-primary">Fatt.</span>';

        // Badge stato documenti:
        // - Fatture: sempre doppio badge (invio + incasso)
        //   * appena creata: Da inviare + Da incassare
        //   * dopo invio: Inviata + Da incassare
        //   * dopo pagamento: Inviata + Pagata
        // - Note di credito: Emessa finché non marcata come inviata; poi Emessa + Inviata
        let statusBadge = '';
        if (inv.type === 'Nota di Credito') {
            statusBadge = '<span class="badge bg-info text-dark">Emessa</span>';
            if (isSent) statusBadge += ' <span class="badge bg-dark">Inviata</span>';
        } else {
            const sendBadge = isSent
                ? '<span class="badge bg-dark">Inviata</span>'
                : '<span class="badge bg-secondary">Da inviare</span>';

            const payBadge = isPaid
                ? '<span class="badge bg-success">Pagata</span>'
                : '<span class="badge bg-warning text-dark">Da Incassare</span>';

            statusBadge = `${sendBadge} ${payBadge}`;
        }

        const payClass = lockPaidButton ? 'btn-secondary disabled' : 'btn-success';
        const editClass = lockEditDelete ? 'btn-secondary disabled' : 'btn-outline-secondary';
        const btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice ${lockEditDelete ? 'disabled' : ''}" data-id="${inv.id}" title="Elimina" ${lockEditDelete ? 'disabled' : ''}><i class="fas fa-trash"></i></button>`;

        const btns = `
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Vedi">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm ${editClass} btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${lockEditDelete ? 'disabled' : ''}>
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="XML">
                    <i class="fas fa-file-code"></i>
                </button>
                <button class=\"btn btn-sm ${isSent ? 'btn-dark' : 'btn-outline-dark'} btn-mark-sent\" data-id=\"${inv.id}\" title=\"${isSent ? 'Segnato come Inviato (clic per annullare)' : 'Segna come Inviato'}\">
                    <i class=\"fas fa-paper-plane\"></i>
                </button>
                <button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="Segna come pagata" ${lockPaidButton ? 'disabled' : ''}>
                    <i class="fas fa-check"></i>
                </button>
                ${btnDelete}
            </div>
        `;

        const total = (parseFloat(inv.total) || 0).toFixed(2);
        table.append(`
            <tr class="${lockEditDelete ? 'table-light text-muted' : ''}">
                <td>${badge}</td>
                <td class="fw-bold">${inv.number}</td>
                <td>${formatDateForDisplay(inv.date)}</td>
                <td>${c.name}</td>
                <td class="text-end">€ ${total}</td>
                <td class="text-end small">${formatDateForDisplay(inv.dataScadenza)}</td>
                <td>${statusBadge}</td>
                <td class="text-end">${btns}</td>
            </tr>
        `);
    });
}

    function populateDropdowns() {
        // clienti
        $('#invoice-customer-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append(
                getData('customers').map(c => 
                    `<option value="${c.id}">${c.name}</option>`
                )
            );

        // prodotti/servizi
        $('#invoice-product-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append('<option value="manual">Manuale</option>')
            .append(
                getData('products').map(p =>
                    `<option value="${p.id}">${p.code || ''} - ${p.description || ''}</option>`
                )
            );
    }

    // =========================================================


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

    const money = (v) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '0.00';

    // -----------------------------
    // Stima acconti (didattica)
    // Regola standard: se l'acconto complessivo è >= 257,52€ -> 40% + 60%;
    // se tra 52€ e 257,52€ -> unica rata; sotto 52€ -> nessun acconto.
    // (La numerazione righi/colonne può variare per annualità del modello.)
    const imposta = (typeof s.impostaSostitutivaStimata === 'number' && isFinite(s.impostaSostitutivaStimata)) ? s.impostaSostitutivaStimata : 0;
    let accontiHtml = '';
    if (imposta > 0) {
        if (imposta >= 257.52) {
            const a1 = imposta * 0.40;
            const a2 = imposta * 0.60;
            accontiHtml = `<div class="mt-2"><b>Stima acconti imposta:</b> 1° acconto (40%) € ${money(a1)} — 2° acconto (60%) € ${money(a2)}</div>`;
        } else if (imposta >= 52) {
            accontiHtml = `<div class="mt-2"><b>Stima acconto imposta:</b> unica rata € ${money(imposta)} (soglia sotto 257,52€)</div>`;
        } else {
            accontiHtml = `<div class="mt-2 text-muted"><b>Stima acconti imposta:</b> nessun acconto (sotto 52€)</div>`;
        }
    }


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

<div class=\"mt-3 p-2 border rounded\">
          <div class=\"mb-1\"><span class=\"badge bg-primary\">FISCO</span></div>
          <div><b>Imponibile imposta:</b> € ${money(s.imponibileImposta)}</div>
          <div><b>Imposta sostitutiva stimata:</b> € ${money(s.impostaSostitutivaStimata)} (${escapeXML(String(s.aliquotaSostitutiva || ''))}%)</div>
          ${accontiHtml}
        </div>
        </div>
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
}

