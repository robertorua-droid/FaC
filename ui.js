// FILE: ui.js - Gestione Interfaccia Utente (Versione Corretta)

// --- Render Principale ---
function renderAll() {
    renderCompanyInfoForm(); 
    updateCompanyUI(); 
    renderProductsTable(); 
    renderCustomersTable(); 
    renderInvoicesTable();
    populateDropdowns(); 
    renderStatisticsPage(); 
    renderHomePage();
}

// --- Header e Sidebar ---
function updateCompanyUI() { 
    const company = getData('companyInfo'); 
    if(company.name) $('#company-name-sidebar').text(company.name);
    if(currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
}

// --- Home Page ---
function renderHomePage() {
    // Messaggio di Benvenuto
    if(currentUser && currentUser.email) {
        $('#welcome-message').text(`Benvenuto, ${currentUser.email}`);
    }

    // Carica note personali
    const userNote = getData('notes').find(n => n.userId === (currentUser ? currentUser.uid : '')); 
    if(userNote) $('#notes-textarea').val(userNote.text);
    
    // Orologio
    // Nota: dateTimeInterval è definita globale in config.js o main.js
    if (typeof dateTimeInterval !== 'undefined') clearInterval(dateTimeInterval);
    
    const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    updateDateTime();
    
    // Assegnamo a window per essere sicuri che sia accessibile globalmente
    window.dateTimeInterval = setInterval(updateDateTime, 1000);

    // Calendario
    renderCalendar();
}

function renderCalendar() {
    const c = $('#calendar-widget');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayDate = now.getDate();
    
    // Primo giorno del mese
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Ultimo giorno del mese
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    const totalDays = lastDay.getDate();
    let startingDay = firstDay.getDay(); // 0 = Domenica
    
    let html = `<div class="card shadow-sm border-0">
                <div class="card-header bg-primary text-white text-center fw-bold">
                    ${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}
                </div>
                <div class="card-body p-0">
                <table class="table table-bordered text-center mb-0" style="table-layout: fixed;">
                    <thead class="table-light"><tr>
                        <th class="text-danger">Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th>
                    </tr></thead>
                    <tbody><tr>`;
    
    // Celle vuote iniziali
    for(let i = 0; i < startingDay; i++) { 
        html += '<td class="bg-light"></td>'; 
    }
    
    // Giorni del mese
    for(let day = 1; day <= totalDays; day++) {
        if (startingDay > 6) {
            startingDay = 0;
            html += '</tr><tr>';
        }
        
        const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
        html += `<td class="align-middle p-2"><div class="${isToday}" style="width:30px; height:30px; line-height:30px; margin:0 auto;">${day}</div></td>`;
        
        startingDay++;
    }
    
    // Celle vuote finali
    while(startingDay <= 6) { 
        html += '<td class="bg-light"></td>'; 
        startingDay++; 
    }
    
    html += '</tr></tbody></table></div></div>';
    c.html(html);
}

// --- Statistiche e Simulazione Fiscale ---
function renderStatisticsPage() {
    const container = $('#stats-table-container').empty();
    const invoices = getData('invoices');
    const customers = getData('customers');

    // Filtri per tipo documento
    const facts = invoices.filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '');
    const notes = invoices.filter(i => i.type === 'Nota di Credito');
    
    if(facts.length === 0) { 
        container.html('<div class="alert alert-info">Non ci sono ancora fatture per generare statistiche.</div>'); 
        renderTaxSimulation(0, 0); 
        return; 
    }

    // Helper locale per convertire stringhe in numeri
    const safeFloat = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };

    const totalFact = facts.reduce((s, i) => s + safeFloat(i.total), 0);
    const totalNote = notes.reduce((s, i) => s + safeFloat(i.total), 0);
    const netTotal = totalFact - totalNote;

    let custTot = {};
    
    // Somma Fatture
    facts.forEach(i => { 
        const cid = String(i.customerId);
        if(!custTot[cid]) custTot[cid] = 0;
        custTot[cid] += safeFloat(i.total); 
    });
    
    // Sottrai Note di Credito
    notes.forEach(i => { 
        const cid = String(i.customerId);
        if(custTot[cid]) custTot[cid] -= safeFloat(i.total); 
    });

    // Tabella Fatturato per Cliente
    let html = `<div class="card shadow-sm mb-4 border-0"><div class="card-header fw-bold bg-white border-bottom">Dettaglio Clienti</div><div class="card-body p-0"><table class="table table-striped mb-0 table-hover"><thead><tr><th>Cliente</th><th class="text-end">Fatturato Netto</th><th class="text-end">% sul Totale</th></tr></thead><tbody>`;
    
    const sortedIds = Object.keys(custTot).sort((a,b) => custTot[b] - custTot[a]);
    
    for(const cid of sortedIds) {
        const c = customers.find(x => String(x.id) === String(cid)) || {name: 'Cliente Eliminato'};
        const tot = custTot[cid];
        const perc = netTotal > 0 ? (tot / netTotal) * 100 : 0;
        html += `<tr><td>${c.name}</td><td class="text-end">€ ${tot.toFixed(2)}</td><td class="text-end">${perc.toFixed(1)}%</td></tr>`;
    }
    
    html += `</tbody><tfoot class="table-dark"><tr><td>TOTALE GENERALE</td><td class="text-end">€ ${netTotal.toFixed(2)}</td><td class="text-end">100%</td></tr></tfoot></table></div></div>`;
    container.html(html);
    
    // Calcolo imponibili per le tasse (usando safeFloat)
    const impFact = facts.reduce((s, i) => s + safeFloat(i.totaleImponibile || i.total), 0); // Fallback su total se imponibile manca
    const impNote = notes.reduce((s, i) => s + safeFloat(i.totaleImponibile || i.total), 0);
    renderTaxSimulation(impFact, impNote);
}

function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
    const container = $('#tax-simulation-container').empty();
    const comp = getData('companyInfo');
    
    const safeFloat = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };

    const coeff = safeFloat(comp.coefficienteRedditivita);
    const taxRate = safeFloat(comp.aliquotaSostitutiva);
    const inpsRate = safeFloat(comp.aliquotaContributi);

    if(!coeff || !taxRate || !inpsRate) { 
        container.html('<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> Per la simulazione fiscale, compila tutti i campi percentuali in "Anagrafica Azienda".</div>'); 
        return; 
    }

    const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
    const taxableIncome = grossRevenue * (coeff / 100); // Reddito Imponibile Lordo
    const socialSecurity = taxableIncome * (inpsRate / 100); // INPS
    const netTaxable = taxableIncome - socialSecurity; // Reddito Netto
    // Imposta minima 0
    const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0; 
    const totalDue = socialSecurity + tax;

    const html = `
        <div class="card bg-light border-0 shadow-sm">
            <div class="card-body">
                <h4 class="card-title mb-4 text-primary"><i class="fas fa-calculator"></i> Simulazione Fiscale (Regime Forfettario)</h4>
                <div class="row g-4">
                    <div class="col-md-6">
                        <div class="card h-100 border-primary">
                            <div class="card-header bg-primary text-white">Contributi INPS (${inpsRate}%)</div>
                            <div class="card-body">
                                <ul class="list-group list-group-flush">
                                    <li class="list-group-item d-flex justify-content-between"><span>Imponibile Lordo:</span> <strong>€ ${taxableIncome.toFixed(2)}</strong></li>
                                    <li class="list-group-item list-group-item-primary d-flex justify-content-between fs-5"><span>Totale INPS:</span> <strong>€ ${socialSecurity.toFixed(2)}</strong></li>
                                    <li class="list-group-item d-flex justify-content-between text-muted"><small>Acconto 1 (40%):</small> <small>€ ${(socialSecurity*0.4).toFixed(2)}</small></li>
                                    <li class="list-group-item d-flex justify-content-between text-muted"><small>Acconto 2 (40%):</small> <small>€ ${(socialSecurity*0.4).toFixed(2)}</small></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100 border-success">
                            <div class="card-header bg-success text-white">Imposta Sostitutiva (${taxRate}%)</div>
                            <div class="card-body">
                                <ul class="list-group list-group-flush">
                                    <li class="list-group-item d-flex justify-content-between"><span>Reddito Netto:</span> <strong>€ ${netTaxable.toFixed(2)}</strong></li>
                                    <li class="list-group-item list-group-item-success d-flex justify-content-between fs-5"><span>Totale Imposta:</span> <strong>€ ${tax.toFixed(2)}</strong></li>
                                    <li class="list-group-item d-flex justify-content-between text-muted"><small>Acconto 1 (50%):</small> <small>€ ${(tax*0.5).toFixed(2)}</small></li>
                                    <li class="list-group-item d-flex justify-content-between text-muted"><small>Acconto 2 (50%):</small> <small>€ ${(tax*0.5).toFixed(2)}</small></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 mt-3">
                        <div class="alert alert-dark text-center fs-4 fw-bold m-0">
                            TOTALE STIMATO DA VERSARE: € ${totalDue.toFixed(2)}
                        </div>
                    </div>
                </div>
                <p class="text-muted small mt-3 mb-0 text-center">* Stima a scopo didattico.</p>
            </div>
        </div>
    `;
    container.html(html);
}

// --- Anagrafiche (Tabelle) ---
function renderCompanyInfoForm() { const c = getData('companyInfo'); for (const k in c) $(`#company-${k}`).val(c[k]); }

function renderProductsTable() { 
    const table = $('#products-table-body').empty(); 
    getData('products').forEach(p => { 
        const price = parseFloat(p.salePrice).toFixed(2);
        table.append(`<tr><td>${p.code}</td><td>${p.description}</td><td class="text-end">€ ${price}</td><td class="text-end">${p.iva}%</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
    }); 
}

function renderCustomersTable() { 
    const table = $('#customers-table-body').empty(); 
    getData('customers').forEach(c => { 
        table.append(`<tr><td>${c.name}</td><td>${c.piva}</td><td>${c.sdi || '-'}</td><td>${c.address || ''}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
    }); 
}

function renderInvoicesTable() {
    const table = $('#invoices-table-body').empty();
    // Ordine decrescente per numero
    const invoices = getData('invoices').sort((a, b) => (b.number || '').localeCompare(a.number || ''));
    
    invoices.forEach(inv => {
        const c = getData('customers').find(cust => String(cust.id) === String(inv.customerId)) || { name: 'Cliente non trovato' };
        const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
        
        // Badge Tipo
        const badge = inv.type === 'Nota di Credito' 
            ? '<span class="badge bg-warning text-dark border border-dark">NdC</span>' 
            : '<span class="badge bg-primary">Fatt.</span>';
            
        // Badge Stato
        let statusBadge = '<span class="badge bg-warning text-dark">Da Incassare</span>';
        if (inv.type === 'Nota di Credito') {
             statusBadge = isPaid ? '<span class="badge bg-info text-dark">Emessa</span>' : '<span class="badge bg-secondary">Bozza</span>';
        } else {
             statusBadge = isPaid ? '<span class="badge bg-success">Pagata</span>' : '<span class="badge bg-warning text-dark">Da Incassare</span>';
        }
        
        // Bottoni
        const payClass = isPaid ? 'btn-secondary disabled' : 'btn-success';
        const editClass = isPaid ? 'btn-secondary disabled' : 'btn-secondary';
        
        const btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina"><i class="fas fa-trash"></i></button>`;

        const btns = `
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Vedi"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm ${editClass} btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${isPaid?'disabled':''}><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="XML"><i class="fas fa-file-code"></i></button>
                <button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="Stato" ${isPaid?'disabled':''}><i class="fas fa-check"></i></button>
                ${btnDelete}
            </div>
        `;
        
        // Safe float per evitare NaN
        const total = (parseFloat(inv.total) || 0).toFixed(2);
        
        table.append(`<tr class="${isPaid?'table-light text-muted':''}">
            <td>${badge}</td>
            <td class="fw-bold">${inv.number}</td>
            <td>${formatDateForDisplay(inv.date)}</td>
            <td>${c.name}</td>
            <td class="text-end">€ ${total}</td>
            <td class="text-end small">${formatDateForDisplay(inv.dataScadenza)}</td>
            <td>${statusBadge}</td>
            <td class="text-end">${btns}</td>
        </tr>`);
    });
}

function populateDropdowns() {
    // Clienti
    $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona Cliente...</option>')
        .append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
    
    // Prodotti
    $('#invoice-product-select').empty().append('<option selected value="">Seleziona Servizio...</option><option value="manual">--- Inserimento Manuale ---</option>')
        .append(getData('products').map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`));
}