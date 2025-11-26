// Logica Principale (Eventi)

$(document).ready(function() {

    // Auth Listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none');
            await loadAllDataFromCloud();
            $('#loading-screen').addClass('d-none');
            $('#main-app').removeClass('d-none');
            renderAll();
        } else {
            currentUser = null;
            $('#main-app').addClass('d-none');
            $('#login-container').removeClass('d-none');
        }
    });

    // Login
    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        auth.signInWithEmailAndPassword($('#email').val(), $('#password').val())
            .catch(err => { $('#login-error').removeClass('d-none'); });
    });
    $('#logout-btn').on('click', () => auth.signOut().then(() => location.reload()));

    // Navigation
    $('.sidebar .nav-link').on('click', function(e) {
        if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return;
        e.preventDefault();
        const target = $(this).data('target');
        if(target === 'nuova-fattura-accompagnatoria') {
            prepareNewItemModal('invoice'); // Reset
            if(this.id === 'menu-nuova-nota-credito') {
                 $('#document-type').val('Nota di Credito'); $('#document-title').text('Nuova Nota Credito'); $('#credit-note-fields').removeClass('d-none');
            } else {
                 $('#document-type').val('Fattura'); $('#document-title').text('Nuova Fattura'); $('#credit-note-fields').addClass('d-none');
            }
            populateDropdowns();
        }
        if(target === 'statistiche') renderStatisticsPage();
        
        $('.sidebar .nav-link').removeClass('active'); $(this).addClass('active');
        $('.content-section').addClass('d-none'); $('#' + target).removeClass('d-none');
    });

    // CRUD Buttons (Delegated)
    // Clienti
    $('#newCustomerBtn').click(() => { prepareNewItemModal('customer'); $('#customerModal').modal('show'); });
    $('#saveCustomerBtn').click(async () => {
        const id = $('#customer-id').val() || String(Date.now());
        const data = {
            name: $('#customer-name').val(), piva: $('#customer-piva').val(), codiceFiscale: $('#customer-codiceFiscale').val(),
            sdi: $('#customer-sdi').val(), address: $('#customer-address').val(), comune: $('#customer-comune').val(),
            provincia: $('#customer-provincia').val(), cap: $('#customer-cap').val(), nazione: $('#customer-nazione').val(),
            rivalsaInps: $('#customer-rivalsaInps').is(':checked')
        };
        await saveDataToCloud('customers', data, id); $('#customerModal').modal('hide'); renderAll();
    });
    $('#customers-table-body').on('click', '.btn-edit-customer', function() { editItem('customer', $(this).data('id')); });
    $('#customers-table-body').on('click', '.btn-delete-customer', function() { deleteDataFromCloud('customers', $(this).data('id')); });

    // Prodotti
    $('#newProductBtn').click(() => { prepareNewItemModal('product'); $('#productModal').modal('show'); });
    $('#saveProductBtn').click(async () => {
        const id = $('#product-id').val() || 'PRD' + Date.now();
        const data = {
            description: $('#product-description').val(), code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), iva: $('#product-iva').val(), esenzioneIva: $('#product-esenzioneIva').val()
        };
        await saveDataToCloud('products', data, id); $('#productModal').modal('hide'); renderAll();
    });
    $('#products-table-body').on('click', '.btn-edit-product', function() { editItem('product', $(this).data('id')); });
    $('#products-table-body').on('click', '.btn-delete-product', function() { deleteDataFromCloud('products', $(this).data('id')); });
    $('#product-iva').change(function() { toggleEsenzioneIvaField('product', $(this).val()); });

    // Fatture (Salvataggio Semplificato per Moduli)
    let currentLines = []; 
    $('#add-product-to-invoice-btn').click(() => {
        const desc = $('#invoice-product-description').val();
        if(!desc) return;
        const qty = parseFloat($('#invoice-product-qty').val());
        const price = parseFloat($('#invoice-product-price').val());
        currentLines.push({ productName: desc, qty, price, subtotal: qty*price });
        renderLines();
    });
    
    function renderLines() {
        const b = $('#invoice-lines-tbody').empty(); let t = 0;
        currentLines.forEach((l, i) => { t+=l.subtotal; b.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">${l.price}</td><td class="text-end">${l.subtotal}</td><td><button class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`); });
        $('#invoice-total').text(t.toFixed(2));
    }
    
    $('#invoice-lines-tbody').on('click', '.del-line', function() { currentLines.splice($(this).data('i'), 1); renderLines(); });

    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();
        const id = $('#editing-invoice-id').val() || String(Date.now());
        const data = {
            number: $('#invoice-number').val(), date: $('#invoice-date').val(),
            customerId: $('#invoice-customer-select').val(), type: $('#document-type').val(),
            lines: currentLines, total: parseFloat($('#invoice-total').text()),
            status: $('#document-type').val() === 'Fattura' ? 'Da Incassare' : 'Emessa',
            dataScadenza: $('#invoice-dataScadenza').val()
        };
        await saveDataToCloud('invoices', data, id);
        alert("Documento salvato!"); $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });
    
    // Dettaglio / Edit / Delete Fatture
    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const id = $(this).data('id');
        // Chiama funzione render dettaglio in ui.js (trigger manuale click pulsante nascosto se serve o logica diretta)
        // Qui semplifichiamo: il modale si apre via bootstrap data-bs-toggle, dobbiamo popolare i dati
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(inv) {
            $('#invoiceDetailModalTitle').text(inv.number);
            $('#invoiceDetailModalBody').html(`<p>Cliente: ${inv.customerId}</p><p>Totale: ${inv.total}</p>`); // Placeholder per modularità
        }
    });
    
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { deleteDataFromCloud('invoices', $(this).data('id')); });
    
    // Import
    $('#import-file-input').change(function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const d = JSON.parse(ev.target.result);
            if(d.companyInfo) await saveDataToCloud('companyInfo', d.companyInfo);
            if(d.customers) for(let c of d.customers) await saveDataToCloud('customers', c, c.id);
            if(d.products) for(let p of d.products) await saveDataToCloud('products', p, p.id);
            if(d.invoices) for(let i of d.invoices) await saveDataToCloud('invoices', i, i.id);
            alert("Import completato"); location.reload();
        };
        reader.readAsText(file);
    });

    // Helper per popolare form edit fattura
    window.loadInvoiceForEdit = function(id) {
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(inv) {
            $('#editing-invoice-id').val(inv.id); $('#invoice-number').val(inv.number);
            currentLines = inv.lines || []; renderLines();
        }
    }
    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).data('id'); 
        $('#menu-nuova-fattura').click(); // Simula nav
        setTimeout(() => window.loadInvoiceForEdit(id), 500);
    });
});