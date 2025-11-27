// Variabili Globali
let db, auth;
let globalData = {
    companyInfo: {},
    products: [],
    customers: [],
    invoices: [],
    notes: []
};
let currentUser = null;
let dateTimeInterval = null;
let CURRENT_EDITING_ID = null;         
let CURRENT_EDITING_INVOICE_ID = null; 
window.tempInvoiceLines = [];          

$(document).ready(function() {

    // =========================================================
    // 0. INIZIALIZZAZIONE FIREBASE (AVVIO SICURO)
    // =========================================================
    
    if (typeof firebase === 'undefined') {
        alert("ERRORE CRITICO: Firebase non caricato. Controlla la connessione internet.");
        return;
    }

    try {
        const firebaseConfig = {
          apiKey: "AIzaSyCuGd5MSKdixcMYOYullnyam6Pj1D9tNbM",
          authDomain: "fprf-6c080.firebaseapp.com",
          projectId: "fprf-6c080",
          storageBucket: "fprf-6c080.firebasestorage.app",
          messagingSenderId: "406236428222",
          appId: "1:406236428222:web:3be6b3b8530ab20ba36bef"
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase connesso.");

    } catch (error) {
        console.error("Firebase Error:", error);
        alert("Errore connessione Database: " + error.message);
    }

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
        const numericIds = items.map(i => parseInt(i.id)).filter(id => !isNaN(id));
        return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1; 
    }

    function getData(key) { return globalData[key] || []; }
    function safeFloat(val) { const n = parseFloat(val); return isNaN(n) ? 0 : n; }
    function toggleEsenzioneIvaField(container, ivaValue) { 
        const div = (container === 'product') ? $('#esenzione-iva-container') : $('#invoice-esenzione-iva-container'); 
        if (ivaValue == '0') div.removeClass('d-none'); else div.addClass('d-none'); 
    }

    function getUserRootRef() {
        if (!currentUser || !currentUser.uid) {
            throw new Error("Utente non autenticato");
        }
        return db.collection('users').doc(currentUser.uid);
    }

    function getUserCollectionRef(collection) {
        return getUserRootRef().collection(collection);
    }

    function getCompanyInfoDocRef() {
        return getUserRootRef().collection('settings').doc('companyInfo');
    }



    // =========================================================
    // 2. GESTIONE DATI CLOUD
    // =========================================================

    
    function getUserDocRef() {
        if (!currentUser || !currentUser.uid) {
            throw new Error("Utente non autenticato (userDocRef).");
        }
        return db.collection('userData').doc(currentUser.uid);
    }

    async function loadAllDataFromCloud() {
        if (!auth || !db) throw new Error("Firebase non inizializzato.");
        if (!currentUser) throw new Error("Utente non autenticato.");
        try {
            const userRef = getUserDocRef();

            // Azienda (impostazioni per utente)
            const companyDoc = await userRef.collection('settings').doc('companyInfo').get();
            globalData.companyInfo = companyDoc.exists ? companyDoc.data() : {};

            // Collezioni per utente
            const collections = ['products', 'customers', 'invoices', 'notes'];
            for (const col of collections) {
                const snapshot = await userRef.collection(col).get();
                globalData[col] = snapshot.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
            }
            console.log("Dati sincronizzati per utente:", currentUser.uid, globalData);
        } catch (e) {
            console.error("Errore Load Cloud:", e);
            throw e;
        }
    }

    async function saveDataToCloud(collection, dataObj, id = null) {
        if (!currentUser) {
            alert("Utente non autenticato.");
            return;
        }
        try {
            const userRef = getUserDocRef();

            if (collection === 'companyInfo') {
                await userRef.collection('settings').doc('companyInfo').set(dataObj, { merge: true });
                globalData.companyInfo = { ...(globalData.companyInfo || {}), ...dataObj };
            } else {
                if (!id) {
                    console.error("ID mancante per salvataggio in", collection);
                    return;
                }
                const strId = String(id);
                await userRef.collection(collection).doc(strId).set(dataObj, { merge: true });

                if (!globalData[collection]) globalData[collection] = [];
                const index = globalData[collection].findIndex(item => String(item.id) === strId);
                if (index > -1) {
                    globalData[collection][index] = { ...globalData[collection][index], ...dataObj };
                } else {
                    globalData[collection].push({ id: strId, ...dataObj });
                }
            }
        } catch (e) {
            console.error("Errore Cloud:", e);
            alert("Errore Cloud: " + e.message);
        }
    }

    async function deleteDataFromCloud(collection, id) {
        if (!currentUser) {
            alert("Utente non autenticato.");
            return;
        }
        if (!confirm("Sei sicuro di voler eliminare questo elemento?")) return;

        try {
            const userRef = getUserDocRef();
            const strId = String(id);
            await userRef.collection(collection).doc(strId).delete();

            if (globalData[collection]) {
                globalData[collection] = globalData[collection].filter(item => String(item.id) !== strId);
            }
            renderAll();
        } catch (e) {
            console.error("Errore eliminazione:", e);
            alert("Errore eliminazione: " + e.message);
        }
    }

// =========================================================
    // 3. FUNZIONI DI RENDER UI
    // =========================================================

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
        if(currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
        $('#version-sidebar').text('v10.3 (Stable)');
    }

    function renderHomePage() { 
        if(currentUser && currentUser.email) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
        const note = getData('notes').find(n => n.userId === currentUser.uid);
        if(note) $('#notes-textarea').val(note.text);
        renderCalendar();
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        updateDateTime();
        dateTimeInterval = setInterval(updateDateTime, 1000);
    }

    function renderCalendar() {
        const c = $('#calendar-widget');
        const now = new Date();
        const t = now.getDate();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const totalDays = lastDay.getDate();
        let startingDay = firstDay.getDay(); 

        let html = `<div class="card shadow-sm border-0"><div class="card-header bg-primary text-white text-center fw-bold">${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}</div><div class="card-body p-0"><table class="table table-bordered text-center mb-0" style="table-layout: fixed;"><thead class="table-light"><tr><th class="text-danger">Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th></tr></thead><tbody><tr>`;
        
        for (let i = 0; i < startingDay; i++) html += '<td class="bg-light"></td>';
        for (let day = 1; day <= totalDays; day++) {
            if (startingDay > 6) { startingDay = 0; html += '</tr><tr>'; }
            const isToday = (day === t) ? 'bg-primary text-white fw-bold rounded-circle' : '';
            html += `<td class="align-middle p-2"><div class="${isToday}" style="width:32px; height:32px; line-height:32px; margin:0 auto;">${day}</div></td>`;
            startingDay++;
        }
        while (startingDay <= 6) { html += '<td class="bg-light"></td>'; startingDay++; }
        html += '</tr></tbody></table></div></div>';
        c.html(html);
    }

    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty();
        const facts = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '');
        const notes = getData('invoices').filter(i => i.type === 'Nota di Credito');
        
        if(facts.length === 0) { container.html('<div class="alert alert-info">Nessun dato.</div>'); renderTaxSimulation(0,0); return; }

        const totF = facts.reduce((s,i)=>s+safeFloat(i.total),0);
        const totN = notes.reduce((s,i)=>s+safeFloat(i.total),0);
        const net = totF - totN;

        let cust = {};
        facts.forEach(i=>{const c=String(i.customerId); if(!cust[c])cust[c]=0; cust[c]+=safeFloat(i.total)});
        notes.forEach(i=>{const c=String(i.customerId); if(cust[c])cust[c]-=safeFloat(i.total)});

        let h = `<div class="card shadow-sm mb-4 border-0"><div class="card-header fw-bold bg-white border-bottom">Dettaglio Clienti</div><div class="card-body p-0"><table class="table table-striped mb-0 table-hover"><thead><tr><th>Cliente</th><th class="text-end">Fatturato Netto</th><th class="text-end">% sul Totale</th></tr></thead><tbody>`;
        Object.keys(cust).sort((a,b)=>cust[b]-cust[a]).forEach(cid=>{
            const c = getData('customers').find(x=>String(x.id)===String(cid))||{name:'?'};
            const tot = cust[cid];
            const perc = net > 0 ? (tot / net) * 100 : 0;
            h+=`<tr><td>${c.name}</td><td class="text-end">€ ${tot.toFixed(2)}</td><td class="text-end">${perc.toFixed(1)}%</td></tr>`;
        });
        h+=`</tbody><tfoot class="table-dark"><tr><td>TOTALE</td><td class="text-end">€ ${net.toFixed(2)}</td><td class="text-end">100%</td></tr></tfoot></table></div></div>`;
        container.html(h);
        
        const impF = facts.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        const impN = notes.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        renderTaxSimulation(impF, impN);
    }

    function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
        const container = $('#tax-simulation-container').empty();
        const comp = getData('companyInfo');
        const coeff = safeFloat(comp.coefficienteRedditivita);
        const taxRate = safeFloat(comp.aliquotaSostitutiva);
        const inpsRate = safeFloat(comp.aliquotaContributi);

        if(!coeff || !taxRate || !inpsRate) { container.html('<div class="alert alert-warning">Dati mancanti in Anagrafica Azienda.</div>'); return; }

        const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
        const taxableIncome = grossRevenue * (coeff / 100);
        const socialSecurity = taxableIncome * (inpsRate / 100);
        const netTaxable = taxableIncome - socialSecurity;
        const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0;
        const totalDue = socialSecurity + tax;

        const html = `
            <div class="row">
                <div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-header fw-bold">Simulazione Contributi INPS</div><div class="card-body"><dl class="row mb-0">
                    <dt class="col-sm-8">Reddito Lordo Imponibile</dt><dd class="col-sm-4 text-end">€ ${taxableIncome.toFixed(2)}</dd>
                    <dt class="col-sm-8">Aliquota Contributi INPS</dt><dd class="col-sm-4 text-end">${inpsRate}%</dd>
                    <dt class="col-sm-8 h5 text-primary border-top pt-3">Contributi Totali Previsti</dt><dd class="col-sm-4 text-end h5 text-primary border-top pt-3">€ ${socialSecurity.toFixed(2)}</dd>
                    <hr class="my-3"><dt class="col-sm-8 fw-normal">Stima Primo Acconto (40%)</dt><dd class="col-sm-4 text-end text-muted">€ ${(socialSecurity*0.4).toFixed(2)}</dd>
                    <dt class="col-sm-8 fw-normal">Stima Secondo Acconto (40%)</dt><dd class="col-sm-4 text-end text-muted">€ ${(socialSecurity*0.4).toFixed(2)}</dd>
                </dl></div></div></div>
                <div class="col-lg-6 mb-4"><div class="card h-100"><div class="card-header fw-bold">Simulazione Imposta Sostitutiva (IRPEF)</div><div class="card-body"><dl class="row mb-0">
                    <dt class="col-sm-8">Reddito Lordo Imponibile</dt><dd class="col-sm-4 text-end">€ ${taxableIncome.toFixed(2)}</dd>
                    <dt class="col-sm-8">Contributi INPS Deducibili</dt><dd class="col-sm-4 text-end text-danger">- € ${socialSecurity.toFixed(2)}</dd>
                    <dt class="col-sm-8 border-top pt-2">Reddito Netto Imponibile</dt><dd class="col-sm-4 text-end border-top pt-2">€ ${netTaxable.toFixed(2)}</dd>
                    <dt class="col-sm-8">Aliquota Imposta</dt><dd class="col-sm-4 text-end">${taxRate}%</dd>
                    <dt class="col-sm-8 h5 text-primary border-top pt-3">Imposta Totale Prevista</dt><dd class="col-sm-4 text-end h5 text-primary border-top pt-3">€ ${tax.toFixed(2)}</dd>
                    <hr class="my-3"><dt class="col-sm-8 fw-normal">Stima Primo Acconto (50%)</dt><dd class="col-sm-4 text-end text-muted">€ ${(tax*0.5).toFixed(2)}</dd>
                    <dt class="col-sm-8 fw-normal">Stima Secondo Acconto (50%)</dt><dd class="col-sm-4 text-end text-muted">€ ${(tax*0.5).toFixed(2)}</dd>
                </dl></div></div></div>
            </div>
            <div class="card bg-light mt-4"><div class="card-body d-flex justify-content-between align-items-center"><h5 class="card-title mb-0">Totale Uscite Stimate (Contributi + Imposte)</h5><h5 class="card-title mb-0">€ ${totalDue.toFixed(2)}</h5></div></div>`;
        container.html(html);
    }

    function renderCompanyInfoForm() { const c = getData('companyInfo'); for (const k in c) $(`#company-${k}`).val(c[k]); }
    
    function renderProductsTable() { 
        const table = $('#products-table-body').empty(); 
        getData('products').forEach(p => { 
            const price = parseFloat(p.salePrice).toFixed(2);
            table.append(`<tr><td>${p.code}</td><td>${p.description}</td><td class="text-end">€ ${price}</td><td class="text-end">${p.iva}%</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
        }); 
    }
    
    function renderCustomersTable() { 
        const table = $('#customers-table-body').empty(); 
        getData('customers').forEach(c => { 
            table.append(`<tr><td>${c.name}</td><td>${c.piva}</td><td>${c.sdi || '-'}</td><td>${c.address || ''}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); 
        }); 
    }
    
    function populateInvoiceYearFilter() {
    const select = $('#invoice-year-filter');
    if (!select.length) return;
    const invoices = getData('invoices');
    const yearsSet = new Set();
    invoices.forEach(inv => {
        if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
            yearsSet.add(inv.date.substring(0, 4));
        }
    });
    const years = Array.from(yearsSet).sort().reverse();
    const current = select.val() || 'all';
    select.empty();
    select.append('<option value="all">Tutti</option>');
    years.forEach(year => {
        select.append(`<option value="${year}">${year}</option>`);
    });
    if (years.includes(current)) {
        select.val(current);
    }
}

function renderInvoicesTable() {
    populateInvoiceYearFilter();

    const table = $('#invoices-table-body').empty();
    const select = $('#invoice-year-filter');
    const yearFilter = select.length ? select.val() : 'all';

    let invoices = getData('invoices').slice();
    if (yearFilter && yearFilter !== 'all') {
        invoices = invoices.filter(inv => inv.date && String(inv.date).substring(0, 4) === String(yearFilter));
    }

    invoices.sort((a, b) => (b.number || '').localeCompare(a.number || ''));

    invoices.forEach(inv => {
        const c = getData('customers').find(cust => String(cust.id) === String(inv.customerId)) || { name: 'Sconosciuto' }; 
        const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';

        const badge = inv.type === 'Nota di Credito' ? '<span class="badge bg-warning text-dark border border-dark">NdC</span>' : '<span class="badge bg-primary">Fatt.</span>';
        let statusBadge = '<span class="badge bg-warning text-dark">Da Incassare</span>';
        if (inv.type === 'Nota di Credito') statusBadge = isPaid ? '<span class="badge bg-info text-dark">Emessa</span>' : '<span class="badge bg-secondary">Bozza</span>';
        else statusBadge = isPaid ? '<span class="badge bg-success">Pagata</span>' : '<span class="badge bg-warning text-dark">Da Incassare</span>';

        const payClass = isPaid ? 'btn-secondary disabled' : 'btn-success';
        const editClass = isPaid ? 'btn-secondary disabled' : 'btn-outline-secondary';
        const btnDelete = `<button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina"><i class="fas fa-trash"></i></button>`;

        const btns = `<div class="d-flex justify-content-end gap-1">
            <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal" title="Vedi">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm ${editClass} btn-edit-invoice" data-id="${inv.id}" title="Modifica" ${isPaid?'disabled':''}>
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}" title="XML">
                <i class="fas fa-file-code"></i>
            </button>
            <button class="btn btn-sm ${payClass} btn-mark-paid" data-id="${inv.id}" title="Stato" ${isPaid?'disabled':''}>
                <i class="fas fa-check"></i>
            </button>
            ${btnDelete}
        </div>`;

        const total = (parseFloat(inv.total) || 0).toFixed(2);
        table.append(`<tr class="${isPaid?'table-light text-muted':''}">
            <td>${badge}</td>
            <td class="fw-bold">${inv.number}</td>
            <td>${formatDateForDisplay(inv.date)}</td>
            <td>${c.name}</td>
            <td class="text-end">€ ${total}</td>
            <td class="text-end small">${formatDateForDisplay(inv.dataScadenza)}</td>
            <td>${statusBadge}</td>
            <td class="text-end">${btns}</td>
        </tr>`);
    });
}

    function populateDropdowns() {
        // Clienti
        $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona Cliente...</option>')
            .append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
        
        // Prodotti
        $('#invoice-product-select').empty().append('<option selected value="">Seleziona Servizio...</option><option value="manual">--- Inserimento Manuale ---</option>')
            .append(getData('products').map(p => {
                const label = (p.code ? p.code + ' - ' : '') + p.description;
                return `<option value="${p.id}">${label}</option>`;
            }));
        
        // Data default
        if(!$('#editing-invoice-id').val()) { 
            $('#invoice-date').val(new Date().toISOString().slice(0, 10)); 
        }
    }

    // =========================================================
    // 4. EVENTI (AUTH, NAV, FORM)
    // =========================================================

    // AUTH
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            $('#login-container').addClass('d-none'); $('#loading-screen').removeClass('d-none'); 
            try {
                await loadAllDataFromCloud(); 
                $('#loading-screen').addClass('d-none'); $('#main-app').removeClass('d-none');
                renderAll();
            } catch (error) { alert("Errore DB: " + error.message); $('#loading-screen').addClass('d-none'); }
        } else {
            currentUser = null;
            $('#main-app').addClass('d-none'); $('#loading-screen').addClass('d-none'); $('#login-container').removeClass('d-none');
        }
    });

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        auth.signInWithEmailAndPassword($('#email').val(), $('#password').val()).catch(err => { $('#login-error').removeClass('d-none'); });
    });

    $('#logout-btn').on('click', function(e) { e.preventDefault(); auth.signOut().then(() => location.reload()); });

    // NAVIGAZIONE
    $('.sidebar .nav-link').on('click', function(e) { 
        if ($(this).attr('id') === 'logout-btn' || $(this).data('bs-toggle') === 'modal') return; 
        e.preventDefault(); 
        const target = $(this).data('target');
        if (target === 'nuova-fattura-accompagnatoria') {
            if ($(this).attr('id') === 'menu-nuova-nota-credito') prepareDocumentForm('Nota di Credito'); 
            else if ($(this).attr('id') === 'menu-nuova-fattura') return; 
            else prepareDocumentForm('Fattura');
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

    // MODALE FATTURA (Fix)
    $('#newInvoiceChoiceModal').on('show.bs.modal', function () {
        const invoices = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined);
        invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
        const options = invoices.map(inv => `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`).join('');
        $('#copy-from-invoice-select').html('<option selected value="">Copia da esistente...</option>' + options);
    });

    $('#btn-create-new-blank-invoice').click(function() {
        $('#newInvoiceChoiceModal').modal('hide');
        $('.sidebar .nav-link').removeClass('active'); $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active');
        $('.content-section').addClass('d-none'); $('#nuova-fattura-accompagnatoria').removeClass('d-none');
        prepareDocumentForm('Fattura');
    });

    $('#btn-copy-from-invoice').click(function() {
        const id = $('#copy-from-invoice-select').val();
        if(!id) return;
        $('#newInvoiceChoiceModal').modal('hide');
        $('.sidebar .nav-link').removeClass('active'); $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active');
        $('.content-section').addClass('d-none'); $('#nuova-fattura-accompagnatoria').removeClass('d-none');
        loadInvoiceForEditing(id, true);
    });

    // CRUD ANAGRAFICHE
    function editItem(type, id) { 
        if (type === 'customer' || type === 'product') CURRENT_EDITING_ID = String(id);
        const item = getData(`${type}s`).find(i => String(i.id) === String(id)); 
        if (!item) { alert("Elemento non trovato"); return; }
        
        $(`#${type}Form`)[0].reset(); 
        $(`#${type}ModalTitle`).text(`Modifica ${type === 'product' ? 'Servizio' : 'Cliente'}`); 
        $(`#${type}-id`).val(String(item.id));
        
        // Set ID sul bottone per sicurezza
        const btnSave = (type === 'product') ? $('#saveProductBtn') : $('#saveCustomerBtn');
        btnSave.data('edit-id', String(item.id)); 
        
        for (const key in item) { 
            const field = $(`#${type}-${key}`); 
            if (field.length) { if (field.is(':checkbox')) field.prop('checked', item[key]); else field.val(item[key]); }
        } 
        if (type === 'product') { $('#product-iva').trigger('change'); if(item.iva == '0') $('#product-esenzioneIva').val(item.esenzioneIva); } 
        $(`#${type}Modal`).modal('show'); 
    }

    $('#newCustomerBtn').click(() => { 
        CURRENT_EDITING_ID = null; 
        $('#saveCustomerBtn').data('edit-id', null); 
        $('#customerForm')[0].reset(); 
        $('#customer-id').val('Nuovo'); 
        $('#customerModal').modal('show'); 
    });

    $('#saveCustomerBtn').click(async function() {
        const editId = $(this).data('edit-id');
        const data = {
            name: $('#customer-name').val(), piva: $('#customer-piva').val(), codiceFiscale: $('#customer-codiceFiscale').val(),
            sdi: $('#customer-sdi').val(), pec: $('#customer-pec').val(), address: $('#customer-address').val(), comune: $('#customer-comune').val(),
            provincia: $('#customer-provincia').val(), cap: $('#customer-cap').val(), nazione: $('#customer-nazione').val(),
            rivalsaInps: $('#customer-rivalsaInps').is(':checked')
        };
        let id = editId ? editId : String(getNextId(getData('customers')));
        await saveDataToCloud('customers', data, id); $('#customerModal').modal('hide'); renderAll();
    });

    $('#customers-table-body').on('click', '.btn-edit-customer', function(e) { editItem('customer', $(e.currentTarget).attr('data-id')); });
    $('#customers-table-body').on('click', '.btn-delete-customer', function(e) { deleteDataFromCloud('customers', $(e.currentTarget).attr('data-id')); });

    $('#newProductBtn').click(() => { 
        CURRENT_EDITING_ID = null; 
        $('#saveProductBtn').data('edit-id', null);
        $('#productForm')[0].reset(); 
        $('#product-id').val('Nuovo'); 
        $('#product-iva').val('0').change(); 
        $('#productModal').modal('show'); 
    });

    $('#saveProductBtn').click(async function() {
        const editId = $(this).data('edit-id');
        const data = {
            description: $('#product-description').val(), code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), iva: $('#product-iva').val(), esenzioneIva: $('#product-esenzioneIva').val()
        };
        let id = editId ? editId : 'PRD' + new Date().getTime();
        await saveDataToCloud('products', data, id); $('#productModal').modal('hide'); renderAll();
    });

    $('#products-table-body').on('click', '.btn-edit-product', function(e) { editItem('product', $(e.currentTarget).attr('data-id')); });
    $('#products-table-body').on('click', '.btn-delete-product', function(e) { deleteDataFromCloud('products', $(e.currentTarget).attr('data-id')); });
    $('#product-iva').change(function() { toggleEsenzioneIvaField('product', $(this).val()); });
    
    function toggleEsenzioneIvaField(container, ivaValue) { const div = (container === 'product') ? $('#esenzione-iva-container') : $('#invoice-esenzione-iva-container'); if (ivaValue == '0') div.removeClass('d-none'); else div.addClass('d-none'); }

    // FATTURE CORE
    function prepareDocumentForm(type) {
        CURRENT_EDITING_INVOICE_ID = null; 
        $('#new-invoice-form')[0].reset(); $('#invoice-id').val('Nuovo'); $('#document-type').val(type);
        $('#invoice-lines-tbody').empty(); window.tempInvoiceLines = []; 
        populateDropdowns(); 
        const today = new Date().toISOString().slice(0, 10); $('#invoice-date').val(today);
        if (type === 'Nota di Credito') { $('#document-title').text('Nuova Nota di Credito'); $('#credit-note-fields').removeClass('d-none'); } 
        else { $('#document-title').text('Nuova Fattura'); $('#credit-note-fields').addClass('d-none'); }
        updateInvoiceNumber(type, today.substring(0, 4)); updateTotalsDisplay();
    }

    function loadInvoiceForEditing(id, isCopy) {
        const inv = getData('invoices').find(i => String(i.id) === String(id)); if (!inv) return;
        const type = isCopy ? 'Fattura' : (inv.type || 'Fattura');
        prepareDocumentForm(type);
        if (!isCopy) { CURRENT_EDITING_INVOICE_ID = String(inv.id); $('#invoice-id').val(inv.id); $('#document-title').text(`Modifica ${type} ${inv.number}`); }
        $('#invoice-customer-select').val(inv.customerId);
        $('#invoice-date').val(isCopy ? new Date().toISOString().slice(0, 10) : inv.date);
        if(!isCopy) $('#invoice-number').val(inv.number);
        $('#invoice-condizioniPagamento').val(inv.condizioniPagamento); $('#invoice-modalitaPagamento').val(inv.modalitaPagamento); $('#invoice-dataScadenza').val(inv.dataScadenza);
        if (type === 'Nota di Credito') { $('#linked-invoice').val(inv.linkedInvoice); $('#reason').val(inv.reason); }
        window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines)); renderLocalInvoiceLines(); updateTotalsDisplay();
    }

    function updateInvoiceNumber(type, year) {
        if (CURRENT_EDITING_INVOICE_ID) return;
        const invs = getData('invoices').filter(i => (i.type === type || (type==='Fattura' && !i.type)) && i.date.substring(0, 4) === String(year));
        let next = 1; if (invs.length > 0) next = Math.max(...invs.map(i => parseInt(i.number.split('-').pop()) || 0)) + 1;
        $('#invoice-number').val(`${type==='Fattura'?'FATT':'NC'}-${year}-${String(next).padStart(2, '0')}`);
    }

    $('#add-product-to-invoice-btn').click(() => {
        const d = $('#invoice-product-description').val(); if(!d) return;
        window.tempInvoiceLines.push({ productName: d, qty: parseFloat($('#invoice-product-qty').val())||1, price: parseFloat($('#invoice-product-price').val())||0, subtotal: (parseFloat($('#invoice-product-qty').val())||1)*(parseFloat($('#invoice-product-price').val())||0), iva: $('#invoice-product-iva').val(), esenzioneIva: $('#invoice-product-esenzioneIva').val() });
        renderLocalInvoiceLines(); updateTotalsDisplay();
    });

    function renderLocalInvoiceLines() {
        const t = $('#invoice-lines-tbody').empty(); 
        window.tempInvoiceLines.forEach((l, i) => { t.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">€ ${l.price.toFixed(2)}</td><td class="text-end">€ ${l.subtotal.toFixed(2)}</td><td class="text-center"><button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`); });
    }
    $('#invoice-lines-tbody').on('click', '.del-line', function() { window.tempInvoiceLines.splice($(this).data('i'), 1); renderLocalInvoiceLines(); updateTotalsDisplay(); });

    function updateTotalsDisplay() {
        const cid = $('#invoice-customer-select').val(); const cust = getData('customers').find(c => String(c.id) === String(cid)); const comp = getData('companyInfo');
        const rows = window.tempInvoiceLines.filter(l => l.productName.toLowerCase() !== 'rivalsa bollo');
        const bollo = window.tempInvoiceLines.find(l => l.productName.toLowerCase() === 'rivalsa bollo');
        const impBollo = bollo ? bollo.subtotal : 0;
        const totPrest = rows.reduce((s, l) => s + l.subtotal, 0);
        let riv = 0; if (cust && cust.rivalsaInps) riv = totPrest * (parseFloat(comp.aliquotaInps||0) / 100);
        const totDoc = totPrest + riv + impBollo;
        $('#invoice-total').text(`€ ${totDoc.toFixed(2)}`);
        $('#invoice-tax-details').text(`(Imp: € ${(totPrest+riv).toFixed(2)} - Bollo: € ${impBollo.toFixed(2)})`);
        return { totPrest, riv, impBollo, totImp: totPrest+riv, totDoc };
    }
    $('#invoice-customer-select').change(updateTotalsDisplay);
    $('#invoice-year-filter').on('change', function() { renderInvoicesTable(); });
    $('#invoice-date').change(function() { $('#invoice-dataRiferimento').val($(this).val()); updateInvoiceNumber($('#document-type').val(), $(this).val().substring(0, 4)); });
    $('#invoice-dataRiferimento, #invoice-giorniTermini').on('input', function() { const d = $('#invoice-dataRiferimento').val(); const g = parseInt($('#invoice-giorniTermini').val()); if(d && !isNaN(g)) { const dt = new Date(d); dt.setDate(dt.getDate() + g); $('#invoice-dataScadenza').val(dt.toISOString().split('T')[0]); } });

    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();
        const cid = $('#invoice-customer-select').val(); if (!cid || window.tempInvoiceLines.length === 0) { alert("Dati mancanti."); return; }
        const type = $('#document-type').val(); const calcs = updateTotalsDisplay();
        const data = {
            number: $('#invoice-number').val(), date: $('#invoice-date').val(), customerId: cid, type: type, lines: window.tempInvoiceLines,
            totalePrestazioni: calcs.totPrest, importoBollo: calcs.impBollo, rivalsa: { importo: calcs.riv }, totaleImponibile: calcs.totImp, total: calcs.totDoc,
            status: (type === 'Fattura' ? 'Da Incassare' : 'Emessa'), dataScadenza: $('#invoice-dataScadenza').val(),
            condizioniPagamento: $('#invoice-condizioniPagamento').val(), modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            linkedInvoice: $('#linked-invoice').val(), reason: $('#reason').val()
        };
        if (CURRENT_EDITING_INVOICE_ID) { const old = getData('invoices').find(i => String(i.id) === CURRENT_EDITING_INVOICE_ID); if(old) data.status = old.status; }
        let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices')));
        await saveDataToCloud('invoices', data, id); alert("Salvato!"); $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { loadInvoiceForEditing($(this).attr('data-id'), false); });
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { deleteDataFromCloud('invoices', $(this).attr('data-id')); });
    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(confirm("Confermi cambio stato?")) { await saveDataToCloud('invoices', { status: inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata' }, id); renderInvoicesTable(); }
    });

    // XML
    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { 
         let id = $(this).attr('id') === 'export-xml-btn' ? $('#export-xml-btn').data('invoiceId') : $(this).attr('data-id');
         if (id) generateInvoiceXML(id); 
    });
    function generateInvoiceXML(invoiceId) {
        const invoice = getData('invoices').find(inv => String(inv.id) === String(invoiceId)); if (!invoice) { alert("Errore!"); return; }
        const company = getData('companyInfo'); const customer = getData('customers').find(c => String(c.id) === String(invoice.customerId));
        let anagraficaCedente = `<Anagrafica><Denominazione>${escapeXML(company.name)}</Denominazione></Anagrafica>`;
        if (company.nome && company.cognome) { anagraficaCedente = `<Anagrafica><Nome>${escapeXML(company.nome)}</Nome><Cognome>${escapeXML(company.cognome)}</Cognome></Anagrafica>`; }
        const summaryByNature = {}; invoice.lines.forEach(l => { if (l.iva == "0" && l.esenzioneIva) { const k = l.esenzioneIva; if (!summaryByNature[k]) summaryByNature[k] = { aliquota: l.iva, natura: k, imponibile: 0 }; summaryByNature[k].imponibile += l.subtotal; } });
        if (invoice.rivalsa && invoice.rivalsa.importo > 0) { const k = "N4"; if (!summaryByNature[k]) summaryByNature[k] = { aliquota: "0.00", natura: k, imponibile: 0 }; summaryByNature[k].imponibile += invoice.rivalsa.importo; }
        let riepilogoXml = ''; Object.values(summaryByNature).forEach(s => { riepilogoXml += `<DatiRiepilogo><AliquotaIVA>${parseFloat(s.aliquota).toFixed(2)}</AliquotaIVA><Natura>${escapeXML(s.natura)}</Natura><ImponibileImporto>${s.imponibile.toFixed(2)}</ImponibileImporto><Imposta>0.00</Imposta></DatiRiepilogo>`; });
        let xml = `<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.codiceFiscale)}</IdCodice></IdTrasmittente><ProgressivoInvio>${(Math.random().toString(36)+'00000').slice(2,7)}</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>${escapeXML(customer.sdi||'0000000')}</CodiceDestinatario></DatiTrasmissione><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(company.piva)}</IdCodice></IdFiscaleIVA><CodiceFiscale>${escapeXML(company.codiceFiscale)}</CodiceFiscale>${anagraficaCedente}<RegimeFiscale>${escapeXML(company.codiceRegimeFiscale)}</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>${escapeXML(company.address)}</Indirizzo><NumeroCivico>${escapeXML(company.numeroCivico)}</NumeroCivico><CAP>${escapeXML(company.zip)}</CAP><Comune>${escapeXML(company.city)}</Comune><Provincia>${escapeXML(company.province)}</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore><CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${escapeXML(customer.piva)}</IdCodice></IdFiscaleIVA><CodiceFiscale>${escapeXML(customer.codiceFiscale)}</CodiceFiscale><Anagrafica><Denominazione>${escapeXML(customer.name)}</Denominazione></Anagrafica></DatiAnagrafici><Sede><Indirizzo>${escapeXML(customer.address)}</Indirizzo><CAP>${escapeXML(customer.cap)}</CAP><Comune>${escapeXML(customer.comune)}</Comune><Provincia>${escapeXML(customer.provincia)}</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>${invoice.type==='Nota di Credito'?'TD04':'TD01'}</TipoDocumento><Divisa>EUR</Divisa><Data>${invoice.date}</Data><Numero>${escapeXML(invoice.number)}</Numero><ImportoTotaleDocumento>${invoice.total.toFixed(2)}</ImportoTotaleDocumento>${invoice.type==='Nota di Credito'?`<Causale>${escapeXML(invoice.reason)}</Causale>`:''}</DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi>`;
        let ln = 1; invoice.lines.forEach(l => { xml += `<DettaglioLinee><NumeroLinea>${ln++}</NumeroLinea><Descrizione>${escapeXML(l.productName)}</Descrizione><Quantita>${l.qty.toFixed(2)}</Quantita><PrezzoUnitario>${l.price.toFixed(2)}</PrezzoUnitario><PrezzoTotale>${l.subtotal.toFixed(2)}</PrezzoTotale><AliquotaIVA>${parseFloat(l.iva).toFixed(2)}</AliquotaIVA><Natura>${escapeXML(l.esenzioneIva)}</Natura></DettaglioLinee>`; });
        xml += `${riepilogoXml}</DatiBeniServizi><DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>${invoice.dataScadenza}</DataScadenzaPagamento><ImportoPagamento>${invoice.total.toFixed(2)}</ImportoPagamento><IBAN>${escapeXML(company.iban)}</IBAN></DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>`;
        const a = document.createElement('a'); a.download = `IT${company.piva}_XML.xml`; const b = new Blob([xml], { type: 'application/xml' }); a.href = URL.createObjectURL(b); a.click();
    }
    // VIEW
    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const id = $(this).attr('data-id'); const inv = getData('invoices').find(i=>String(i.id)===String(id)); if(!inv) return;
        const c = getData('customers').find(x=>String(x.id)===String(inv.customerId))||{};
        const comp = getData('companyInfo');
        $('#export-xml-btn').data('invoiceId', inv.id); $('#invoiceDetailModalTitle').text(`${inv.type||'Fattura'} N. ${inv.number}`);
        let h = `<div class="row"><div class="col-6"><strong>Emittente:</strong><br>${comp.name}<br>${comp.address}<br>P.IVA: ${comp.piva}</div>
                 <div class="col-6 text-end"><strong>Destinatario:</strong><br>${c.name}<br>${c.address}<br>P.IVA: ${c.piva}</div></div>
                 <hr><table class="table table-sm"><thead><tr><th>Desc</th><th>Qt</th><th>Prezzo</th><th>Tot</th></tr></thead><tbody>`;
        inv.lines.forEach(l=>h+=`<tr><td>${l.productName}</td><td>${l.qty}</td><td>€ ${l.price.toFixed(2)}</td><td>€ ${l.subtotal.toFixed(2)}</td></tr>`);
        h+=`</tbody></table><h4 class="text-end">Totale: € ${parseFloat(inv.total).toFixed(2)}</h4>`;
        if(inv.type==='Nota di Credito' && inv.linkedInvoice) h+= `<p class="text-danger">Rettifica fattura: ${inv.linkedInvoice}</p>`;
        $('#invoiceDetailModalBody').html(h);
    });
    $('#print-invoice-btn').click(()=>window.print());
    $('#company-info-form').on('submit', async function(e) { e.preventDefault(); const d={}; $(this).find('input').each(function(){if(this.id)d[this.id.replace('company-','')] = $(this).val()}); await saveDataToCloud('companyInfo', d); alert("Salvato!"); });
    
$('#export-cloud-json-btn').on('click', function() {
    if (!currentUser) {
        alert('Devi essere loggato per esportare il backup dal Cloud.');
        return;
    }
    const backup = {
        meta: {
            version: 2,
            exportedAt: new Date().toISOString(),
            userId: currentUser.uid || null,
            userEmail: currentUser.email || null
        },
        data: {
            companyInfo: globalData.companyInfo || {},
            products: globalData.products || [],
            customers: globalData.customers || [],
            invoices: globalData.invoices || [],
            notes: globalData.notes || []
        }
    };
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10);
    a.href = URL.createObjectURL(blob);
    a.download = `gestionale-backup-cloud-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
});
    $('#save-notes-btn').click(async()=>{ await saveDataToCloud('notes', {userId:currentUser.uid, text:$('#notes-textarea').val()}, currentUser.uid); alert("Salvato!"); });
    
    $('#import-file-input').change(function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!currentUser) {
            alert("Devi prima effettuare il login per importare un backup.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const d = JSON.parse(ev.target.result);
                if (!d || typeof d !== 'object') {
                    alert("File JSON non valido.");
                    return;
                }

                if (!confirm("ATTENZIONE:\n\nL'import sovrascriver\u00e0 i dati esistenti (clienti, servizi, documenti, note) per questo utente.\n\nVuoi continuare?")) {
                    return;
                }

                const userRef = getUserDocRef();

                // 1. Svuota le sottocollezioni attuali dell'utente
                const collectionsToClear = ['products', 'customers', 'invoices', 'notes'];
                for (const col of collectionsToClear) {
                    const snap = await userRef.collection(col).get();
                    if (!snap.empty) {
                        const batch = db.batch();
                        snap.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                    }
                    globalData[col] = [];
                }

                // 2. Importa anagrafica azienda
                if (d.companyInfo) {
                    await saveDataToCloud('companyInfo', d.companyInfo);
                }

                // 3. Importa clienti
                if (Array.isArray(d.customers)) {
                    for (const c of d.customers) {
                        const id = (c.id !== undefined && c.id !== null)
                            ? String(c.id)
                            : String(getNextId(globalData.customers || []));
                        const { id: _oldId, ...customerData } = c;
                        await saveDataToCloud('customers', customerData, id);
                    }
                }

                // 4. Importa prodotti
                if (Array.isArray(d.products)) {
                    for (const p of d.products) {
                        const id = (p.id !== undefined && p.id !== null)
                            ? String(p.id)
                            : 'PRD' + new Date().getTime();
                        const { id: _oldId, ...productData } = p;
                        await saveDataToCloud('products', productData, id);
                    }
                }

                // 5. Importa documenti
                if (Array.isArray(d.invoices)) {
                    for (const i of d.invoices) {
                        const id = (i.id !== undefined && i.id !== null)
                            ? String(i.id)
                            : String(getNextId(globalData.invoices || []));
                        const { id: _oldId, ...invoiceData } = i;
                        await saveDataToCloud('invoices', invoiceData, id);
                    }
                }

                // 6. Importa note (vecchio formato)
                if (Array.isArray(d.notes) && d.notes.length > 0) {
                    const mergedText = d.notes.map(n => n.text).join("\n----------------------\n");
                    const noteDoc = {
                        userId: currentUser.uid,
                        text: mergedText
                    };
                    await saveDataToCloud('notes', noteDoc, currentUser.uid);
                }

                alert("Import completato per l'utente " + (currentUser.email || currentUser.uid) + ".");
                await loadAllDataFromCloud();
                renderAll();
            } catch (err) {
                console.error("Errore durante l'import JSON:", err);
                alert("Errore durante l'import: " + err.message);
            }
        };
        reader.readAsText(file);
    });
});