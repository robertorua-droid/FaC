$(document).ready(function() {

    let currentUser = null; 
    let dateTimeInterval = null;

    const DB_KEYS = ['companyInfo', 'products', 'customers', 'users', 'invoices', 'notes'];

    function checkAndSeedData() {
        if (!localStorage.getItem('companyInfo')) {
            console.log("Creazione dati di esempio...");
            const sampleData = {
                companyInfo: { name: "Mio Studio Professionale", nome: "Mario", cognome: "Rossi", address: "Via Roma", numeroCivico: "1", city: "Milano", zip: "20121", province: "MI", nazione: "Italia", piva: "12345678901", codiceFiscale: "RSSMRA80A01H501U", regimeFiscale: "Regime Forfettario", codiceRegimeFiscale: "RF19", aliquotaInps: "4", banca: "Fineco Bank S.p.A.", iban: "IT60X0301503200000003592674", coefficienteRedditivita: "78", aliquotaSostitutiva: "15", contributiVersati: "0", aliquotaContributi: "26.23" },
                products: [ { id: 'PRD1', code: 'CONS-01', description: 'Consulenza Oraria', salePrice: "80.00", iva: "0", esenzioneIva: 'N2.2' }, { id: 'PRD2', code: 'PROG-PRE', description: 'Progettazione Preliminare', salePrice: "1500.00", iva: "0", esenzioneIva: 'N2.2' }, { id: 'PRD3', code: 'VEND-HW', description: 'Vendita Hardware', salePrice: "500.00", iva: "22", esenzioneIva: '' }, { id: 'PRD4', code: 'BOLLO', description: 'Rivalsa bollo', salePrice: "2.00", iva: "0", esenzioneIva: 'N4' } ],
                customers: [ { id: 1, name: 'Lavorazioni Meccaniche SAS', piva: '01122334455', codiceFiscale: '', sdi: '0000000', address: 'Via Cagliari 32', comune: 'Torino', provincia: 'TO', cap: '10100', nazione: 'Italia', rivalsaInps: true }, { id: 2, name: 'Rossi S.p.A.', piva: '09988776655', codiceFiscale: '', sdi: 'SUBM70N', address: 'Via Roma 1', comune: 'Torino', provincia: 'TO', cap: '10123', nazione: 'Italia', rivalsaInps: false } ],
                users: [ { id: 1, surname: 'admin', name: 'Amministratore', password: 'gestionale', role: 'Admin' } ],
                invoices: [],
                notes: []
            };
            DB_KEYS.forEach(key => localStorage.setItem(key, JSON.stringify(sampleData[key] || [])));
        }
    }

    checkAndSeedData(); 

    function initializeApp() { $('.content-section').addClass('d-none'); $('#home').removeClass('d-none'); $('.sidebar .nav-link').removeClass('active'); $('.sidebar .nav-link[data-target="home"]').addClass('active'); renderAll(); }
    function getData(key) { return JSON.parse(localStorage.getItem(key)) || []; }
    function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
    function getNextId(items) { return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1; }

    function renderAll() {
        renderCompanyInfoForm(); 
        updateCompanyUI(); 
        renderProductsTable(); 
        renderCustomersTable(); 
        renderUsersTable(); 
        renderInvoicesTable();
        populateDropdowns(); 
        renderStatisticsPage();
        renderHomePage();
        updateMenuVisibility();
    }

    function updateCompanyUI() { 
        const company = getData('companyInfo'); 
        if(company.name) $('#company-name-sidebar').text(company.name);
        if(currentUser) $('#user-name-sidebar').text('Utente: ' + currentUser.surname);
        $('#version-sidebar').text('v6.0 (Stabile)');
    }

    function renderCompanyInfoForm() { const company = getData('companyInfo'); for (const key in company) { $(`#company-${key}`).val(company[key]); } }
    function renderProductsTable() { const products = getData('products'); const tableBody = $('#products-table-body').empty(); products.forEach(p => { const salePrice = p.salePrice ? `€ ${parseFloat(p.salePrice).toFixed(2)}` : '-'; const ivaText = (p.iva == 0 && p.esenzioneIva) ? `0% (${p.esenzioneIva})` : `${p.iva}%`; tableBody.append(`<tr><td>${p.code}</td><td>${p.description}</td><td>${salePrice}</td><td>${ivaText}</td><td><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); }); }
    function renderCustomersTable() { const customers = getData('customers'); const tableBody = $('#customers-table-body').empty(); customers.forEach(c => { const pivaCf = c.piva || c.codiceFiscale || '-'; const fullAddress = `${c.address || ''}, ${c.cap || ''} ${c.comune || ''} (${c.provincia || ''})`; tableBody.append(`<tr><td>${c.id}</td><td>${c.name}</td><td>${pivaCf}</td><td>${c.sdi || '-'}</td><td>${fullAddress}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); }); }
    function renderUsersTable() { const users = getData('users'); const tableBody = $('#users-table-body').empty(); users.forEach(u => tableBody.append(`<tr><td>${u.id}</td><td>${u.surname}</td><td>${u.name}</td><td>${u.role}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-user" data-id="${u.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-user" data-id="${u.id}"><i class="fas fa-trash"></i></button></td></tr>`)); }
    
    function renderInvoicesTable() {
        const invoices = getData('invoices'); const customers = getData('customers'); const tableBody = $('#invoices-table-body').empty();
        invoices.forEach(inv => {
            const customer = customers.find(c => c.id == inv.customerId) || { name: 'Sconosciuto' }; 
            const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
            let statusBadge = `<span class="badge bg-warning text-dark">Da Incassare</span>`;
            if (inv.type === 'Nota di Credito') {
                statusBadge = isPaid ? `<span class="badge bg-info text-dark">Emessa</span>` : `<span class="badge bg-secondary">Bozza</span>`;
            } else {
                statusBadge = isPaid ? `<span class="badge bg-success">Pagata</span>` : `<span class="badge bg-warning text-dark">Da Incassare</span>`;
            }
            const docTypeBadge = inv.type === 'Nota di Credito' ? `<span class="badge bg-doc-nc">N.C.</span>` : `<span class="badge bg-primary">Fatt.</span>`;
            let actions = `<button class="btn btn-sm btn-info btn-view-invoice" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal">Dettagli</button> <button class="btn btn-sm btn-secondary btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${isPaid ? 'disabled' : ''}><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="Esporta XML"><i class="fas fa-file-code"></i></button>`;
            const payButtonText = inv.type === 'Nota di Credito' ? 'Segna come Emessa' : 'Segna come Pagata';
            if (!isPaid) { actions += ` <button class="btn btn-sm btn-success btn-mark-paid" data-id="${inv.id}" title="${payButtonText}"><i class="fas fa-check"></i></button>`; }
            if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Supervisor')) { actions += ` <button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina"><i class="fas fa-trash"></i></button>`; }
            const rowClass = isPaid ? 'class="invoice-paid"' : '';
            tableBody.append(`<tr ${rowClass}><td>${docTypeBadge}</td><td>${inv.number}</td><td>${inv.date}</td><td>${customer.name}</td><td class="text-end-numbers pe-5">€ ${inv.total.toFixed(2)}</td><td class="text-end-numbers">${inv.dataScadenza || '-'}</td><td>${statusBadge}</td><td class="text-end">${actions}</td></tr>`);
        });
    }

    // --- LOGIN E NAVIGAZIONE (LOGICA STABILE) ---
    $('#login-form').on('submit', function(e) { e.preventDefault(); const username = $('#username').val(); const password = $('#password').val(); let users = getData('users'); if (users.length === 0) { const adminUser = { id: 1, surname: 'admin', name: 'Amministratore', password: 'gestionale', role: 'Admin' }; users = [adminUser]; saveData('users', users); } const user = users.find(u => u.surname.toLowerCase() === username.toLowerCase() && u.password === password); if (user) { currentUser = user; $('#login-container').addClass('d-none'); $('#main-app').removeClass('d-none'); initializeApp(); } else { $('#error-message').removeClass('d-none'); } });
    $('#logout-btn').on('click', function(e) { e.preventDefault(); location.reload(); });
    $('.sidebar .nav-link').on('click', function(e) { 
        if ($(this).attr('id') === 'logout-btn' || $(this).data('bs-toggle') === 'modal') return; 
        e.preventDefault(); 
        const target = $(this).data('target');
        if (target === 'nuova-fattura-accompagnatoria') {
            if ($(this).attr('id') === 'menu-nuova-nota-credito') {
                prepareDocumentForm('Nota di Credito');
            } else {
                 return;
            }
        }
        if (target === 'statistiche') { renderStatisticsPage(); }
        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active');
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none'); 
    });
    function updateMenuVisibility() { if (currentUser && currentUser.role === 'User') { $('#menu-anagrafica-clienti, #menu-anagrafica-azienda, #menu-nuova-fattura').hide(); } else { $('#menu-anagrafica-clienti, #menu-anagrafica-azienda, #menu-nuova-fattura').show(); } }

    // --- SALVATAGGIO ANAGRAFICA AZIENDA ---
    $('#company-info-form').on('submit', function(e) { e.preventDefault(); const companyInfo = {}; $(this).find('input, select').each(function() { const id = $(this).attr('id'); if (id) { const key = id.replace('company-', ''); companyInfo[key] = $(this).val(); } }); saveData('companyInfo', companyInfo); alert("Dati azienda salvati con successo!"); updateCompanyUI(); });
    
    // --- GESTIONE CAMPO CONDIZIONALE ESENZIONE IVA ---
    function toggleEsenzioneIvaField(container, ivaValue) { const esenzioneContainer = (container === 'product') ? $('#esenzione-iva-container') : $('#invoice-esenzione-iva-container'); const esenzioneSelect = (container === 'product') ? $('#product-esenzioneIva') : $('#invoice-product-esenzioneIva'); if (ivaValue == '0') { esenzioneContainer.removeClass('d-none'); } else { esenzioneContainer.addClass('d-none'); esenzioneSelect.val(''); } }
    $('#product-iva').on('change', function() { toggleEsenzioneIvaField('product', $(this).val()); });
    $('#invoice-product-iva').on('change', function() { toggleEsenzioneIvaField('invoice', $(this).val()); });

    // --- CRUD ANAGRAFICHE ---
    function prepareNewItemModal(type) { const form = $(`#${type}Form`); if (form.length) form[0].reset(); $(`#${type}-id`).val(''); const titleText = (type === 'product') ? 'Servizio/Prodotto' : type.charAt(0).toUpperCase() + type.slice(1); $(`#${type}ModalTitle`).text(`Nuovo ${titleText}`); if (type === 'product') { $('#product-iva').val('0'); $('#product-esenzioneIva').val('N2.2'); toggleEsenzioneIvaField('product', '0'); } if (type === 'customer') { $('#customer-nazione').val('Italia'); $('#customer-rivalsaInps').prop('checked', false); } if (type === 'user') { $('#togglePassword i').removeClass('fa-eye-slash').addClass('fa-eye'); $('#user-password').attr('type', 'password'); } }
    function editItem(type, id) { const items = getData(`${type}s`); const item = items.find(i => i.id == id); if (!item) return; prepareNewItemModal(type); const titleText = (type === 'product') ? 'Servizio/Prodotto' : type.charAt(0).toUpperCase() + type.slice(1); $(`#${type}ModalTitle`).text(`Modifica ${titleText}`); for (const key in item) { const field = $(`#${type}-${key}`); if (field.is(':checkbox')) { field.prop('checked', item[key]); } else if (field.length) { field.val(item[key]); } } if (type === 'product') { toggleEsenzioneIvaField('product', item.iva); } $(`#${type}-id`).val(item.id); $(`#${type}Modal`).modal('show'); }
    function deleteItem(type, id) { if (confirm(`Sei sicuro di voler eliminare questo elemento?`)) { saveData(`${type}s`, (getData(`${type}s`)).filter(i => i.id != id)); renderAll(); } }
    
    ['product', 'customer', 'user'].forEach(type => {
        $(`#new${type.charAt(0).toUpperCase() + type.slice(1)}Btn`).on('click', function() { prepareNewItemModal(type); });
        $(`#save${type.charAt(0).toUpperCase() + type.slice(1)}Btn`).on('click', function() { const typePlural = `${type}s`; let items = getData(typePlural); const id = $(`#${type}-id`).val(); let itemData = {}; $(`#${type}Form`).find('input, select').each(function() { const field = $(this); const fieldId = field.attr('id'); if (fieldId) { const key = fieldId.replace(`${type}-`, ''); itemData[key] = field.is(':checkbox') ? field.is(':checked') : field.val(); } }); if (type === 'product' && itemData.iva != '0') { itemData.esenzioneIva = ''; } if (id) { const index = items.findIndex(i => i.id == id); if (index > -1) items[index] = { ...items[index], ...itemData }; } else { itemData.id = (type === 'product') ? 'PRD' + new Date().getTime() : getNextId(items); items.push(itemData); } saveData(typePlural, items); $(`#${type}Modal`).modal('hide'); renderAll(); });
        $(`#${type}s-table-body`).on('click', `.btn-edit-${type}`, function() { editItem(type, $(this).data('id')); });
        $(`#${type}s-table-body`).on('click', `.btn-delete-${type}`, function() { deleteItem(type, $(this).data('id')); });
    });
    $('#togglePassword').on('click', function() { const p = $('#user-password'); p.attr('type', p.attr('type') === 'password' ? 'text' : 'password'); $(this).find('i').toggleClass('fa-eye fa-eye-slash'); });

    // --- HOME PAGE ---
    function renderHomePage() { if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.name} ${currentUser.surname}`); if (dateTimeInterval) clearInterval(dateTimeInterval); const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })); updateDateTime(); dateTimeInterval = setInterval(updateDateTime, 1000); renderCalendar(); loadUserNotes(); }
    function renderCalendar() { const c = $('#calendar-widget'); const n = new Date(); const m = n.getMonth(); const y = n.getFullYear(); const t = n.getDate(); const f = new Date(y, m, 1); const l = new Date(y, m + 1, 0); let h = `<h5 class="text-center">${f.toLocaleDateString('it-IT',{month:'long',year:'numeric'})}</h5><table class="table table-bordered"><thead><tr><th>Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th></tr></thead><tbody><tr>`; let d=f.getDay(); for(let i=0;i<d;i++){h+='<td></td>'} for(let day=1;day<=l.getDate();day++){if(d===7){d=0;h+='</tr><tr>'}h+=`<td${(day===t)?' class="today"':''}>${day}</td>`;d++} for(let i=d;i<7;i++){h+='<td></td>'} h+='</tr></tbody></table>'; c.html(h); }
    function loadUserNotes() { if (!currentUser) return; const notes = getData('notes'); const userNote = notes.find(note => note.userId === currentUser.id); $('#notes-textarea').val(userNote ? userNote.text : ''); }
    $('#save-notes-btn').on('click', function() { if (!currentUser) return; let notes = getData('notes'); const noteText = $('#notes-textarea').val(); const userNoteIndex = notes.findIndex(note => note.userId === currentUser.id); if (userNoteIndex > -1) { notes[userNoteIndex].text = noteText; } else { notes.push({ userId: currentUser.id, text: noteText }); } saveData('notes', notes); alert("Appunti salvati!"); });
    
    // --- LOGICA FATTURAZIONE E NOTE DI CREDITO ---
    let currentInvoiceLines = [];
    function generateNextDocumentNumber(type, year) { const invoices = getData('invoices'); const prefix = type === 'Fattura' ? 'FATT' : 'NC'; const documentsForYear = invoices.filter(inv => inv.type === type && inv.date.substring(0, 4) === String(year)); if (documentsForYear.length === 0) { return 1; } else { const lastNumbers = documentsForYear.map(inv => { const parts = inv.number.split('-'); const numPart = parts[parts.length - 1]; return parseInt(numPart, 10) || 0; }); return Math.max(...lastNumbers) + 1; } }
    function updateInvoiceNumber() { if ($('#editing-invoice-id').val()) return; const dateStr = $('#invoice-date').val(); if (!dateStr) return; const year = dateStr.substring(0, 4); const type = $('#document-type').val(); const prefix = type === 'Fattura' ? 'FATT' : 'NC'; const nextNumber = generateNextDocumentNumber(type, year); const paddedNumber = String(nextNumber).padStart(2, '0'); $('#invoice-number').val(`${prefix}-${year}-${paddedNumber}`); }
    function renderInvoiceLines() { const tbody = $('#invoice-lines-tbody').empty(); let total = 0; currentInvoiceLines.forEach((line, index) => { tbody.append(`<tr><td>${line.productName}</td><td class="text-end-numbers">${line.qty}</td><td class="text-end-numbers">€ ${line.price.toFixed(2)}</td><td class="text-end-numbers">€ ${line.subtotal.toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-danger remove-invoice-line" data-index="${index}"><i class="fas fa-times"></i></button></td></tr>`); total += line.subtotal; }); $('#invoice-total').text(`€ ${total.toFixed(2)}`); }
    $('#invoice-product-select').on('change', function() { const productId = $(this).val(); const descriptionField = $('#invoice-product-description'); const priceField = $('#invoice-product-price'); const ivaField = $('#invoice-product-iva'); const esenzioneField = $('#invoice-product-esenzioneIva'); if (productId === 'manual') { descriptionField.val('').prop('readonly', false).focus(); priceField.val(''); ivaField.prop('disabled', false).val('0'); esenzioneField.prop('disabled', false).val('N2.2'); toggleEsenzioneIvaField('invoice', '0'); } else if (productId) { const product = getData('products').find(p => p.id === productId); if (product) { descriptionField.val(product.description).prop('readonly', true); priceField.val(parseFloat(product.salePrice).toFixed(2)); ivaField.prop('disabled', true).val(product.iva); esenzioneField.prop('disabled', true).val(product.esenzioneIva); toggleEsenzioneIvaField('invoice', product.iva); } } else { descriptionField.val('').prop('readonly', true); priceField.val(''); ivaField.prop('disabled', true); esenzioneField.prop('disabled', true); toggleEsenzioneIvaField('invoice', '-1'); } });
    $('#add-product-to-invoice-btn').on('click', function() { const selectedProductId = $('#invoice-product-select').val(); const description = $('#invoice-product-description').val(); const qty = parseInt($('#invoice-product-qty').val()); const price = parseFloat($('#invoice-product-price').val()); if (!description || !qty || qty <= 0 || isNaN(price)) { alert("Compilare Descrizione, Quantità e Prezzo validi."); return; } let lineData = { productName: description, qty, price, subtotal: qty * price }; if (selectedProductId === 'manual' || !selectedProductId) { lineData.productId = 'manual'; lineData.iva = $('#invoice-product-iva').val(); lineData.esenzioneIva = (lineData.iva === '0') ? $('#invoice-product-esenzioneIva').val() : ''; } else { const product = getData('products').find(p => p.id === selectedProductId); lineData = {...lineData, productId: product.id, iva: product.iva, esenzioneIva: product.esenzioneIva }; } currentInvoiceLines.push(lineData); renderInvoiceLines(); $('#invoice-product-select').val(''); $('#invoice-product-description').val('').prop('readonly', true); $('#invoice-product-price').val(''); $('#invoice-product-qty').val(1); $('#invoice-product-iva').prop('disabled', true); $('#invoice-esenzione-iva-container').addClass('d-none'); });
    $('#invoice-lines-tbody').on('click', '.remove-invoice-line', function() { currentInvoiceLines.splice($(this).data('index'), 1); renderInvoiceLines(); });
    function calculateDueDate() { const startDate = $('#invoice-dataRiferimento').val(); const days = parseInt($('#invoice-giorniTermini').val()); if (startDate && !isNaN(days)) { const date = new Date(startDate); date.setDate(date.getDate() + days); $('#invoice-dataScadenza').val(date.toISOString().split('T')[0]); } }
    $('#invoice-date').on('change', function() { $('#invoice-dataRiferimento').val($(this).val()); calculateDueDate(); updateInvoiceNumber(); });
    $('#invoice-dataRiferimento, #invoice-giorniTermini').on('input', calculateDueDate);
    $('#new-invoice-form').on('submit', function(e) {
        e.preventDefault();
        const editingId = parseInt($('#editing-invoice-id').val()); const customerId = $('#invoice-customer-select').val(); if (!customerId || currentInvoiceLines.length === 0) { alert("Selezionare un cliente e aggiungere almeno una riga."); return; }
        const customer = getData('customers').find(c => c.id == customerId); const company = getData('companyInfo'); const docType = $('#document-type').val(); const bolloDescription = 'rivalsa bollo'; const righePrestazioni = currentInvoiceLines.filter(line => line.productName.toLowerCase() !== bolloDescription); const rigaBollo = currentInvoiceLines.find(line => line.productName.toLowerCase() === bolloDescription); const importoBollo = rigaBollo ? rigaBollo.price : 0; let totalePrestazioni = righePrestazioni.reduce((sum, line) => sum + line.subtotal, 0); let rivalsa = {}; if (customer.rivalsaInps) { const aliquotaInps = parseFloat(company.aliquotaInps || 0); const importoRivalsa = totalePrestazioni * (aliquotaInps / 100); rivalsa = { aliquota: aliquotaInps, importo: importoRivalsa }; } const totaleImponibile = totalePrestazioni + (rivalsa.importo || 0); let totaleIva = 0;
        const totaleDocumento = totaleImponibile + totaleIva + importoBollo;
        let invoices = getData('invoices'); let finalDueDate = $('#invoice-dataScadenza').val(); if (!finalDueDate) { finalDueDate = $('#invoice-date').val(); } 
        const invoiceData = { type: docType, number: $('#invoice-number').val(), date: $('#invoice-date').val(), customerId, lines: currentInvoiceLines, summary: {}, rivalsa, importoBollo, totalePrestazioni, totaleImponibile, totaleIva, condizioniPagamento: $('#invoice-condizioniPagamento').val(), modalitaPagamento: $('#invoice-modalitaPagamento').val(), dataScadenza: finalDueDate, total: totaleDocumento };
        if (docType === 'Nota di Credito') { invoiceData.linkedInvoice = $('#linked-invoice').val(); invoiceData.reason = $('#reason').val(); }
        if (editingId) {
            const index = invoices.findIndex(inv => inv.id === editingId); if (index > -1) { invoices[index] = { ...invoices[index], ...invoiceData }; alert(`${docType} ${invoiceData.number} modificata con successo!`); }
        } else {
            invoiceData.id = getNextId(invoices); invoiceData.status = docType === 'Fattura' ? 'Da Incassare' : 'Bozza'; invoices.push(invoiceData); alert(`${docType} ${invoiceData.number} generata con successo!`);
        }
        saveData('invoices', invoices); resetInvoiceForm(); renderInvoicesTable(); $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });
    function prepareDocumentForm(type) {
        $('#new-invoice-form')[0].reset(); currentInvoiceLines = []; renderInvoiceLines(); $('#editing-invoice-id').val(''); $('#document-type').val(type);
        if (type === 'Nota di Credito') {
            $('#document-title').text('Nuova Nota di Credito'); $('#credit-note-fields').removeClass('d-none'); $('#save-invoice-btn').text('Genera Nota di Credito');
        } else {
            $('#document-title').text('Nuova Fattura'); $('#credit-note-fields').addClass('d-none'); $('#save-invoice-btn').text('Genera Fattura');
        }
        populateDropdowns();
    }
    function resetInvoiceForm() { prepareDocumentForm('Fattura'); }
    function loadInvoiceForEditing(invoiceId, isCopy = false) {
        const invoice = getData('invoices').find(inv => inv.id === invoiceId); if (!invoice) { alert("Documento non trovato!"); return; } 
        prepareDocumentForm(isCopy ? 'Fattura' : invoice.type);
        if (!isCopy) {
            $('#editing-invoice-id').val(invoice.id);
            $('#document-title').text(`Modifica ${invoice.type} N° ${invoice.number}`);
            $('#save-invoice-btn').text('Salva Modifiche');
            $('#cancel-edit-invoice-btn').removeClass('d-none');
        }
        $('#invoice-customer-select').val(invoice.customerId); $('#invoice-date').val(isCopy ? new Date().toISOString().slice(0, 10) : invoice.date); $('#invoice-number').val(invoice.number); $('#invoice-condizioniPagamento').val(invoice.condizioniPagamento); $('#invoice-modalitaPagamento').val(invoice.modalitaPagamento); $('#invoice-dataRiferimento').val(invoice.date); $('#invoice-dataScadenza').val(invoice.dataScadenza); 
        if (invoice.type === 'Nota di Credito') { $('#linked-invoice').val(invoice.linkedInvoice); $('#reason').val(invoice.reason); }
        const date1 = new Date(invoice.date); const date2 = new Date(invoice.dataScadenza); if (date1 && date2) { const diffTime = Math.abs(date2 - date1); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (!isNaN(diffDays)) { $('#invoice-giorniTermini').val(diffDays); } } currentInvoiceLines = JSON.parse(JSON.stringify(invoice.lines)); renderInvoiceLines();
        if(isCopy) { updateInvoiceNumber(); }
        $('.content-section').addClass('d-none'); $('#nuova-fattura-accompagnatoria').removeClass('d-none');
    }
    $('#cancel-edit-invoice-btn').on('click', function() { resetInvoiceForm(); $('.sidebar .nav-link[data-target="elenco-fatture"]').click(); });
    function populateDropdowns() {
        const productOptions = (getData('products')).map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`).join('');
        $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona...</option>').append((getData('customers')).map(c => `<option value="${c.id}">${c.name}</option>`));
        $('#invoice-product-select').empty().append('<option selected value="">Seleziona un servizio (opzionale)...</option><option value="manual">--- Inserimento Manuale ---</option>').append(productOptions);
        const today = new Date().toISOString().slice(0, 10);
        if(!$('#editing-invoice-id').val()) {
            $('#invoice-date').val(today);
            updateInvoiceNumber();
        }
        $('#invoice-dataRiferimento').val(today); $('#invoice-giorniTermini').val(''); $('#invoice-dataScadenza').val(''); $('#invoice-product-description').val('').prop('readonly', true); $('#invoice-product-iva').prop('disabled', true); $('#invoice-esenzione-iva-container').addClass('d-none');
    }
    $('#print-invoice-btn').on('click', () => window.print());
    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { let invoiceId; if ($(this).attr('id') === 'export-xml-btn') { invoiceId = $('#export-xml-btn').data('invoiceId'); } else { invoiceId = $(this).data('id'); } if (invoiceId) { generateInvoiceXML(invoiceId); } });
    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const invoiceId = $(this).data('id'); const invoice = getData('invoices').find(inv => inv.id == invoiceId); if (!invoice) return;
        $('#export-xml-btn').data('invoiceId', invoiceId); const customer = getData('customers').find(c => c.id == invoice.customerId) || {}; const company = getData('companyInfo'); const customerAddress = `${customer.address || ''}<br>${customer.cap || ''} ${customer.comune || ''} (${customer.provincia || ''}) - ${customer.nazione || ''}`; const companyAddress = `${company.address || ''} ${company.numeroCivico || ''}<br>${company.zip || ''} ${company.city || ''} (${company.province || ''})`; $('#invoiceDetailModalTitle').text(`Dettaglio ${invoice.type} N° ${invoice.number}`);
        let modalBodyHtml = `<div class="row mb-3"><div class="col-6"><h5>${company.name || ''}</h5><p class="mb-0 small">${company.cognome || ''} ${company.nome || ''}<br>${companyAddress}<br>P.IVA: ${company.piva || ''} - C.F: ${company.codiceFiscale || ''}<br>${company.regimeFiscale || ''} (${company.codiceRegimeFiscale || ''})</p></div><div class="col-6 text-end"><h5>Spett.le</h5><p class="mb-0 small">${customer.name}<br>${customer.address}<br>P.IVA: ${customer.piva || ''} - C.F: ${customer.codiceFiscale || ''}<br>Codice S.d.I: ${customer.sdi || ''}</p></div></div><hr><div class="row mb-3"><div class="col-6"><h4>${invoice.type} N° ${invoice.number}</h4></div><div class="col-6 text-end"><h4>Data: ${invoice.date}</h4></div></div><table class="table table-sm"><thead class="table-light"><tr><th>Descrizione</th><th>Qtà</th><th>Prezzo</th><th>IVA</th><th class="text-end">Imponibile</th></tr></thead><tbody>`;
        invoice.lines.forEach(line => { const ivaCell = (line.iva == 0 && line.esenzioneIva) ? `0% (${line.esenzioneIva})` : `${line.iva}%`; modalBodyHtml += `<tr><td>${line.productName}</td><td>${line.qty}</td><td>€ ${line.price.toFixed(2)}</td><td>${ivaCell}</td><td class="text-end">€ ${line.subtotal.toFixed(2)}</td></tr>`; }); modalBodyHtml += `</tbody></table>`; let summaryHtml = '<div class="row justify-content-end mt-4"><div class="col-md-6"><table class="table table-sm">'; summaryHtml += `<tr><td>Totale Prestazioni</td><td class="text-end">€ ${invoice.totalePrestazioni.toFixed(2)}</td></tr>`; if (invoice.rivalsa && invoice.rivalsa.importo > 0) { summaryHtml += `<tr><td>Rivalsa INPS ${invoice.rivalsa.aliquota}%</td><td class="text-end">€ ${invoice.rivalsa.importo.toFixed(2)}</td></tr>`; } summaryHtml += `<tr><td><strong>Totale Imponibile</strong></td><td class="text-end"><strong>€ ${invoice.totaleImponibile.toFixed(2)}</strong></td></tr>`; if (invoice.totaleIva > 0) { summaryHtml += `<tr><td>Totale IVA</td><td class="text-end">€ ${invoice.totaleIva.toFixed(2)}</td></tr>`; } if (invoice.importoBollo > 0) { summaryHtml += `<tr><td>Marca da Bollo</td><td class="text-end">€ ${invoice.importoBollo.toFixed(2)}</td></tr>`; } summaryHtml += `<tr class="fw-bold fs-5 border-top"><td>Totale Documento</td><td class="text-end">€ ${invoice.total.toFixed(2)}</td></tr></tbody></table></div></div>`; modalBodyHtml += summaryHtml;
        if(company.regimeFiscale === "Regime Forfettario"){ modalBodyHtml += `<hr><p class="small text-muted">Operazione senza applicazione dell’IVA ai sensi dell’art. 1, commi da 54 a 89, Legge n. 190/2014 (Regime Forfettario). Si richiede la non applicazione della ritenuta alla fonte a titolo d’acconto ai sensi dell’art. 1, comma 67, Legge n. 190/2014.</p>`; } modalBodyHtml += `<hr><div class="row mt-2"><div class="col-6"><small><strong>Condizioni:</strong> ${invoice.condizioniPagamento}<br><strong>Modalità:</strong> ${invoice.modalitaPagamento}<br><strong>Scadenza:</strong> ${invoice.dataScadenza}</small></div><div class="col-6"><small><strong>Coordinate Bancarie:</strong><br><strong>Banca:</strong> ${company.banca || ''}<br><strong>IBAN:</strong> ${company.iban || ''}</small></div></div>`;
        $('#invoiceDetailModalBody').html(modalBodyHtml);
    });
    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { const invoiceId = $(this).data('id'); loadInvoiceForEditing(parseInt(invoiceId), false); });
    $('#invoices-table-body').on('click', '.btn-mark-paid', function() { const invoiceId = parseInt($(this).data('id')); const doc = getData('invoices').find(inv => inv.id === invoiceId); const message = doc.type === 'Nota di Credito' ? 'Sei sicuro di voler segnare questa nota di credito come emessa? Non potrà più essere modificata.' : 'Sei sicuro di voler segnare questa fattura come pagata? Non potrà più essere modificata.'; if (confirm(message)) { let invoices = getData('invoices'); const invoice = invoices.find(inv => inv.id === invoiceId); if (invoice) { invoice.status = invoice.type === 'Nota di Credito' ? 'Emessa' : 'Pagata'; saveData('invoices', invoices); renderInvoicesTable(); } } });
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { if (confirm("Sei sicuro di voler eliminare questo documento? L'operazione è irreversibile.")) { saveData('invoices', (getData('invoices')).filter(inv => inv.id != $(this).data('id'))); renderAll(); } });

    // --- LOGICA MODALE NUOVA FATTURA ---
    $('#newInvoiceChoiceModal').on('show.bs.modal', function () {
        const invoices = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined);
        const options = invoices.map(inv => `<option value="${inv.id}">${inv.number} - ${inv.date}</option>`).join('');
        $('#copy-from-invoice-select').html('<option selected value="">Scegli una fattura da copiare...</option>' + options);
    });
    $('#btn-create-new-blank-invoice').on('click', function() {
        $('#newInvoiceChoiceModal').modal('hide');
        $('.sidebar .nav-link').removeClass('active');
        $('.sidebar .nav-link[data-target="nuova-fattura-accompagnatoria"]').addClass('active');
        $('.content-section').addClass('d-none');
        $('#nuova-fattura-accompagnatoria').removeClass('d-none');
        prepareDocumentForm('Fattura');
    });
    $('#btn-copy-from-invoice').on('click', function() {
        const invoiceId = $('#copy-from-invoice-select').val();
        if (invoiceId) {
            $('#newInvoiceChoiceModal').modal('hide');
            $('.sidebar .nav-link').removeClass('active');
            $('.sidebar .nav-link[data-target="nuova-fattura-accompagnatoria"]').addClass('active');
            loadInvoiceForEditing(parseInt(invoiceId), true);
        } else {
            alert("Per favore, seleziona una fattura da cui copiare i dati.");
        }
    });

    // --- PAGINA STATISTICHE E SIMULAZIONE ---
    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty(); const invoices = getData('invoices'); const customers = getData('customers');
        const fakture = invoices.filter(i => i.type === 'Fattura' || i.type === undefined);
        if (fakture.length === 0) { container.html('<div class="alert alert-info">Non ci sono ancora fatture per generare statistiche.</div>'); renderTaxSimulation(); return; }
        const grandTotal = fakture.reduce((sum, inv) => sum + inv.total, 0); let customerTotals = {}; fakture.forEach(inv => { if (!customerTotals[inv.customerId]) { customerTotals[inv.customerId] = 0; } customerTotals[inv.customerId] += inv.total; });
        let tableHtml = `<table class="table table-hover"><thead><tr><th>Cliente</th><th class="text-end-numbers">Fatturato Totale</th><th class="text-end-numbers">% sul Totale</th></tr></thead><tbody>`;
        const sortedCustomerIds = Object.keys(customerTotals).sort((a, b) => customerTotals[b] - customerTotals[a]);
        for (const customerId of sortedCustomerIds) { const customer = customers.find(c => c.id == customerId) || { name: 'Cliente Eliminato' }; const total = customerTotals[customerId]; const percentage = grandTotal > 0 ? (total / grandTotal) * 100 : 0; tableHtml += `<tr><td>${customer.name}</td><td class="text-end-numbers">€ ${total.toFixed(2)}</td><td class="text-end-numbers">${percentage.toFixed(2)}%</td></tr>`; }
        tableHtml += `</tbody><tfoot><tr class="table-group-divider fw-bold"><td>Totale Generale</td><td class="text-end-numbers">€ ${grandTotal.toFixed(2)}</td><td class="text-end-numbers">100.00%</td></tr></tfoot></table>`;
        container.html(tableHtml);
        renderTaxSimulation();
    }
    
    function renderTaxSimulation() {
        const container = $('#tax-simulation-container').empty(); const invoices = getData('invoices'); const company = getData('companyInfo');
        const coeff = parseFloat(company.coefficienteRedditivita); const taxRate = parseFloat(company.aliquotaSostitutiva);
        const socialSecurityRate = parseFloat(company.aliquotaContributi);
        let warningHtml = `<div class="alert alert-warning small"><i class="fas fa-exclamation-triangle me-2"></i><strong>ATTENZIONE:</strong> Questa è una stima a scopo puramente didattico e non sostituisce una consulenza fiscale professionale.</div>`;
        if (!coeff || !taxRate || !socialSecurityRate) { container.html(warningHtml + '<div class="alert alert-danger">Per favore, imposta "Coefficiente di Redditività", "Aliquota Imposta" e "Aliquota Contributi INPS" nella sezione Anagrafica Azienda per abilitare la simulazione.</div>'); return; }
        const fatturato = invoices.filter(i => i.type === 'Fattura' || i.type === undefined).reduce((sum, inv) => sum + inv.totaleImponibile, 0);
        const noteCredito = invoices.filter(i => i.type === 'Nota di Credito').reduce((sum, inv) => sum + inv.totaleImponibile, 0);
        const grossRevenue = fatturato - noteCredito;
        const taxableGross = grossRevenue > 0 ? grossRevenue * (coeff / 100) : 0;
        const totalSocialSecurityDue = taxableGross > 0 ? taxableGross * (socialSecurityRate / 100) : 0;
        let socialFirstAdvance = 0; let socialSecondAdvance = 0;
        if(totalSocialSecurityDue > 0){ socialFirstAdvance = totalSocialSecurityDue * 0.40; socialSecondAdvance = totalSocialSecurityDue * 0.40; }
        const netTaxable = taxableGross > 0 ? taxableGross - totalSocialSecurityDue : 0; 
        const totalTaxDue = netTaxable > 0 ? netTaxable * (taxRate / 100) : 0;
        let taxFirstAdvance = 0; let taxSecondAdvance = 0;
        if (totalTaxDue >= 257.52) { taxFirstAdvance = totalTaxDue * 0.50; taxSecondAdvance = totalTaxDue * 0.50; }
        const totalDue = totalSocialSecurityDue + totalTaxDue;
        let resultHtml = `<div class="row"><div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-header fw-bold">Simulazione Contributi INPS</div><div class="card-body"><dl class="row mb-0"><dt class="col-sm-6">Reddito Lordo Imponibile</dt><dd class="col-sm-6 text-end">€ ${taxableGross.toFixed(2)}</dd><dt class="col-sm-6">Aliquota Contributi INPS</dt><dd class="col-sm-6 text-end">${socialSecurityRate}%</dd><dt class="col-sm-6 h5 text-primary border-top pt-3">Contributi Totali Previsti</dt><dd class="col-sm-6 text-end h5 text-primary border-top pt-3">€ ${totalSocialSecurityDue.toFixed(2)}</dd><hr class="my-3"><dt class="col-sm-6">Stima Primo Acconto (40%)</dt><dd class="col-sm-6 text-end">€ ${socialFirstAdvance.toFixed(2)}</dd><dt class="col-sm-6">Stima Secondo Acconto (40%)</dt><dd class="col-sm-6 text-end">€ ${socialSecondAdvance.toFixed(2)}</dd></dl></div></div></div><div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-header fw-bold">Simulazione Imposta Sostitutiva (IRPEF)</div><div class="card-body"><dl class="row mb-0"><dt class="col-sm-6">Reddito Lordo Imponibile</dt><dd class="col-sm-6 text-end">€ ${taxableGross.toFixed(2)}</dd><dt class="col-sm-6">Contributi INPS Deducibili</dt><dd class="col-sm-6 text-end">- € ${totalSocialSecurityDue.toFixed(2)}</dd><dt class="col-sm-6 border-top pt-2">Reddito Netto Imponibile</dt><dd class="col-sm-6 text-end border-top pt-2">€ ${netTaxable.toFixed(2)}</dd><dt class="col-sm-6">Aliquota Imposta</dt><dd class="col-sm-6 text-end">${taxRate}%</dd><dt class="col-sm-6 h5 text-primary border-top pt-3">Imposta Totale Prevista</dt><dd class="col-sm-6 text-end h5 text-primary border-top pt-3">€ ${totalTaxDue.toFixed(2)}</dd><hr class="my-3"><dt class="col-sm-6">Stima Primo Acconto (50%)</dt><dd class="col-sm-6 text-end">€ ${taxFirstAdvance.toFixed(2)}</dd><dt class="col-sm-6">Stima Secondo Acconto (50%)</dt><dd class="col-sm-6 text-end">€ ${taxSecondAdvance.toFixed(2)}</dd></dl></div></div></div></div><div class="card bg-light mt-4"><div class="card-body d-flex justify-content-between align-items-center"><h5 class="card-title mb-0">Totale Uscite Stimate (Contributi + Imposte)</h5><h5 class="card-title mb-0">€ ${totalDue.toFixed(2)}</h5></div></div>`;
        container.html(warningHtml + resultHtml);
    }

    // --- SEZIONE AVANZATE: ESPORTA, IMPORTA, CANCELLA DATI ---
    $('#export-data-btn').on('click', function() { const allData = {}; DB_KEYS.forEach(key => { allData[key] = getData(key); }); const jsonString = JSON.stringify(allData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); const today = new Date().toISOString().slice(0, 10); a.download = `gestionale-backup-${today}.json`; a.href = url; a.click(); URL.revokeObjectURL(url); });
    $('#email-backup-btn').on('click', function() {
        const btn = $(this);
        btn.prop('disabled', true).find('.spinner-border').removeClass('d-none');

        const allData = {};
        DB_KEYS.forEach(key => { allData[key] = getData(key); });
        const jsonString = JSON.stringify(allData);

        const payload = {
            _subject: `Backup Gestionale - ${currentUser.name} ${currentUser.surname}`,
            messaggio: "Backup dei dati del gestionale in formato JSON.",
            backup_json: jsonString
        };

        fetch("https://formspree.io/f/xyzlrjwj", {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Accept': 'application/json' }
        }).then(response => {
            if (response.ok) {
                alert("Backup inviato con successo!");
            } else {
                throw new Error('Qualcosa è andato storto.');
            }
        }).catch(error => {
            alert("Errore: Impossibile inviare il backup. Controlla la connessione o riprova più tardi.");
            console.error('Errore Formspree:', error);
        }).finally(() => {
            btn.prop('disabled', false).find('.spinner-border').addClass('d-none');
        });
    });
    $('#import-file-input').on('change', function(event) { const file = event.target.files[0]; if (!file) return; if (confirm("Sei sicuro di voler importare i dati? Questa operazione sovrascriverà tutti i dati attuali.")) { const reader = new FileReader(); reader.onload = function(e) { try { const importedData = JSON.parse(e.target.result); let valid = true; DB_KEYS.forEach(key => { if (importedData[key] === undefined) { valid = false; } }); if (valid) { DB_KEYS.forEach(key => { saveData(key, importedData[key]); }); alert("Dati importati con successo! L'applicazione verrà ricaricata."); location.reload(); } else { alert("Errore: il file selezionato non sembra un backup valido del gestionale."); } } catch (error) { alert("Errore durante la lettura del file. Assicurati che sia un file JSON valido."); } }; reader.readAsText(file); } $(this).val(''); });
    $('#delete-all-data-btn').on('click', function() { if (confirm("ATTENZIONE! Stai per cancellare PERMANENTEMENTE tutti i dati. Sei assolutamente sicuro di voler procedere?")) { DB_KEYS.forEach(key => { localStorage.removeItem(key); }); alert("Tutti i dati sono stati cancellati. L'applicazione verrà ricaricata."); location.reload(); } });

    // --- FUNZIONE ESPORTA XML (CONFORME) ---
    function escapeXML(str) { if (typeof str !== 'string') { return ''; } return str.replace(/[<>&'"]/g, function (c) { switch (c) { case '<': return '&lt;'; case '>': return '&gt;'; case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;'; } }); }

    function generateInvoiceXML(invoiceId) {
        const invoice = getData('invoices').find(inv => inv.id == invoiceId); if (!invoice) { alert("Documento non trovato!"); return; } const company = getData('companyInfo'); const customer = getData('customers').find(c => c.id == invoice.customerId);
        const generateProgressivo = () => (Math.random().toString(36) + '00000').slice(2, 7);
        let progressivoInvio = generateProgressivo();
        let anagraficaCedente = `<Anagrafica><Denominazione>${escapeXML(company.name)}</Denominazione></Anagrafica>`;
        if (company.nome && company.cognome) { anagraficaCedente = `<Anagrafica><Nome>${escapeXML(company.nome)}</Nome><Cognome>${escapeXML(company.cognome)}</Cognome></Anagrafica>`; }
        const summaryByNature = {};
        invoice.lines.forEach(line => { if (line.iva == "0" && line.esenzioneIva) { const key = line.esenzioneIva; if (!summaryByNature[key]) { summaryByNature[key] = { aliquota: line.iva, natura: key, imponibile: 0 }; } summaryByNature[key].imponibile += line.subtotal; } });
        if (invoice.rivalsa && invoice.rivalsa.importo > 0) { const key = "N4"; if (!summaryByNature[key]) { summaryByNature[key] = { aliquota: "0.00", natura: key, imponibile: 0 }; } summaryByNature[key].imponibile += invoice.rivalsa.importo; }
        let riepilogoXml = '';
        Object.values(summaryByNature).forEach(summary => { riepilogoXml += `<DatiRiepilogo><AliquotaIVA>${parseFloat(summary.aliquota).toFixed(2)}</AliquotaIVA><Natura>${escapeXML(summary.natura)}</Natura><ImponibileImporto>${summary.imponibile.toFixed(2)}</ImponibileImporto><Imposta>0.00</Imposta></DatiRiepilogo>`; });
        const tipoDocumento = invoice.type === 'Nota di Credito' ? 'TD04' : 'TD01';
        let datiFattureCollegate = '';
        if (invoice.type === 'Nota di Credito' && invoice.linkedInvoice) { datiFattureCollegate = `<DatiFattureCollegate><IdDocumento>${escapeXML(invoice.linkedInvoice)}</IdDocumento></DatiFattureCollegate>`; }
        let causale = invoice.reason ? `<Causale>${escapeXML(invoice.reason)}</Causale>` : '';
        let xml = `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.codiceFiscale)}</IdCodice></IdTrasmittente><ProgressivoInvio>${progressivoInvio}</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>${escapeXML(customer.sdi || '0000000')}</CodiceDestinatario></DatiTrasmissione><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.piva)}</IdCodice></IdFiscaleIVA><CodiceFiscale>${escapeXML(company.codiceFiscale)}</CodiceFiscale>${anagraficaCedente}<RegimeFiscale>${escapeXML(company.codiceRegimeFiscale)}</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>${escapeXML(company.address)}</Indirizzo>${company.numeroCivico ? `<NumeroCivico>${escapeXML(company.numeroCivico)}</NumeroCivico>` : ''}<CAP>${escapeXML(company.zip)}</CAP><Comune>${escapeXML(company.city)}</Comune><Provincia>${escapeXML(company.province.toUpperCase())}</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore><CessionarioCommittente><DatiAnagrafici>${customer.piva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(customer.piva)}</IdCodice></IdFiscaleIVA>` : ''}${customer.codiceFiscale ? `<CodiceFiscale>${escapeXML(customer.codiceFiscale)}</CodiceFiscale>` : ''}<Anagrafica><Denominazione>${escapeXML(customer.name)}</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>${escapeXML(customer.address)}</Indirizzo><CAP>${escapeXML(customer.cap)}</CAP><Comune>${escapeXML(customer.comune)}</Comune><Provincia>${escapeXML(customer.provincia.toUpperCase())}</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${tipoDocumento}</TipoDocumento><Divisa>EUR</Divisa><Data>${invoice.date}</Data><Numero>${escapeXML(invoice.number)}</Numero>${invoice.importoBollo > 0 ? `<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>${invoice.importoBollo.toFixed(2)}</ImportoBollo></DatiBollo>` : ''}<ImportoTotaleDocumento>${invoice.total.toFixed(2)}</ImportoTotaleDocumento>${invoice.rivalsa && invoice.rivalsa.importo > 0 ? `<DatiCassaPrevidenziale><TipoCassa>TC22</TipoCassa><AlCassa>${invoice.rivalsa.aliquota.toFixed(2)}</AlCassa><ImportoContributoCassa>${invoice.rivalsa.importo.toFixed(2)}</ImportoContributoCassa><ImponibileCassa>${invoice.totalePrestazioni.toFixed(2)}</ImponibileCassa><AliquotaIVA>0.00</AliquotaIVA><Natura>N4</Natura></DatiCassaPrevidenziale>` : ''}${causale}</DatiGeneraliDocumento>${datiFattureCollegate}</DatiGenerali><DatiBeniServizi>`;
        let lineNumber = 1; invoice.lines.forEach(line => { xml += `<DettaglioLinee><NumeroLinea>${lineNumber++}</NumeroLinea><Descrizione>${escapeXML(line.productName)}</Descrizione>${line.qty ? `<Quantita>${line.qty.toFixed(2)}</Quantita>`: ''}<PrezzoUnitario>${line.price.toFixed(2)}</PrezzoUnitario><PrezzoTotale>${line.subtotal.toFixed(2)}</PrezzoTotale><AliquotaIVA>${parseFloat(line.iva).toFixed(2)}</AliquotaIVA>${line.iva == "0" && line.esenzioneIva ? `<Natura>${escapeXML(line.esenzioneIva)}</Natura>` : ''}</DettaglioLinee>`; });
        xml += `${riepilogoXml}</DatiBeniServizi><DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento>${(company.nome && company.cognome) ? `<Beneficiario>${escapeXML(company.nome + ' ' + company.cognome)}</Beneficiario>` : ''}<ModalitaPagamento>MP05</ModalitaPagamento>${invoice.dataScadenza ? `<DataScadenzaPagamento>${invoice.dataScadenza}</DataScadenzaPagamento>`: ''}<ImportoPagamento>${invoice.total.toFixed(2)}</ImportoPagamento>${company.banca ? `<IstitutoFinanziario>${escapeXML(company.banca)}</IstitutoFinanziario>`: ''}${company.iban ? `<IBAN>${escapeXML(company.iban)}</IBAN>`: ''}</DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>`;
        const fileNameProgressive = (Math.random().toString(36) + '00000').slice(2, 7);
        const a = document.createElement('a'); a.download = `IT${company.piva}_${fileNameProgressive}.xml`;
        const blob = new Blob([xml], { type: 'application/xml' });
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
    }
});