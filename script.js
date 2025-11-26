c:\Users\rober\Desktop\Esperimento\Etremo Fatt\Stabile\V 7.6 DA TESTARE_WEB\---script.js// CONFIGURAZIONE FIREBASE
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

// Variabili Globali
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

    // =========================================================
    // 1. FUNZIONI DI UTILITÀ
    // =========================================================

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
        // Filtra solo ID che sembrano numeri per calcolare il prossimo
        const numericIds = items.map(i => parseInt(i.id)).filter(id => !isNaN(id));
        return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1; 
    }

    function getData(key) {
        return globalData[key] || [];
    }

    // =========================================================
    // 2. GESTIONE DATI CLOUD
    // =========================================================

    async function loadAllDataFromCloud() {
        const companyDoc = await db.collection('settings').doc('companyInfo').get();
        if (companyDoc.exists) globalData.companyInfo = companyDoc.data();

        const collections = ['products', 'customers', 'invoices', 'notes'];
        for (const col of collections) {
            const snapshot = await db.collection(col).get();
            // Forziamo l'ID ad essere una stringa per evitare conflitti
            globalData[col] = snapshot.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
        }
        console.log("Dati sincronizzati:", globalData);
    }

    async function saveDataToCloud(collection, dataObj, id = null) {
        try {
            if (collection === 'companyInfo') {
                await db.collection('settings').doc('companyInfo').set(dataObj);
                globalData.companyInfo = dataObj;
            } else {
                if (id) {
                    const strId = String(id);
                    await db.collection(collection).doc(strId).set(dataObj, { merge: true });
                    const index = globalData[collection].findIndex(item => String(item.id) === strId);
                    if (index > -1) globalData[collection][index] = { ...globalData[collection][index], ...dataObj };
                    else globalData[collection].push({ id: strId, ...dataObj });
                } else {
                    console.error("ID mancante per il salvataggio");
                }
            }
        } catch (e) {
            console.error("Errore salvataggio Cloud:", e);
            alert("Errore Cloud: " + e.message);
        }
    }

    async function deleteDataFromCloud(collection, id) {
        if (confirm("Sei sicuro di voler eliminare questo elemento?")) {
            try {
                const strId = String(id);
                await db.collection(collection).doc(strId).delete();
                globalData[collection] = globalData[collection].filter(item => String(item.id) !== strId);
                renderAll(); // Ricarica le tabelle
            } catch (e) {
                alert("Errore eliminazione: " + e.message);
            }
        }
    }

    // =========================================================
    // 3. FUNZIONI DI RENDER
    // =========================================================

    function updateCompanyUI() { 
        const company = getData('companyInfo'); 
        if(company.name) $('#company-name-sidebar').text(company.name);
        if(currentUser) $('#user-name-sidebar').text(currentUser.email);
        $('#version-sidebar').text('v8.1 (Cloud Fix)');
    }

    function renderCompanyInfoForm() { 
        const company = getData('companyInfo'); 
        for (const key in company) { $(`#company-${key}`).val(company[key]); } 
    }
    
    function renderProductsTable() { 
        const products = getData('products'); 
        const tableBody = $('#products-table-body').empty(); 
        products.forEach(p => { 
            const salePrice = p.salePrice ? `€ ${parseFloat(p.salePrice).toFixed(2)}` : '-'; 
            const ivaText = (p.iva == 0 && p.esenzioneIva) ? `0% (${p.esenzioneIva})` : `${p.iva}%`; 
            // Nota: uso attr('data-id') invece di .data() per sicurezza con le stringhe
            tableBody.append(`<tr><td>${p.code}</td><td>${p.description}</td><td class="text-end-numbers pe-5">${salePrice}</td><td class="text-end-numbers">${ivaText}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
        }); 
    }
    
    function renderCustomersTable() { 
        const customers = getData('customers'); 
        const tableBody = $('#customers-table-body').empty(); 
        customers.forEach(c => { 
            const pivaCf = c.piva || c.codiceFiscale || '-'; 
            const fullAddress = `${c.address || ''}, ${c.cap || ''} ${c.comune || ''} (${c.provincia || ''})`; 
            tableBody.append(`<tr><td>${c.name}</td><td>${pivaCf}</td><td>${c.sdi || '-'}</td><td>${fullAddress}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
        }); 
    }
    
    function renderInvoicesTable() {
        const invoices = getData('invoices'); 
        const customers = getData('customers'); 
        const tableBody = $('#invoices-table-body').empty();
        
        invoices.sort((a, b) => {
            const numA = a.number || ''; const numB = b.number || '';
            return numB.localeCompare(numA);
        });

        invoices.forEach(inv => {
            const customer = customers.find(c => String(c.id) === String(inv.customerId)) || { name: 'Sconosciuto' }; 
            const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
            
            let statusBadge = `<span class="badge bg-warning text-dark">Da Incassare</span>`;
            if (inv.type === 'Nota di Credito') {
                statusBadge = isPaid ? `<span class="badge bg-info text-dark">Emessa</span>` : `<span class="badge bg-secondary">Bozza</span>`;
            } else {
                statusBadge = isPaid ? `<span class="badge bg-success">Pagata</span>` : `<span class="badge bg-warning text-dark">Da Incassare</span>`;
            }
            const docTypeBadge = inv.type === 'Nota di Credito' ? `<span class="badge bg-warning text-dark">NdC</span>` : `<span class="badge bg-primary">Fatt.</span>`;

            const btnDetails = `<button class="btn btn-sm btn-info btn-view-invoice" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Dettagli"><i class="fas fa-eye"></i></button>`;
            const btnEdit = `<button class="btn btn-sm btn-secondary btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${isPaid ? 'disabled' : ''}><i class="fas fa-edit"></i></button>`;
            const btnXml = `<button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="Esporta XML"><i class="fas fa-file-code"></i></button>`;
            const payLabel = inv.type === 'Nota di Credito' ? 'Segna come Emessa' : 'Segna come Pagata';
            const payClass = isPaid ? 'btn-secondary' : 'btn-success';
            const payAttr = isPaid ? 'disabled' : '';
            const btnPay = `<button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="${payLabel}" ${payAttr}><i class="fas fa-check"></i></button>`;
            let btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina"><i class="fas fa-trash"></i></button>`;

            const actions = `<div class="d-flex justify-content-end gap-1">${btnDetails}${btnEdit}${btnXml}${btnPay}${btnDelete}</div>`;
            tableBody.append(`<tr><td>${docTypeBadge}</td><td>${inv.number}</td><td>${formatDateForDisplay(inv.date)}</td><td>${customer.name}</td><td class="text-end-numbers pe-5">€ ${inv.total.toFixed(2)}</td><td class="text-end-numbers">${formatDateForDisplay(inv.dataScadenza)}</td><td>${statusBadge}</td><td class="text-end">${actions}</td></tr>`);
        });
    }

    // --- RENDER PAGINE SECONDARIE (STATISTICHE, HOME, ETC) ---

    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty(); 
        const invoices = getData('invoices'); 
        const customers = getData('customers');
        const fakture = invoices.filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '');
        const noteCredito = invoices.filter(i => i.type === 'Nota di Credito');

        if (fakture.length === 0) { 
            container.html('<div class="alert alert-info">Non ci sono ancora fatture per generare statistiche.</div>'); 
            renderTaxSimulation(); 
            return; 
        }
        
        const grandTotal = fakture.reduce((sum, inv) => sum + inv.total, 0); 
        const totalCreditNotes = noteCredito.reduce((sum, inv) => sum + inv.total, 0);
        const netTotal = grandTotal - totalCreditNotes;

        let customerTotals = {}; 
        fakture.forEach(inv => { if (!customerTotals[inv.customerId]) customerTotals[inv.customerId] = 0; customerTotals[inv.customerId] += inv.total; });
        noteCredito.forEach(inv => { if (customerTotals[inv.customerId]) customerTotals[inv.customerId] -= inv.total; });

        let tableHtml = `<table class="table table-hover"><thead><tr><th>Cliente</th><th class="text-end-numbers">Fatturato Netto</th><th class="text-end-numbers">% sul Totale</th></tr></thead><tbody>`;
        const sortedCustomerIds = Object.keys(customerTotals).sort((a, b) => customerTotals[b] - customerTotals[a]);
        for (const customerId of sortedCustomerIds) { 
            const customer = customers.find(c => String(c.id) === String(customerId)) || { name: 'Cliente Eliminato' }; 
            const total = customerTotals[customerId]; 
            const percentage = netTotal > 0 ? (total / netTotal) * 100 : 0; 
            tableHtml += `<tr><td>${customer.name}</td><td class="text-end-numbers">€ ${total.toFixed(2)}</td><td class="text-end-numbers">${percentage.toFixed(2)}%</td></tr>`; 
        }
        tableHtml += `</tbody><tfoot><tr class="table-group-divider fw-bold"><td>Totale Generale Netto</td><td class="text-end-numbers">€ ${netTotal.toFixed(2)}</td><td class="text-end-numbers">100.00%</td></tr></tfoot></table>`;
        container.html(tableHtml);
        renderTaxSimulation();
    }

    function renderTaxSimulation() {
        const container = $('#tax-simulation-container').empty(); 
        const invoices = getData('invoices'); 
        const company = getData('companyInfo');
        
        const coeff = parseFloat(company.coefficienteRedditivita); 
        const taxRate = parseFloat(company.aliquotaSostitutiva);
        const socialSecurityRate = parseFloat(company.aliquotaContributi);
        
        let warningHtml = `<div class="alert alert-warning small"><i class="fas fa-exclamation-triangle me-2"></i><strong>ATTENZIONE:</strong> Stima didattica.</div>`;
        
        if (!coeff || !taxRate || !socialSecurityRate) { 
            container.html(warningHtml + '<div class="alert alert-danger">Dati fiscali mancanti in Anagrafica Azienda.</div>'); 
            return; 
        }
        
        const fatturato = invoices.filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '').reduce((sum, inv) => sum + inv.totaleImponibile, 0);
        const noteCredito = invoices.filter(i => i.type === 'Nota di Credito').reduce((sum, inv) => sum + inv.totaleImponibile, 0);
        const grossRevenue = fatturato - noteCredito;
        const taxableGross = grossRevenue > 0 ? grossRevenue * (coeff / 100) : 0;
        const totalSocialSecurityDue = taxableGross > 0 ? taxableGross * (socialSecurityRate / 100) : 0;
        
        let socialFirstAdvance = totalSocialSecurityDue > 0 ? totalSocialSecurityDue * 0.40 : 0;
        let socialSecondAdvance = totalSocialSecurityDue > 0 ? totalSocialSecurityDue * 0.40 : 0;
        const netTaxable = taxableGross > 0 ? taxableGross - totalSocialSecurityDue : 0; 
        const totalTaxDue = netTaxable > 0 ? netTaxable * (taxRate / 100) : 0;
        let taxFirstAdvance = totalTaxDue >= 257.52 ? totalTaxDue * 0.50 : 0;
        let taxSecondAdvance = totalTaxDue >= 257.52 ? totalTaxDue * 0.50 : 0;
        const totalDue = totalSocialSecurityDue + totalTaxDue;
        
        let resultHtml = `<div class="row"><div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-header fw-bold">Simulazione Contributi INPS</div><div class="card-body"><dl class="row mb-0"><dt class="col-sm-6">Reddito Lordo Imponibile</dt><dd class="col-sm-6 text-end">€ ${taxableGross.toFixed(2)}</dd><dt class="col-sm-6">Aliquota Contributi INPS</dt><dd class="col-sm-6 text-end">${socialSecurityRate}%</dd><dt class="col-sm-6 h5 text-primary border-top pt-3">Contributi Totali Previsti</dt><dd class="col-sm-6 text-end h5 text-primary border-top pt-3">€ ${totalSocialSecurityDue.toFixed(2)}</dd><hr class="my-3"><dt class="col-sm-6">Stima Primo Acconto (40%)</dt><dd class="col-sm-6 text-end">€ ${socialFirstAdvance.toFixed(2)}</dd><dt class="col-sm-6">Stima Secondo Acconto (40%)</dt><dd class="col-sm-6 text-end">€ ${socialSecondAdvance.toFixed(2)}</dd></dl></div></div></div><div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-header fw-bold">Simulazione Imposta Sostitutiva (IRPEF)</div><div class="card-body"><dl class="row mb-0"><dt class="col-sm-6">Reddito Lordo Imponibile</dt><dd class="col-sm-6 text-end">€ ${taxableGross.toFixed(2)}</dd><dt class="col-sm-6">Contributi INPS Deducibili</dt><dd class="col-sm-6 text-end">- € ${totalSocialSecurityDue.toFixed(2)}</dd><dt class="col-sm-6 border-top pt-2">Reddito Netto Imponibile</dt><dd class="col-sm-6 text-end border-top pt-2">€ ${netTaxable.toFixed(2)}</dd><dt class="col-sm-6">Aliquota Imposta</dt><dd class="col-sm-6 text-end">${taxRate}%</dd><dt class="col-sm-6 h5 text-primary border-top pt-3">Imposta Totale Prevista</dt><dd class="col-sm-6 text-end h5 text-primary border-top pt-3">€ ${totalTaxDue.toFixed(2)}</dd><hr class="my-3"><dt class="col-sm-6">Stima Primo Acconto (50%)</dt><dd class="col-sm-6 text-end">€ ${taxFirstAdvance.toFixed(2)}</dd><dt class="col-sm-6">Stima Secondo Acconto (50%)</dt><dd class="col-sm-6 text-end">€ ${taxSecondAdvance.toFixed(2)}</dd></dl></div></div></div></div><div class="card bg-light mt-4"><div class="card-body d-flex justify-content-between align-items-center"><h5 class="card-title mb-0">Totale Uscite Stimate (Contributi + Imposte)</h5><h5 class="card-title mb-0">€ ${totalDue.toFixed(2)}</h5></div></div>`;
        container.html(warningHtml + resultHtml);
    }

    function renderCalendar() {
        const c = $('#calendar-widget');
        const n = new Date();
        const t = n.getDate();
        const l = new Date(n.getFullYear(), n.getMonth() + 1, 0);
        let h = `<h5 class="text-center">${n.toLocaleDateString('it-IT',{month:'long',year:'numeric'})}</h5><table class="table table-bordered"><thead><tr><th>Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th></tr></thead><tbody><tr>`;
        let d = new Date(n.getFullYear(), n.getMonth(), 1).getDay();
        for(let i=0;i<d;i++) h+='<td></td>';
        for(let day=1;day<=l.getDate();day++){
            if(d===7){d=0;h+='</tr><tr>'}
            h+=`<td${(day===t)?' class="today"':''}>${day}</td>`;
            d++;
        }
        h+='</tr></tbody></table>';
        c.html(h);
    }

    function renderHomePage() { 
        if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
        const notes = getData('notes').find(n => n.userId === currentUser.uid); 
        if(notes) $('#notes-textarea').val(notes.text); 
        renderCalendar();
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        updateDateTime();
        dateTimeInterval = setInterval(updateDateTime, 1000);
    }

    function populateDropdowns() {
        $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona...</option>').append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
        $('#invoice-product-select').empty().append('<option selected value="">Seleziona...</option><option value="manual">Manuale</option>').append(getData('products').map(p => `<option value="${p.id}">${p.code}</option>`));
        if(!$('#editing-invoice-id').val()) { $('#invoice-date').val(new Date().toISOString().slice(0, 10)); updateInvoiceNumber(); }
    }

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

    function initializeApp() { 
        $('.content-section').addClass('d-none'); 
        $('#home').removeClass('d-none'); 
        $('.sidebar .nav-link').removeClass('active'); 
        $('.sidebar .nav-link[data-target="home"]').addClass('active'); 
        renderAll(); 
    }

    // =========================================================
    // 4. EVENT LISTENERS (LOGICA AZIONI)
    // =========================================================

    // AUTH
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none'); 
            try {
                await loadAllDataFromCloud(); 
                $('#loading-screen').addClass('d-none');
                $('#main-app').removeClass('d-none');
                initializeApp();
            } catch (error) {
                console.error("Errore:", error);
                alert("Errore DB: " + error.message);
                $('#loading-screen').addClass('d-none');
            }
        } else {
            currentUser = null;
            $('#main-app').addClass('d-none');
            $('#loading-screen').addClass('d-none');
            $('#login-container').removeClass('d-none');
        }
    });

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        const email = $('#email').val(); const password = $('#password').val();
        $('#btn-login-submit').prop('disabled', true); $('#login-spinner').removeClass('d-none');
        auth.signInWithEmailAndPassword(email, password).catch((error) => {
            $('#login-error').text("Errore Login.").removeClass('d-none');
            $('#btn-login-submit').prop('disabled', false); $('#login-spinner').addClass('d-none');
        });
    });
    $('#logout-btn').on('click', function(e) { e.preventDefault(); auth.signOut().then(() => location.reload()); });

    // NAVIGAZIONE
    $('.sidebar .nav-link').on('click', function(e) { 
        if ($(this).attr('id') === 'logout-btn' || $(this).data('bs-toggle') === 'modal') return; 
        e.preventDefault(); 
        const target = $(this).data('target');
        if (target === 'nuova-fattura-accompagnatoria') {
            if ($(this).attr('id') === 'menu-nuova-nota-credito') prepareDocumentForm('Nota di Credito'); 
            else return;
        }
        if (target === 'statistiche') renderStatisticsPage(); 
        $('.sidebar .nav-link').removeClass('active'); $(this).addClass('active');
        $('.content-section').addClass('d-none'); $('#' + target).removeClass('d-none'); 
    });

    // AZIENDA
    $('#company-info-form').on('submit', async function(e) { 
        e.preventDefault(); const companyInfo = {}; 
        $(this).find('input, select').each(function() { const id = $(this).attr('id'); if (id) companyInfo[id.replace('company-', '')] = $(this).val(); }); 
        await saveDataToCloud('companyInfo', companyInfo); alert("Dati salvati!"); updateCompanyUI(); 
    });

    // --- GESTIONE ANAGRAFICHE (MODIFICATA E RIPARATA) ---
    
    // Funzioni di supporto Anagrafiche
    function prepareNewItemModal(type) { 
        const form = $(`#${type}Form`); 
        if (form.length) form[0].reset(); 
        $(`#${type}-id`).val(''); 
        const titleText = (type === 'product') ? 'Servizio/Prodotto' : 'Cliente'; 
        $(`#${type}ModalTitle`).text(`Nuovo ${titleText}`); 
        if (type === 'product') { $('#product-iva').val('0'); $('#product-esenzioneIva').val('N2.2'); toggleEsenzioneIvaField('product', '0'); } 
    }

    function editItem(type, id) { 
        const items = getData(`${type}s`); // 'products' o 'customers'
        // Confronto stringa per sicurezza
        const item = items.find(i => String(i.id) === String(id)); 
        if (!item) { alert("Elemento non trovato: " + id); return; }
        
        prepareNewItemModal(type); 
        $(`#${type}ModalTitle`).text(`Modifica ${type === 'product' ? 'Servizio' : 'Cliente'}`); 
        
        // Popola campi
        for (const key in item) { 
            const field = $(`#${type}-${key}`); 
            if (field.is(':checkbox')) { field.prop('checked', item[key]); } 
            else if (field.length) { field.val(item[key]); } 
        } 
        
        if (type === 'product') { toggleEsenzioneIvaField('product', item.iva); } 
        $(`#${type}-id`).val(String(item.id)); // Importante: imposta l'ID nel campo nascosto
        $(`#${type}Modal`).modal('show'); 
    }

    function toggleEsenzioneIvaField(container, ivaValue) { 
        const div = (container === 'product') ? $('#esenzione-iva-container') : $('#invoice-esenzione-iva-container'); 
        if (ivaValue == '0') div.removeClass('d-none'); else div.addClass('d-none'); 
    }

    $('#product-iva').on('change', function() { toggleEsenzioneIvaField('product', $(this).val()); });
    $('#invoice-product-iva').on('change', function() { toggleEsenzioneIvaField('invoice', $(this).val()); });

    // GESTORI EVENTI CLIENTI
    $('#newCustomerBtn').on('click', function() { prepareNewItemModal('customer'); });
    
    $('#saveCustomerBtn').on('click', async function() {
        const idInput = $('#customer-id').val();
        let itemData = {};
        $('#customerForm').find('input, select').each(function() {
            const id = $(this).attr('id');
            if(id) itemData[id.replace('customer-', '')] = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val();
        });
        let id = idInput ? idInput : String(getNextId(getData('customers')));
        await saveDataToCloud('customers', itemData, id);
        $('#customerModal').modal('hide');
        renderAll();
    });

    $('#customers-table-body').on('click', '.btn-edit-customer', function() {
        const id = $(this).attr('data-id'); // Usa attr per sicurezza
        editItem('customer', id);
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function() {
        const id = $(this).attr('data-id');
        deleteDataFromCloud('customers', id);
    });

    // GESTORI EVENTI PRODOTTI
    $('#newProductBtn').on('click', function() { prepareNewItemModal('product'); });

    $('#saveProductBtn').on('click', async function() {
        const idInput = $('#product-id').val();
        let itemData = {};
        $('#productForm').find('input, select').each(function() {
            const id = $(this).attr('id');
            if(id) itemData[id.replace('product-', '')] = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val();
        });
        // Se è un nuovo prodotto, generiamo un ID basato sul timestamp per unicità
        let id = idInput ? idInput : 'PRD' + new Date().getTime();
        await saveDataToCloud('products', itemData, id);
        $('#productModal').modal('hide');
        renderAll();
    });

    $('#products-table-body').on('click', '.btn-edit-product', function() {
        const id = $(this).attr('data-id');
        editItem('product', id);
    });

    $('#products-table-body').on('click', '.btn-delete-product', function() {
        const id = $(this).attr('data-id');
        deleteDataFromCloud('products', id);
    });

    // --- FATTURE ---
    let currentInvoiceLines = [];
    
    function updateInvoiceNumber() { if ($('#editing-invoice-id').val()) return; const dateStr = $('#invoice-date').val(); if (!dateStr) return; const year = dateStr.substring(0, 4); const type = $('#document-type').val(); const prefix = type === 'Fattura' ? 'FATT' : 'NC'; const nextNumber = generateNextDocumentNumber(type, year); const paddedNumber = String(nextNumber).padStart(2, '0'); $('#invoice-number').val(`${prefix}-${year}-${paddedNumber}`); }
    function generateNextDocumentNumber(type, year) { const invoices = getData('invoices'); const documentsForYear = invoices.filter(inv => inv.type === type && inv.date.substring(0, 4) === String(year)); if (documentsForYear.length === 0) return 1; const lastNumbers = documentsForYear.map(inv => { const parts = inv.number.split('-'); const numPart = parts[parts.length - 1]; return parseInt(numPart, 10) || 0; }); return Math.max(...lastNumbers) + 1; }
    function renderInvoiceLines() { const tbody = $('#invoice-lines-tbody').empty(); let total = 0; currentInvoiceLines.forEach((line, index) => { tbody.append(`<tr><td>${line.productName}</td><td class="text-end-numbers">${line.qty}</td><td class="text-end-numbers">€ ${line.price.toFixed(2)}</td><td class="text-end-numbers">€ ${line.subtotal.toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-danger remove-invoice-line" data-index="${index}"><i class="fas fa-times"></i></button></td></tr>`); total += line.subtotal; }); $('#invoice-total').text(`€ ${total.toFixed(2)}`); }

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

    $('#invoice-product-select').on('change', function() { const pid = $(this).val(); const p = getData('products').find(x => x.id === pid); if(pid === 'manual') { $('#invoice-product-description').val('').prop('readonly',false).focus(); $('#invoice-product-price').val(''); $('#invoice-product-iva').prop('disabled',false).val('0'); toggleEsenzioneIvaField('invoice','0'); } else if(p) { $('#invoice-product-description').val(p.description).prop('readonly',true); $('#invoice-product-price').val(p.salePrice); $('#invoice-product-iva').val(p.iva).prop('disabled',true); $('#invoice-product-esenzioneIva').val(p.esenzioneIva); toggleEsenzioneIvaField('invoice', p.iva); } });
    
    $('#add-product-to-invoice-btn').on('click', function() { 
        const desc = $('#invoice-product-description').val(); const qty = parseInt($('#invoice-product-qty').val()); const price = parseFloat($('#invoice-product-price').val()); 
        if(!desc || !qty || isNaN(price)) return;
        currentInvoiceLines.push({ productName: desc, qty: qty, price: price, subtotal: qty*price, iva: $('#invoice-product-iva').val(), esenzioneIva: $('#invoice-product-esenzioneIva').val() });
        renderInvoiceLines();
    });

    $('#invoice-lines-tbody').on('click', '.remove-invoice-line', function() { currentInvoiceLines.splice($(this).data('index'), 1); renderInvoiceLines(); });
    $('#invoice-date').on('change', function() { $('#invoice-dataRiferimento').val($(this).val()); updateInvoiceNumber(); });

    $('#new-invoice-form').on('submit', async function(e) {
        e.preventDefault();
        const customerId = $('#invoice-customer-select').val();
        if (!customerId || currentInvoiceLines.length === 0) { alert("Dati incompleti."); return; }
        
        const customer = getData('customers').find(c => String(c.id) === String(customerId)); 
        const company = getData('companyInfo');
        const docType = $('#document-type').val();
        
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

        let id = $('#editing-invoice-id').val();
        if (!id) {
            id = String(getNextId(getData('invoices')));
        } else {
            const oldInv = getData('invoices').find(i => String(i.id) === String(id));
            if(oldInv) invoiceData.status = oldInv.status;
        }

        await saveDataToCloud('invoices', invoiceData, id);
        alert(`${docType} salvata!`);
        prepareDocumentForm('Fattura');
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).attr('data-id'); const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if(!inv) return; 
        prepareDocumentForm(inv.type || 'Fattura');
        $('#editing-invoice-id').val(inv.id); $('#invoice-customer-select').val(inv.customerId); $('#invoice-date').val(inv.date); $('#invoice-number').val(inv.number);
        currentInvoiceLines = JSON.parse(JSON.stringify(inv.lines)); renderInvoiceLines();
        $('.content-section').addClass('d-none'); $('#nuova-fattura-accompagnatoria').removeClass('d-none');
    });

    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(confirm("Confermi il cambio stato?")) {
            await saveDataToCloud('invoices', { status: inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata' }, id);
            renderInvoicesTable();
        }
    });
    
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { deleteDataFromCloud('invoices', $(this).attr('data-id')); });

    $('#save-notes-btn').on('click', async function() { 
        await saveDataToCloud('notes', { userId: currentUser.uid, text: $('#notes-textarea').val() }, currentUser.uid); 
        alert("Note salvate!");
    });

    $('#import-file-input').on('change', function(event) {
        const file = event.target.files[0]; if (!file) return;
        if (confirm("Vuoi migrare i dati da questo file al Cloud?")) {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.companyInfo) await saveDataToCloud('companyInfo', data.companyInfo);
                    if (data.customers) for (let c of data.customers) await saveDataToCloud('customers', c, c.id);
                    if (data.products) for (let p of data.products) await saveDataToCloud('products', p, p.id);
                    if (data.invoices) for (let i of data.invoices) await saveDataToCloud('invoices', i, i.id);
                    alert("Migrazione completata! Ricarica la pagina."); location.reload();
                } catch (err) { alert("Errore importazione: " + err.message); }
            };
            reader.readAsText(file);
        }
    });
    
     $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { 
         let invoiceId = $(this).attr('id') === 'export-xml-btn' ? $('#export-xml-btn').data('invoiceId') : $(this).attr('data-id');
         if (invoiceId) generateInvoiceXML(invoiceId); 
    });

    function generateInvoiceXML(invoiceId) {
        const invoice = getData('invoices').find(inv => String(inv.id) === String(invoiceId)); if (!invoice) { alert("Errore!"); return; }
        const company = getData('companyInfo'); const customer = getData('customers').find(c => String(c.id) === String(invoice.customerId));
        
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
        let xml = `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.codiceFiscale)}</IdCodice></IdTrasmittente><ProgressivoInvio>${progressivoInvio}</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>${escapeXML(customer.sdi || '0000000')}</CodiceDestinatario></DatiTrasmissione><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.piva)}</IdCodice></IdFiscaleIVA><CodiceFiscale>${escapeXML(company.codiceFiscale)}</CodiceFiscale>${anagraficaCedente}<RegimeFiscale>${escapeXML(company.codiceRegimeFiscale)}</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>${escapeXML(company.address)}</Indirizzo>${company.numeroCivico ? `<NumeroCivico>${escapeXML(company.numeroCivico)}</NumeroCivico>` : ''}<CAP>${escapeXML(company.zip)}</CAP><Comune>${escapeXML(company.city)}</Comune><Provincia>${escapeXML(company.province.toUpperCase())}</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore><CessionarioCommittente><DatiAnagrafici>${customer.piva ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(customer.piva)}</IdCodice></IdFiscaleIVA>` : ''}${customer.codiceFiscale ? `<CodiceFiscale>${escapeXML(customer.codiceFiscale)}</CodiceFiscale>` : ''}<Anagrafica><Denominazione>${escapeXML(customer.name)}</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>${escapeXML(customer.address)}</Indirizzo><CAP>${escapeXML(customer.cap)}</CAP><Comune>${escapeXML(customer.comune)}</Comune><Provincia>${escapeXML(customer.provincia.toUpperCase())}</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${tipoDocumento}</TipoDocumento><Divisa>EUR</Divisa><Data>${invoice.date}</Data><Numero>${escapeXML(invoice.number)}</Numero>${invoice.importoBollo > 0 ? `<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>${invoice.importoBollo.toFixed(2)}</ImportoBollo></DatiBollo>` : ''}<ImportoTotaleDocumento>${invoice.total.toFixed(2)}</ImportoTotaleDocumento>${invoice.rivalsa && invoice.rivalsa.importo > 0 ? `<DatiCassaPrevidenziale><TipoCassa>TC22</TipoCassa><AlCassa>${invoice.rivalsa.aliquota.toFixed(2)}</AlCassa><ImportoContributoCassa>${invoice.rivalsa.importo.toFixed(2)}</ImportoContributoCassa><ImponibileCassa>${invoice.totalePrestazioni.toFixed(2)}</ImponibileCassa><AliquotaIVA>0.00</AliquotaIVA><Natura>N4</Natura></DatiCassaPrevidenziale>` : ''}${causale}</DatiGeneraliDocumento>${datiFattureCollegate}</DatiGenerali><DatiBeniServizi>`;
        let lineNumber = 1; invoice.lines.forEach(line => { xml += `<DettaglioLinee><NumeroLinea>${lineNumber++}</NumeroLinea><Descrizione>${escapeXML(line.productName)}</Descrizione>${line.qty ? `<Quantita>${line.qty.toFixed(2)}</Quantita>`: ''}<PrezzoUnitario>${line.price.toFixed(2)}</PrezzoUnitario><PrezzoTotale>${line.subtotal.toFixed(2)}</PrezzoTotale><AliquotaIVA>${parseFloat(line.iva).toFixed(2)}</AliquotaIVA>${line.iva == "0" && line.esenzioneIva ? `<Natura>${escapeXML(line.esenzioneIva)}</Natura>` : ''}</DettaglioLinee>`; });
        xml += `${riepilogoXml}</DatiBeniServizi><DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento>${(company.nome && company.cognome) ? `<Beneficiario>${escapeXML(company.nome + ' ' + company.cognome)}</Beneficiario>` : ''}<ModalitaPagamento>MP05</ModalitaPagamento>${invoice.dataScadenza ? `<DataScadenzaPagamento>${invoice.dataScadenza}</DataScadenzaPagamento>`: ''}<ImportoPagamento>${invoice.total.toFixed(2)}</ImportoPagamento>${company.banca ? `<IstitutoFinanziario>${escapeXML(company.banca)}</IstitutoFinanziario>`: ''}${company.iban ? `<IBAN>${escapeXML(company.iban)}</IBAN>`: ''}</DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>`;
        const fileNameProgressive = (Math.random().toString(36) + '00000').slice(2, 7);
        const a = document.createElement('a'); a.download = `IT${company.piva}_${fileNameProgressive}.xml`; const blob = new Blob([xml], { type: 'application/xml' }); a.href = URL.createObjectURL(blob); a.click(); URL.revokeObjectURL(a.href);
    }

    // DETTAGLIO FATTURA (MODALE)
    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const invoiceId = $(this).attr('data-id'); const invoice = getData('invoices').find(inv => String(inv.id) === String(invoiceId)); if (!invoice) return;
        $('#export-xml-btn').data('invoiceId', invoiceId); const customer = getData('customers').find(c => String(c.id) === String(invoice.customerId)) || {}; const company = getData('companyInfo'); const customerAddress = `${customer.address || ''}<br>${customer.cap || ''} ${customer.comune || ''} (${customer.provincia || ''}) - ${customer.nazione || ''}`; const companyAddress = `${company.address || ''} ${company.numeroCivico || ''}<br>${company.zip || ''} ${company.city || ''} (${company.province || ''})`; $('#invoiceDetailModalTitle').text(`Dettaglio ${invoice.type} N° ${invoice.number}`);
        let modalBodyHtml = `<div class="row mb-3"><div class="col-6"><h5>${company.name || ''}</h5><p class="mb-0 small">${company.cognome || ''} ${company.nome || ''}<br>${companyAddress}<br>P.IVA: ${company.piva || ''} - C.F: ${company.codiceFiscale || ''}<br>${company.regimeFiscale || ''} (${company.codiceRegimeFiscale || ''})</p></div><div class="col-6 text-end"><h5>Spett.le</h5><p class="mb-0 small">${customer.name}<br>${customer.address}<br>P.IVA: ${customer.piva || ''} - C.F: ${customer.codiceFiscale || ''}<br>Codice S.d.I: ${customer.sdi || ''}</p></div></div><hr><div class="row mb-3"><div class="col-6"><h4>${invoice.type} N° ${invoice.number}</h4></div><div class="col-6 text-end"><h4>Data: ${formatDateForDisplay(invoice.date)}</h4></div></div><table class="table table-sm"><thead class="table-light"><tr><th>Descrizione</th><th>Qtà</th><th>Prezzo</th><th>IVA</th><th class="text-end">Imponibile</th></tr></thead><tbody>`;
        invoice.lines.forEach(line => { const ivaCell = (line.iva == 0 && line.esenzioneIva) ? `0% (${line.esenzioneIva})` : `${line.iva}%`; modalBodyHtml += `<tr><td>${line.productName}</td><td>${line.qty}</td><td>€ ${line.price.toFixed(2)}</td><td>${ivaCell}</td><td class="text-end">€ ${line.subtotal.toFixed(2)}</td></tr>`; }); modalBodyHtml += `</tbody></table>`; let summaryHtml = '<div class="row justify-content-end mt-4"><div class="col-md-6"><table class="table table-sm">'; summaryHtml += `<tr><td>Totale Prestazioni</td><td class="text-end">€ ${invoice.totalePrestazioni.toFixed(2)}</td></tr>`; if (invoice.rivalsa && invoice.rivalsa.importo > 0) { summaryHtml += `<tr><td>Rivalsa INPS ${invoice.rivalsa.aliquota}%</td><td class="text-end">€ ${invoice.rivalsa.importo.toFixed(2)}</td></tr>`; } summaryHtml += `<tr><td><strong>Totale Imponibile</strong></td><td class="text-end"><strong>€ ${invoice.totaleImponibile.toFixed(2)}</strong></td></tr>`; if (invoice.totaleIva > 0) { summaryHtml += `<tr><td>Totale IVA</td><td class="text-end">€ ${invoice.totaleIva.toFixed(2)}</td></tr>`; } if (invoice.importoBollo > 0) { summaryHtml += `<tr><td>Marca da Bollo</td><td class="text-end">€ ${invoice.importoBollo.toFixed(2)}</td></tr>`; } summaryHtml += `<tr class="fw-bold fs-5 border-top"><td>Totale Documento</td><td class="text-end">€ ${invoice.total.toFixed(2)}</td></tr></tbody></table></div></div>`; modalBodyHtml += summaryHtml;
        if(company.regimeFiscale === "Regime Forfettario"){ modalBodyHtml += `<hr><p class="small text-muted">Operazione senza applicazione dell’IVA ai sensi dell’art. 1, commi da 54 a 89, Legge n. 190/2014 (Regime Forfettario). Si richiede la non applicazione della ritenuta alla fonte a titolo d’acconto ai sensi dell’art. 1, comma 67, Legge n. 190/2014.</p>`; } modalBodyHtml += `<hr><div class="row mt-2"><div class="col-6"><small><strong>Condizioni:</strong> ${invoice.condizioniPagamento}<br><strong>Modalità:</strong> ${invoice.modalitaPagamento}<br><strong>Scadenza:</strong> ${formatDateForDisplay(invoice.dataScadenza)}</small></div><div class="col-6"><small><strong>Coordinate Bancarie:</strong><br><strong>Banca:</strong> ${company.banca || ''}<br><strong>IBAN:</strong> ${company.iban || ''}</small></div></div>`;
        $('#invoiceDetailModalBody').html(modalBodyHtml);
    });

    $('#print-invoice-btn').on('click', () => window.print());

});