// CONFIGURAZIONE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCuGd5MSKdixcMYOYullnyam6Pj1D9tNbM",
  authDomain: "fprf-6c080.firebaseapp.com",
  projectId: "fprf-6c080",
  storageBucket: "fprf-6c080.firebasestorage.app",
  messagingSenderId: "406236428222",
  appId: "1:406236428222:web:3be6b3b8530ab20ba36bef"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variabili Globali per mantenere i dati in memoria (Cache)
let globalData = {
    companyInfo: {},
    products: [],
    customers: [],
    invoices: [],
    notes: []
};

let currentUser = null;
let dateTimeInterval = null;

$(document).ready(function() {

    // --- GESTIONE AUTENTICAZIONE ---
    
    // Controlla se l'utente è già loggato
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none'); // Mostra caricamento
            
            try {
                await loadAllDataFromCloud(); // Carica tutto dal Cloud
                $('#loading-screen').addClass('d-none');
                $('#main-app').removeClass('d-none');
                initializeApp();
            } catch (error) {
                console.error("Errore caricamento dati:", error);
                alert("Errore di connessione al database.");
                $('#loading-screen').addClass('d-none');
            }
        } else {
            currentUser = null;
            $('#main-app').addClass('d-none');
            $('#loading-screen').addClass('d-none');
            $('#login-container').removeClass('d-none');
        }
    });

    // Login Form Submit
    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        const email = $('#email').val();
        const password = $('#password').val();
        
        $('#btn-login-submit').prop('disabled', true);
        $('#login-spinner').removeClass('d-none');
        $('#login-error').addClass('d-none');

        auth.signInWithEmailAndPassword(email, password)
            .catch((error) => {
                console.error("Login error:", error);
                $('#login-error').text("Email o password errati.").removeClass('d-none');
                $('#btn-login-submit').prop('disabled', false);
                $('#login-spinner').addClass('d-none');
            });
    });

    // Logout
    $('#logout-btn').on('click', function(e) {
        e.preventDefault();
        auth.signOut().then(() => {
            location.reload();
        });
    });

    // --- GESTIONE DATI (CLOUD + CACHE) ---

    async function loadAllDataFromCloud() {
        // Carica Azienda (Documento singolo)
        const companyDoc = await db.collection('settings').doc('companyInfo').get();
        if (companyDoc.exists) globalData.companyInfo = companyDoc.data();

        // Carica Collezioni
        const collections = ['products', 'customers', 'invoices', 'notes'];
        for (const col of collections) {
            const snapshot = await db.collection(col).get();
            globalData[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        console.log("Dati caricati dal cloud:", globalData);
    }

    // Funzioni Helper per accedere ai dati (compatibili col vecchio codice)
    function getData(key) {
        return globalData[key] || [];
    }
    
    // Funzione di salvataggio CLOUD (sostituisce localStorage)
    async function saveDataToCloud(collection, dataObj, id = null) {
        try {
            if (collection === 'companyInfo') {
                await db.collection('settings').doc('companyInfo').set(dataObj);
                globalData.companyInfo = dataObj;
            } else {
                // Per array (prodotti, clienti, fatture)
                if (id) {
                    // Update o Create con ID specifico
                    await db.collection(collection).doc(String(id)).set(dataObj, { merge: true });
                    // Aggiorna Cache locale
                    const index = globalData[collection].findIndex(item => item.id == id);
                    if (index > -1) {
                         globalData[collection][index] = { ...globalData[collection][index], ...dataObj };
                    } else {
                         globalData[collection].push({ id: id, ...dataObj });
                    }
                } else {
                    // Create nuovo (lasciamo generare ID a Firebase se non specificato, ma qui usiamo i nostri ID)
                    console.error("ID mancante per il salvataggio");
                }
            }
        } catch (e) {
            console.error("Errore salvataggio Cloud:", e);
            alert("Errore durante il salvataggio online: " + e.message);
        }
    }

    async function deleteDataFromCloud(collection, id) {
        if (confirm("Sei sicuro di voler eliminare questo elemento?")) {
            try {
                await db.collection(collection).doc(String(id)).delete();
                // Aggiorna cache
                globalData[collection] = globalData[collection].filter(item => item.id != id);
                renderAll();
            } catch (e) {
                alert("Errore eliminazione: " + e.message);
            }
        }
    }

    // --- FUNZIONI DI UTILITÀ UI ---

    function formatDateForDisplay(dateString) {
        if (!dateString) return '-';
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString; 
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    function escapeXML(str) { 
        if (typeof str !== 'string') return ''; 
        return str.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]); 
    }

    function getNextId(items) { 
        if (!items || items.length === 0) return 1;
        // Filtra solo ID numerici se ci sono stringhe strane
        const numericIds = items.map(i => parseInt(i.id)).filter(id => !isNaN(id));
        return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1; 
    }

    // --- UI RENDERING E LOGICA APPLICAZIONE ---

    function initializeApp() { 
        // Navigazione iniziale
        $('.content-section').addClass('d-none'); 
        $('#home').removeClass('d-none'); 
        $('.sidebar .nav-link').removeClass('active'); 
        $('.sidebar .nav-link[data-target="home"]').addClass('active'); 
        renderAll(); 
    }

    function renderAll() {
        renderCompanyInfoForm(); 
        updateCompanyUI(); 
        renderProductsTable(); 
        renderCustomersTable(); 
        // Users table rimossa (gestita da Firebase Auth)
        renderInvoicesTable();
        populateDropdowns(); 
        renderStatisticsPage();
        renderHomePage();
        // Menu visibility: ora basata sull'email
        if(currentUser && currentUser.email !== 'admin@gestionale.it') {
             // Esempio: nascondi menu per utenti non admin se necessario
        }
    }

    function updateCompanyUI() { 
        const company = getData('companyInfo'); 
        if(company.name) $('#company-name-sidebar').text(company.name);
        if(currentUser) $('#user-name-sidebar').text(currentUser.email);
    }

    // --- RENDER FUNZIONI ---
    function renderCompanyInfoForm() { const company = getData('companyInfo'); for (const key in company) { $(`#company-${key}`).val(company[key]); } }
    
    function renderProductsTable() { const products = getData('products'); const tableBody = $('#products-table-body').empty(); products.forEach(p => { const salePrice = p.salePrice ? `€ ${parseFloat(p.salePrice).toFixed(2)}` : '-'; const ivaText = (p.iva == 0 && p.esenzioneIva) ? `0% (${p.esenzioneIva})` : `${p.iva}%`; tableBody.append(`<tr><td>${p.code}</td><td>${p.description}</td><td class="text-end-numbers pe-5">${salePrice}</td><td class="text-end-numbers">${ivaText}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); }); }
    
    function renderCustomersTable() { const customers = getData('customers'); const tableBody = $('#customers-table-body').empty(); customers.forEach(c => { const pivaCf = c.piva || c.codiceFiscale || '-'; const fullAddress = `${c.address || ''}, ${c.cap || ''} ${c.comune || ''} (${c.provincia || ''})`; tableBody.append(`<tr><td>${c.name}</td><td>${pivaCf}</td><td>${c.sdi || '-'}</td><td>${fullAddress}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); }); }
    
    function renderInvoicesTable() {
        const invoices = getData('invoices'); const customers = getData('customers'); const tableBody = $('#invoices-table-body').empty();
        
        // Ordinamento per Numero (Decrescente)
        invoices.sort((a, b) => {
            const numA = a.number || ''; const numB = b.number || '';
            return numB.localeCompare(numA);
        });

        invoices.forEach(inv => {
            const customer = customers.find(c => c.id == inv.customerId) || { name: 'Sconosciuto' }; 
            const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
            
            let statusBadge = `<span class="badge bg-warning text-dark">Da Incassare</span>`;
            if (inv.type === 'Nota di Credito') {
                statusBadge = isPaid ? `<span class="badge bg-info text-dark">Emessa</span>` : `<span class="badge bg-secondary">Bozza</span>`;
            } else {
                statusBadge = isPaid ? `<span class="badge bg-success">Pagata</span>` : `<span class="badge bg-warning text-dark">Da Incassare</span>`;
            }
            const docTypeBadge = inv.type === 'Nota di Credito' ? `<span class="badge bg-warning text-dark">NdC</span>` : `<span class="badge bg-primary">Fatt.</span>`;

            // Azioni
            const btnDetails = `<button class="btn btn-sm btn-info btn-view-invoice" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Dettagli"><i class="fas fa-eye"></i></button>`;
            const btnEdit = `<button class="btn btn-sm btn-secondary btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${isPaid ? 'disabled' : ''}><i class="fas fa-edit"></i></button>`;
            const btnXml = `<button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="Esporta XML"><i class="fas fa-file-code"></i></button>`;
            const payLabel = inv.type === 'Nota di Credito' ? 'Segna come Emessa' : 'Segna come Pagata';
            const payClass = isPaid ? 'btn-secondary' : 'btn-success';
            const btnPay = `<button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="${payLabel}" ${isPaid ? 'disabled' : ''}><i class="fas fa-check"></i></button>`;
            const btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina"><i class="fas fa-trash"></i></button>`;

            const actions = `<div class="d-flex justify-content-end gap-1">${btnDetails}${btnEdit}${btnXml}${btnPay}${btnDelete}</div>`;
            const rowClass = isPaid ? 'class="invoice-paid"' : '';
            tableBody.append(`<tr ${rowClass}><td>${docTypeBadge}</td><td>${inv.number}</td><td>${formatDateForDisplay(inv.date)}</td><td>${customer.name}</td><td class="text-end-numbers pe-5">€ ${inv.total.toFixed(2)}</td><td class="text-end-numbers">${formatDateForDisplay(inv.dataScadenza)}</td><td>${statusBadge}</td><td class="text-end">${actions}</td></tr>`);
        });
    }

    // --- GESTIONE INTERFACCIA ---
    $('.sidebar .nav-link').on('click', function(e) { 
        if ($(this).attr('id') === 'logout-btn' || $(this).data('bs-toggle') === 'modal') return; 
        e.preventDefault(); 
        const target = $(this).data('target');
        
        if (target === 'nuova-fattura-accompagnatoria') {
            if ($(this).attr('id') === 'menu-nuova-nota-credito') { prepareDocumentForm('Nota di Credito'); } else { return; }
        }
        if (target === 'statistiche') { renderStatisticsPage(); }
        
        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active');
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none'); 
    });

    // --- SALVATAGGIO DATI (FORM SUBMIT) ---
    $('#company-info-form').on('submit', async function(e) { 
        e.preventDefault(); 
        const companyInfo = {}; 
        $(this).find('input, select').each(function() { const id = $(this).attr('id'); if (id) { const key = id.replace('company-', ''); companyInfo[key] = $(this).val(); } }); 
        await saveDataToCloud('companyInfo', companyInfo); 
        alert("Dati azienda salvati nel Cloud!"); updateCompanyUI(); 
    });

    // --- PRODOTTI E CLIENTI (CRUD) ---
    function prepareNewItemModal(type) { const form = $(`#${type}Form`); if (form.length) form[0].reset(); $(`#${type}-id`).val(''); const titleText = (type === 'product') ? 'Servizio/Prodotto' : type.charAt(0).toUpperCase() + type.slice(1); $(`#${type}ModalTitle`).text(`Nuovo ${titleText}`); if (type === 'product') { $('#product-iva').val('0'); $('#product-esenzioneIva').val('N2.2'); toggleEsenzioneIvaField('product', '0'); } }
    function editItem(type, id) { const items = getData(`${type}s`); const item = items.find(i => i.id == id); if (!item) return; prepareNewItemModal(type); $(`#${type}ModalTitle`).text(`Modifica`); for (const key in item) { const field = $(`#${type}-${key}`); if (field.is(':checkbox')) { field.prop('checked', item[key]); } else if (field.length) { field.val(item[key]); } } if (type === 'product') { toggleEsenzioneIvaField('product', item.iva); } $(`#${type}-id`).val(item.id); $(`#${type}Modal`).modal('show'); }
    
    function toggleEsenzioneIvaField(container, ivaValue) { const esenzioneContainer = (container === 'product') ? $('#esenzione-iva-container') : $('#invoice-esenzione-iva-container'); if (ivaValue == '0') { esenzioneContainer.removeClass('d-none'); } else { esenzioneContainer.addClass('d-none'); } }
    $('#product-iva').on('change', function() { toggleEsenzioneIvaField('product', $(this).val()); });
    $('#invoice-product-iva').on('change', function() { toggleEsenzioneIvaField('invoice', $(this).val()); });

    ['product', 'customer'].forEach(type => {
        $(`#new${type.charAt(0).toUpperCase() + type.slice(1)}Btn`).on('click', function() { prepareNewItemModal(type); });
        $(`#save${type.charAt(0).toUpperCase() + type.slice(1)}Btn`).on('click', async function() { 
            const typePlural = `${type}s`; 
            let items = getData(typePlural); 
            const idInput = $(`#${type}-id`).val(); 
            let itemData = {}; 
            $(`#${type}Form`).find('input, select').each(function() { const field = $(this); const fieldId = field.attr('id'); if (fieldId) { const key = fieldId.replace(`${type}-`, ''); itemData[key] = field.is(':checkbox') ? field.is(':checked') : field.val(); } }); 
            
            let id = idInput;
            if (!id) { id = (type === 'product') ? 'PRD' + new Date().getTime() : String(getNextId(items)); }
            
            await saveDataToCloud(typePlural, itemData, id);
            $(`#${type}Modal`).modal('hide'); 
            renderAll(); 
        });
        $(`#${type}s-table-body`).on('click', `.btn-edit-${type}`, function() { editItem(type, $(this).data('id')); });
        $(`#${type}s-table-body`).on('click', `.btn-delete-${type}`, function() { deleteDataFromCloud(`${type}s`, $(this).data('id')); });
    });

    // --- FATTURE ---
    let currentInvoiceLines = [];
    function generateNextDocumentNumber(type, year) { const invoices = getData('invoices'); const prefix = type === 'Fattura' ? 'FATT' : 'NC'; const documentsForYear = invoices.filter(inv => inv.type === type && inv.date.substring(0, 4) === String(year)); if (documentsForYear.length === 0) { return 1; } else { const lastNumbers = documentsForYear.map(inv => { const parts = inv.number.split('-'); const numPart = parts[parts.length - 1]; return parseInt(numPart, 10) || 0; }); return Math.max(...lastNumbers) + 1; } }
    function updateInvoiceNumber() { if ($('#editing-invoice-id').val()) return; const dateStr = $('#invoice-date').val(); if (!dateStr) return; const year = dateStr.substring(0, 4); const type = $('#document-type').val(); const prefix = type === 'Fattura' ? 'FATT' : 'NC'; const nextNumber = generateNextDocumentNumber(type, year); const paddedNumber = String(nextNumber).padStart(2, '0'); $('#invoice-number').val(`${prefix}-${year}-${paddedNumber}`); }
    function renderInvoiceLines() { const tbody = $('#invoice-lines-tbody').empty(); let total = 0; currentInvoiceLines.forEach((line, index) => { tbody.append(`<tr><td>${line.productName}</td><td class="text-end-numbers">${line.qty}</td><td class="text-end-numbers">€ ${line.price.toFixed(2)}</td><td class="text-end-numbers">€ ${line.subtotal.toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-danger remove-invoice-line" data-index="${index}"><i class="fas fa-times"></i></button></td></tr>`); total += line.subtotal; }); $('#invoice-total').text(`€ ${total.toFixed(2)}`); }
    
    // Autocomplete Nota Credito
    $('#linked-invoice').on('change', function() {
        const linkedNumber = $(this).val().trim();
        const sourceInvoice = getData('invoices').find(inv => inv.number === linkedNumber);
        if(sourceInvoice && confirm(`Trovata fattura ${sourceInvoice.number}. Importare dati?`)) {
            $('#invoice-customer-select').val(sourceInvoice.customerId);
            currentInvoiceLines = JSON.parse(JSON.stringify(sourceInvoice.lines)); renderInvoiceLines();
            $('#invoice-condizioniPagamento').val(sourceInvoice.condizioniPagamento);
            $('#invoice-modalitaPagamento').val(sourceInvoice.modalitaPagamento);
            if(!$('#reason').val()) $('#reason').val(`Storno totale fattura n. ${sourceInvoice.number} del ${formatDateForDisplay(sourceInvoice.date)}`);
        }
    });

    $('#invoice-product-select').on('change', function() { const productId = $(this).val(); const p = getData('products').find(p => p.id === productId); if(productId === 'manual') { $('#invoice-product-description').val('').prop('readonly',false).focus(); $('#invoice-product-price').val(''); $('#invoice-product-iva').prop('disabled',false).val('0'); toggleEsenzioneIvaField('invoice','0'); } else if(p) { $('#invoice-product-description').val(p.description).prop('readonly',true); $('#invoice-product-price').val(p.salePrice); $('#invoice-product-iva').val(p.iva).prop('disabled',true); $('#invoice-product-esenzioneIva').val(p.esenzioneIva); toggleEsenzioneIvaField('invoice', p.iva); } });
    $('#add-product-to-invoice-btn').on('click', function() { 
        const desc = $('#invoice-product-description').val(); const qty = parseInt($('#invoice-product-qty').val()); const price = parseFloat($('#invoice-product-price').val()); 
        if(!desc || !qty || isNaN(price)) return;
        const line = { productName: desc, qty: qty, price: price, subtotal: qty*price, iva: $('#invoice-product-iva').val(), esenzioneIva: $('#invoice-product-esenzioneIva').val() };
        currentInvoiceLines.push(line); renderInvoiceLines();
    });
    $('#invoice-lines-tbody').on('click', '.remove-invoice-line', function() { currentInvoiceLines.splice($(this).data('index'), 1); renderInvoiceLines(); });
    $('#invoice-date').on('change', function() { $('#invoice-dataRiferimento').val($(this).val()); updateInvoiceNumber(); });

    $('#new-invoice-form').on('submit', async function(e) {
        e.preventDefault();
        const editingId = $('#editing-invoice-id').val();
        const customerId = $('#invoice-customer-select').val();
        if (!customerId || currentInvoiceLines.length === 0) { alert("Dati incompleti."); return; }
        
        const customer = getData('customers').find(c => c.id == customerId); 
        const company = getData('companyInfo');
        const docType = $('#document-type').val();
        
        // Calcoli
        const bolloDescription = 'rivalsa bollo';
        const righePrestazioni = currentInvoiceLines.filter(line => line.productName.toLowerCase() !== bolloDescription);
        const rigaBollo = currentInvoiceLines.find(line => line.productName.toLowerCase() === bolloDescription);
        const importoBollo = rigaBollo ? parseFloat(rigaBollo.price) : 0;
        const totalePrestazioni = righePrestazioni.reduce((sum, line) => sum + line.subtotal, 0);
        
        let rivalsa = {};
        if (customer && customer.rivalsaInps) {
            const aliq = parseFloat(company.aliquotaInps || 0);
            rivalsa = { aliquota: aliq, importo: totalePrestazioni * (aliq / 100) };
        }
        const totaleImponibile = totalePrestazioni + (rivalsa.importo || 0);
        const totaleDocumento = totaleImponibile + importoBollo;

        const invoiceData = {
            type: docType,
            number: $('#invoice-number').val(),
            date: $('#invoice-date').val(),
            customerId: customerId,
            lines: currentInvoiceLines,
            rivalsa: rivalsa,
            importoBollo: importoBollo,
            totalePrestazioni: totalePrestazioni,
            totaleImponibile: totaleImponibile,
            totaleIva: 0,
            total: totaleDocumento,
            condizioniPagamento: $('#invoice-condizioniPagamento').val(),
            modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            dataScadenza: $('#invoice-dataScadenza').val() || $('#invoice-date').val(),
            status: docType === 'Fattura' ? 'Da Incassare' : 'Emessa',
            linkedInvoice: docType === 'Nota di Credito' ? $('#linked-invoice').val() : '',
            reason: docType === 'Nota di Credito' ? $('#reason').val() : ''
        };

        let id = editingId;
        if (!id) {
            id = String(getNextId(getData('invoices')));
        } else {
            // Mantieni status se in modifica
            const oldInv = getData('invoices').find(i => i.id == id);
            if(oldInv) invoiceData.status = oldInv.status;
        }

        await saveDataToCloud('invoices', invoiceData, id);
        alert(`${docType} salvata!`);
        resetInvoiceForm(); 
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    function prepareDocumentForm(type) { $('#new-invoice-form')[0].reset(); currentInvoiceLines = []; renderInvoiceLines(); $('#editing-invoice-id').val(''); $('#document-type').val(type); populateDropdowns(); if (type === 'Nota di Credito') { $('#credit-note-fields').removeClass('d-none'); $('#document-title').text('Nuova Nota di Credito'); } else { $('#credit-note-fields').addClass('d-none'); $('#document-title').text('Nuova Fattura'); } }
    function resetInvoiceForm() { prepareDocumentForm('Fattura'); }
    function populateDropdowns() {
        $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona...</option>').append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
        $('#invoice-product-select').empty().append('<option selected value="">Seleziona...</option><option value="manual">Manuale</option>').append(getData('products').map(p => `<option value="${p.id}">${p.code}</option>`));
        if(!$('#editing-invoice-id').val()) { $('#invoice-date').val(new Date().toISOString().slice(0, 10)); updateInvoiceNumber(); }
    }

    // Edit & Delete & Pay Invoice
    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).data('id'); const inv = getData('invoices').find(i => i.id == id); 
        if(!inv) return; 
        prepareDocumentForm(inv.type || 'Fattura');
        $('#editing-invoice-id').val(inv.id); $('#invoice-customer-select').val(inv.customerId); $('#invoice-date').val(inv.date); $('#invoice-number').val(inv.number);
        currentInvoiceLines = JSON.parse(JSON.stringify(inv.lines)); renderInvoiceLines();
        $('.content-section').addClass('d-none'); $('#nuova-fattura-accompagnatoria').removeClass('d-none');
    });
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { deleteDataFromCloud('invoices', $(this).data('id')); });
    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).data('id'); const inv = getData('invoices').find(i => i.id == id);
        if(confirm("Segnare come pagata/emessa?")) {
            const newStatus = inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata';
            await saveDataToCloud('invoices', { status: newStatus }, id);
            renderInvoicesTable();
        }
    });

    // --- HOME & NOTES ---
    function renderHomePage() { if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); loadUserNotes(); }
    function loadUserNotes() { const notes = getData('notes').find(n => n.userId === currentUser.uid); if(notes) $('#notes-textarea').val(notes.text); }
    $('#save-notes-btn').on('click', async function() { 
        const text = $('#notes-textarea').val(); 
        await saveDataToCloud('notes', { userId: currentUser.uid, text: text }, currentUser.uid); // Usa UID utente come ID nota
        alert("Note salvate!");
    });

    // --- IMPORTAZIONE DATI (MIGRAZIONE) ---
    $('#import-file-input').on('change', function(event) {
        const file = event.target.files[0]; if (!file) return;
        if (confirm("Vuoi migrare i dati da questo file al Cloud?")) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    // Importa Azienda
                    if (data.companyInfo) await saveDataToCloud('companyInfo', data.companyInfo);
                    // Importa collezioni
                    if (data.customers) for (let c of data.customers) await saveDataToCloud('customers', c, c.id);
                    if (data.products) for (let p of data.products) await saveDataToCloud('products', p, p.id);
                    if (data.invoices) for (let i of data.invoices) await saveDataToCloud('invoices', i, i.id);
                    
                    alert("Migrazione completata! I dati sono ora su Firebase.");
                    location.reload();
                } catch (err) { alert("Errore importazione: " + err.message); }
            };
            reader.readAsText(file);
        }
    });
    
    // --- XML EXPORT ---
    // (Mantenuta identica alla v6.7, usa generateInvoiceXML)
     $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { 
         let invoiceId; 
         if ($(this).attr('id') === 'export-xml-btn') { invoiceId = $('#export-xml-btn').data('invoiceId'); } 
         else { invoiceId = $(this).data('id'); } 
         if (invoiceId) { generateInvoiceXML(invoiceId); } 
    });

    function generateInvoiceXML(invoiceId) {
        // ... (Codice XML identico alla v6.7, copiato per brevità o incluso qui se necessario)
        const invoice = getData('invoices').find(inv => inv.id == invoiceId); if (!invoice) { alert("Errore!"); return; }
        const company = getData('companyInfo'); const customer = getData('customers').find(c => c.id == invoice.customerId);
        // ... Logica XML standard ...
        let xml = `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica ...>`; // Placeholder per la funzione completa
        // (Nota: Se serve, reincollo la funzione XML completa qui, ma è lunga 50 righe)
        // Per ora la funzione reale deve essere presente nel codice finale.
        
        // REINSERIMENTO FUNZIONE XML COMPLETA PER SICUREZZA
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
        let datiFattureCollegate = ''; if (invoice.type === 'Nota di Credito' && invoice.linkedInvoice) { datiFattureCollegate = `<DatiFattureCollegate><IdDocumento>${escapeXML(invoice.linkedInvoice)}</IdDocumento></DatiFattureCollegate>`; }
        let causale = invoice.reason ? `<Causale>${escapeXML(invoice.reason)}</Causale>` : '';
        xml = `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.codiceFiscale)}</IdCodice></IdTrasmittente><ProgressivoInvio>${progressivoInvio}</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>${escapeXML(customer.sdi || '0000000')}</CodiceDestinatario></DatiTrasmissione><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.piva)}</IdCodice></IdFiscaleIVA><CodiceFiscale>${escapeXML(company.codiceFiscale)}</CodiceFiscale>${anagraficaCedente}<RegimeFiscale>${escapeXML(company.codiceRegimeFiscale)}</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>${escapeXML(company.address)}</Indirizzo>${company.numeroCivico ? `<NumeroCivico>${escapeXML(company.numeroCivico)}</NumeroCivico>` : ''}<CAP>${escapeXML(company.zip)}</CAP><Comune>${escapeXML(company.city)}</Comune><Provincia>${escapeXML(company.province.toUpperCase())}</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore><CessionarioCommittente><DatiAnagrafici>${customer.piva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(customer.piva)}</IdCodice></IdFiscaleIVA>` : ''}${customer.codiceFiscale ? `<CodiceFiscale>${escapeXML(customer.codiceFiscale)}</CodiceFiscale>` : ''}<Anagrafica><Denominazione>${escapeXML(customer.name)}</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>${escapeXML(customer.address)}</Indirizzo><CAP>${escapeXML(customer.cap)}</CAP><Comune>${escapeXML(customer.comune)}</Comune><Provincia>${escapeXML(customer.provincia.toUpperCase())}</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${tipoDocumento}</TipoDocumento><Divisa>EUR</Divisa><Data>${invoice.date}</Data><Numero>${escapeXML(invoice.number)}</Numero>${invoice.importoBollo > 0 ? `<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>${invoice.importoBollo.toFixed(2)}</ImportoBollo></DatiBollo>` : ''}<ImportoTotaleDocumento>${invoice.total.toFixed(2)}</ImportoTotaleDocumento>${invoice.rivalsa && invoice.rivalsa.importo > 0 ? `<DatiCassaPrevidenziale><TipoCassa>TC22</TipoCassa><AlCassa>${invoice.rivalsa.aliquota.toFixed(2)}</AlCassa><ImportoContributoCassa>${invoice.rivalsa.importo.toFixed(2)}</ImportoContributoCassa><ImponibileCassa>${invoice.totalePrestazioni.toFixed(2)}</ImponibileCassa><AliquotaIVA>0.00</AliquotaIVA><Natura>N4</Natura></DatiCassaPrevidenziale>` : ''}${causale}</DatiGeneraliDocumento>${datiFattureCollegate}</DatiGenerali><DatiBeniServizi>`;
        let lineNumber = 1; invoice.lines.forEach(line => { xml += `<DettaglioLinee><NumeroLinea>${lineNumber++}</NumeroLinea><Descrizione>${escapeXML(line.productName)}</Descrizione>${line.qty ? `<Quantita>${line.qty.toFixed(2)}</Quantita>`: ''}<PrezzoUnitario>${line.price.toFixed(2)}</PrezzoUnitario><PrezzoTotale>${line.subtotal.toFixed(2)}</PrezzoTotale><AliquotaIVA>${parseFloat(line.iva).toFixed(2)}</AliquotaIVA>${line.iva == "0" && line.esenzioneIva ? `<Natura>${escapeXML(line.esenzioneIva)}</Natura>` : ''}</DettaglioLinee>`; });
        xml += `${riepilogoXml}</DatiBeniServizi><DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento>${(company.nome && company.cognome) ? `<Beneficiario>${escapeXML(company.nome + ' ' + company.cognome)}</Beneficiario>` : ''}<ModalitaPagamento>MP05</ModalitaPagamento>${invoice.dataScadenza ? `<DataScadenzaPagamento>${invoice.dataScadenza}</DataScadenzaPagamento>`: ''}<ImportoPagamento>${invoice.total.toFixed(2)}</ImportoPagamento>${company.banca ? `<IstitutoFinanziario>${escapeXML(company.banca)}</IstitutoFinanziario>`: ''}${company.iban ? `<IBAN>${escapeXML(company.iban)}</IBAN>`: ''}</DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>`;
        const fileNameProgressive = (Math.random().toString(36) + '00000').slice(2, 7);
        const a = document.createElement('a'); a.download = `IT${company.piva}_${fileNameProgressive}.xml`; const blob = new Blob([xml], { type: 'application/xml' }); a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
    }
});