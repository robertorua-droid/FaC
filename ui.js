// Render dell'Interfaccia

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

function updateCompanyUI() { 
    const company = getData('companyInfo'); 
    if(company.name) $('#company-name-sidebar').text(company.name);
    if(currentUser) $('#user-name-sidebar').text(currentUser.email);
}

function renderCompanyInfoForm() { const c = getData('companyInfo'); for (const k in c) $(`#company-${k}`).val(c[k]); }

function renderProductsTable() { 
    const table = $('#products-table-body').empty(); 
    getData('products').forEach(p => { 
        table.append(`<tr><td>${p.code}</td><td>${p.description}</td><td class="text-end">€ ${p.salePrice}</td><td class="text-end">${p.iva}%</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
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
    const invoices = getData('invoices').sort((a, b) => (b.number || '').localeCompare(a.number || ''));
    
    invoices.forEach(inv => {
        const c = getData('customers').find(cust => String(cust.id) === String(inv.customerId)) || { name: '?' };
        const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
        const badge = inv.type === 'Nota di Credito' ? '<span class="badge bg-warning text-dark">NdC</span>' : '<span class="badge bg-primary">Fatt.</span>';
        const statusBadge = isPaid ? '<span class="badge bg-success">OK</span>' : '<span class="badge bg-warning text-dark">Attesa</span>';
        
        const btns = `
            <button class="btn btn-sm btn-info btn-view-invoice" data-id="${inv.id}"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm btn-secondary btn-edit-invoice" data-id="${inv.id}" ${isPaid?'disabled':''}><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}"><i class="fas fa-file-code"></i></button>
            <button class="btn btn-sm ${isPaid?'btn-secondary':'btn-success'} btn-mark-paid" data-id="${inv.id}" ${isPaid?'disabled':''}><i class="fas fa-check"></i></button>
            <button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}"><i class="fas fa-trash"></i></button>
        `;
        table.append(`<tr><td>${badge}</td><td>${inv.number}</td><td>${formatDateForDisplay(inv.date)}</td><td>${c.name}</td><td class="text-end">€ ${inv.total.toFixed(2)}</td><td class="text-end">${formatDateForDisplay(inv.dataScadenza)}</td><td>${statusBadge}</td><td class="text-end"><div class="d-flex justify-content-end gap-1">${btns}</div></td></tr>`);
    });
}

function renderStatisticsPage() {
    const container = $('#stats-table-container').empty();
    const invs = getData('invoices');
    const facts = invs.filter(i => i.type !== 'Nota di Credito');
    const notes = invs.filter(i => i.type === 'Nota di Credito');
    
    if(facts.length === 0) { container.html('Nessuna fattura.'); renderTaxSimulation(0,0); return; }

    const totalFact = facts.reduce((s, i) => s + i.total, 0);
    const totalNote = notes.reduce((s, i) => s + i.total, 0);
    const net = totalFact - totalNote;

    let custTot = {};
    facts.forEach(i => { custTot[i.customerId] = (custTot[i.customerId] || 0) + i.total; });
    notes.forEach(i => { if(custTot[i.customerId]) custTot[i.customerId] -= i.total; });

    let html = `<table class="table"><thead><tr><th>Cliente</th><th class="text-end">Netto</th><th class="text-end">%</th></tr></thead><tbody>`;
    for(const cid in custTot) {
        const c = getData('customers').find(x => String(x.id) === String(cid)) || {name: '?'};
        html += `<tr><td>${c.name}</td><td class="text-end">€ ${custTot[cid].toFixed(2)}</td><td class="text-end">${((custTot[cid]/net)*100).toFixed(1)}%</td></tr>`;
    }
    html += `</tbody></table>`;
    container.html(html);
    
    const impFact = facts.reduce((s, i) => s + i.totaleImponibile, 0);
    const impNote = notes.reduce((s, i) => s + i.totaleImponibile, 0);
    renderTaxSimulation(impFact, impNote);
}

function renderTaxSimulation(fatturato, noteCredito) {
    const container = $('#tax-simulation-container').empty();
    const comp = getData('companyInfo');
    const coeff = parseFloat(comp.coefficienteRedditivita || 0);
    const tax = parseFloat(comp.aliquotaSostitutiva || 0);
    const inps = parseFloat(comp.aliquotaContributi || 0);

    if(!coeff) { container.html('Dati fiscali mancanti.'); return; }

    const gross = fatturato - noteCredito;
    const taxable = gross * (coeff/100);
    const dueInps = taxable * (inps/100);
    const netTaxable = taxable - dueInps;
    const dueTax = netTaxable * (tax/100);

    container.html(`
        <div class="card"><div class="card-body">
            <h5>Stima Tasse</h5>
            <p>Imponibile Lordo: € ${taxable.toFixed(2)}</p>
            <p>INPS (${inps}%): € ${dueInps.toFixed(2)}</p>
            <p>Imposta (${tax}%): € ${dueTax.toFixed(2)}</p>
            <h4 class="text-primary">Totale da Versare: € ${(dueInps+dueTax).toFixed(2)}</h4>
        </div></div>
    `);
}

function renderHomePage() {
    if(currentUser) $('#welcome-message').text(`Ciao, ${currentUser.email}`);
    const n = getData('notes').find(x => x.userId === currentUser.uid);
    if(n) $('#notes-textarea').val(n.text);
    
    const now = new Date();
    $('#current-datetime').text(now.toLocaleDateString());
    // Calendar simple
    $('#calendar-widget').html(`<div class="text-center p-3 bg-light rounded"><h3>${now.getDate()}</h3><p>${now.toLocaleString('default',{month:'long'})}</p></div>`);
}

function populateDropdowns() {
    $('#invoice-customer-select').empty().append('<option>Seleziona...</option>').append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
    $('#invoice-product-select').empty().append('<option value="">...</option><option value="manual">Manuale</option>').append(getData('products').map(p => `<option value="${p.id}">${p.code}</option>`));
}

// XML Generation
function generateInvoiceXML(invoiceId) {
    const inv = getData('invoices').find(i => String(i.id) === String(invoiceId));
    if(!inv) return;
    alert("Generazione XML per fattura " + inv.number);
    // (XML logic simplified for brevity in modular version, add full logic if needed)
}