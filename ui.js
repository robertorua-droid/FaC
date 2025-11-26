// FILE: ui.js - Gestione Interfaccia Utente

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
    // Il messaggio utente viene gestito in renderHomePage, ma aggiorniamo anche qui per sicurezza
    if(currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
}

// --- Home Page (Benvenuto e Calendario) ---
function renderHomePage() {
    // Messaggio di Benvenuto
    if(currentUser && currentUser.email) {
        $('#welcome-message').text(`Benvenuto, ${currentUser.email}`);
        $('#user-name-sidebar').text(currentUser.email); // Aggiorna anche la sidebar
    }

    // Carica note personali
    const userNote = getData('notes').find(n => n.userId === (currentUser ? currentUser.uid : '')); 
    if(userNote) $('#notes-textarea').val(userNote.text);
    
    // Orologio
    if (typeof dateTimeInterval !== 'undefined') clearInterval(dateTimeInterval);
    const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    updateDateTime();
    // Nota: dateTimeInterval deve essere definito in config.js o main.js come variabile globale
    window.dateTimeInterval = setInterval(updateDateTime, 1000);

    // Calendario Completo
    renderCalendar();
}

function renderCalendar() {
    const c = $('#calendar-widget');
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const t = now.getDate(); // Giorno di oggi
    
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    
    let html = `<h5 class="text-center mb-3">${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}</h5>
                <table class="table table-bordered text-center table-sm">
                    <thead class="table-light"><tr><th>Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th></tr></thead>
                    <tbody><tr>`;
    
    let d = firstDay.getDay(); // Giorno della settimana (0 = Domenica)
    
    // Celle vuote iniziali
    for(let i=0; i<d; i++) { html += '<td></td>'; }
    
    // Giorni del mese
    for(let day=1; day <= lastDay.getDate(); day++) {
        if(d === 7) { d=0; html += '</tr><tr>'; } // A capo
        const isToday = (day === t) ? 'class="bg-primary text-white fw-bold rounded-circle"' : '';
        // Un piccolo div per rendere il cerchio visibile
        html += `<td class="align-middle"><div ${isToday} style="width:30px; height:30px; line-height:30px; margin:0 auto;">${day}</div></td>`;
        d++;
    }
    
    // Celle vuote finali per completare la riga
    while(d < 7 && d !== 0) { html += '<td></td>'; d++; }
    
    html += '</tr></tbody></table>';
    c.html(html);
}

// --- Statistiche e Simulazione Fiscale ---
function renderStatisticsPage() {
    const container = $('#stats-table-container').empty();
    const invoices = getData('invoices');
    const customers = getData('customers');

    // Filtri robusti come nella v6.7
    const facts = invoices.filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '');
    const notes = invoices.filter(i => i.type === 'Nota di Credito');
    
    if(facts.length === 0) { 
        container.html('<div class="alert alert-info">Non ci sono ancora fatture per generare statistiche.</div>'); 
        renderTaxSimulation(0, 0); 
        return; 
    }

    const totalFact = facts.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
    const totalNote = notes.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
    const netTotal = totalFact - totalNote;

    let custTot = {};
    
    // Somma Fatture
    facts.forEach(i => { 
        if(!custTot[i.customerId]) custTot[i.customerId] = 0;
        custTot[i.customerId] += (parseFloat(i.total) || 0); 
    });
    
    // Sottrai Note di Credito
    notes.forEach(i => { 
        if(custTot[i.customerId]) custTot[i.customerId] -= (parseFloat(i.total) || 0); 
    });

    // Tabella Fatturato per Cliente
    let html = `<table class="table table-hover">
                <thead><tr><th>Cliente</th><th class="text-end">Fatturato Netto</th><th class="text-end">% sul Totale</th></tr></thead>
                <tbody>`;
    
    // Ordina clienti per fatturato
    const sortedIds = Object.keys(custTot).sort((a,b) => custTot[b] - custTot[a]);
    
    for(const cid of sortedIds) {
        const c = customers.find(x => String(x.id) === String(cid)) || {name: 'Cliente Eliminato'};
        const tot = custTot[cid];
        const perc = netTotal > 0 ? (tot / netTotal) * 100 : 0;
        html += `<tr><td>${c.name}</td><td class="text-end">€ ${tot.toFixed(2)}</td><td class="text-end">${perc.toFixed(1)}%</td></tr>`;
    }
    
    html += `</tbody><tfoot class="table-group-divider fw-bold"><tr><td>TOTALE GENERALE</td><td class="text-end">€ ${netTotal.toFixed(2)}</td><td class="text-end">100%</td></tr></tfoot></table>`;
    container.html(html);
    
    // Calcolo imponibili per le tasse
    const impFact = facts.reduce((s, i) => s + (parseFloat(i.totaleImponibile) || 0), 0);
    const impNote = notes.reduce((s, i) => s + (parseFloat(i.totaleImponibile) || 0), 0);
    renderTaxSimulation(impFact, impNote);
}

function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
    const container = $('#tax-simulation-container').empty();
    const comp = getData('companyInfo');
    
    const coeff = parseFloat(comp.coefficienteRedditivita || 0);
    const taxRate = parseFloat(comp.aliquotaSostitutiva || 0);
    const inpsRate = parseFloat(comp.aliquotaContributi || 0);

    if(!coeff || !taxRate || !inpsRate) { 
        container.html('<div class="alert alert-warning">Per la simulazione fiscale, compila tutti i campi (Coefficiente, Aliquote) in "Anagrafica Azienda".</div>'); 
        return; 
    }

    const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
    const taxableIncome = grossRevenue * (coeff / 100); // Reddito Imponibile Lordo
    const socialSecurity = taxableIncome * (inpsRate / 100); // INPS
    const netTaxable = taxableIncome - socialSecurity; // Reddito Netto
    const tax = netTaxable * (taxRate / 100); // Imposta Sostitutiva
    const totalDue = socialSecurity + tax;

    const html = `
        <div class="card bg-light border-0">
            <div class="card-body">
                <h4 class="card-title mb-4"><i class="fas fa-calculator"></i> Simulazione Fiscale (Forfettario)</h4>
                <div class="row">
                    <div class="col-md-6">
                        <ul class="list-group list-group-flush bg-transparent">
                            <li class="list-group-item bg-transparent d-flex justify-content-between"><span>Fatturato Netto:</span> <strong>€ ${grossRevenue.toFixed(2)}</strong></li>
                            <li class="list-group-item bg-transparent d-flex justify-content-between"><span>Reddito Imponibile (${coeff}%):</span> <strong>€ ${taxableIncome.toFixed(2)}</strong></li>
                            <li class="list-group-item bg-transparent d-flex justify-content-between text-danger"><span>Contributi INPS (${inpsRate}%):</span> <strong>€ ${socialSecurity.toFixed(2)}</strong></li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <ul class="list-group list-group-flush bg-transparent">
                            <li class="list-group-item bg-transparent d-flex justify-content-between"><span>Reddito Netto:</span> <strong>€ ${netTaxable.toFixed(2)}</strong></li>
                            <li class="list-group-item bg-transparent d-flex justify-content-between text-danger"><span>Imposta Sostitutiva (${taxRate}%):</span> <strong>€ ${tax.toFixed(2)}</strong></li>
                            <li class="list-group-item bg-primary text-white d-flex justify-content-between mt-2 rounded"><span>TOTALE DA VERSARE:</span> <strong>€ ${totalDue.toFixed(2)}</strong></li>
                        </ul>
                    </div>
                </div>
                <p class="text-muted small mt-3 mb-0">* Questa è una stima didattica. Consulta il commercialista.</p>
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
        table.append(`<tr><td>${c.name}</td><td>${c.piva}</td><td>${c.sdi}</td><td>${c.address}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
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
            ? '<span class="badge bg-warning text-dark">NdC</span>' 
            : '<span class="badge bg-primary">Fatt.</span>';
            
        // Badge Stato
        let statusBadge = '<span class="badge bg-warning text-dark">Da Incassare</span>';
        if (inv.type === 'Nota di Credito') {
             statusBadge = isPaid ? '<span class="badge bg-info text-dark">Emessa</span>' : '<span class="badge bg-secondary">Bozza</span>';
        } else {
             statusBadge = isPaid ? '<span class="badge bg-success">Pagata</span>' : '<span class="badge bg-warning text-dark">Da Incassare</span>';
        }
        
        // Pulsanti Allineati
        const payClass = isPaid ? 'btn-secondary disabled' : 'btn-success';
        const editClass = isPaid ? 'btn-secondary disabled' : 'btn-secondary';
        
        // Solo Admin/Supervisor vede delete (o tutti se non gestiamo ruoli strict)
        const btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina"><i class="fas fa-trash"></i></button>`;

        const btns = `
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Dettagli"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm ${editClass} btn-edit-invoice" data-id="${inv.id}" title="Modifica"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="XML"><i class="fas fa-file-code"></i></button>
                <button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="Stato"><i class="fas fa-check"></i></button>
                ${btnDelete}
            </div>
        `;
        
        const total = parseFloat(inv.total).toFixed(2);
        table.append(`<tr class="${isPaid?'table-light text-muted':''}"><td>${badge}</td><td>${inv.number}</td><td>${formatDateForDisplay(inv.date)}</td><td>${c.name}</td><td class="text-end">€ ${total}</td><td class="text-end">${formatDateForDisplay(inv.dataScadenza)}</td><td>${statusBadge}</td><td class="text-end">${btns}</td></tr>`);
    });
}

function populateDropdowns() {
    // Clienti
    $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona Cliente...</option>')
        .append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
    
    // Prodotti
    $('#invoice-product-select').empty().append('<option selected value="">Seleziona Servizio...</option><option value="manual">--- Inserimento Manuale ---</option>')
        .append(getData('products').map(p => `<option value="${p.id}">${p.code}</option>`));
}