// FILE: main.js - Logica Principale ed Eventi

$(document).ready(function() {

    // --- Auth Listener (Il cuore dell'App) ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Utente Loggato
            currentUser = user; // Imposta la variabile globale definita in config.js
            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none');
            
            await loadAllDataFromCloud(); // Carica i dati da Firebase (data.js)
            
            $('#loading-screen').addClass('d-none');
            $('#main-app').removeClass('d-none');
            
            renderAll(); // Disegna l'interfaccia (ui.js)
        } else {
            // Utente Non Loggato
            currentUser = null;
            $('#main-app').addClass('d-none');
            $('#loading-screen').addClass('d-none');
            $('#login-container').removeClass('d-none');
        }
    });

    // --- Login Form ---
    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        const email = $('#email').val();
        const pass = $('#password').val();
        $('#login-error').addClass('d-none');
        
        auth.signInWithEmailAndPassword(email, pass)
            .catch(err => {
                $('#login-error').text("Credenziali non valide.").removeClass('d-none');
            });
    });

    $('#logout-btn').on('click', function(e) {
        e.preventDefault();
        auth.signOut().then(() => location.reload());
    });

    // --- Navigazione Sidebar ---
    $('.sidebar .nav-link').on('click', function(e) {
        if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return;
        e.preventDefault();
        const target = $(this).data('target');

        // Gestione menu Nuova Fattura / Nota Credito
        if(target === 'nuova-fattura-accompagnatoria') {
            // Reset del form
            $('#new-invoice-form')[0].reset();
            $('#invoice-lines-tbody').empty();
            // Variabile globale temporanea per le righe (definita qui o in config.js)
            window.tempInvoiceLines = []; 
            
            populateDropdowns();
            const today = new Date().toISOString().slice(0, 10);
            $('#invoice-date').val(today);
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
            // Logica numero successivo qui o in una funzione helper
             // (Implementazione rapida: ricalcola numero)
             // ...
        }
        
        if(target === 'statistiche') renderStatisticsPage();
        
        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active');
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none');
    });

    // --- Gestione Azienda ---
    $('#company-info-form').on('submit', async function(e) {
        e.preventDefault();
        const data = {};
        $(this).find('input').each(function() { if(this.id) data[this.id.replace('company-','')] = $(this).val(); });
        $(this).find('select').each(function() { if(this.id) data[this.id.replace('company-','')] = $(this).val(); });
        await saveDataToCloud('companyInfo', data);
        alert("Dati salvati!");
        updateCompanyUI();
    });

    // --- Gestione Clienti (Eventi Delegati) ---
    $('#newCustomerBtn').click(() => { 
        $('#customerForm')[0].reset(); 
        $('#customer-id').val(''); 
        $('#customerModal').modal('show'); 
    });

    $('#saveCustomerBtn').click(async () => {
        const id = $('#customer-id').val() || String(Date.now());
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
        await saveDataToCloud('customers', data, id); 
        $('#customerModal').modal('hide'); 
        renderAll();
    });

    // Modifica/Elimina Clienti
    $('#customers-table-body').on('click', '.btn-edit-customer', function() {
        const id = $(this).data('id');
        const c = getData('customers').find(x => String(x.id) === String(id));
        if(!c) return;
        for(let k in c) {
            if($(`#customer-${k}`).is(':checkbox')) $(`#customer-${k}`).prop('checked', c[k]);
            else $(`#customer-${k}`).val(c[k]);
        }
        $('#customer-id').val(c.id);
        $('#customerModal').modal('show');
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function() {
        deleteDataFromCloud('customers', $(this).data('id'));
    });

    // --- Gestione Prodotti ---
    $('#newProductBtn').click(() => { 
        $('#productForm')[0].reset(); 
        $('#product-id').val(''); 
        $('#product-iva').val('0').change(); // Reset IVA
        $('#productModal').modal('show'); 
    });

    $('#saveProductBtn').click(async () => {
        const id = $('#product-id').val() || 'PRD' + Date.now();
        const data = {
            description: $('#product-description').val(), 
            code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), 
            iva: $('#product-iva').val(), 
            esenzioneIva: $('#product-esenzioneIva').val()
        };
        await saveDataToCloud('products', data, id); 
        $('#productModal').modal('hide'); 
        renderAll();
    });

    $('#product-iva').change(function() { toggleEsenzioneIvaField('product', $(this).val()); });

    $('#products-table-body').on('click', '.btn-edit-product', function() {
        const id = $(this).data('id');
        const p = getData('products').find(x => String(x.id) === String(id));
        if(!p) return;
        for(let k in p) $(`#product-${k}`).val(p[k]);
        toggleEsenzioneIvaField('product', p.iva);
        $('#product-id').val(p.id);
        $('#productModal').modal('show');
    });

    $('#products-table-body').on('click', '.btn-delete-product', function() {
        deleteDataFromCloud('products', $(this).data('id'));
    });

    // --- Gestione Fatture (Logica Semplificata per Moduli) ---
    // Nota: Le funzioni complesse di calcolo sono gestite meglio qui
    
    window.tempInvoiceLines = []; // Variabile globale per le righe fattura
    
    // Aggiungi Riga
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
        renderInvoiceLines();
        // Reset campi riga
        $('#invoice-product-select').val('');
        $('#invoice-product-description').val('');
        $('#invoice-product-price').val('');
    });
    
    function renderInvoiceLines() {
        const tbody = $('#invoice-lines-tbody').empty(); 
        let total = 0;
        window.tempInvoiceLines.forEach((l, i) => { 
            total += l.subtotal; 
            tbody.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">${l.price.toFixed(2)}</td><td class="text-end">${l.subtotal.toFixed(2)}</td><td><button class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`); 
        });
        $('#invoice-total').text(total.toFixed(2));
    }
    
    // Rimuovi riga
    $('#invoice-lines-tbody').on('click', '.del-line', function() { 
        window.tempInvoiceLines.splice($(this).data('i'), 1); 
        renderInvoiceLines(); 
    });
    
    // Auto-compilazione Prodotti
    $('#invoice-product-select').change(function() {
        const pid = $(this).val();
        const p = getData('products').find(x => x.id === pid);
        if(pid === 'manual') {
            $('#invoice-product-description').val('').prop('readonly', false).focus();
            $('#invoice-product-price').val('');
            $('#invoice-product-iva').prop('disabled', false).val('0').change();
        } else if(p) {
            $('#invoice-product-description').val(p.description).prop('readonly', true);
            $('#invoice-product-price').val(p.salePrice);
            $('#invoice-product-iva').val(p.iva).prop('disabled', true).change();
            $('#invoice-product-esenzioneIva').val(p.esenzioneIva);
        }
    });

    // SALVA FATTURA
    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();
        const id = $('#editing-invoice-id').val() || String(Date.now());
        const type = $('#document-type').val();
        
        // Calcoli Totali (Semplificati)
        const total = parseFloat($('#invoice-total').text());
        // Qui dovresti aggiungere la logica completa di Rivalsa/Bollo se necessaria, 
        // per ora salviamo il totale calcolato dalle righe.
        
        const data = {
            number: $('#invoice-number').val(), 
            date: $('#invoice-date').val(),
            customerId: $('#invoice-customer-select').val(), 
            type: type,
            lines: window.tempInvoiceLines, 
            total: total,
            totaleImponibile: total, // Approssimazione per statistiche
            status: (type === 'Fattura' ? 'Da Incassare' : 'Emessa'),
            dataScadenza: $('#invoice-dataScadenza').val(),
            condizioniPagamento: $('#invoice-condizioniPagamento').val(),
            modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            linkedInvoice: $('#linked-invoice').val(),
            reason: $('#reason').val()
        };
        
        await saveDataToCloud('invoices', data, id);
        alert("Documento salvato!"); 
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });
    
    // --- Azioni Tabella Fatture ---
    
    // Dettaglio (Popola modale)
    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const id = $(this).data('id');
        // La logica di render dettaglio è dentro ui.js (gestore click delegato lì o qui)
        // Nota: Nel file ui.js che ti ho dato prima c'è già il listener completo. 
        // Se usi questo main.js, assicurati che non vada in conflitto. 
        // Per sicurezza, lasciamo che ui.js gestisca il render visuale e main.js gestisca solo i dati.
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

    // Helper: Edit Fattura
    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).data('id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(inv) {
            // Simula navigazione
            if(inv.type === 'Nota di Credito') $('#menu-nuova-nota-credito').click();
            else $('#menu-nuova-fattura').click();
            
            // Popola campi
            setTimeout(() => {
                $('#editing-invoice-id').val(inv.id);
                $('#invoice-customer-select').val(inv.customerId);
                $('#invoice-date').val(inv.date);
                $('#invoice-number').val(inv.number);
                $('#invoice-condizioniPagamento').val(inv.condizioniPagamento);
                $('#invoice-modalitaPagamento').val(inv.modalitaPagamento);
                $('#linked-invoice').val(inv.linkedInvoice);
                $('#reason').val(inv.reason);
                
                window.tempInvoiceLines = inv.lines || [];
                renderInvoiceLines();
            }, 100);
        }
    });
});