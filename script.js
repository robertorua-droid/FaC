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
    // TIMEOUT DI INATTIVITÀ (5 minuti)
    // =========================================================
    const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minuti
    let inactivityTimer = null;
    let inactivityHandlersBound = false;

    function handleInactivityLogout() {
        if (!currentUser) return; // già disconnesso

        // Piccolo messaggio all'utente
        alert("Sessione scaduta per inattività. Verrai disconnesso.");

        // Logout Firebase
        if (auth) {
            auth.signOut().catch(err => console.error("Errore nel logout per inattività:", err));
        }

        // Pulizia stato UI locale
        currentUser = null;
        resetInactivityTimer();
        $('#main-app').addClass('d-none');
        $('#loading-screen').addClass('d-none');
        $('#login-container').removeClass('d-none');
        $('#email').val('');
        $('#password').val('');
    }

    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (!currentUser) return; // se non è loggato, non serve il timer

        inactivityTimer = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
    }

    function bindInactivityHandlersOnce() {
        if (inactivityHandlersBound) return;
        inactivityHandlersBound = true;

        const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        events.forEach(ev => {
            document.addEventListener(ev, resetInactivityTimer, { passive: true });
        });
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
            const companyDoc = await db.collection('settings').doc('companyInfo').get();
            if (companyDoc.exists) globalData.companyInfo = companyDoc.data();

            const collections = ['products', 'customers', 'invoices', 'notes'];
            for (const col of collections) {
                const snapshot = await db.collection(col).get();
                globalData[col] = snapshot.docs.map(doc => ({ id: String(doc.id), ...doc.data() }));
            }
            console.log("Dati sincronizzati:", globalData);
        } catch (e) { 
            console.error("Errore Load Cloud:", e); 
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
        if(company.name) $('#company-name-sidebar').text(company.name);
        if(currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
    }

    function renderHomePage() { 
        if(currentUser) $('#welcome-message').text(`Benvenuto, ${currentUser.email}`); 
        const note = getData('notes').find(n => n.userId === (currentUser && currentUser.uid));
        if(note) $('#notes-textarea').val(note.text);
        renderCalendar();
        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => $('#current-datetime').text(new Date().toLocaleDateString('it-IT', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        }));
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
        
        let html = `
        <div class="card shadow-sm border-0">
            <div class="card-header bg-primary text-white text-center fw-bold">
                ${firstDay.toLocaleDateString('it-IT',{month:'long',year:'numeric'}).toUpperCase()}
            </div>
            <div class="card-body p-0">
                <table class="table table-bordered text-center mb-0" style="table-layout: fixed;">
                    <thead class="table-light">
                        <tr>
                            <th class="text-danger">Dom</th>
                            <th>Lun</th>
                            <th>Mar</th>
                            <th>Mer</th>
                            <th>Gio</th>
                            <th>Ven</th>
                            <th>Sab</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>`;
        for(let i = 0; i < startingDay; i++) { 
            html += '<td class="bg-light"></td>'; 
        }
        for(let day = 1; day <= totalDays; day++) {
            if (startingDay > 6) { 
                startingDay = 0; 
                html += '</tr><tr>'; 
            }
            const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
            html += `
                <td class="align-middle p-2">
                    <div class="${isToday}" style="width:32px; height:32px; line-height:32px; margin:0 auto;">
                        ${day}
                    </div>
                </td>`;
            startingDay++;
        }
        while(startingDay <= 6) { 
            html += '<td class="bg-light"></td>'; 
            startingDay++; 
        }
        html += `
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;
        c.html(html);
    }

    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty();
        const facts = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined || i.type === '');
        const notes = getData('invoices').filter(i => i.type === 'Nota di Credito');
        
        if(facts.length === 0) { 
            container.html('<div class="alert alert-info">Nessun dato.</div>'); 
            renderTaxSimulation(0,0); 
            return; 
        }

        const totF = facts.reduce((s,i)=>s+safeFloat(i.total),0);
        const totN = notes.reduce((s,i)=>s+safeFloat(i.total),0);
        const net = totF - totN;

        let cust = {};
        facts.forEach(i=>{
            const c=String(i.customerId); 
            if(!cust[c])cust[c]=0; 
            cust[c]+=safeFloat(i.total)
        });
        notes.forEach(i=>{
            const c=String(i.customerId); 
            if(cust[c])cust[c]-=safeFloat(i.total)
        });

        let h = `
        <div class="card shadow-sm mb-4 border-0">
            <div class="card-header fw-bold bg-white border-bottom">Dettaglio Clienti</div>
            <div class="card-body p-0">
                <table class="table table-striped mb-0 table-hover">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th class="text-end">Fatturato Netto</th>
                            <th class="text-end">% sul Totale</th>
                        </tr>
                    </thead>
                    <tbody>`;
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
        h+=`
                    </tbody>
                    <tfoot class="table-dark">
                        <tr>
                            <td>TOTALE</td>
                            <td class="text-end">€ ${net.toFixed(2)}</td>
                            <td class="text-end">100%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
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
            container.html('<div class="alert alert-warning">Dati mancanti.</div>'); 
            return; 
        }

        const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
        const taxableIncome = grossRevenue * (coeff / 100);
        const socialSecurity = taxableIncome * (inpsRate / 100);
        const netTaxable = taxableIncome - socialSecurity;
        const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0;
        const totalDue = socialSecurity + tax;

        const html = `
            <div class="row">
                <div class="col-lg-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header fw-bold">Simulazione Contributi INPS</div>
                        <div class="card-body">
                            <dl class="row mb-0">
                                <dt class="col-sm-8">Reddito Lordo Imponibile</dt>
                                <dd class="col-sm-4 text-end">€ ${taxableIncome.toFixed(2)}</dd>
                                <dt class="col-sm-8">Aliquota Contributi INPS</dt>
                                <dd class="col-sm-4 text-end">${inpsRate}%</dd>
                                <dt class="col-sm-8 h5 text-primary border-top pt-3">Contributi Totali Previsti</dt>
                                <dd class="col-sm-4 text-end h5 text-primary border-top pt-3">€ ${socialSecurity.toFixed(2)}</dd>
                                <hr class="my-3">
                                <dt class="col-sm-8 fw-normal">Stima Primo Acconto (40%)</dt>
                                <dd class="col-sm-4 text-end text-muted">€ ${(socialSecurity*0.4).toFixed(2)}</dd>
                                <dt class="col-sm-8 fw-normal">Stima Secondo Acconto (40%)</dt>
                                <dd class="col-sm-4 text-end text-muted">€ ${(socialSecurity*0.4).toFixed(2)}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6 mb-4">
                    <div class="card h-100">
                        <div class="card-header fw-bold">Simulazione Imposta Sostitutiva (IRPEF)</div>
                        <div class="card-body">
                            <dl class="row mb-0">
                                <dt class="col-sm-8">Reddito Lordo Imponibile</dt>
                                <dd class="col-sm-4 text-end">€ ${taxableIncome.toFixed(2)}</dd>
                                <dt class="col-sm-8">Contributi INPS Deducibili</dt>
                                <dd class="col-sm-4 text-end text-danger">- € ${socialSecurity.toFixed(2)}</dd>
                                <dt class="col-sm-8 border-top pt-2">Reddito Netto Imponibile</dt>
                                <dd class="col-sm-4 text-end border-top pt-2">€ ${netTaxable.toFixed(2)}</dd>
                                <dt class="col-sm-8">Aliquota Imposta</dt>
                                <dd class="col-sm-4 text-end">${taxRate}%</dd>
                                <dt class="col-sm-8 h5 text-primary border-top pt-3">Imposta Totale Prevista</dt>
                                <dd class="col-sm-4 text-end h5 text-primary border-top pt-3">€ ${tax.toFixed(2)}</dd>
                                <hr class="my-3">
                                <dt class="col-sm-8 fw-normal">Stima Primo Acconto (50%)</dt>
                                <dd class="col-sm-4 text-end text-muted">€ ${(tax*0.5).toFixed(2)}</dd>
                                <dt class="col-sm-8 fw-normal">Stima Secondo Acconto (50%)</dt>
                                <dd class="col-sm-4 text-end text-muted">€ ${(tax*0.5).toFixed(2)}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card bg-light mt-4">
                <div class="card-body d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">Totale Uscite Stimate (Contributi + Imposte)</h5>
                    <h5 class="card-title mb-0">€ ${totalDue.toFixed(2)}</h5>
                </div>
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
                    <td class="text-end">${p.iva}%</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary btn-edit-product" data-id="${p.id}">
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
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary btn-edit-customer" data-id="${c.id}">
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
            
            const badge = inv.type === 'Nota di Credito' 
                ? '<span class="badge bg-warning text-dark border border-dark">NdC</span>' 
                : '<span class="badge bg-primary">Fatt.</span>';
            let statusBadge = '<span class="badge bg-warning text-dark">Da Incassare</span>';
            if (inv.type === 'Nota di Credito') {
                statusBadge = isPaid 
                    ? '<span class="badge bg-info text-dark">Emessa</span>' 
                    : '<span class="badge bg-secondary">Bozza</span>';
            } else {
                statusBadge = isPaid 
                    ? '<span class="badge bg-success">Pagata</span>' 
                    : '<span class="badge bg-warning text-dark">Da Incassare</span>';
            }
            
            const payClass = isPaid ? 'btn-secondary disabled' : 'btn-success';
            const editClass = isPaid ? 'btn-secondary disabled' : 'btn-outline-secondary';
            const deleteDisabled = isPaid ? 'disabled' : '';
            const btnDelete = `
                <button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" title="Elimina" ${deleteDisabled}>
                    <i class="fas fa-trash"></i>
                </button>`;

            const btns = `
                <div class="d-flex justify-content-end gap-1">
                    <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" title="Vedi">
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
            table.append(`
                <tr class="${isPaid?'table-light text-muted':''}">
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
        $('#invoice-customer-select')
            .empty()
            .append('<option selected disabled value="">Seleziona...</option>')
            .append(getData('customers').map(c => `<option value="${c.id}">${c.name}</option>`));

        $('#invoice-product-select')
            .empty()
            .append('<option selected value="">Seleziona...</option><option value="manual">Manuale</option>')
            .append(getData('products').map(p => `<option value="${p.id}">${p.code} - ${p.description}</option>`));
    }

    // =========================================================
    // 4. EVENT LISTENERS
    // =========================================================

    // AUTH
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;

            // Reset timer inattività e bind degli handler
            resetInactivityTimer();
            bindInactivityHandlersOnce();

            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none');
            try {
                await loadAllDataFromCloud();
                $('#loading-screen').addClass('d-none');
                $('#main-app').removeClass('d-none');
                renderAll();
            } catch (error) {
                alert("Errore DB: " + error.message);
                $('#loading-screen').addClass('d-none');
            }
        } else {
            currentUser = null;
            resetInactivityTimer();
            $('#main-app').addClass('d-none');
            $('#loading-screen').addClass('d-none');
            $('#login-container').removeClass('d-none');
        }
    });

    $('#login-form').on('submit', function(e) {
        e.preventDefault();
        $('#login-error').addClass('d-none');
        $('#btn-login-submit').attr('disabled', true);
        $('#login-spinner').removeClass('d-none');
        auth.signInWithEmailAndPassword($('#email').val(), $('#password').val())
            .catch(err => {
                console.error(err);
                $('#login-error').removeClass('d-none');
            })
            .finally(() => {
                $('#btn-login-submit').attr('disabled', false);
                $('#login-spinner').addClass('d-none');
            });
    });

    $('#logout-btn').on('click', function(e) { 
        e.preventDefault(); 
        if (auth) {
            auth.signOut().then(() => {
                // Pulizia locale
                currentUser = null;
                resetInactivityTimer();
                $('#main-app').addClass('d-none');
                $('#loading-screen').addClass('d-none');
                $('#login-container').removeClass('d-none');
                $('#email').val('');
                $('#password').val('');
            });
        }
    });

    // NAVIGAZIONE
    $('.sidebar .nav-link').on('click', function(e) { 
        if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return; 
        e.preventDefault(); 
        const target = $(this).data('target'); 
        if(target === 'nuova-fattura-accompagnatoria') { 
            if(this.id === 'menu-nuova-nota-credito') {
                prepareDocumentForm('Nota di Credito'); 
            } else if(this.id === 'menu-nuova-fattura') {
                return; 
            } else {
                prepareDocumentForm('Fattura'); 
            }
        } 
        if(target === 'statistiche') renderStatisticsPage(); 
        $('.sidebar .nav-link').removeClass('active'); 
        $(this).addClass('active'); 
        $('.content-section').addClass('d-none'); 
        $('#' + target).removeClass('d-none'); 
    });

    // MODALE FATTURA
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

    // CRUD ANAGRAFICHE (Con ID sicuro)
    function editItem(type, id) { 
        if (type === 'customer' || type === 'product') {
            CURRENT_EDITING_ID = String(id); 
        }
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
        const val = $(this).val();
        if (val === '0') {
            $('#esenzione-iva-container').removeClass('d-none');
        } else {
            $('#esenzione-iva-container').addClass('d-none');
        }
    }); 

    // FATTURE CORE
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
        $('#invoice-dataRiferimento').val(inv.dataRiferimento); 
        $('#invoice-giorniTermini').val(inv.giorniTermini); 
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

    // Quando seleziono un servizio dalla tendina, compilo automaticamente la riga
    $('#invoice-product-select').on('change', function() {
        const selectedId = $(this).val();
        const descInput = $('#invoice-product-description');
        const priceInput = $('#invoice-product-price');
        const qtyInput = $('#invoice-product-qty');
        const ivaSelect = $('#invoice-product-iva');
        const esenzioneSelect = $('#invoice-product-esenzioneIva');

        if (!selectedId) {
            // Nessuna scelta: reset campi
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', true);
            ivaSelect.prop('disabled', true);
            esenzioneSelect.prop('disabled', true);
            $('#invoice-esenzione-iva-container').addClass('d-none');
            return;
        }

        if (selectedId === 'manual') {
            // Modalità manuale: l'utente digita descrizione e prezzo
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', false);
            ivaSelect.prop('disabled', true);
            esenzioneSelect.prop('disabled', true);
            $('#invoice-esenzione-iva-container').addClass('d-none');
            return;
        }

        const p = getData('products').find(prod => String(prod.id) === String(selectedId));
        if (!p) {
            // Se per qualche motivo non trovo il prodotto, reset
            descInput.val('');
            priceInput.val('');
            qtyInput.val(1);
            ivaSelect.val('0');
            esenzioneSelect.val('N2.1');
            descInput.prop('readonly', true);
            ivaSelect.prop('disabled', true);
            esenzioneSelect.prop('disabled', true);
            $('#invoice-esenzione-iva-container').addClass('d-none');
            return;
        }

        descInput.val(p.description || '');
        priceInput.val(p.salePrice || '');
        qtyInput.val(1);
        ivaSelect.val(p.iva || '0');

        if (p.iva === '0') {
            $('#invoice-esenzione-iva-container').removeClass('d-none');
            esenzioneSelect.val(p.esenzioneIva || 'N2.1');
            ivaSelect.prop('disabled', false);
            esenzioneSelect.prop('disabled', false);
        } else {
            $('#invoice-esenzione-iva-container').addClass('d-none');
            esenzioneSelect.val(p.esenzioneIva || 'N2.1');
            ivaSelect.prop('disabled', false);
            esenzioneSelect.prop('disabled', true);
        }
    });

    $('#add-product-to-invoice-btn').click(() => { 
        const d = $('#invoice-product-description').val(); 
        if(!d) return; 
        const qty = parseFloat($('#invoice-product-qty').val())||1;
        const price = parseFloat($('#invoice-product-price').val())||0;
        const subtotal = qty * price;
        window.tempInvoiceLines.push({ 
            productName: d, 
            qty: qty, 
            price: price, 
            subtotal: subtotal, 
            iva: $('#invoice-product-iva').val(), 
            esenzioneIva: $('#invoice-product-esenzioneIva').val() 
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
                        <button type="button" class="btn btn-sm btn-outline-danger del-line" data-i="${i}">
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

    function updateTotalsDisplay() {
        const cid = $('#invoice-customer-select').val();
        const cust = getData('customers').find(c => String(c.id) === String(cid));
        const comp = getData('companyInfo');

        if (!cust || !comp) {
            $('#invoice-total').text('€ 0,00');
            $('#invoice-tax-details').text('');
            return { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, totDoc: 0 };
        }

        // 1) Individuare riga "Rivalsa Bollo", se presente
        const rows = window.tempInvoiceLines.filter(l => 
            l.productName.toLowerCase() !== 'rivalsa bollo'
        );
        const bollo = window.tempInvoiceLines.find(l => 
            l.productName.toLowerCase() === 'rivalsa bollo'
        );
        const impBollo = bollo ? safeFloat(bollo.subtotal) : 0;

        // 2) Totale prestazioni (esclude la riga "Rivalsa Bollo")
        const totPrest = rows.reduce((s, l) => s + safeFloat(l.subtotal), 0);

        // 3) Rivalsa INPS se il cliente la prevede
        let riv = 0;
        const aliquotaInps = parseFloat(comp.aliquotaInps || comp.aliquotaContributi || 0);
        if (cust.rivalsaInps && aliquotaInps > 0) {
            riv = totPrest * (aliquotaInps / 100);
        }

        // 4) Totale Imponibile (Prestazioni + eventuale rivalsa INPS)
        const totImp = totPrest + riv;

        // 5) Totale Documento (Imponibile + marca da bollo, se presente)
        const totDoc = totImp + impBollo;

        // 6) Aggiornamento UI
        $('#invoice-total').text(`€ ${totDoc.toFixed(2)}`);
        $('#invoice-tax-details').text(
            `(Imp: € ${totImp.toFixed(2)} - Bollo: € ${impBollo.toFixed(2)})`
        );

        return { totPrest, riv, impBollo, totImp, totDoc };
    }

    $('#invoice-customer-select').change(updateTotalsDisplay);

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
            reason: $('#reason').val(),
            dataRiferimento: $('#invoice-dataRiferimento').val(),
            giorniTermini: $('#invoice-giorniTermini').val()
        }; 
        if (CURRENT_EDITING_INVOICE_ID) { 
            const old = getData('invoices').find(i => String(i.id) === CURRENT_EDITING_INVOICE_ID); 
            if(old) data.status = old.status; 
        } 
        let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices'))); 
        await saveDataToCloud('invoices', data, id); 
        alert("Salvato!"); 
        $('.sidebar .nav-link[data-target="elenco-fatture"]').click(); 
    });

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if (!inv) return;

        if (inv.status === 'Pagata') {
            alert("Non è possibile modificare una fattura già pagata.");
            return;
        }

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

        if (inv.status === 'Pagata') {
            alert("Non è possibile cancellare una fattura già pagata.");
            return;
        }

        deleteDataFromCloud('invoices', id); 
    });

    $('#invoices-table-body').on('click', '.btn-mark-paid', async function() { 
        const id = $(this).attr('data-id'); 
        const inv = getData('invoices').find(i => String(i.id) === String(id)); 
        if(confirm("Confermi cambio stato?")) { 
            await saveDataToCloud('invoices', { 
                status: inv.type === 'Nota di Credito' ? 'Emessa' : 'Pagata' 
            }, id); 
            renderInvoicesTable(); 
        } 
    });

    // XML
    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { 
        let id = $(this).attr('id') === 'export-xml-btn' 
            ? $('#export-xml-btn').data('invoiceId') 
            : $(this).attr('data-id');
        if (id) generateInvoiceXML(id); 
    });

    function generateInvoiceXML(invoiceId) {
        const invoice = getData('invoices').find(inv => String(inv.id) === String(invoiceId));
        if (!invoice) {
            alert("Errore: fattura non trovata.");
            return;
        }

        const company = getData('companyInfo');
        const customer = getData('customers').find(c => String(c.id) === String(invoice.customerId)) || {};

        // -----------------------------
        // 1. Dati monetari principali
        // -----------------------------
        const totalePrestazioni = safeFloat(invoice.totalePrestazioni);
        const importoBollo = safeFloat(invoice.importoBollo);
        const importoRivalsa = invoice.rivalsa ? safeFloat(invoice.rivalsa.importo) : 0;
        const totaleImponibile = safeFloat(invoice.totaleImponibile);
        const totaleDocumento = safeFloat(invoice.total);

        // -----------------------------
        // 2. Anagrafica Cedente/Prestatore
        // -----------------------------
        let anagraficaCedente = `${escapeXML(company.name || '')}`;
        if (company.nome && company.cognome) {
            anagraficaCedente = `${escapeXML(company.nome)} ${escapeXML(company.cognome)}`;
        }

        const nazioneCedente = (company.nazione || 'IT');
        const nazioneCedenteIso = (!nazioneCedente || nazioneCedente.trim().toUpperCase() === 'ITALIA') 
            ? 'IT' 
            : nazioneCedente.trim().toUpperCase();

        const nazioneCessionario = (customer.nazione || 'IT');
        const nazioneCessionarioIso = (!nazioneCessionario || nazioneCessionario.trim().toUpperCase() === 'ITALIA') 
            ? 'IT' 
            : nazioneCessionario.trim().toUpperCase();

        const provCedente = (company.province || '').toUpperCase();
        const provCessionario = (customer.provincia || '').toUpperCase();

        // -----------------------------
        // 3. Riepilogo aliquote/nature
        // -----------------------------
        const summaryByNature = {};

        (invoice.lines || []).forEach(l => {
            if (l.iva == "0" && l.esenzioneIva) {
                const k = l.esenzioneIva;
                if (!summaryByNature[k]) {
                    summaryByNature[k] = {
                        aliquota: l.iva,
                        natura: k,
                        imponibile: 0
                    };
                }
                summaryByNature[k].imponibile += safeFloat(l.subtotal);
            }
        });

        // Rivalsa INPS in N4
        if (importoRivalsa > 0) {
            const k = "N4";
            if (!summaryByNature[k]) {
                summaryByNature[k] = {
                    aliquota: "0.00",
                    natura: k,
                    imponibile: 0
                };
            }
            summaryByNature[k].imponibile += importoRivalsa;
        }

        let riepilogoXml = "";
        Object.values(summaryByNature).forEach(s => {
            riepilogoXml += `
                <DatiRiepilogo>
                    <AliquotaIVA>${parseFloat(s.aliquota).toFixed(2)}</AliquotaIVA>
                    <Natura>${escapeXML(s.natura)}</Natura>
                    <ImponibileImporto>${s.imponibile.toFixed(2)}</ImponibileImporto>
                    <Imposta>0.00</Imposta>
                </DatiRiepilogo>`;
        });

        // -----------------------------
        // 4. XML vero e proprio
        // -----------------------------
        const prog = (Math.random().toString(36)+'00000').slice(2,7).toUpperCase();
        const fileNameBase = `IT${escapeXML(company.codiceFiscale || company.piva || '')}_${prog}`;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12" xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXML(company.codiceFiscale || company.piva || '')}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${prog}</ProgressivoInvio>
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
        <Anagrafica>
          <Denominazione>${anagraficaCedente}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${escapeXML(company.codiceRegimeFiscale || 'RF19')}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXML(company.address || '')}</Indirizzo>
        <NumeroCivico>${escapeXML(company.numeroCivico || '')}</NumeroCivico>
        <CAP>${escapeXML(company.zip || '')}</CAP>
        <Comune>${escapeXML(company.city || '')}</Comune>
        <Provincia>${escapeXML(provCedente)}</Provincia>
        <Nazione>${escapeXML(nazioneCedenteIso)}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXML(customer.piva || customer.codiceFiscale || '')}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${escapeXML(customer.codiceFiscale || customer.piva || '')}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${escapeXML(customer.name || '')}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXML(customer.address || '')}</Indirizzo>
        <CAP>${escapeXML(customer.cap || '')}</CAP>
        <Comune>${escapeXML(customer.comune || '')}</Comune>
        <Provincia>${escapeXML(provCessionario)}</Provincia>
        <Nazione>${escapeXML(nazioneCessionarioIso)}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${invoice.type==='Nota di Credito'?'TD04':'TD01'}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${invoice.date}</Data>
        <Numero>${escapeXML(invoice.number || '')}</Numero>
        <ImportoTotaleDocumento>${totaleDocumento.toFixed(2)}</ImportoTotaleDocumento>`;

        if (invoice.type === 'Nota di Credito' && invoice.reason) {
            xml += `
        <Causale>${escapeXML(invoice.reason)}</Causale>`;
        }

        if (importoBollo > 0) {
            xml += `
        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>${importoBollo.toFixed(2)}</ImportoBollo>
        </DatiBollo>`;
        }

        xml += `
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>`;

        let lineNumber = 1;
        (invoice.lines || []).forEach(l => {
            const qty = safeFloat(l.qty);
            const price = safeFloat(l.price);
            const tot = safeFloat(l.subtotal);
            const aliquotaIva = safeFloat(l.iva);
            const natura = (aliquotaIva === 0 ? (l.esenzioneIva || 'N2.1') : '');

            xml += `
      <DettaglioLinee>
        <NumeroLinea>${lineNumber++}</NumeroLinea>
        <Descrizione>${escapeXML(l.productName || '')}</Descrizione>
        <Quantita>${qty.toFixed(2)}</Quantita>
        <PrezzoUnitario>${price.toFixed(2)}</PrezzoUnitario>
        <PrezzoTotale>${tot.toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>${aliquotaIva.toFixed(2)}</AliquotaIVA>`;
            if (natura) {
                xml += `
        <Natura>${escapeXML(natura)}</Natura>`;
            }
            xml += `
      </DettaglioLinee>`;
        });

        if (importoRivalsa > 0) {
            xml += `
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N4</Natura>
        <ImponibileImporto>${importoRivalsa.toFixed(2)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
      </DatiRiepilogo>`;
        }

        xml += `
      ${riepilogoXml}
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>${invoice.condizioniPagamento ? 'TP02' : 'TP01'}</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>`;
        if (invoice.dataScadenza) {
            xml += `
        <DataScadenzaPagamento>${invoice.dataScadenza}</DataScadenzaPagamento>`;
        }
        xml += `
        <ImportoPagamento>${totaleDocumento.toFixed(2)}</ImportoPagamento>
        <IBAN>${escapeXML(company.iban || '')}</IBAN>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

        const blob = new Blob([xml], { type: 'application/xml' });

        // nome file: IT<piva>_<5caratteri>.xml
        const basePiva = escapeXML(company.piva || company.codiceFiscale || 'ITXXXXXX');
        const rand5 = Math.random().toString(36).substring(2,7);
        const filename = `IT${basePiva}_${rand5}.xml`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }

    // VISUALIZZAZIONE DETTAGLIO FATTURA (modale)
    $('#invoices-table-body').on('click', '.btn-view-invoice', function () {
        const id = $(this).attr('data-id');
        const inv = getData('invoices').find(i => String(i.id) === String(id));
        if (!inv) return;

        const c = getData('customers').find(x => String(x.id) === String(inv.customerId)) || {};

        // collega il pulsante XML alla fattura corrente
        $('#export-xml-btn').data('invoiceId', inv.id);
        $('#invoiceDetailModalTitle').text(`${inv.type} ${inv.number}`);

        // intestazione: cliente
        let h = `
        <h5>${escapeXML(c.name || '')}</h5>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Descrizione</th>
                    <th class="text-end">Totale</th>
                </tr>
            </thead>
            <tbody>
        `;

        // righe dettaglio documento
        (inv.lines || []).forEach(l => {
            const desc = escapeXML(l.productName || '');
            const tot = (parseFloat(l.subtotal) || 0).toFixed(2);
            h += `<tr><td>${desc}</td><td class="text-end">€ ${tot}</td></tr>`;
        });

        // calcoli riepilogo usando i valori salvati sulla fattura
        const totalePrestazioni = safeFloat(inv.totalePrestazioni);
        const importoBollo = safeFloat(inv.importoBollo);
        const importoRivalsa = inv.rivalsa ? safeFloat(inv.rivalsa.importo) : 0;
        const totaleImponibile = safeFloat(inv.totaleImponibile);
        const totaleDocumento = safeFloat(inv.total);

        // blocco riepilogo
        h += `
            </tbody>
        </table>
        <hr>
        <div class="row">
            <div class="col-md-6"></div>
            <div class="col-md-6">
                <table class="table table-sm mb-0">
                    <tbody>
                        <tr>
                            <th>Totale prestazioni</th>
                            <td class="text-end">€ ${totalePrestazioni.toFixed(2)}</td>
                        </tr>
        `;

        if (importoRivalsa > 0) {
            h += `
                        <tr>
                            <th>Rivalsa INPS</th>
                            <td class="text-end">€ ${importoRivalsa.toFixed(2)}</td>
                        </tr>
            `;
        }

        h += `
                        <tr>
                            <th>Totale imponibile</th>
                            <td class="text-end">€ ${totaleImponibile.toFixed(2)}</td>
                        </tr>
        `;

        if (importoBollo > 0) {
            h += `
                        <tr>
                            <th>Marca da bollo</th>
                            <td class="text-end">€ ${importoBollo.toFixed(2)}</td>
                        </tr>
            `;
        }

        h += `
                        <tr class="fw-bold border-top">
                            <th>Totale documento</th>
                            <td class="text-end">€ ${totaleDocumento.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        `;

        $('#invoiceDetailModalBody').html(h);

        // apertura sicura della modale (anche se i data-bs-* non venissero letti)
        const modalEl = document.getElementById('invoiceDetailModal');
        if (modalEl && window.bootstrap && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        }
    });

    $('#print-invoice-btn').click(()=>window.print());

    // Salvataggio anagrafica azienda
    $('#company-info-form').on('submit', async function(e) { 
        e.preventDefault(); 
        const d={}; 
        $(this).find('input, select, textarea').each(function(){
            if(this.id) {
                const key = this.id.replace('company-','');
                d[key] = $(this).val();
            }
        }); 
        await saveDataToCloud('companyInfo', d, 'companyInfo'); 
        alert("Dati azienda salvati."); 
        renderAll(); 
    });

    // Salvataggio note (home)
    $('#save-notes-btn').click(async function() { 
        if (!currentUser) return; 
        const text = $('#notes-textarea').val(); 
        const noteData = { userId: currentUser.uid, text }; 
        await saveDataToCloud('notes', noteData, currentUser.uid); 
        alert("Note salvate nel cloud."); 
    }); 

    // Export JSON (backup utente corrente)
    $('#export-json-btn').click(function() {
        if (!currentUser) {
            alert("Nessun utente loggato.");
            return;
        }
        const backup = JSON.stringify(globalData, null, 2);
        const blob = new Blob([backup], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const today = new Date().toISOString().slice(0,10);
        a.download = `gestionale-backup-${today}.json`;
        a.click();
    });

    // Import JSON (nuovo formato multi-utente)
    $('#import-file-input').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!currentUser) {
            alert("Devi essere loggato per importare dati.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(evt) {
            try {
                const data = JSON.parse(evt.target.result);
                if (!data) {
                    alert("File JSON non valido.");
                    return;
                }

                if (data.companyInfo) {
                    await saveDataToCloud('companyInfo', data.companyInfo, 'companyInfo');
                }
                if (Array.isArray(data.customers)) {
                    for (const c of data.customers) {
                        const id = c.id || String(getNextId(getData('customers')));
                        await saveDataToCloud('customers', c, id);
                    }
                }
                if (Array.isArray(data.products)) {
                    for (const p of data.products) {
                        const id = p.id || 'PRD' + new Date().getTime();
                        await saveDataToCloud('products', p, id);
                    }
                }
                if (Array.isArray(data.invoices)) {
                    for (const inv of data.invoices) {
                        const id = inv.id || String(getNextId(getData('invoices')));
                        await saveDataToCloud('invoices', inv, id);
                    }
                }

                await loadAllDataFromCloud();
                renderAll();
                alert("Import completato con successo.");
            } catch (err) {
                console.error(err);
                alert("Errore durante l'import del JSON.");
            }
        };
        reader.readAsText(file);
    });

});

// CONFIGURAZIONE FIREBASE (compat)
(function initFirebase() {
    const firebaseConfig = {
        apiKey: "AIzaSyCuGd5MSKdixcMYOYullnyam6Pj1D9tNbM",
        authDomain: "fprf-6c080.firebaseapp.com",
        projectId: "fprf-6c080",
        storageBucket: "fprf-6c080.firebasestorage.app",
        messagingSenderId: "406236428222",
        appId: "1:406236428222:web:3be6b3b8530ab20ba36bef"
    };

    if (window.firebase && firebase.apps && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else if (window.firebase && !firebase.apps) {
        firebase.initializeApp(firebaseConfig);
    }

    if (window.firebase) {
        db = firebase.firestore();
        auth = firebase.auth();
    } else {
        console.error("Firebase non è disponibile.");
    }
})();
