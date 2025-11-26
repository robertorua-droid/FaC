// FILE: main.js - v9.3 (Fix Documenti & Logica Completa)

$(document).ready(function() {

    // --- VARIABILI DI STATO ---
    let CURRENT_EDITING_ID = null;         // Per Clienti e Prodotti
    let CURRENT_EDITING_INVOICE_ID = null; // Per i Documenti (Fatture/NdC)
    window.tempInvoiceLines = [];          // Righe temporanee fattura

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
            prepareDocumentForm(this.id === 'menu-nuova-nota-credito' ? 'Nota di Credito' : 'Fattura');
        }
        
        if(target === 'statistiche') renderStatisticsPage();
        
        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active');
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none');
    });

    // --- 3. FUNZIONI SUPPORTO CRUD (ANAGRAFICHE) ---
    function editItem(type, id) { 
        if (type === 'customer' || type === 'product') CURRENT_EDITING_ID = String(id);
        
        const items = getData(`${type}s`); 
        const item = items.find(i => String(i.id) === String(id)); 
        
        if (!item) { alert("Elemento non trovato"); return; }
        
        $(`#${type}Form`)[0].reset();
        $(`#${type}ModalTitle`).text(`Modifica ${type === 'product' ? 'Servizio' : 'Cliente'}`); 
        $(`#${type}-id`).val(String(item.id));
        
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
        CURRENT_EDITING_ID = null; 
        $('#customerForm')[0].reset(); 
        $('#customer-id').val('Nuovo'); 
        $('#customerModal').modal('show'); 
    });

    $('#saveCustomerBtn').click(async () => {
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
        let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : String(getNextId(getData('customers')));
        await saveDataToCloud('customers', data, id); 
        $('#customerModal').modal('hide'); 
        renderAll();
    });

    $('#customers-table-body').on('click', '.btn-edit-customer', function(e) { editItem('customer', $(e.currentTarget).attr('data-id')); });
    $('#customers-table-body').on('click', '.btn-delete-customer', function(e) {
        const id = $(e.currentTarget).attr('data-id');
        if(id) deleteDataFromCloud('customers', id);
    });

    // --- 5. GESTIONE PRODOTTI ---
    $('#newProductBtn').click(() => { 
        CURRENT_EDITING_ID = null; 
        $('#productForm')[0].reset(); 
        $('#product-id').val('Nuovo'); 
        $('#product-iva').val('0').change(); 
        $('#productModal').modal('show'); 
    });

    $('#saveProductBtn').click(async () => {
        const data = {
            description: $('#product-description').val(), 
            code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), 
            iva: $('#product-iva').val(), 
            esenzioneIva: $('#product-esenzioneIva').val()
        };
        let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : 'PRD' + new Date().getTime();
        await saveDataToCloud('products', data, id); 
        $('#productModal').modal('hide'); 
        renderAll();
    });

    $('#products-table-body').on('click', '.btn-edit-product', function(e) { editItem('product', $(e.currentTarget).attr('data-id')); });
    $('#products-table-body').on('click', '.btn-delete-product', function(e) {
        const id = $(e.currentTarget).attr('data-id');
        if(id) deleteDataFromCloud('products', id);
    });
    $('#product-iva').change(function() { 
        const val = $(this).val();
        if(val == '0') $('#esenzione-iva-container').removeClass('d-none'); else $('#esenzione-iva-container').addClass('d-none');
    });

    // ====================================================================================
    // --- 6. GESTIONE DOCUMENTI (CORE LOGIC) ---
    // ====================================================================================

    function prepareDocumentForm(type) {
        CURRENT_EDITING_INVOICE_ID = null; // Reset ID modifica
        
        $('#new-invoice-form')[0].reset();
        $('#invoice-id').val('Nuovo Documento');
        $('#document-type').val(type);
        $('#invoice-lines-tbody').empty();
        window.tempInvoiceLines = []; 
        
        populateDropdowns();
        const today = new Date().toISOString().slice(0, 10);
        $('#invoice-date').val(today);
        $('#invoice-dataRiferimento').val(today);

        if (type === 'Nota di Credito') {
            $('#document-title').text('Nuova Nota di Credito'); 
            $('#credit-note-fields').removeClass('d-none');
        } else {
            $('#document-title').text('Nuova Fattura'); 
            $('#credit-note-fields').addClass('d-none');
        }
        
        // Calcola numero successivo (solo se creazione)
        updateInvoiceNumber(type, today.substring(0, 4));
        updateTotalsDisplay();
    }

    function updateInvoiceNumber(type, year) {
        if (CURRENT_EDITING_INVOICE_ID) return; // Non cambiare numero se modifico
        const invoices = getData('invoices');
        const prefix = type === 'Fattura' ? 'FATT' : 'NC';
        
        const docsForYear = invoices.filter(inv => 
            (inv.type === type || (type==='Fattura' && !inv.type)) && 
            inv.date.substring(0, 4) === String(year)
        );
        
        let nextNum = 1;
        if (docsForYear.length > 0) {
            const numbers = docsForYear.map(inv => {
                const parts = inv.number.split('-');
                return parseInt(parts[parts.length - 1]) || 0;
            });
            nextNum = Math.max(...numbers) + 1;
        }
        
        const padded = String(nextNum).padStart(2, '0');
        $('#invoice-number').val(`${prefix}-${year}-${padded}`);
    }

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
        
        renderLocalInvoiceLines();
        // Reset campi riga
        $('#invoice-product-select').val('');
        $('#invoice-product-description').val('');
        $('#invoice-product-price').val('');
        $('#invoice-product-qty').val(1);
        updateTotalsDisplay();
    });

    function renderLocalInvoiceLines() {
        const tbody = $('#invoice-lines-tbody').empty(); 
        window.tempInvoiceLines.forEach((l, i) => { 
            tbody.append(`
                <tr>
                    <td>${l.productName}</td>
                    <td class="text-end">${l.qty}</td>
                    <td class="text-end">€ ${l.price.toFixed(2)}</td>
                    <td class="text-end">€ ${l.subtotal.toFixed(2)}</td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-outline-danger del-line" data-i="${i}"><i class="fas fa-times"></i></button>
                    </td>
                </tr>`); 
        });
    }

    $('#invoice-lines-tbody').on('click', '.del-line', function() { 
        window.tempInvoiceLines.splice($(this).data('i'), 1); 
        renderLocalInvoiceLines(); 
        updateTotalsDisplay();
    });

    // Calcolo Totali (Rivalsa + Bollo)
    function updateTotalsDisplay() {
        const customerId = $('#invoice-customer-select').val();
        const customer = getData('customers').find(c => String(c.id) === String(customerId));
        const company = getData('companyInfo');
        
        const bolloDesc = 'rivalsa bollo';
        const righePrestazioni = window.tempInvoiceLines.filter(l => l.productName.toLowerCase() !== bolloDesc);
        const rigaBollo = window.tempInvoiceLines.find(l => l.productName.toLowerCase() === bolloDesc);
        
        const importoBollo = rigaBollo ? rigaBollo.subtotal : 0;
        const totalePrestazioni = righePrestazioni.reduce((s, l) => s + l.subtotal, 0);
        
        let rivalsaImporto = 0;
        if (customer && customer.rivalsaInps && company.aliquotaInps) {
             rivalsaImporto = totalePrestazioni * (parseFloat(company.aliquotaInps) / 100);
        }
        
        const totaleImponibile = totalePrestazioni + rivalsaImporto;
        const totaleDocumento = totaleImponibile + importoBollo;
        
        $('#invoice-total').text(`€ ${totaleDocumento.toFixed(2)}`);
        $('#invoice-tax-details').text(`(Imponibile: € ${totaleImponibile.toFixed(2)} - Rivalsa: € ${rivalsaImporto.toFixed(2)} - Bollo: € ${importoBollo.toFixed(2)})`);
        
        return { totalePrestazioni, rivalsaImporto, importoBollo, totaleImponibile, totaleDocumento };
    }
    
    // Trigger ricalcolo al cambio cliente (per la rivalsa)
    $('#invoice-customer-select').change(updateTotalsDisplay);

    // Auto-compilazione Prodotti
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
    
    $('#invoice-date').change(function() {
        $('#invoice-dataRiferimento').val($(this).val());
        // Aggiorna numero solo se è nuovo
        if(!CURRENT_EDITING_INVOICE_ID) updateInvoiceNumber($('#document-type').val(), $(this).val().substring(0, 4));
    });
    
    // Calcolo Scadenza
    $('#invoice-dataRiferimento, #invoice-giorniTermini').on('input', function() { 
        const d = $('#invoice-dataRiferimento').val(); 
        const g = parseInt($('#invoice-giorniTermini').val()); 
        if(d && !isNaN(g)) { 
            const dt = new Date(d); dt.setDate(dt.getDate() + g); 
            $('#invoice-dataScadenza').val(dt.toISOString().split('T')[0]); 
        } 
    });

    // SALVA DOCUMENTO
    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();
        
        // Calcola i totali finali al momento del salvataggio
        const calcs = updateTotalsDisplay();
        
        if (!calcs.totaleDocumento || window.tempInvoiceLines.length === 0) { alert("Inserire almeno una riga."); return; }
        if (!$('#invoice-customer-select').val()) { alert("Selezionare un cliente."); return; }
        
        const docType = $('#document-type').val();
        const company = getData('companyInfo');

        const data = {
            number: $('#invoice-number').val(), 
            date: $('#invoice-date').val(),
            customerId: $('#invoice-customer-select').val(), 
            type: docType,
            lines: window.tempInvoiceLines, 
            
            // Dati Calcolati
            totalePrestazioni: calcs.totalePrestazioni,
            importoBollo: calcs.importoBollo,
            rivalsa: { aliquota: company.aliquotaInps, importo: calcs.rivalsaImporto },
            totaleImponibile: calcs.totaleImponibile,
            total: calcs.totaleDocumento,
            
            status: (docType === 'Fattura' ? 'Da Incassare' : 'Emessa'), // NdC nasce emessa
            
            dataScadenza: $('#invoice-dataScadenza').val(),
            condizioniPagamento: $('#invoice-condizioniPagamento').val(),
            modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            linkedInvoice: $('#linked-invoice').val(),
            reason: $('#reason').val()
        };

        // Se stiamo modificando, mantieni lo status originale (es. se era già Pagata)
        if (CURRENT_EDITING_INVOICE_ID) {
            const oldInv = getData('invoices').find(i => String(i.id) === CURRENT_EDITING_INVOICE_ID);
            if(oldInv) data.status = oldInv.status;
        }

        // ID: Usa quello in editing o generane uno nuovo
        let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices')));

        console.log("Salvataggio Documento:", id, data);
        await saveDataToCloud('invoices', data, id);
        
        alert("Documento salvato!"); 
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    // --- AZIONI TABELLA FATTURE ---
    
    // Modifica Fattura
    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        
        if(inv) {
            CURRENT_EDITING_INVOICE_ID = String(inv.id); // Setta stato
            
            // Naviga alla pagina corretta
            if(inv.type === 'Nota di Credito') $('#menu-nuova-nota-credito').click();
            else $('#menu-nuova-fattura').click();
            
            // Aspetta che il form si sia resettato (dalla navigazione) e poi popola
            setTimeout(() => {
                $('#invoice-id').val(inv.id); // Mostra ID a video
                
                $('#invoice-customer-select').val(inv.customerId);
                $('#invoice-date').val(inv.date);
                $('#invoice-number').val(inv.number);
                $('#invoice-condizioniPagamento').val(inv.condizioniPagamento);
                $('#invoice-modalitaPagamento').val(inv.modalitaPagamento);
                $('#linked-invoice').val(inv.linkedInvoice);
                $('#reason').val(inv.reason);
                $('#invoice-dataScadenza').val(inv.dataScadenza);
                
                // Importante: clona le righe per non modificare l'oggetto originale in memoria
                window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines || []));
                renderLocalInvoiceLines();
                updateTotalsDisplay();
            }, 200);
        }
    });

    // Cambio Stato
    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(confirm("Confermi il cambio stato in Pagata/Emessa?")) {
            await saveDataToCloud('invoices', { status: inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata' }, id);
            renderInvoicesTable();
        }
    });
    
    // Elimina
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { 
        const id = $(this).attr('data-id');
        if(id) deleteDataFromCloud('invoices', id);
    });
    
    // Autocomplete Nota Credito
    $('#linked-invoice').on('change', function() {
        const linkedNumber = $(this).val().trim();
        const sourceInvoice = getData('invoices').find(inv => inv.number === linkedNumber);
        if(sourceInvoice && confirm(`Trovata fattura ${sourceInvoice.number}. Importare dati?`)) {
            $('#invoice-customer-select').val(sourceInvoice.customerId);
            window.tempInvoiceLines = JSON.parse(JSON.stringify(sourceInvoice.lines)); 
            renderLocalInvoiceLines();
            updateTotalsDisplay();
            $('#invoice-condizioniPagamento').val(sourceInvoice.condizioniPagamento);
            $('#invoice-modalitaPagamento').val(sourceInvoice.modalitaPagamento);
            if(!$('#reason').val()) $('#reason').val(`Storno totale fattura n. ${sourceInvoice.number} del ${formatDateForDisplay(sourceInvoice.date)}`);
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