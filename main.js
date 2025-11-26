// FILE: main.js - v9.2 (Fix CRUD con Data-Attributes)

$(document).ready(function() {

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
            $('#new-invoice-form')[0].reset();
            $('#invoice-lines-tbody').empty();
            window.tempInvoiceLines = []; 
            populateDropdowns();
            $('#invoice-date').val(new Date().toISOString().slice(0, 10));
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

    // --- 3. FUNZIONI DI SUPPORTO CRUD ---
    
    function editItem(type, id) { 
        const items = getData(`${type}s`); 
        const item = items.find(i => String(i.id) === String(id)); 
        
        if (!item) { alert("Elemento non trovato"); return; }
        
        // Reset Form
        $(`#${type}Form`)[0].reset();
        $(`#${type}ModalTitle`).text(`Modifica ${type === 'product' ? 'Servizio' : 'Cliente'}`); 
        
        // Mostra ID a video (solo lettura)
        $(`#${type}-id`).val(String(item.id));
        
        // --- FIX CRUCIALE: Salva l'ID direttamente sul bottone di salvataggio ---
        const btnSave = (type === 'product') ? $('#saveProductBtn') : $('#saveCustomerBtn');
        btnSave.data('edit-id', String(item.id)); 
        // -----------------------------------------------------------------------

        // Popola campi
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
    
    $('#newCustomerBtn').click(() => { 
        $('#customerForm')[0].reset(); 
        $('#customer-id').val('Nuovo'); 
        
        // Pulisce l'ID dal bottone (modalità creazione)
        $('#saveCustomerBtn').data('edit-id', null);
        
        $('#customerModalTitle').text('Nuovo Cliente');
        $('#customerModal').modal('show'); 
    });

    $('#saveCustomerBtn').click(async function() {
        // Leggi ID dal bottone stesso
        const editId = $(this).data('edit-id');
        
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
        
        let id;
        if (editId) {
            id = editId;
            console.log("Aggiorno Cliente esistente:", id);
        } else {
            id = String(getNextId(getData('customers')));
            console.log("Creo Nuovo Cliente:", id);
        }

        await saveDataToCloud('customers', data, id); 
        $('#customerModal').modal('hide'); 
        renderAll();
    });

    $('#customers-table-body').on('click', '.btn-edit-customer', function(e) {
        const id = $(e.currentTarget).attr('data-id');
        editItem('customer', id);
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function(e) {
        const id = $(e.currentTarget).attr('data-id');
        if(id) deleteDataFromCloud('customers', id);
    });

    // --- 5. GESTIONE PRODOTTI ---
    
    $('#newProductBtn').click(() => { 
        $('#productForm')[0].reset(); 
        $('#product-id').val('Nuovo'); 
        $('#product-iva').val('0').change(); 
        
        // Pulisce l'ID dal bottone (modalità creazione)
        $('#saveProductBtn').data('edit-id', null);

        $('#productModalTitle').text('Nuovo Servizio');
        $('#productModal').modal('show'); 
    });

    $('#saveProductBtn').click(async function() {
        // Leggi ID dal bottone stesso
        const editId = $(this).data('edit-id');

        const data = {
            description: $('#product-description').val(), 
            code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), 
            iva: $('#product-iva').val(), 
            esenzioneIva: $('#product-esenzioneIva').val()
        };
        
        let id;
        if (editId) {
            id = editId;
            console.log("Aggiorno Prodotto esistente:", id);
        } else {
            id = 'PRD' + new Date().getTime();
            console.log("Creo Nuovo Prodotto:", id);
        }
        
        await saveDataToCloud('products', data, id); 
        $('#productModal').modal('hide'); 
        renderAll();
    });

    $('#products-table-body').on('click', '.btn-edit-product', function(e) {
        const id = $(e.currentTarget).attr('data-id');
        editItem('product', id);
    });

    $('#products-table-body').on('click', '.btn-delete-product', function(e) {
        const id = $(e.currentTarget).attr('data-id');
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