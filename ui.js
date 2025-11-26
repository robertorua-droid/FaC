// FILE: ui.js - Gestione Interfaccia Utente (CORRETTO)

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
    // Benvenuto
    if(currentUser && currentUser.email) {
        $('#welcome-message').text(`Benvenuto, ${currentUser.email}`);
    }

    // Note
    const userNote = getData('notes').find(n => n.userId === (currentUser ? currentUser.uid : '')); 
    if(userNote) $('#notes-textarea').val(userNote.text);
    
    // Orologio
    if (typeof window.dateTimeInterval !== 'undefined') clearInterval(window.dateTimeInterval);
    const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    updateDateTime();
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
    
    // Primo giorno del mese (es. 1 Gennaio)
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Ultimo giorno del mese (es. 31 Gennaio)
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    const totalDays = lastDay.getDate();
    let startingDay = firstDay.getDay(); // 0 = Domenica
    
    // Correggi inizio settimana (Lunedì = 0 per la nostra tabella visiva, Domenica = 6)
    // Ma il metodo getDay() ritorna 0 per Domenica. Adattiamolo allo standard Lun-Dom o Dom-Sab.
    // Qui usiamo standard Dom(0) - Sab(6) come header HTML.

    let html = `<h5 class="text-center mb-3 text-uppercase">${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'})}</h5>
                <table class="table table-bordered text-center table-sm bg-white">
                    <thead class="table-light"><tr><th>Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th></tr></thead>
                    <tbody><tr>`;
    
    // Celle vuote prima del primo giorno
    for(let i = 0; i < startingDay; i++) { 
        html += '<td class="bg-light"></td>'; 
    }
    
    // Giorni del mese
    for(let day = 1; day <= totalDays; day++) {
        // Se è domenica (e non è il primissimo giorno della riga), vai a capo
        if (startingDay > 6) {
            startingDay = 0;
            html += '</tr><tr>';
        }
        
        const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
        html += `<td class="align-middle"><div class="${isToday}" style="width:30px; height:30px; line-height:30px; margin:0 auto;">${day}</div></td>`;
        
        startingDay++;
    }
    
    // Celle vuote finali
    while(startingDay <= 6) { 
        html += '<td class="bg-light"></td>'; 
        startingDay++; 
    }
    
    html += '</tr></tbody></table>';
    c.html(html);
}

// --- Statistiche ---
function renderStatisticsPage() {
    const container = $('#stats-table-container').empty();
    const invoices = getData('invoices');
    const customers = getData('customers');

    const facts = invoices.filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '');
    const notes = invoices.filter(i => i.type === 'Nota di Credito');
    
    if(facts.length === 0) { 
        container.html('<div class="alert alert-info">Non ci sono ancora fatture per generare statistiche.</div>'); 
        renderTaxSimulation(0, 0); 
        return; 
    }

    // Helper per parsare numeri sicuri
    const safeFloat = (val) => {
        const n = parseFloat(val);
        return isNaN(n) ? 0 : n;
    };

    const totalFact = facts.reduce((s, i) => s + safeFloat(i.total), 0);
    const totalNote = notes.reduce((s, i) => s + safeFloat(i.total), 0);
    const netTotal = totalFact - totalNote;

    let custTot = {};
    facts.forEach(i => { 
        const cid = String(i.customerId);
        if(!custTot[cid]) custTot[cid] = 0;
        custTot[cid] += safeFloat(i.total); 
    });
    
    notes.forEach(i => { 
        const cid = String(i.customerId);
        if(custTot[cid]) custTot[cid] -= safeFloat(i.total); 
    });

    let html = `<table class="table table-hover align-middle">
                <thead class="table-light"><tr><th>Cliente</th><th class="text-end">Fatturato Netto</th><th class="text-end">% Totale</th></tr></thead>
                <tbody>`;
    
    const sortedIds = Object.keys(custTot).sort((a,b) => custTot[b] - custTot[a]);
    
    for(const cid of sortedIds) {
        const c = customers.find(x => String(x.id) === String(cid)) || { name: 'Cliente Eliminato/Ignoto' };
        const tot = custTot[cid];
        const perc = netTotal > 0 ? (tot / netTotal) * 100 : 0;
        html += `<tr><td>${c.name}</td><td class="text-end fw-bold">€ ${tot.toFixed(2)}</td><td class="text-end">${perc.toFixed(1)}%</td></tr>`;
    }
    
    html += `</tbody><tfoot class="table-group-divider fw-bold bg-light"><tr><td>TOTALE GENERALE</td><td class="text-end">€ ${netTotal.toFixed(2)}</td><td class="text-end">100%</td></tr></tfoot></table>`;
    container.html(html);
    
    // Calcoli per Tasse (Imponibile)
    const impFact = facts.reduce((s, i) => s + safeFloat(i.totaleImponibile), 0);
    const impNote = notes.reduce((s, i) => s + safeFloat(i.totaleImponibile), 0);
    renderTaxSimulation(impFact, impNote);
}

function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
    const container = $('#tax-simulation-container').empty();
    const comp = getData('companyInfo');
    
    const safeFloat = (val) => isNaN(parseFloat(val)) ? 0 : parseFloat(val);

    const coeff = safeFloat(comp.coefficienteRedditivita);
    const taxRate = safeFloat(comp.aliquotaSostitutiva);
    const inpsRate = safeFloat(comp.aliquotaContributi);

    if(!coeff || !taxRate || !inpsRate) { 
        container.html('<div class="alert alert-warning"><i class="fas fa-exclamation-circle"></i> Per vedere la simulazione fiscale, compila tutti i campi percentuali in "Anagrafica Azienda".</div>'); 
        return; 
    }

    const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
    const taxableIncome = grossRevenue * (coeff / 100);
    const socialSecurity = taxableIncome * (inpsRate / 100);
    const netTaxable = taxableIncome - socialSecurity;
    // Tassa minima 0 se negativo
    const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0; 
    const totalDue = socialSecurity + tax;

    const html = `
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-header bg-white border-bottom-0 pt-4">
                <h4 class="text-primary"><i class="fas fa-calculator"></i> Simulazione Fiscale</h4>
                <p class="text-muted small mb-0">Regime Forfettario • Coeff. ${coeff}% • Imposta ${taxRate}%</p>
            </div>
            <div class="card-body">
                <div class="row g-4">
                    <div class="col-md-6">
                        <div class="p-3 bg-light rounded h-100">
                            <h6 class="text-uppercase text-muted small fw-bold mb-3">Calcolo Base</h6>
                            <div class="d-flex justify-content-between mb-2"><span>Fatturato Netto:</span> <span class="fw-bold">€ ${grossRevenue.toFixed(2)}</span></div>
                            <div class="d-flex justify-content-between mb-2"><span>Reddito Imponibile:</span> <span>€ ${taxableIncome.toFixed(2)}</span></div>
                            <div class="d-flex justify-content-between text-danger"><span>Contributi INPS (${inpsRate}%):</span> <strong>€ ${socialSecurity.toFixed(2)}</strong></div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="p-3 bg-light rounded h-100">
                             <h6 class="text-uppercase text-muted small fw-bold mb-3">Imposte e Totali</h6>
                             <div class="d-flex justify-content-between mb-2"><span>Reddito Netto:</span> <span>€ ${netTaxable.toFixed(2)}</span></div>
                             <div class="d-flex justify-content-between mb-2 text-danger"><span>Imposta Sostitutiva:</span> <strong>€ ${tax.toFixed(2)}</strong></div>
                             <hr>
                             <div class="d-flex justify-content-between fs-5 fw-bold text-primary"><span>TOTALE DA VERSARE:</span> <span>€ ${totalDue.toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.html(html);
}

// --- Tabelle Anagrafiche ---

function renderCompanyInfoForm() { const c = getData('companyInfo'); for (const k in c) $(`#company-${k}`).val(c[k]); }

function renderProductsTable() { 
    const table = $('#products-table-body').empty(); 
    getData('products').forEach(p => { 
        const price = parseFloat(p.salePrice).toFixed(2);
        table.append(`<tr><td>${p.code}</td><td>${p.description}</td><td class="text-end">€ ${price}</td><td class="text-end">${p.iva}%</td><td class="text-end"><button class="btn btn-sm btn-outline-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
    }); 
}

function renderCustomersTable() { 
    const table = $('#customers-table-body').empty(); 
    getData('customers').forEach(c => { 
        table.append(`<tr><td>${c.name}</td><td>${c.piva}</td><td>${c.sdi || '-'}</td><td>${c.address || ''}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-outline-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
    }); 
}

function renderInvoicesTable() {
    const table = $('#invoices-table-body').empty();
    const invoices = getData('invoices');
    
    // Ordinamento naturale per numero documento (es. FATT-2025-2 viene dopo FATT-2025-1, FATT-2025-10 dopo 2)
    invoices.sort((a, b) => {
        const numA = a.number || ''; 
        const numB = b.number || '';
        return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
    });

    invoices.forEach(inv => {
        const c = getData('customers').find(cust => String(cust.id) === String(inv.customerId)) || { name: 'Cliente non trovato' };
        const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
        
        const badge = inv.type === 'Nota di Credito' 
            ? '<span class="badge bg-warning text-dark border border-dark">NdC</span>' 
            : '<span class="badge bg-primary">Fatt.</span>';
            
        let statusBadge = '<span class="badge bg-warning text-dark">Da Incassare</span>';
        if (inv.type === 'Nota di Credito') {
             statusBadge = isPaid ? '<span class="badge bg-info text-dark">Emessa</span>' : '<span class="badge bg-secondary">Bozza</span>';
        } else {
             statusBadge = isPaid ? '<span class="badge bg-success">Pagata</span>' : '<span class="badge bg-warning text-dark">Da Incassare</span>';
        }
        
        // Bottoni
        const payClass = isPaid ? 'btn-secondary disabled' : 'btn-success';
        const editClass = isPaid ? 'btn-secondary disabled' : 'btn-outline-secondary';
        
        const btns = `
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Vedi"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm ${editClass} btn-edit-invoice" data-id="${inv.id}" title="Modifica"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="XML"><i class="fas fa-file-code"></i></button>
                <button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="Pagata/Emessa"><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
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
    $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona Cliente...</option>')
        .append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
    
    $('#invoice-product-select').empty().append('<option selected value="">Seleziona Servizio...</option><option value="manual">--- Inserimento Manuale ---</option>')
        .append(getData('products').map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`));
}