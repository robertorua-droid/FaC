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
        console.error("Errore inizializzazione Firebase:", error);
        alert("Errore Firebase: " + error.message);
        return;
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

    function getData(key) {
        return globalData[key] || [];
    }

    function safeFloat(val) { 
        const n = parseFloat(val); 
        return isNaN(n) ? 0 : n; 
    }

    // =========================================================
    // 2. GESTIONE DATI CLOUD
    // =========================================================

    async function loadAllDataFromCloud() {
        try {
            // Azienda
            const companyDoc = await db.collection('settings').doc('companyInfo').get();
            if (companyDoc.exists) globalData.companyInfo = companyDoc.data();

            // Collezioni (non filtrate per utente, come da versione corrente)
            const collections = ['products', 'customers', 'invoices', 'notes'];
            for (const col of collections) {
                const snapshot = await db.collection(col).get();
                globalData[col] = snapshot.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
            }
            console.log("Dati sincronizzati:", globalData);
        } catch (e) { 
            console.error("Errore Load Cloud:", e); 
            throw e; 
        }
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
                    // Aggiorna cache locale
                    const index = globalData[collection].findIndex(item => String(item.id) === strId);
                    if (index > -1) {
                        globalData[collection][index] = { ...globalData[collection][index], ...dataObj };
                    } else {
                        globalData[collection].push({ id: strId, ...dataObj });
                    }
                } else { 
                    console.error("ID mancante"); 
                }
            }
        } catch (e) { 
            alert("Errore Cloud: " + e.message); 
        }
    }

    async function deleteDataFromCloud(collection, id) {
        if (confirm("Sei sicuro di voler eliminare questo elemento?")) {
            try {
                const strId = String(id);
                await db.collection(collection).doc(strId).delete();
                globalData[collection] = globalData[collection].filter(item => String(item.id) !== strId);
                renderAll();
            } catch (e) { 
                alert("Errore eliminazione: " + e.message); 
            }
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
        if (company.name) $('#company-name-sidebar').text(company.name);
        if (currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
    }

    function renderHomePage() { 
        if (currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
        const note = getData('notes').find(n => n.userId === currentUser.uid);
        if (note) $('#notes-textarea').val(note.text);
        renderCalendar();
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => $('#current-datetime').text(
            new Date().toLocaleDateString('it-IT', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            })
        );
        updateDateTime();
        dateTimeInterval = setInterval(updateDateTime, 1000);
    }

    function renderCalendar() {
        const c = $('#calendar-widget');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayDate = now.getDate();
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const totalDays = lastDay.getDate();
        let startingDay = firstDay.getDay(); 
        if (startingDay === 0) startingDay = 6; else startingDay -= 1;

        let html = `
<div class="card shadow-sm border-0">
  <div class="card-header bg-primary text-white text-center fw-bold">
    ${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}
  </div>
  <div class="card-body p-0">
    <table class="table table-bordered text-center mb-0" style="table-layout: fixed;">
      <thead class="table-light">
        <tr>
          <th>Lu</th><th>Ma</th><th>Me</th><th>Gi</th><th>Ve</th><th>Sa</th><th>Do</th>
        </tr>
      </thead>
      <tbody>
        <tr>
`;

        for (let i = 0; i < startingDay; i++) {
            html += `<td></td>`;
        }

        let dayOfWeek = startingDay;
        for (let day = 1; day <= totalDays; day++) {
            if (dayOfWeek > 6) {
                html += `</tr><tr>`;
                dayOfWeek = 0;
            }
            const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
            html += `<td><div class="${isToday}" style="width:2.2rem;height:2.2rem;line-height:2.2rem;margin:auto;">${day}</div></td>`;
            dayOfWeek++;
        }

        while (dayOfWeek <= 6) {
            html += `<td></td>`;
            dayOfWeek++;
        }

        html += `
        </tr>
      </tbody>
    </table>
  </div>
</div>
`;
        c.html(html);
    }

    function renderStatisticsPage() { 
        const container = $('#stats-table-container').empty();
        const facts = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '');
        const notes = getData('invoices').filter(i => i.type === 'Nota di Credito');
        if (facts.length === 0) { 
            container.html('<p class="text-muted">Nessun dato.</p>'); 
            renderTaxSimulation(0,0); 
            return; 
        }
        const totF = facts.reduce((s,i)=>s+safeFloat(i.total),0);
        const totN = notes.reduce((s,i)=>s+safeFloat(i.total),0);
        const net = totF - totN;

        let cust = {};
        facts.forEach(i=>{
            const c = String(i.customerId); 
            if(!cust[c]) cust[c]=0; 
            cust[c]+=safeFloat(i.total);
        });
        notes.forEach(i=>{
            const c = String(i.customerId); 
            if(cust[c]) cust[c]-=safeFloat(i.total);
        });

        let h = `
<div class="table-responsive">
<table class="table table-sm table-striped align-middle">
  <thead class="table-light">
    <tr>
      <th>Cliente</th>
      <th class="text-end">Fatturato Netto</th>
      <th class="text-end">% sul Totale</th>
    </tr>
  </thead>
  <tbody>
`;

        Object.keys(cust).sort((a,b)=>cust[b]-cust[a]).forEach(cid=>{
            const c = getData('customers').find(x=>String(x.id)===String(cid))||{name:'?'};
            const tot = cust[cid]; 
            const perc = net > 0 ? (tot / net) * 100 : 0;
            h+=`
    <tr>
      <td>${c.name}</td>
      <td class="text-end">€ ${tot.toFixed(2)}</td>
      <td class="text-end">${perc.toFixed(1)}%</td>
    </tr>`;
        });

        h += `
    <tr class="fw-bold table-secondary">
      <td>TOTALE</td>
      <td class="text-end">€ ${net.toFixed(2)}</td>
      <td class="text-end">100%</td>
    </tr>
  </tbody>
</table>
</div>`;

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
        if(!coeff || !taxRate || !inpsRate) { 
            container.html('<p class="text-muted">Dati mancanti per la simulazione fiscale.</p>'); 
            return; 
        }

        const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
        const taxableIncome = grossRevenue * (coeff / 100);
        const socialSecurity = taxableIncome * (inpsRate / 100);
        const netTaxable = taxableIncome - socialSecurity;
        const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0;
        const totalDue = socialSecurity + tax;

        const html = `
<div class="row g-3">
  <div class="col-md-6">
    <div class="card h-100">
      <div class="card-header bg-light fw-bold">Simulazione Contributi INPS</div>
      <div class="card-body">
        <p><strong>Reddito Lordo Imponibile:</strong><br>€ ${taxableIncome.toFixed(2)}</p>
        <p><strong>Aliquota Contributi INPS:</strong><br>${inpsRate}%</p>
        <p><strong>Contributi Totali Previsti:</strong><br>€ ${socialSecurity.toFixed(2)}</p>
        <p><strong>Stima Primo Acconto (40%):</strong><br>€ ${(socialSecurity*0.4).toFixed(2)}</p>
        <p><strong>Stima Secondo Acconto (40%):</strong><br>€ ${(socialSecurity*0.4).toFixed(2)}</p>
      </div>
    </div>
  </div>
  <div class="col-md-6">
    <div class="card h-100">
      <div class="card-header bg-light fw-bold">Simulazione Imposta Sostitutiva (IRPEF)</div>
      <div class="card-body">
        <p><strong>Reddito Lordo Imponibile:</strong><br>€ ${taxableIncome.toFixed(2)}</p>
        <p><strong>Contributi INPS Deducibili:</strong><br>- € ${socialSecurity.toFixed(2)}</p>
        <p><strong>Reddito Netto Imponibile:</strong><br>€ ${netTaxable.toFixed(2)}</p>
        <p><strong>Aliquota Imposta:</strong><br>${taxRate}%</p>
        <p><strong>Imposta Totale Prevista:</strong><br>€ ${tax.toFixed(2)}</p>
        <p><strong>Stima Primo Acconto (50%):</strong><br>€ ${(tax*0.5).toFixed(2)}</p>
        <p><strong>Stima Secondo Acconto (50%):</strong><br>€ ${(tax*0.5).toFixed(2)}</p>
      </div>
    </div>
  </div>
</div>
<div class="alert alert-info mt-3 mb-0">
  <strong>Totale Uscite Stimate (Contributi + Imposte):</strong> € ${totalDue.toFixed(2)}
</div>`;
        container.html(html);
    }

    function renderCompanyInfoForm() {
        const c = getData('companyInfo');
        for (const k in c) {
            $(`#company-${k}`).val(c[k]);
        }
    }

    function renderProductsTable() {
        const table = $('#products-table-body').empty();
        getData('products').forEach(p => { 
            const price = parseFloat(p.salePrice).toFixed(2);
            table.append(`
<tr>
  <td>${p.code}</td>
  <td>${p.description}</td>
  <td class="text-end">€ ${price}</td>
  <td class="text-center">${p.iva}%</td>
  <td class="text-end">
    <button class="btn btn-sm btn-outline-secondary me-1 btn-edit-product" data-id="${p.id}">
      <i class="fas fa-edit"></i>
    </button>
    <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}">
      <i class="fas fa-trash"></i>
    </button>
  </td>
</tr>`);
        });
    }

    function renderCustomersTable() {
        const table = $('#customers-table-body').empty();
        getData('customers').forEach(c => { 
            table.append(`
<tr>
  <td>${c.name}</td>
  <td>${c.piva}</td>
  <td>${c.sdi || '-'}</td>
  <td>${c.address || ''}</td>
  <td class="text-center">
    ${c.rivalsaInps ? '<span class="badge bg-info text-dark">Rivalsa INPS</span>' : ''}
  </td>
  <td class="text-end">
    <button class="btn btn-sm btn-outline-secondary me-1 btn-edit-customer" data-id="${c.id}">
      <i class="fas fa-edit"></i>
    </button>
    <button class="btn btn-sm btn-outline-danger btn-delete-customer" data-id="${c.id}">
      <i class="fas fa-trash"></i>
    </button>
  </td>
</tr>`);
        });
    }

    function renderInvoicesTable() {
        const table = $('#invoices-table-body').empty();
        const invoices = getData('invoices').sort((a, b) => (b.number || '').localeCompare(a.number || ''));
        invoices.forEach(inv => { 
            const c = getData('customers').find(cust => String(cust.id) === String(inv.customerId)) || { name: 'Sconosciuto' };
            const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
            const badge = inv.type === 'Nota di Credito' ? 'NdC' : 'Fatt.';

            let statusBadge = 'Da Incassare';
            if (inv.type === 'Nota di Credito') statusBadge = isPaid ? 'Emessa' : 'Bozza';
            else statusBadge = isPaid ? 'Pagata' : 'Da Incassare';

            const payClass = isPaid ? 'btn-secondary disabled' : 'btn-success';
            const editClass = isPaid ? 'btn-secondary disabled' : 'btn-outline-secondary';
            const deleteClass = isPaid ? 'btn-secondary disabled' : 'btn-outline-danger';

            const total = (parseFloat(inv.total) || 0).toFixed(2);

            const btns = `
<div class="btn-group btn-group-sm" role="group">
  <button class="btn btn-outline-primary btn-show-invoice" data-id="${inv.id}">
    <i class="fas fa-eye"></i>
  </button>
  <button class="btn ${editClass} btn-edit-invoice" data-id="${inv.id}">
    <i class="fas fa-edit"></i>
  </button>
  <button class="btn ${deleteClass} btn-delete-invoice" data-id="${inv.id}">
    <i class="fas fa-trash"></i>
  </button>
  <button class="btn ${payClass} btn-mark-paid" data-id="${inv.id}">
    <i class="fas fa-check"></i>
  </button>
</div>`;

            table.append(`
<tr>
  <td><span class="badge bg-secondary">${badge}</span></td>
  <td>${inv.number}</td>
  <td>${formatDateForDisplay(inv.date)}</td>
  <td>${c.name}</td>
  <td class="text-end">€ ${total}</td>
  <td>${formatDateForDisplay(inv.dataScadenza)}</td>
  <td>${statusBadge}</td>
  <td class="text-end">${btns}</td>
</tr>`);
        });
    }

    function populateDropdowns() {
        $('#invoice-customer-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append(
                getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`)
            );

        $('#invoice-product-select')
            .empty()
            .append('<option value="">Seleziona...</option><option value="manual">Manuale</option>')
            .append(
                getData('products').map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`)
            );
    }

    // =========================================================
    // 4. EVENT LISTENERS (AUTH, NAV, CRUD, FATTURE)
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
                initializeAppUI(); 
            } catch (error) { 
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
        auth.signInWithEmailAndPassword($('#email').val(), $('#password').val()).catch(err => { 
            $('#login-error').removeClass('d-none'); 
        }); 
    });

    $('#logout-btn').on('click', function(e) { 
        e.preventDefault(); 
        auth.signOut().then(() => location.reload()); 
    });

    // NAVIGAZIONE
    $('.sidebar .nav-link').on('click', function(e) { 
        if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return; 
        e.preventDefault(); 
        const target = $(this).data('target'); 
        if(target === 'nuova-fattura-accompagnatoria') { 
            if(this.id === 'menu-nuova-nota-credito') prepareDocumentForm('Nota di Credito'); 
            else if(this.id === 'menu-nuova-fattura') return; 
            else prepareDocumentForm('Fattura'); 
        }
        if(target === 'statistiche') renderStatisticsPage(); 
        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none'); 
    });

    // MODALE FATTURA: Scelta "nuova o copia da esistente"
    $('#newInvoiceChoiceModal').on('show.bs.modal', function () { 
        const invoices = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined); 
        invoices.sort((a, b) => new Date(b.date) - new Date(a.date)); 
        const options = invoices.map(inv => `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`).join(''); 
        $('#copy-from-invoice-select').html('<option value="">Copia da esistente...</option>' + options); 
    });

    $('#btn-create-new-blank-invoice').click(function() { 
        $('#newInvoiceChoiceModal').modal('hide'); 
        $('.sidebar .nav-link').removeClass('active'); 
        $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
        prepareDocumentForm('Fattura'); 
    });

    $('#btn-copy-from-invoice').click(function() { 
        const id = $('#copy-from-invoice-select').val(); 
        if(!id) return; 
        $('#newInvoiceChoiceModal').modal('hide'); 
        $('.sidebar .nav-link').removeClass('active'); 
        $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
        loadInvoiceForEditing(id, true); 
    });

    // =========================================================
    // CRUD ANAGRAFICHE
    // =========================================================

    function editItem(type, id) { 
        if (type === 'customer' || type === 'product') CURRENT_EDITING_ID = String(id); 
        const item = getData(`${type}s`).find(i => String(i.id) === String(id)); 
        if (!item) return; 
        $(`#${type}Form`)[0].reset(); 
        $(`#${type}ModalTitle`).text(`Modifica`); 
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

    $('#customers-table-body').on('click', '.btn-edit-customer', function(e) { 
        editItem('customer', $(e.currentTarget).attr('data-id')); 
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function(e) { 
        deleteDataFromCloud('customers', $(e.currentTarget).attr('data-id')); 
    });

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

    $('#products-table-body').on('click', '.btn-edit-product', function(e) { 
        editItem('product', $(e.currentTarget).attr('data-id')); 
    });

    $('#products-table-body').on('click', '.btn-delete-product', function(e) { 
        deleteDataFromCloud('products', $(e.currentTarget).attr('data-id')); 
    });

    $('#product-iva').change(function() { 
        toggleEsenzioneIvaField('product', $(this).val()); 
    });

    // =========================================================
    // FATTURE CORE
    // =========================================================

    function prepareDocumentForm(type) { 
        CURRENT_EDITING_INVOICE_ID = null; 
        $('#new-invoice-form')[0].reset(); 
        $('#invoice-id').val('Nuovo'); 
        $('#document-type').val(type); 
        $('#invoice-lines-tbody').empty(); 
        window.tempInvoiceLines = []; 
        populateDropdowns(); 
        const today = new Date().toISOString().slice(0, 10); 
        $('#invoice-date').val(today); 
        if (type === 'Nota di Credito') { 
            $('#document-title').text('Nuova Nota di Credito'); 
            $('#credit-note-fields').removeClass('d-none'); 
        } else { 
            $('#document-title').text('Nuova Fattura'); 
            $('#credit-note-fields').addClass('d-none'); 
        }
        updateInvoiceNumber(type, today.substring(0, 4)); 
        updateTotalsDisplay(); 
    }

    function loadInvoiceForEditing(id, isCopy) { 
        const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if (!inv) return; 
        const type = isCopy ? 'Fattura' : (inv.type || 'Fattura'); 
        prepareDocumentForm(type); 
        if (!isCopy) { 
            CURRENT_EDITING_INVOICE_ID = String(inv.id); 
            $('#invoice-id').val(inv.id); 
            $('#document-title').text(`Modifica ${type} ${inv.number}`); 
        }
        $('#invoice-customer-select').val(inv.customerId); 
        $('#invoice-date').val(isCopy ? new Date().toISOString().slice(0, 10) : inv.date); 
        if(!isCopy) $('#invoice-number').val(inv.number); 
        $('#invoice-condizioniPagamento').val(inv.condizioniPagamento); 
        $('#invoice-modalitaPagamento').val(inv.modalitaPagamento); 
        $('#invoice-dataScadenza').val(inv.dataScadenza); 
        if (type === 'Nota di Credito') { 
            $('#linked-invoice').val(inv.linkedInvoice); 
            $('#reason').val(inv.reason); 
        }
        window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines || [])); 
        renderLocalInvoiceLines(); 
        updateTotalsDisplay(); 
    }

    function updateInvoiceNumber(type, year) { 
        if (CURRENT_EDITING_INVOICE_ID) return; 
        const invs = getData('invoices').filter(i => 
            (i.type === type || (type==='Fattura' && !i.type)) && 
            i.date && i.date.substring(0, 4) === String(year)
        ); 
        let next = 1; 
        if (invs.length > 0) { 
            next = Math.max(...invs.map(i => parseInt((i.number || '').split('-').pop()) || 0)) + 1; 
        }
        $('#invoice-number').val(`${type==='Fattura'?'FATT':'NC'}-${year}-${String(next).padStart(2, '0')}`); 
    }

    // === LOGICA DI CALCOLO CORRETTA (Rivalsa INPS + Rivalsa Bollo) ===
    function updateTotalsDisplay() {
        const cid = $('#invoice-customer-select').val();
        const cust = getData('customers').find(c => String(c.id) === String(cid));
        const comp = getData('companyInfo');

        // Righe effettive di prestazione (escludo la riga "Rivalsa Bollo")
        const rows = window.tempInvoiceLines.filter(
            l => (l.productName || '').toLowerCase() !== 'rivalsa bollo'
        );

        // Riga bollo (se presente)
        const bollo = window.tempInvoiceLines.find(
            l => (l.productName || '').toLowerCase() === 'rivalsa bollo'
        );
        const impBollo = bollo ? safeFloat(bollo.subtotal) : 0;

        // Totale prestazioni
        const totPrest = rows.reduce((s, l) => s + safeFloat(l.subtotal), 0);

        // Rivalsa INPS se il cliente ha la spunta
        let riv = 0;
        if (cust && cust.rivalsaInps) {
            const aliqInps = safeFloat(comp.aliquotaInps || comp.aliquotaContributi || 0);
            riv = totPrest * (aliqInps / 100);
        }

        // Totale Documento = Prestazioni + Rivalsa + Bolli
        const totDoc = totPrest + riv + impBollo;

        $('#invoice-total').text(`€ ${totDoc.toFixed(2)}`);
        $('#invoice-tax-details').text(
            `(Imp: € ${(totPrest + riv).toFixed(2)} - Bollo: € ${impBollo.toFixed(2)})`
        );

        return { 
            totPrest, 
            riv, 
            impBollo, 
            totImp: totPrest + riv, 
            totDoc 
        };
    }

    $('#invoice-customer-select').change(updateTotalsDisplay);

    // Quando seleziono un servizio dalla tendina, compilo automaticamente la riga
    $('#invoice-product-select').on('change', function() {
        const selectedId = $(this).val();
        const descInput = $('#invoice-product-description');
        const qtyInput = $('#invoice-product-qty');
        const priceInput = $('#invoice-product-price');
        const ivaSelect = $('#invoice-product-iva');
        const esenzioneSelect = $('#invoice-product-esenzioneIva');

        if (!selectedId) {
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', true);
            ivaSelect.prop('disabled', true);
            esenzioneSelect.prop('disabled', true);
            toggleEsenzioneIvaField('invoice', ivaSelect.val());
            return;
        }

        if (selectedId === 'manual') {
            // Inserimento manuale
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', false);
            ivaSelect.prop('disabled', false);
            esenzioneSelect.prop('disabled', false);
            toggleEsenzioneIvaField('invoice', ivaSelect.val());
            return;
        }

        const p = getData('products').find(prod => String(prod.id) === String(selectedId));
        if (!p) {
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', true);
            ivaSelect.prop('disabled', true);
            esenzioneSelect.prop('disabled', true);
            toggleEsenzioneIvaField('invoice', ivaSelect.val());
            return;
        }

        descInput.val(p.description);
        priceInput.val(p.salePrice);
        qtyInput.val(1);
        ivaSelect.val(p.iva || '0');
        esenzioneSelect.val(p.esenzioneIva || 'N2.1');

        descInput.prop('readonly', true);
        ivaSelect.prop('disabled', true);
        esenzioneSelect.prop('disabled', true);
        toggleEsenzioneIvaField('invoice', ivaSelect.val());
    });

    $('#add-product-to-invoice-btn').click(() => {
        const d = $('#invoice-product-description').val();
        if (!d) {
            alert("Inserisci una descrizione o seleziona un servizio.");
            return;
        }
        const qty = parseFloat($('#invoice-product-qty').val()) || 1;
        const price = parseFloat($('#invoice-product-price').val()) || 0;
        const iva = $('#invoice-product-iva').val();
        const esenzioneIva = $('#invoice-product-esenzioneIva').val();

        const subtotal = qty * price;

        window.tempInvoiceLines.push({
            productName: d,
            qty,
            price,
            subtotal,
            iva,
            esenzioneIva
        });

        renderLocalInvoiceLines();
        updateTotalsDisplay();
    });

    function renderLocalInvoiceLines() {
        const t = $('#invoice-lines-tbody').empty();
        window.tempInvoiceLines.forEach((l, i) => {
            t.append(`
<tr>
  <td>${l.productName}</td>
  <td class="text-end">${l.qty}</td>
  <td class="text-end">€ ${l.price.toFixed(2)}</td>
  <td class="text-end">€ ${l.subtotal.toFixed(2)}</td>
  <td class="text-center">
    <button class="btn btn-sm btn-outline-danger del-line" data-i="${i}">
      <i class="fas fa-trash"></i>
    </button>
  </td>
</tr>`);
        });
    }

    $('#invoice-lines-tbody').on('click', '.del-line', function() { 
        window.tempInvoiceLines.splice($(this).data('i'), 1); 
        renderLocalInvoiceLines(); 
        updateTotalsDisplay(); 
    });

    $('#new-invoice-form').submit(async function(e) {
        e.preventDefault();

        const cid = $('#invoice-customer-select').val();
        if (!cid || window.tempInvoiceLines.length === 0) {
            alert("Dati incompleti.");
            return;
        }

        const type = $('#document-type').val();
        const calcs = updateTotalsDisplay();

        const data = {
            number: $('#invoice-number').val(),
            date: $('#invoice-date').val(),
            customerId: cid,
            type: type,
            lines: window.tempInvoiceLines,
            totalePrestazioni: calcs.totPrest,
            importoBollo: calcs.impBollo,
            rivalsa: { importo: calcs.riv },
            totaleImponibile: calcs.totImp,
            total: calcs.totDoc,
            status: (type === 'Fattura' ? 'Da Incassare' : 'Emessa'),
            dataScadenza: $('#invoice-dataScadenza').val(),
            condizioniPagamento: $('#invoice-condizioniPagamento').val(),
            modalitaPagamento: $('#invoice-modalitaPagamento').val(),
            linkedInvoice: $('#linked-invoice').val(),
            reason: $('#reason').val()
        };

        if (CURRENT_EDITING_INVOICE_ID) {
            const old = getData('invoices').find(i => String(i.id) === CURRENT_EDITING_INVOICE_ID);
            if (old) data.status = old.status;
        }

        let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices')));
        await saveDataToCloud('invoices', data, id);

        alert("Documento salvato!");
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).attr('data-id');
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if (!inv) return;
        if (inv.status === 'Pagata') return; // Blocco modifiche se pagata
        $('.sidebar .nav-link').removeClass('active'); 
        $('.sidebar .nav-link[data-target="nuova-fattura-accompagnatoria"]').addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
        loadInvoiceForEditing(id, false); 
    });

    $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if (!inv) return; 
        if (inv.status === 'Pagata') return; // Blocco cancellazione se pagata
        deleteDataFromCloud('invoices', id); 
    });

    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if (!inv) return; 
        if (!confirm("Confermi cambio stato?")) return; 
        await saveDataToCloud('invoices', { status: inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata' }, id); 
        renderInvoicesTable(); 
    });

    // =========================================================
    // EXPORT XML (LOGICA ALLINEATA A script_ok.js)
    // =========================================================

    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { 
        let id = $(this).attr('id') === 'export-xml-btn' ? $('#export-xml-btn').data('invoiceId') : $(this).attr('data-id'); 
        if (id) generateInvoiceXML(id); 
    });

    function generateInvoiceXML(invoiceId) {
        const invoice = getData('invoices').find(inv => String(inv.id) === String(invoiceId));
        if (!invoice) {
            alert("Errore: documento non trovato.");
            return;
        }

        const company = getData('companyInfo');
        const customer = getData('customers').find(c => String(c.id) === String(invoice.customerId));

        if (!company || !customer) {
            alert("Errore: anagrafica incompleta (azienda o cliente).");
            return;
        }

        let anagraficaCedente = `<Anagrafica><Denominazione>${escapeXML(company.name)}</Denominazione></Anagrafica>`;
        if (company.nome && company.cognome) {
            anagraficaCedente = `<Anagrafica><Nome>${escapeXML(company.nome)}</Nome><Cognome>${escapeXML(company.cognome)}</Cognome></Anagrafica>`;
        }

        // Riepilogo per Natura IVA
        const summaryByNature = {};
        (invoice.lines || []).forEach(l => {
            const iva = (l.iva || "0").toString();
            const natura = l.esenzioneIva || '';
            if (iva === "0" && natura) {
                const key = natura;
                if (!summaryByNature[key]) {
                    summaryByNature[key] = {
                        aliquota: iva,
                        natura: key,
                        imponibile: 0
                    };
                }
                summaryByNature[key].imponibile += safeFloat(l.subtotal);
            }
        });

        // Se c'è rivalsa INPS la trattiamo come Natura N4
        if (invoice.rivalsa && safeFloat(invoice.rivalsa.importo) > 0) {
            const k = "N4";
            if (!summaryByNature[k]) {
                summaryByNature[k] = {
                    aliquota: "0",
                    natura: k,
                    imponibile: 0
                };
            }
            summaryByNature[k].imponibile += safeFloat(invoice.rivalsa.importo);
        }

        // Se c'è bollo, lo sommiamo anch'esso a N4
        if (safeFloat(invoice.importoBollo) > 0) {
            const k = "N4";
            if (!summaryByNature[k]) {
                summaryByNature[k] = {
                    aliquota: "0",
                    natura: k,
                    imponibile: 0
                };
            }
            summaryByNature[k].imponibile += safeFloat(invoice.importoBollo);
        }

        let riepilogoXml = '';
        Object.values(summaryByNature).forEach(s => {
            riepilogoXml += `
<DatiRiepilogo>
  <AliquotaIVA>${parseFloat(s.aliquota).toFixed(2)}</AliquotaIVA>
  <Natura>${escapeXML(s.natura)}</Natura>
  <ImponibileImporto>${s.imponibile.toFixed(2)}</ImponibileImporto>
  <Imposta>0.00</Imposta>
</DatiRiepilogo>`;
        });

        // Numero progressivo univoco simile all'Agenzia
        const numeroProgressivo = (Math.random().toString(36) + '00000').slice(2,7);

        const provinciaUpper = escapeXML((customer.provincia || '').toUpperCase());

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXML(company.codiceFiscale || company.piva || '')}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${numeroProgressivo}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXML(customer.sdi || '0000000')}</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXML(company.piva || '')}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${escapeXML(company.codiceFiscale || '')}</CodiceFiscale>
        ${anagraficaCedente}
        <RegimeFiscale>${escapeXML(company.codiceRegimeFiscale || 'RF19')}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXML(company.address || '')}</Indirizzo>
        <NumeroCivico>${escapeXML(company.numeroCivico || '')}</NumeroCivico>
        <CAP>${escapeXML(company.zip || '')}</CAP>
        <Comune>${escapeXML(company.city || '')}</Comune>
        <Provincia>${escapeXML((company.province || '').toUpperCase())}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXML(customer.piva || '')}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${escapeXML(customer.codiceFiscale || '')}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${escapeXML(customer.name || '')}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXML(customer.address || '')}</Indirizzo>
        <CAP>${escapeXML(customer.cap || '')}</CAP>
        <Comune>${escapeXML(customer.comune || '')}</Comune>
        <Provincia>${provinciaUpper}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${invoice.type === 'Nota di Credito' ? 'TD04' : 'TD01'}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${invoice.date}</Data>
        <Numero>${escapeXML(invoice.number || '')}</Numero>
        <ImportoTotaleDocumento>${safeFloat(invoice.total).toFixed(2)}</ImportoTotaleDocumento>`;

        // Dati Bollo se presenti
        if (safeFloat(invoice.importoBollo) > 0) {
            xml += `
        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>${safeFloat(invoice.importoBollo).toFixed(2)}</ImportoBollo>
        </DatiBollo>`;
        }

        // Cassa previdenziale per rivalsa INPS (gestione separata)
        if (invoice.rivalsa && safeFloat(invoice.rivalsa.importo) > 0) {
            const imponibileCassa = safeFloat(invoice.totalePrestazioni || invoice.totaleImponibile);
            const importoCassa = safeFloat(invoice.rivalsa.importo);
            xml += `
        <DatiCassaPrevidenziale>
          <TipoCassa>TC22</TipoCassa>
          <AlCassa>${(safeFloat(company.aliquotaInps || company.aliquotaContributi || 0)).toFixed(2)}</AlCassa>
          <ImportoContributoCassa>${importoCassa.toFixed(2)}</ImportoContributoCassa>
          <ImponibileCassa>${imponibileCassa.toFixed(2)}</ImponibileCassa>
          <AliquotaIVA>0.00</AliquotaIVA>
          <Natura>N4</Natura>
        </DatiCassaPrevidenziale>`;
        }

        xml += `
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>`;

        let lineNumber = 1;
        (invoice.lines || []).forEach(l => {
            xml += `
      <DettaglioLinee>
        <NumeroLinea>${lineNumber++}</NumeroLinea>
        <Descrizione>${escapeXML(l.productName || '')}</Descrizione>
        <Quantita>${(safeFloat(l.qty)).toFixed(2)}</Quantita>
        <PrezzoUnitario>${(safeFloat(l.price)).toFixed(2)}</PrezzoUnitario>
        <PrezzoTotale>${(safeFloat(l.subtotal)).toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>${parseFloat(l.iva || '0').toFixed(2)}</AliquotaIVA>`;
            if ((l.iva || '0') === '0' && l.esenzioneIva) {
                xml += `
        <Natura>${escapeXML(l.esenzioneIva)}</Natura>`;
            }
            xml += `
      </DettaglioLinee>`;
        });

        xml += `
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
        <ImponibileImporto>${safeFloat(invoice.totalePrestazioni || invoice.totaleImponibile).toFixed(2)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
      </DatiRiepilogo>`;

        xml += riepilogoXml;

        xml += `
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>${escapeXML(invoice.condizioniPagamento || 'TP02')}</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <DataScadenzaPagamento>${escapeXML(invoice.dataScadenza || invoice.date)}</DataScadenzaPagamento>
        <ImportoPagamento>${safeFloat(invoice.total).toFixed(2)}</ImportoPagamento>
        ${company.iban ? `<IBAN>${escapeXML(company.iban)}</IBAN>` : ''}
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

        // Nome file: IT + PIVA + "_" + casuale 5 char
        const piva = (company.piva || '').replace(/[^0-9]/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const fileName = `IT${piva}_${randomSuffix}.xml`;

        const blob = new Blob([xml.trim()], { type: 'application/xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // =========================================================
    // NOTE, BACKUP/IMPORT & TIMEOUT INATTIVITÀ
    // =========================================================

    $('#save-notes-btn').click(async () => { 
        await saveDataToCloud('notes', { userId: currentUser.uid, text: $('#notes-textarea').val() }, currentUser.uid); 
        alert("Note salvate!");
    });

    $('#import-file-input').change(function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(evt) {
            try {
                const imported = JSON.parse(evt.target.result);
                // Qui la logica di import/migrazione dal vecchio JSON se necessario
                console.log("Dati importati:", imported);
                alert("File importato (logica di import da completare).");
            } catch (err) {
                alert("Errore lettura JSON: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    // TIMEOUT DI INATTIVITÀ (5 minuti)
    const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
    let inactivityTimer = null;
    let inactivityHandlersBound = false;

    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            if (auth && auth.currentUser) {
                alert("Sessione scaduta per inattività. Verrai disconnesso.");
                auth.signOut().then(() => location.reload());
            }
        }, INACTIVITY_LIMIT_MS);
    }

    function bindInactivityHandlers() {
        if (inactivityHandlersBound) return;
        inactivityHandlersBound = true;
        ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, resetInactivityTimer);
        });
        resetInactivityTimer();
    }

    function initializeAppUI() {
        renderAll();
        bindInactivityHandlers();
    }

});
