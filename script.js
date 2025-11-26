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

    // Variabili di stato per tracciare le modifiche (più sicuro dei campi hidden)
    let CURRENT_EDITING_ID = null;
    let CURRENT_EDITING_INVOICE_ID = null;
    window.tempInvoiceLines = []; 

    // =========================================================
    // 1. FUNZIONI DI UTILITÀ E ACCESSO DATI
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

    // =========================================================
    // 2. GESTIONE DATI CLOUD
    // =========================================================

    async function loadAllDataFromCloud() {
        try {
            const companyDoc = await db.collection('settings').doc('companyInfo').get();
            if (companyDoc.exists) globalData.companyInfo = companyDoc.data();

            const collections = ['products', 'customers', 'invoices', 'notes'];
            for (const col of collections) {
                const snapshot = await db.collection(col).get();
                globalData[col] = snapshot.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
            }
            console.log("Dati sincronizzati:", globalData);
        } catch (e) { console.error("Errore Load Cloud:", e); }
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
                } else { console.error("ID mancante"); }
            }
        } catch (e) { alert("Errore Cloud: " + e.message); }
    }

    async function deleteDataFromCloud(collection, id) {
        if (confirm("Sei sicuro di voler eliminare questo elemento?")) {
            try {
                const strId = String(id);
                await db.collection(collection).doc(strId).delete();
                globalData[collection] = globalData[collection].filter(item => String(item.id) !== strId);
                renderAll();
            } catch (e) { alert("Errore eliminazione: " + e.message); }
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
    }

    function renderHomePage() { 
        if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
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
        const l = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        let h = `<h5 class="text-center">${now.toLocaleDateString('it-IT',{month:'long',year:'numeric'})}</h5><table class="table table-bordered text-center"><thead><tr><th>Dom</th><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th></tr></thead><tbody><tr>`;
        let d = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
        for(let i=0;i<d;i++) h+='<td></td>';
        for(let day=1;day<=l.getDate();day++){
            if(d===7){d=0;h+='</tr><tr>'}
            h+=`<td class="${day===t?'bg-primary text-white rounded-circle fw-bold':''}">${day}</td>`;
            d++;
        }
        h+='</tr></tbody></table>';
        c.html(h);
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

        let h = `<table class="table table-hover"><thead><tr><th>Cliente</th><th class="text-end">Netto</th><th class="text-end">%</th></tr></thead><tbody>`;
        Object.keys(cust).sort((a,b)=>cust[b]-cust[a]).forEach(cid=>{
            const c = getData('customers').find(x=>String(x.id)===String(cid))||{name:'?'};
            h+=`<tr><td>${c.name}</td><td class="text-end">€ ${cust[cid].toFixed(2)}</td><td class="text-end">${net>0?((cust[cid]/net)*100).toFixed(1):0}%</td></tr>`;
        });
        h+=`</tbody><tfoot><tr class="fw-bold"><td>TOTALE</td><td class="text-end">€ ${net.toFixed(2)}</td><td></td></tr></tfoot></table>`;
        container.html(h);
        
        const impF = facts.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        const impN = notes.reduce((s,i)=>s+safeFloat(i.totaleImponibile||i.total),0);
        renderTaxSimulation(impF, impN);
    }

    function renderTaxSimulation(fatt, note) {
        const c = getData('companyInfo');
        const coeff = safeFloat(c.coefficienteRedditivita);
        const tax = safeFloat(c.aliquotaSostitutiva);
        const inps = safeFloat(c.aliquotaContributi);
        
        if(!coeff || !tax || !inps) { $('#tax-simulation-container').html('Dati mancanti.'); return; }
        
        const gross = fatt - note;
        const taxable = gross * (coeff/100);
        const inpsDue = taxable * (inps/100);
        const netTax = taxable - inpsDue;
        const taxDue = netTax > 0 ? netTax * (tax/100) : 0;
        
        const h = `<div class="row"><div class="col-md-6"><div class="card"><div class="card-header">INPS</div><div class="card-body">
            <p>Imponibile: € ${taxable.toFixed(2)}</p><p>Dovuto: € ${inpsDue.toFixed(2)}</p><p>Acconti: € ${(inpsDue*0.4).toFixed(2)}</p>
        </div></div></div><div class="col-md-6"><div class="card"><div class="card-header">IMPOSTA</div><div class="card-body">
            <p>Netto: € ${netTax.toFixed(2)}</p><p>Dovuto: € ${taxDue.toFixed(2)}</p><p>Acconti: € ${(taxDue*0.5).toFixed(2)}</p>
        </div></div></div></div><h4 class="mt-3 text-center">Totale: € ${(inpsDue+taxDue).toFixed(2)}</h4>`;
        $('#tax-simulation-container').html(h);
    }

    function renderCompanyInfoForm() { const c = getData('companyInfo'); for (const k in c) $(`#company-${k}`).val(c[k]); }
    
    function renderProductsTable() { 
        const t = $('#products-table-body').empty(); 
        getData('products').forEach(p => { t.append(`<tr><td>${p.code}</td><td>${p.description}</td><td class="text-end">€ ${safeFloat(p.salePrice).toFixed(2)}</td><td class="text-end">${p.iva}%</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button></td></tr>`); }); 
    }
    
    function renderCustomersTable() { 
        const t = $('#customers-table-body').empty(); 
        getData('customers').forEach(c => { t.append(`<tr><td>${c.name}</td><td>${c.piva}</td><td>${c.sdi||''}</td><td>${c.address||''}</td><td class="text-end"><button class="btn btn-sm btn-primary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button></td></tr>`); }); 
    }
    
    function renderInvoicesTable() {
        const t = $('#invoices-table-body').empty();
        const invs = getData('invoices').sort((a,b) => (b.number||'').localeCompare(a.number||''));
        invs.forEach(i => {
            const c = getData('customers').find(x => String(x.id) === String(i.customerId)) || {name:'?'};
            const badge = i.type === 'Nota di Credito' ? '<span class="badge bg-warning text-dark">NdC</span>' : '<span class="badge bg-primary">Fatt.</span>';
            const status = (i.status==='Pagata'||i.status==='Emessa') ? '<span class="badge bg-success">OK</span>' : '<span class="badge bg-warning text-dark">Attesa</span>';
            const btns = `<div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${i.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-secondary btn-edit-invoice" data-id="${i.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${i.id}"><i class="fas fa-file-code"></i></button>
                <button class="btn btn-sm btn-success btn-mark-paid" data-id="${i.id}"><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${i.id}"><i class="fas fa-trash"></i></button></div>`;
            t.append(`<tr><td>${badge}</td><td class="fw-bold">${i.number}</td><td>${formatDateForDisplay(i.date)}</td><td>${c.name}</td><td class="text-end">€ ${safeFloat(i.total).toFixed(2)}</td><td class="text-end">${formatDateForDisplay(i.dataScadenza)}</td><td>${status}</td><td class="text-end">${btns}</td></tr>`);
        });
    }

    function populateDropdowns() {
        $('#invoice-customer-select').empty().append('<option selected disabled value="">Seleziona...</option>').append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));
        $('#invoice-product-select').empty().append('<option selected value="">Seleziona...</option><option value="manual">Manuale</option>').append(getData('products').map(p => `<option value="${p.id}">${p.code}</option>`));
    }

    // =========================================================
    // 4. EVENTI E LOGICA
    // =========================================================

    // AUTH
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            $('#login-container').addClass('d-none'); $('#loading-screen').removeClass('d-none');
            await loadAllDataFromCloud();
            $('#loading-screen').addClass('d-none'); $('#main-app').removeClass('d-none');
            renderAll();
        } else {
            currentUser = null;
            $('#main-app').addClass('d-none'); $('#login-container').removeClass('d-none');
        }
    });

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        auth.signInWithEmailAndPassword($('#email').val(), $('#password').val()).catch(err => $('#login-error').removeClass('d-none'));
    });
    $('#logout-btn').click(e => { e.preventDefault(); auth.signOut().then(() => location.reload()); });

    // NAVIGAZIONE
    $('.sidebar .nav-link').click(function(e) {
        if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return;
        e.preventDefault();
        const target = $(this).data('target');
        
        if(target === 'nuova-fattura-accompagnatoria') {
             // Se clicco direttamente il menu, vado alla fattura
             if(this.id === 'menu-nuova-nota-credito') prepareDocumentForm('Nota di Credito');
             else if(this.id === 'menu-nuova-fattura') return; // Aspetta il modale
             else prepareDocumentForm('Fattura');
        }
        
        $('.sidebar .nav-link').removeClass('active'); $(this).addClass('active');
        $('.content-section').addClass('d-none'); $('#' + target).removeClass('d-none');
    });

    // MODALE NUOVA FATTURA
    $('#newInvoiceChoiceModal').on('show.bs.modal', function () {
        const invoices = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined);
        invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
        const options = invoices.map(inv => `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`).join('');
        $('#copy-from-invoice-select').html('<option selected value="">Copia da esistente...</option>' + options);
    });

    $('#btn-create-new-blank-invoice').click(function() {
        $('#newInvoiceChoiceModal').modal('hide');
        $('.sidebar .nav-link').removeClass('active');
        $('.content-section').addClass('d-none'); $('#nuova-fattura-accompagnatoria').removeClass('d-none');
        prepareDocumentForm('Fattura');
    });

    $('#btn-copy-from-invoice').click(function() {
        const id = $('#copy-from-invoice-select').val();
        if(!id) return;
        $('#newInvoiceChoiceModal').modal('hide');
        $('.sidebar .nav-link').removeClass('active');
        $('.content-section').addClass('d-none'); $('#nuova-fattura-accompagnatoria').removeClass('d-none');
        loadInvoiceForEditing(id, true);
    });

    // CRUD CLIENTI
    $('#newCustomerBtn').click(() => { 
        CURRENT_EDITING_ID = null; $('#customerForm')[0].reset(); $('#customer-id').val('Nuovo'); $('#customerModal').modal('show'); 
    });
    $('#saveCustomerBtn').click(async () => {
        const data = {
            name: $('#customer-name').val(), piva: $('#customer-piva').val(), codiceFiscale: $('#customer-codiceFiscale').val(),
            sdi: $('#customer-sdi').val(), address: $('#customer-address').val(), comune: $('#customer-comune').val(),
            provincia: $('#customer-provincia').val(), cap: $('#customer-cap').val(), nazione: $('#customer-nazione').val(),
            rivalsaInps: $('#customer-rivalsaInps').is(':checked')
        };
        let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : String(getNextId(getData('customers')));
        await saveDataToCloud('customers', data, id); $('#customerModal').modal('hide'); renderAll();
    });
    $('#customers-table-body').on('click', '.btn-edit-customer', function(e) { editItem('customer', $(e.currentTarget).attr('data-id')); });
    $('#customers-table-body').on('click', '.btn-delete-customer', function(e) { deleteDataFromCloud('customers', $(e.currentTarget).attr('data-id')); });

    // CRUD PRODOTTI
    $('#newProductBtn').click(() => { 
        CURRENT_EDITING_ID = null; $('#productForm')[0].reset(); $('#product-id').val('Nuovo'); $('#product-iva').val('0').change(); $('#productModal').modal('show'); 
    });
    $('#saveProductBtn').click(async () => {
        const data = {
            description: $('#product-description').val(), code: $('#product-code').val(),
            salePrice: $('#product-salePrice').val(), iva: $('#product-iva').val(), esenzioneIva: $('#product-esenzioneIva').val()
        };
        let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : 'PRD' + Date.now();
        await saveDataToCloud('products', data, id); $('#productModal').modal('hide'); renderAll();
    });
    $('#products-table-body').on('click', '.btn-edit-product', function(e) { editItem('product', $(e.currentTarget).attr('data-id')); });
    $('#products-table-body').on('click', '.btn-delete-product', function(e) { deleteDataFromCloud('products', $(e.currentTarget).attr('data-id')); });
    $('#product-iva').change(function() { toggleEsenzioneIvaField('product', $(this).val()); });

    function editItem(type, id) {
        if(type==='customer'||type==='product') CURRENT_EDITING_ID = String(id);
        const item = getData(`${type}s`).find(i=>String(i.id)===String(id));
        if(!item) return;
        $(`#${type}Form`)[0].reset();
        $(`#${type}-id`).val(String(item.id));
        for(const k in item) {
            const f = $(`#${type}-${k}`);
            if(f.is(':checkbox')) f.prop('checked', item[k]); else f.val(item[k]);
        }
        if(type==='product') { $('#product-iva').change(); if(item.iva=='0') $('#product-esenzioneIva').val(item.esenzioneIva); }
        $(`#${type}Modal`).modal('show');
    }

    function toggleEsenzioneIvaField(c, v) { const d = c==='product'?$('#esenzione-iva-container'):$('#invoice-esenzione-iva-container'); if(v=='0')d.removeClass('d-none'); else d.addClass('d-none'); }

    // FATTURE
    $('#add-product-to-invoice-btn').click(() => {
        const d = $('#invoice-product-description').val();
        if(!d) return;
        const q = parseFloat($('#invoice-product-qty').val())||1;
        const p = parseFloat($('#invoice-product-price').val())||0;
        const iv = $('#invoice-product-iva').val();
        const es = $('#invoice-product-esenzioneIva').val();
        window.tempInvoiceLines.push({productName:d, qty:q, price:p, subtotal:q*p, iva:iv, esenzioneIva:es});
        renderLocalInvoiceLines();
        $('#invoice-product-select').val(''); $('#invoice-product-description').val(''); $('#invoice-product-price').val('');
    });

    function renderLocalInvoiceLines() {
        const t = $('#invoice-lines-tbody').empty();
        let tot = 0;
        window.tempInvoiceLines.forEach((l,i) => {
            tot += l.subtotal;
            t.append(`<tr><td>${l.productName}</td><td class="text-end">${l.qty}</td><td class="text-end">€ ${l.price.toFixed(2)}</td><td class="text-end">€ ${l.subtotal.toFixed(2)}</td><td class="text-center"><button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button></td></tr>`);
        });
        $('#invoice-total').text(tot.toFixed(2));
    }
    $('#invoice-lines-tbody').on('click', '.del-line', function() { window.tempInvoiceLines.splice($(this).data('i'),1); renderLocalInvoiceLines(); });

    $('#invoice-product-select').change(function() {
        const pid = $(this).val();
        const p = getData('products').find(x=>String(x.id)===String(pid));
        if(pid==='manual') {
             $('#invoice-product-description').val('').prop('readonly',false).focus();
             $('#invoice-product-price').val('');
             $('#invoice-product-iva').prop('disabled',false).val('0').change();
        } else if(p) {
             $('#invoice-product-description').val(p.description).prop('readonly',true);
             $('#invoice-product-price').val(p.salePrice);
             $('#invoice-product-iva').val(p.iva).prop('disabled',true).change();
             $('#invoice-product-esenzioneIva').val(p.esenzioneIva);
        }
    });
    $('#invoice-product-iva').change(function() { toggleEsenzioneIvaField('invoice', $(this).val()); });

    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();
        const cid = $('#invoice-customer-select').val();
        if(!cid || window.tempInvoiceLines.length===0) { alert("Dati mancanti"); return; }
        
        const type = $('#document-type').val();
        const total = parseFloat($('#invoice-total').text());
        
        const cust = getData('customers').find(c=>String(c.id)===String(cid));
        const comp = getData('companyInfo');
        
        let riv = {};
        if(cust && cust.rivalsaInps) riv = { aliquota: parseFloat(comp.aliquotaInps||0), importo: total*(parseFloat(comp.aliquotaInps||0)/100) };
        
        const data = {
            number: $('#invoice-number').val(), date: $('#invoice-date').val(), customerId: cid, type: type,
            lines: window.tempInvoiceLines, total: total + (riv.importo||0), totaleImponibile: total, rivalsa: riv,
            status: type==='Fattura'?'Da Incassare':'Emessa',
            dataScadenza: $('#invoice-dataScadenza').val(),
            condizioniPagamento: $('#invoice-condizioniPagamento').val(),
            modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            linkedInvoice: $('#linked-invoice').val(), reason: $('#reason').val()
        };

        if(CURRENT_EDITING_INVOICE_ID) {
            const old = getData('invoices').find(i=>String(i.id)===CURRENT_EDITING_INVOICE_ID);
            if(old) data.status = old.status;
        }

        let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices')));
        await saveDataToCloud('invoices', data, id);
        alert("Salvato!"); $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    function prepareDocumentForm(type) {
        CURRENT_EDITING_INVOICE_ID = null;
        $('#new-invoice-form')[0].reset();
        $('#invoice-id').val('Nuovo');
        $('#document-type').val(type);
        $('#invoice-lines-tbody').empty();
        window.tempInvoiceLines = [];
        populateDropdowns();
        const today = new Date().toISOString().slice(0,10);
        $('#invoice-date').val(today);
        if(type==='Nota di Credito') { $('#document-title').text('Nuova Nota Credito'); $('#credit-note-fields').removeClass('d-none'); }
        else { $('#document-title').text('Nuova Fattura'); $('#credit-note-fields').addClass('d-none'); }
        updateInvoiceNumber(type, today.substring(0,4));
    }

    function loadInvoiceForEditing(id, isCopy) {
        const inv = getData('invoices').find(i=>String(i.id)===String(id));
        if(!inv) return;
        const type = isCopy?'Fattura':(inv.type||'Fattura');
        prepareDocumentForm(type);
        
        if(!isCopy) {
            CURRENT_EDITING_INVOICE_ID = String(inv.id);
            $('#invoice-id').val(inv.id);
            $('#document-title').text(`Modifica ${type} ${inv.number}`);
        }
        
        $('#invoice-customer-select').val(inv.customerId);
        $('#invoice-date').val(isCopy ? new Date().toISOString().slice(0,10) : inv.date);
        if(!isCopy) $('#invoice-number').val(inv.number);
        
        $('#invoice-condizioniPagamento').val(inv.condizioniPagamento);
        $('#invoice-modalitaPagamento').val(inv.modalitaPagamento);
        $('#invoice-dataScadenza').val(inv.dataScadenza);
        $('#linked-invoice').val(inv.linkedInvoice);
        $('#reason').val(inv.reason);
        
        window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines));
        renderLocalInvoiceLines();
    }

    function updateInvoiceNumber(type, year) {
        if(CURRENT_EDITING_INVOICE_ID) return;
        const invs = getData('invoices');
        const docs = invs.filter(i => (i.type===type || (type==='Fattura' && !i.type)) && i.date.substring(0,4)===String(year));
        let next = 1;
        if(docs.length>0) next = Math.max(...docs.map(i=>parseInt(i.number.split('-').pop())||0)) + 1;
        const prefix = type==='Fattura'?'FATT':'NC';
        $('#invoice-number').val(`${prefix}-${year}-${String(next).padStart(2,'0')}`);
    }

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { loadInvoiceForEditing($(this).attr('data-id'), false); });
    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { deleteDataFromCloud('invoices', $(this).attr('data-id')); });
    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); const inv = getData('invoices').find(i=>String(i.id)===String(id));
        if(confirm("Cambio stato?")) { await saveDataToCloud('invoices', {status: inv.type==='Nota di Credito'?'Emessa':'Pagata'}, id); renderInvoicesTable(); }
    });

    $('#invoice-date').change(function() { updateInvoiceNumber($('#document-type').val(), $(this).val().substring(0,4)); });

    // XML
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

    // INFO AZIENDA
    $('#company-info-form').on('submit', async function(e) {
        e.preventDefault();
        const data = {};
        $(this).find('input, select').each(function() { if(this.id) data[this.id.replace('company-','')] = $(this).val(); });
        await saveDataToCloud('companyInfo', data);
        alert("Salvataggio completato!"); updateCompanyUI();
    });
    
    // DETTAGLIO FATTURA
    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const id = $(this).attr('data-id'); const inv = getData('invoices').find(i => String(i.id) === String(id));
        if(!inv) return;
        const c = getData('customers').find(x => String(x.id) === String(inv.customerId)) || {name:'?'};
        const comp = getData('companyInfo');
        $('#export-xml-btn').data('invoiceId', inv.id);
        $('#invoiceDetailModalTitle').text(`${inv.type||'Fattura'} N. ${inv.number}`);
        
        let h = `<div class="row"><div class="col-6"><strong>Emittente:</strong><br>${comp.name}<br>${comp.address}<br>P.IVA: ${comp.piva}</div>
                 <div class="col-6 text-end"><strong>Destinatario:</strong><br>${c.name}<br>${c.address}<br>P.IVA: ${c.piva}</div></div>
                 <hr><table class="table table-sm"><thead><tr><th>Desc</th><th>Qt</th><th>Prezzo</th><th>Tot</th></tr></thead><tbody>`;
        
        inv.lines.forEach(l => h += `<tr><td>${l.productName}</td><td>${l.qty}</td><td>€ ${l.price}</td><td>€ ${l.subtotal}</td></tr>`);
        h += `</tbody></table><h4 class="text-end">Totale: € ${parseFloat(inv.total).toFixed(2)}</h4>`;
        if(inv.type==='Nota di Credito' && inv.linkedInvoice) h+= `<p class="text-danger">Rettifica fattura: ${inv.linkedInvoice}</p>`;
        
        $('#invoiceDetailModalBody').html(h);
    });

    $('#save-notes-btn').click(async () => { await saveDataToCloud('notes', { userId: currentUser.uid, text: $('#notes-textarea').val() }, currentUser.uid); alert("Note salvate!"); });
});