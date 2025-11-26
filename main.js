// FILE: main.js - v9.0 (Fix CRUD con ID Espliciti)

$(document).ready(function() {

    // --- VARIABILE DI STATO CRUCIALE ---
    // Questa variabile memorizza l'ID che stiamo modificando. 
    // Se è null, stiamo creando. Se ha un valore, stiamo aggiornando.
    let CURRENT_EDITING_ID = null;

    // --- 1. GESTIONE AUTENTICAZIONE ---
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
            $('#loading-screen').addClass('d-none');
            $('#login-container').removeClass('d-none');
        }
    });

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        auth.signInWithEmailAndPassword($('#email').val(), $('#password').val())
            .catch(err => { $('#login-error').removeClass('d-none'); });
    });

    $('#logout-btn').on('click', function(e) {
        e.preventDefault();
        auth.signOut().then(() => location.reload());
    });

    // --- 2. NAVIGAZIONE SIDEBAR ---
    $('.sidebar .nav-link').on('click', function(e) {
        if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return;
        e.preventDefault();
        const target = $(this).data('target');

        if(target === 'nuova-fattura-accompagnatoria') {
            // Reset Totale fattura
            $('#new-invoice-form')[0].reset();
            $('#invoice-lines-tbody').empty();
            window.tempInvoiceLines = []; 
            populateDropdowns();
            $('#invoice-date').val(new Date().toISOString().slice(0, 10));
            
            // Qui usiamo un campo hidden standard perché la logica fattura è diversa
            $('#editing-invoice-id').val(''); 

            if(this.id === 'menu-nuova-nota-credito') {
                 $('#document-type').val('Nota di Credito'); 
                 $('#document-title').text('Nuova Nota di Credito'); 
                 $('#credit-note-fields').removeClass('d-none');
            } else {
                 $('#document-type').val('Fattura'); 
                 $('#document-title').text('Nuova Fattura'); 
                 $('#credit-note-fields').addClass('d-none');
            }
        }
        
        if(target === 'statistiche') renderStatisticsPage();
        
        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active');
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none');
    });

    // --- 3. FUNZIONI DI SUPPORTO CRUD (BLINDATE) ---
    
    function editItem(type, id) { 
        // 1. Impostiamo la variabile globale
        CURRENT_EDITING_ID = String(id);

        const items = getData(`${type}s`); 
        const item = items.find(i => String(i.id) === String(id)); 
        
        if (!item) { alert("Elemento non trovato"); return; }
        
        // 2. Reset Form
        $(`#${type}Form`)[0].reset();
        $(`#${type}ModalTitle`).text(`Modifica ${type === 'product' ? 'Servizio' : 'Cliente'}`); 
        
        // 3. Mostriamo l'ID a video (così sei sicuro)
        $(`#${type}-id`).val(String(item.id));
        
        // 4. Popoliamo i campi
        for (const key in item) { 
            const field = $(`#${type}-${key}`); 
            if (field.length) {
                if (field.is(':checkbox')) field.prop('checked', item[key]); 
                else field.val(item[key]); 
            }
        } 
        
        if (type === 'product') { 
            $('#product-iva').trigger('change');
            if(item.iva == '0') $('#product-esenzioneIva').val(item.esenzioneIva);
        } 
        
        $(`#${type}Modal`).modal('show'); 
    }

    // --- 4. GESTIONE CLIENTI ---
    
    // Pulsante NUOVO Cliente
    $('#newCustomerBtn').click(() => { 
        CURRENT_EDITING_ID = null; // Reset Variabile Globale
        $('#customerForm')[0].reset(); 
        $('#customer-id').val(''); // Pulisci campo visivo
        $('#customerModalTitle').text('Nuovo Cliente');
        $('#customerModal').modal('show'); 
    });

    // Pulsante SALVA Cliente
    $('#saveCustomerBtn').click(async () => {
        // Determina ID: se c'è CURRENT_EDITING_ID usalo, altrimenti generane uno nuovo
        let finalId;
        if (CURRENT_EDITING_ID) {
            finalId = CURRENT_EDITING_ID;
            console.log("Aggiornamento Cliente esistente: " + finalId);
        } else {
            finalId = String(getNextId(getData('customers')));
            console.log("Creazione Nuovo Cliente: " + finalId);
        }

        const data = {
            name: $('#customer-name').val(), 
            piva: $('#customer-piva').val(), 
            codiceFiscale: $('#customer-codiceFiscale').val(),
            sdi: $('#customer-sdi').val(), 
            address: $('#customer-address').val(), 
            comune: $('#customer-comune').val(),
            provincia: $('#customer-provincia').val(), 
            cap: $('#customer-cap').val(), 
            nazione: $('#customer-nazione').val(),
            rivalsaInps: $('#customer-rivalsaInps').is(':checked')
        };
        
        await saveDataToCloud('customers', data, finalId); 
        $('#customerModal').modal('hide'); 
        renderAll();
    });

    // Pulsante MODIFICA (Dalla tabella)
    $('#customers-table-body').on('click', '.btn-edit-customer', function() {
        const id = $(this).attr('data-id');
        editItem('customer', id);
    });

    // Pulsante ELIMINA
    $('#customers-table-body').on('click', '.btn-delete-customer', function() {
        const id = $(this).attr('data-id');
        if(id) deleteDataFromCloud('customers', id);
    });

    // --- 5. GESTIONE PRODOTTI ---
    
    // Pulsante NUOVO Prodotto
    $('#newProductBtn').click(() => { 
        CURRENT_EDITING_ID = null; // Reset Variabile Globale
        $('#productForm')[0].reset(); 
        $('#product-id').val(''); 
        $('#product-iva').val('0').change(); 
        $('#productModalTitle').text('Nuovo Servizio');
        $('#productModal').modal('show'); 
    });

    // Pulsante SALVA Prodotto
    $('#saveProductBtn').click(async () => {
        let finalId;
        if (CURRENT_EDITING_ID) {
            finalId = CURRENT_EDITING_ID;
            console.log("Aggiornamento Prodotto esistente: " + finalId);
        } else {
            finalId = 'PRD' + new Date().getTime();
            console.log("Creazione Nuovo Prodotto: " + finalId);
        }

        const data = {
            description: $('#product-description').val(), 
            code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), 
            iva: $('#product-iva').val(), 
            esenzioneIva: $('#product-esenzioneIva').val()
        };
        
        await saveDataToCloud('products', data, finalId); 
        $('#productModal').modal('hide'); 
        renderAll();
    });

    // Pulsante MODIFICA (Dalla tabella)
    $('#products-table-body').on('click', '.btn-edit-product', function() {
        const id = $(this).attr('data-id');
        editItem('product', id);
    });

    // Pulsante ELIMINA
    $('#products-table-body').on('click', '.btn-delete-product', function() {
        const id = $(this).attr('data-id');
        if(id) deleteDataFromCloud('products', id);
    });

    $('#product-iva').change(function() { 
        const val = $(this).val();
        if(val == '0') $('#esenzione-iva-container').removeClass('d-none');
        else $('#esenzione-iva-container').addClass('d-none');
    });

    // --- 6. GESTIONE FATTURE ---
    window.tempInvoiceLines = []; 

    $('#add-product-to-invoice-btn').click(() => {
        const desc = $('#invoice-product-description').val();
        if(!desc) return;
        const qty = parseFloat($('#invoice-product-qty').val()) || 1;
        const price = parseFloat($('#invoice-product-price').val()) || 0;
        const iva = $('#invoice-product-iva').val();
        const esenzione = $('#invoice-product-esenzioneIva').val();
        
        window.tempInvoiceLines.push({ productName: desc, qty, price, subtotal: qty*price, iva, esenzioneIva: esenzione });
        renderLocalInvoiceLines();
        $('#invoice-product-select').val(''); $('#invoice-product-description').val(''); $('#invoice-product-price').val('');
    });
    
    function renderLocalInvoiceLines() {
        const tbody = $('#invoice-lines-tbody').empty(); 
        let total = 0;
        window.tempInvoiceLines.forEach((l, i) => { 
            total += l.subtotal; 
            tbody.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">${l.price.toFixed(2)}</td><td class="text-end">${l.subtotal.toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`); 
        });
        $('#invoice-total').text(total.toFixed(2));
    }
    
    $('#invoice-lines-tbody').on('click', '.del-line', function() { 
        window.tempInvoiceLines.splice($(this).data('i'), 1); 
        renderLocalInvoiceLines(); 
    });

    $('#invoice-product-select').change(function() {
        const pid = $(this).val();
        const p = getData('products').find(x => String(x.id) === String(pid));
        if(pid === 'manual') {
            $('#invoice-product-description').val('').prop('readonly', false).focus();
            $('#invoice-product-price').val('');
            $('#invoice-product-iva').prop('disabled', false).val('0').change();
        } else if(p) {
            $('#invoice-product-description').val(p.description).prop('readonly', true);
            $('#invoice-product-price').val(p.salePrice);
            $('#invoice-product-iva').val(p.iva).prop('disabled', true).change();
            $('#invoice-product-esenzioneIva').val(p.esenzioneIva);
            if(p.iva == '0') $('#invoice-esenzione-iva-container').removeClass('d-none');
            else $('#invoice-esenzione-iva-container').addClass('d-none');
        }
    });

    $('#invoice-product-iva').change(function() {
        if($(this).val() == '0') $('#invoice-esenzione-iva-container').removeClass('d-none');
        else $('#invoice-esenzione-iva-container').addClass('d-none');
    });

    // Salva Fattura
    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();
        const idInput = $('#editing-invoice-id').val();
        const customerId = $('#invoice-customer-select').val();
        if (!customerId || window.tempInvoiceLines.length === 0) { alert("Inserire almeno un cliente e una riga."); return; }

        const type = $('#document-type').val();
        const total = parseFloat($('#invoice-total').text());

        const customer = getData('customers').find(c => String(c.id) === String(customerId)); 
        const company = getData('companyInfo');
        
        let rivalsa = {};
        if (customer && customer.rivalsaInps) {
             const aliq = parseFloat(company.aliquotaInps || 0);
             rivalsa = { aliquota: aliq, importo: total * (aliq / 100) };
        }
        const finalTotal = total + (rivalsa.importo || 0);

        const data = {
            number: $('#invoice-number').val(), 
            date: $('#invoice-date').val(),
            customerId: customerId,
            type: type,
            lines: window.tempInvoiceLines, 
            total: finalTotal,
            totaleImponibile: total, 
            rivalsa: rivalsa,
            status: (type === 'Fattura' ? 'Da Incassare' : 'Emessa'),
            dataScadenza: $('#invoice-dataScadenza').val(),
            condizioniPagamento: $('#invoice-condizioniPagamento').val(),
            modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            linkedInvoice: $('#linked-invoice').val(),
            reason: $('#reason').val()
        };
        
        if(idInput) {
            const old = getData('invoices').find(i => String(i.id) === String(idInput));
            if(old) data.status = old.status; 
        }

        let id = (idInput && idInput !== "") ? idInput : String(getNextId(getData('invoices')));
        
        await saveDataToCloud('invoices', data, id);
        alert("Documento salvato!"); 
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    // Azioni Fatture
    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(inv) {
            if(inv.type === 'Nota di Credito') $('#menu-nuova-nota-credito').click();
            else $('#menu-nuova-fattura').click();
            
            setTimeout(() => {
                $('#editing-invoice-id').val(inv.id);
                $('#invoice-customer-select').val(inv.customerId);
                $('#invoice-date').val(inv.date);
                $('#invoice-number').val(inv.number);
                $('#invoice-condizioniPagamento').val(inv.condizioniPagamento);
                $('#invoice-modalitaPagamento').val(inv.modalitaPagamento);
                $('#linked-invoice').val(inv.linkedInvoice);
                $('#reason').val(inv.reason);
                $('#invoice-dataScadenza').val(inv.dataScadenza);
                
                window.tempInvoiceLines = inv.lines || [];
                renderLocalInvoiceLines();
            }, 200);
        }
    });
    
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { deleteDataFromCloud('invoices', $(this).attr('data-id')); });
    
    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(confirm("Confermi il cambio stato?")) {
            await saveDataToCloud('invoices', { status: inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata' }, id);
            renderInvoicesTable(); 
        }
    });

    // --- 7. NOTE E IMPORT ---
    $('#save-notes-btn').on('click', async function() { 
        await saveDataToCloud('notes', { userId: currentUser.uid, text: $('#notes-textarea').val() }, currentUser.uid); 
        alert("Note salvate!");
    });

    $('#import-file-input').change(function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const d = JSON.parse(ev.target.result);
            if(d.companyInfo) await saveDataToCloud('companyInfo', d.companyInfo);
            if(d.customers) for(let c of d.customers) await saveDataToCloud('customers', c, String(c.id));
            if(d.products) for(let p of d.products) await saveDataToCloud('products', p, String(p.id));
            if(d.invoices) for(let i of d.invoices) await saveDataToCloud('invoices', i, String(i.id));
            alert("Import completato"); location.reload();
        };
        reader.readAsText(file);
    });

    // --- 8. AZIENDA ---
    $('#company-info-form').on('submit', async function(e) {
        e.preventDefault();
        const data = {};
        $(this).find('input, select').each(function() { 
            const id = $(this).attr('id'); 
            if(id) data[id.replace('company-','')] = $(this).val(); 
        });
        await saveDataToCloud('companyInfo', data);
        alert("Dati salvati!");
        updateCompanyUI();
    });

});