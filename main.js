// FILE: main.js - Logica Principale ed Eventi (v8.6 - Fix Anagrafiche)

$(document).ready(function() {

    // --- 1. GESTIONE AUTENTICAZIONE ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none');
            
            await loadAllDataFromCloud(); // Funzione in data.js
            
            $('#loading-screen').addClass('d-none');
            $('#main-app').removeClass('d-none');
            
            renderAll(); // Funzione in ui.js
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
            // Logica reset form fattura
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

    // --- 3. FUNZIONE DI SUPPORTO: EDIT ITEM ---
    // Questa funzione serve a popolare i modali di modifica
    function editItem(type, id) { 
        const items = getData(`${type}s`); // 'products' o 'customers'
        // Cerca l'elemento (confrontando le stringhe per sicurezza)
        const item = items.find(i => String(i.id) === String(id)); 
        
        if (!item) { alert("Elemento non trovato"); return; }
        
        // Resetta e prepara il form
        $(`#${type}Form`)[0].reset();
        $(`#${type}ModalTitle`).text(`Modifica ${type === 'product' ? 'Servizio' : 'Cliente'}`); 
        
        // Popola i campi del form
        for (const key in item) { 
            const field = $(`#${type}-${key}`); 
            if (field.is(':checkbox')) { 
                field.prop('checked', item[key]); 
            } else if (field.length) { 
                field.val(item[key]); 
            } 
        } 
        
        // Gestione specifica per i prodotti (campo IVA condizionale)
        if (type === 'product') { 
            $('#product-iva').trigger('change'); // Aggiorna visibilità esenzione
            // Reimposta il valore dell'esenzione se necessario
            if(item.iva == '0') $('#product-esenzioneIva').val(item.esenzioneIva);
        } 
        
        // Imposta l'ID nel campo nascosto
        $(`#${type}-id`).val(String(item.id)); 
        
        // Apre il modale
        $(`#${type}Modal`).modal('show'); 
    }

    // --- 4. GESTIONE CLIENTI ---
    $('#newCustomerBtn').click(() => { 
        $('#customerForm')[0].reset(); 
        $('#customer-id').val(''); 
        $('#customerModal').modal('show'); 
    });

    $('#saveCustomerBtn').click(async () => {
        const idInput = $('#customer-id').val();
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
        
        // Se non c'è ID, ne generiamo uno nuovo, altrimenti usiamo quello esistente
        let id = idInput ? idInput : String(getNextId(getData('customers')));
        
        await saveDataToCloud('customers', data, id); 
        $('#customerModal').modal('hide'); 
        renderAll();
    });

    // Eventi Tabella Clienti
    $('#customers-table-body').on('click', '.btn-edit-customer', function() {
        const id = $(this).attr('data-id');
        editItem('customer', id);
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function() {
        const id = $(this).attr('data-id');
        deleteDataFromCloud('customers', id); // Funzione in data.js
    });

    // --- 5. GESTIONE PRODOTTI ---
    $('#newProductBtn').click(() => { 
        $('#productForm')[0].reset(); 
        $('#product-id').val(''); 
        $('#product-iva').val('0').change(); 
        $('#productModal').modal('show'); 
    });

    $('#saveProductBtn').click(async () => {
        const idInput = $('#product-id').val();
        const data = {
            description: $('#product-description').val(), 
            code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), 
            iva: $('#product-iva').val(), 
            esenzioneIva: $('#product-esenzioneIva').val()
        };
        
        let id = idInput ? idInput : 'PRD' + new Date().getTime();
        
        await saveDataToCloud('products', data, id); 
        $('#productModal').modal('hide'); 
        renderAll();
    });

    // Eventi Tabella Prodotti
    $('#products-table-body').on('click', '.btn-edit-product', function() {
        const id = $(this).attr('data-id');
        editItem('product', id);
    });

    $('#products-table-body').on('click', '.btn-delete-product', function() {
        const id = $(this).attr('data-id');
        deleteDataFromCloud('products', id);
    });

    // Gestione select IVA
    $('#product-iva').change(function() { 
        const val = $(this).val();
        if(val == '0') $('#esenzione-iva-container').removeClass('d-none');
        else $('#esenzione-iva-container').addClass('d-none');
    });

    // --- 6. GESTIONE FATTURE ---
    
    // ... (Il resto della logica fatture rimane invariato se funzionava) ...
    // Variabile globale per le righe della fattura in creazione
    window.tempInvoiceLines = []; 

    $('#add-product-to-invoice-btn').click(() => {
        const desc = $('#invoice-product-description').val();
        if(!desc) return;
        const qty = parseFloat($('#invoice-product-qty').val()) || 1;
        const price = parseFloat($('#invoice-product-price').val()) || 0;
        const iva = $('#invoice-product-iva').val();
        const esenzione = $('#invoice-product-esenzioneIva').val();
        
        window.tempInvoiceLines.push({ 
            productName: desc, qty, price, subtotal: qty*price, iva, esenzioneIva: esenzione 
        });
        
        // Render righe (piccola funzione locale per la tabella di creazione)
        const tbody = $('#invoice-lines-tbody').empty(); 
        let total = 0;
        window.tempInvoiceLines.forEach((l, i) => { 
            total += l.subtotal; 
            tbody.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">${l.price.toFixed(2)}</td><td class="text-end">${l.subtotal.toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`); 
        });
        $('#invoice-total').text(total.toFixed(2));
        
        // Reset campi
        $('#invoice-product-select').val('');
        $('#invoice-product-description').val('');
        $('#invoice-product-price').val('');
    });
    
    $('#invoice-lines-tbody').on('click', '.del-line', function() { 
        window.tempInvoiceLines.splice($(this).data('i'), 1); 
        // Re-render (copia semplificata della logica sopra)
        const tbody = $('#invoice-lines-tbody').empty(); 
        let total = 0;
        window.tempInvoiceLines.forEach((l, i) => { 
            total += l.subtotal; 
            tbody.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">${l.price.toFixed(2)}</td><td class="text-end">${l.subtotal.toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`); 
        });
        $('#invoice-total').text(total.toFixed(2));
    });

    // Auto-compilazione Prodotti in fattura
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
            // Gestione visibilità campo esenzione in fattura
            if(p.iva == '0') $('#invoice-esenzione-iva-container').removeClass('d-none');
            else $('#invoice-esenzione-iva-container').addClass('d-none');
        }
    });

    // Gestione visibilità IVA manuale in fattura
    $('#invoice-product-iva').change(function() {
        if($(this).val() == '0') $('#invoice-esenzione-iva-container').removeClass('d-none');
        else $('#invoice-esenzione-iva-container').addClass('d-none');
    });

    // Salva Fattura
    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();
        const idInput = $('#editing-invoice-id').val();
        const type = $('#document-type').val();
        const total = parseFloat($('#invoice-total').text());
        
        if(window.tempInvoiceLines.length === 0) { alert("Inserire almeno una riga."); return; }

        const data = {
            number: $('#invoice-number').val(), 
            date: $('#invoice-date').val(),
            customerId: $('#invoice-customer-select').val(), 
            type: type,
            lines: window.tempInvoiceLines, 
            total: total,
            totaleImponibile: total, // Semplificato
            status: (type === 'Fattura' ? 'Da Incassare' : 'Emessa'),
            dataScadenza: $('#invoice-dataScadenza').val(),
            condizioniPagamento: $('#invoice-condizioniPagamento').val(),
            modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            linkedInvoice: $('#linked-invoice').val(),
            reason: $('#reason').val()
        };
        
        // Se stiamo modificando, manteniamo lo status esistente
        if(idInput) {
            const old = getData('invoices').find(i => String(i.id) === String(idInput));
            if(old) data.status = old.status;
        }

        let id = idInput ? idInput : String(getNextId(getData('invoices')));
        
        await saveDataToCloud('invoices', data, id);
        alert("Documento salvato!"); 
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    // --- Azioni Tabella Fatture ---
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
                // Trigger render righe
                const tbody = $('#invoice-lines-tbody').empty(); 
                let total = 0;
                window.tempInvoiceLines.forEach((l, i) => { 
                    total += l.subtotal; 
                    tbody.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">${l.price.toFixed(2)}</td><td class="text-end">${l.subtotal.toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`); 
                });
                $('#invoice-total').text(total.toFixed(2));
            }, 200);
        }
    });
    
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { deleteDataFromCloud('invoices', $(this).attr('data-id')); });
    
    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(confirm("Confermi il cambio stato?")) {
            await saveDataToCloud('invoices', { status: inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata' }, id);
            renderInvoicesTable(); // Funzione in ui.js, ma chiamata qui perché aggiorniamo i dati
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
            if(d.customers) for(let c of d.customers) await saveDataToCloud('customers', c, c.id);
            if(d.products) for(let p of d.products) await saveDataToCloud('products', p, p.id);
            if(d.invoices) for(let i of d.invoices) await saveDataToCloud('invoices', i, i.id);
            alert("Import completato"); location.reload();
        };
        reader.readAsText(file);
    });

    // --- 8. SALVATAGGIO AZIENDA ---
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