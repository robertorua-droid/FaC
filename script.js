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

        // Sign-out Firebase + reload pulito
        auth.signOut().then(() => {
            // location.reload() per essere sicuri di reset totale dell'app
            window.location.reload(true);
        }).catch(() => {
            // In caso di errore, comunque forziamo un reload
            window.location.reload(true);
        });
    }

    function resetInactivityTimer() {
        if (!currentUser) return; // se non è loggato, non ha senso il timer
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
    }

    function bindInactivityHandlers() {
        if (inactivityHandlersBound) return;
        inactivityHandlersBound = true;

        ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, resetInactivityTimer, { passive: true });
        });
    }

    function unbindInactivityHandlers() {
        if (!inactivityHandlersBound) return;
        inactivityHandlersBound = false;

        ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
            window.removeEventListener(evt, resetInactivityTimer, { passive: true });
        });
    }

    // =========================================================
    // CONFIGURAZIONE FIREBASE (v9 compat)
    // =========================================================
    const firebaseConfig = {
        apiKey: "AIzaSyCuGd5MSKdixcMYOYullnyam6Pj1D9tNbM",
        authDomain: "fprf-6c080.firebaseapp.com",
        projectId: "fprf-6c080",
        storageBucket: "fprf-6c080.firebasestorage.app",
        messagingSenderId: "406236428222",
        appId: "1:406236428222:web:3be6b3b8530ab20ba36bef"
    };

    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
    } catch (e) {
        console.error("Errore inizializzazione Firebase:", e);
        alert("Errore DB: " + e.message);
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
        return str.replace(/[<>&'"]/g, c => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '\'': '&apos;',
            '"': '&quot;'
        }[c]));
    }

    function getNextId(items) {
        if (!items || items.length === 0) return 1;
        const numericIds = items.map(i => parseInt(i.id)).filter(id => !isNaN(id));
        return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1; 
    }

    function getData(key) { return globalData[key] || []; }
    function safeFloat(val) { const n = parseFloat(val); return isNaN(n) ? 0 : n; }

    // Restituisce il riferimento al document utente: /users/{uid}
    function getUserDocRef(uid) {
        return db.collection('users').doc(uid);
    }

    // Restituisce la collection utente: es. getUserCollection('products') -> /users/{uid}/products
    function getUserCollectionRef(uid, collectionName) {
        return getUserDocRef(uid).collection(collectionName);
    }

    // =========================================================
    // 2. GESTIONE DATI CLOUD (MULTI-UTENTE)
    // =========================================================

    async function loadAllDataFromCloud() {
        if (!currentUser) return;
        try {
            const uid = currentUser.uid;
            globalData = {
                companyInfo: {},
                products: [],
                customers: [],
                invoices: [],
                notes: []
            };

            const userDocRef = getUserDocRef(uid);

            const docSnap = await userDocRef.get();
            if (docSnap.exists) {
                const data = docSnap.data() || {};
                globalData.companyInfo = data.companyInfo || {};
                globalData.notes = data.notes ? [data.notes] : [];
            } else {
                await userDocRef.set({ createdAt: new Date().toISOString() }, { merge: true });
            }

            const collections = ['products', 'customers', 'invoices'];
            for (const col of collections) {
                const colRef = getUserCollectionRef(uid, col);
                const snapshot = await colRef.get();
                globalData[col] = snapshot.docs.map(doc => ({
                    id: String(doc.id),
                    ...doc.data()
                }));
            }

            console.log("Dati sincronizzati per utente:", uid, globalData);
        } catch (e) {
            console.error("Errore Load Cloud:", e);
            throw e;
        }
    }

    async function saveDataToCloud(collection, dataObj, id = null) {
        if (!currentUser) {
            alert("Nessun utente loggato.");
            return;
        }
        const uid = currentUser.uid;

        try {
            const userDocRef = getUserDocRef(uid);

            if (collection === 'companyInfo') {
                await userDocRef.set({ companyInfo: dataObj }, { merge: true });
                globalData.companyInfo = dataObj;
            } else if (collection === 'notes') {
                const notesData = { userId: uid, ...dataObj };
                await userDocRef.set({ notes: notesData }, { merge: true });
                globalData.notes = [notesData];
            } else {
                if (!id) {
                    console.error("ID mancante per salvataggio in collection:", collection);
                    return;
                }
                const colRef = getUserCollectionRef(uid, collection);
                const docRef = colRef.doc(String(id));

                await docRef.set(dataObj, { merge: true });

                const existingIndex = globalData[collection].findIndex(
                    item => String(item.id) === String(id)
                );
                const newItem = { id: String(id), ...dataObj };

                if (existingIndex > -1) {
                    globalData[collection][existingIndex] = newItem;
                } else {
                    globalData[collection].push(newItem);
                }
            }
        } catch (e) {
            console.error("Errore salvataggio cloud:", e);
            alert("Errore Cloud: " + e.message);
        }
    }

    async function deleteDataFromCloud(collection, id) {
        if (!currentUser) {
            alert("Nessun utente loggato.");
            return;
        }
        const uid = currentUser.uid;

        if (confirm("Sei sicuro di voler eliminare questo elemento?")) {
            try {
                const colRef = getUserCollectionRef(uid, collection);
                const docRef = colRef.doc(String(id));
                await docRef.delete();

                globalData[collection] = globalData[collection].filter(
                    item => String(item.id) !== String(id)
                );

                renderAll();
            } catch (e) {
                console.error("Errore eliminazione:", e);
                alert("Errore eliminazione: " + e.message);
            }
        }
    }

    async function exportCurrentUserData() {
        if (!currentUser) {
            alert("Nessun utente loggato.");
            return;
        }

        try {
            const dataToExport = {
                companyInfo: globalData.companyInfo || {},
                products: globalData.products || [],
                customers: globalData.customers || [],
                invoices: globalData.invoices || [],
                notes: globalData.notes || []
            };

            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const mi = String(now.getMinutes()).padStart(2, '0');

            a.href = url;
            a.download = `gestionale-backup-${yyyy}-${mm}-${dd}-${hh}${mi}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert("Backup JSON esportato correttamente.");
        } catch (e) {
            console.error("Errore export JSON:", e);
            alert("Errore durante l'esportazione del backup JSON: " + e.message);
        }
    }

    async function importDataForCurrentUserFromJSON(jsonData) {
        if (!currentUser) {
            alert("Nessun utente loggato.");
            return;
        }

        const uid = currentUser.uid;

        try {
            const companyInfo = jsonData.companyInfo || {};
            const products = Array.isArray(jsonData.products) ? jsonData.products : [];
            const customers = Array.isArray(jsonData.customers) ? jsonData.customers : [];
            const invoices = Array.isArray(jsonData.invoices) ? jsonData.invoices : [];
            const notesArr = Array.isArray(jsonData.notes) ? jsonData.notes : [];

            const userDocRef = getUserDocRef(uid);
            await userDocRef.set({
                companyInfo: companyInfo
            }, { merge: true });

            globalData.companyInfo = companyInfo;

            const batch = db.batch();
            const productsCol = getUserCollectionRef(uid, 'products');
            const customersCol = getUserCollectionRef(uid, 'customers');
            const invoicesCol = getUserCollectionRef(uid, 'invoices');

            const existingProductsSnap = await productsCol.get();
            existingProductsSnap.forEach(doc => batch.delete(doc.ref));

            const existingCustomersSnap = await customersCol.get();
            existingCustomersSnap.forEach(doc => batch.delete(doc.ref));

            const existingInvoicesSnap = await invoicesCol.get();
            existingInvoicesSnap.forEach(doc => batch.delete(doc.ref));

            products.forEach(p => {
                const id = String(p.id || p.code || Date.now() + '_P');
                const docRef = productsCol.doc(id);
                batch.set(docRef, {
                    description: p.description || '',
                    code: p.code || '',
                    salePrice: p.salePrice || p.prezzo || 0,
                    iva: p.iva || '0',
                    esenzioneIva: p.esenzioneIva || 'N2.2'
                });
            });

            customers.forEach(c => {
                const id = String(c.id || Date.now() + '_C');
                const docRef = customersCol.doc(id);
                batch.set(docRef, {
                    name: c.name || c.ragioneSociale || '',
                    piva: c.piva || c.partitaIva || '',
                    codiceFiscale: c.codiceFiscale || '',
                    sdi: c.sdi || c.codiceSdi || '',
                    address: c.address || c.indirizzo || '',
                    comune: c.comune || '',
                    provincia: c.provincia || '',
                    cap: c.cap || '',
                    nazione: c.nazione || 'Italia',
                    rivalsaInps: !!c.rivalsaInps
                });
            });

            invoices.forEach(inv => {
                const id = String(inv.id || getNextId(invoices));
                const docRef = invoicesCol.doc(id);

                let lines = Array.isArray(inv.lines)
                    ? inv.lines
                    : Array.isArray(inv.righe) ? inv.righe : [];

                lines = lines.map(l => ({
                    productName: l.productName || l.descrizione || '',
                    qty: Number(l.qty || l.quantita || 1),
                    price: Number(l.price || l.prezzo || l.prezzoUnitario || 0),
                    subtotal: Number(l.subtotal || l.importo || l.prezzoTotale || 0),
                    iva: l.iva || l.aliquotaIva || '0',
                    esenzioneIva: l.esenzioneIva || l.natura || 'N2.2'
                }));

                const totalePrestazioni = Number(inv.totalePrestazioni || 0);
                const importoBollo = Number(inv.importoBollo || 0);
                const totaleImponibile = Number(inv.totaleImponibile || 0);
                const total = Number(inv.total || inv.importoTotaleDocumento || 0);
                const rivalsaImporto = inv.rivalsa && typeof inv.rivalsa.importo === 'number'
                    ? inv.rivalsa.importo
                    : Number(inv.importoRivalsa || 0);

                batch.set(docRef, {
                    number: inv.number || inv.numero || '',
                    date: inv.date || inv.data || new Date().toISOString().slice(0, 10),
                    customerId: String(inv.customerId || inv.clienteId || ''),
                    type: inv.type || inv.tipoDocumento || 'Fattura',
                    lines: lines,
                    totalePrestazioni,
                    importoBollo,
                    rivalsa: { importo: rivalsaImporto },
                    totaleImponibile,
                    total,
                    status: inv.status || (inv.type === 'Nota di Credito' ? 'Emessa' : 'Da Incassare'),
                    dataScadenza: inv.dataScadenza || '',
                    condizioniPagamento: inv.condizioniPagamento || '',
                    modalitaPagamento: inv.modalitaPagamento || '',
                    linkedInvoice: inv.linkedInvoice || '',
                    reason: inv.reason || inv.causale || ''
                });
            });

            await batch.commit();

            if (notesArr.length > 0) {
                const note = notesArr[0];
                const notesData = {
                    userId: uid,
                    text: note.text || note.testo || ''
                };
                await userDocRef.set({ notes: notesData }, { merge: true });
                globalData.notes = [notesData];
            }

            alert("Import eseguito correttamente per l'utente corrente.");
            await loadAllDataFromCloud();
            renderAll();
        } catch (e) {
            console.error("Errore import JSON:", e);
            alert("Errore durante l'import dei dati: " + e.message);
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
        const company = getData('companyInfo') || {};
        if (company.name) $('#company-name-sidebar').text(company.name);
        if (currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);
    }

    function renderHomePage() {
        if (currentUser) {
            $('#welcome-message').text(`Benvenuto, ${currentUser.email}`);
        }

        const note = (getData('notes') || []).find(n => n.userId === (currentUser && currentUser.uid));
        if (note) $('#notes-textarea').val(note.text);

        renderCalendar();

        if (dateTimeInterval) clearInterval(dateTimeInterval);
        const updateDateTime = () => {
            $('#current-datetime').text(new Date().toLocaleDateString('it-IT', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }));
        };
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
        if (startingDay === 0) startingDay = 6;
        else startingDay = startingDay - 1;

        let html = `
            <div class="text-center fw-bold mb-2">
                ${firstDay.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()}
            </div>
            <div class="calendar-grid">
        `;

        for (let i = 0; i < startingDay; i++) {
            html += `<div class="calendar-cell empty"></div>`;
        }

        for (let day = 1; day <= totalDays; day++) {
            const isToday = (day === todayDate) ? 'bg-primary text-white fw-bold rounded-circle' : '';
            html += `
                <div class="calendar-cell">
                    <span class="${isToday}">${day}</span>
                </div>
            `;
        }

        html += `
            </div>
            <div class="calendar-weekdays mt-2 small text-center">
                <div>Lu</div><div>Ma</div><div>Me</div><div>Gi</div><div>Ve</div><div>Sa</div><div>Do</div>
            </div>
        `;
        c.html(html);
    }

    function renderStatisticsPage() {
        const container = $('#stats-table-container').empty();

        const allInvoices = getData('invoices') || [];
        const facts = allInvoices.filter(i =>
            i.type === 'Fattura' || i.type === undefined || i.type === ''
        );
        const notes = allInvoices.filter(i => i.type === 'Nota di Credito');

        if (facts.length === 0) {
            container.html('<p class="text-muted">Nessun dato.</p>');
            renderTaxSimulation(0, 0);
            return;
        }

        const totF = facts.reduce((s, i) => s + safeFloat(i.total), 0);
        const totN = notes.reduce((s, i) => s + safeFloat(i.total), 0);
        const net = totF - totN;

        let custMap = {};
        facts.forEach(i => {
            const cId = String(i.customerId || '');
            if (!custMap[cId]) custMap[cId] = 0;
            custMap[cId] += safeFloat(i.total);
        });

        notes.forEach(i => {
            const cId = String(i.customerId || '');
            if (custMap[cId]) custMap[cId] -= safeFloat(i.total);
        });

        let h = `
            <h5>Dettaglio Clienti</h5>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th class="text-end">Fatturato Netto</th>
                        <th class="text-end">% sul Totale</th>
                    </tr>
                </thead>
                <tbody>
        `;

        Object.keys(custMap)
            .sort((a, b) => custMap[b] - custMap[a])
            .forEach(cid => {
                const c = getData('customers').find(x => String(x.id) === String(cid)) || { name: '?' };
                const tot = custMap[cid];
                const perc = net > 0 ? (tot / net) * 100 : 0;
                h += `
                    <tr>
                        <td>${c.name}</td>
                        <td class="text-end">€ ${tot.toFixed(2)}</td>
                        <td class="text-end">${perc.toFixed(1)}%</td>
                    </tr>
                `;
            });

        h += `
                    <tr class="fw-bold">
                        <td>TOTALE</td>
                        <td class="text-end">€ ${net.toFixed(2)}</td>
                        <td class="text-end">100%</td>
                    </tr>
                </tbody>
            </table>
        `;

        container.html(h);

        const impF = facts.reduce((s, i) => s + safeFloat(i.totaleImponibile || i.total), 0);
        const impN = notes.reduce((s, i) => s + safeFloat(i.totaleImponibile || i.total), 0);
        renderTaxSimulation(impF, impN);
    }

    function renderTaxSimulation(fatturatoImponibile, noteCreditoImponibile) {
        const container = $('#tax-simulation-container').empty();
        const comp = getData('companyInfo') || {};

        const coeff = safeFloat(comp.coefficienteRedditivita);
        const taxRate = safeFloat(comp.aliquotaSostitutiva);
        const inpsRate = safeFloat(comp.aliquotaContributi);

        if (!coeff || !taxRate || !inpsRate) {
            container.html('<p class="text-muted">Dati mancanti.</p>');
            return;
        }

        const grossRevenue = fatturatoImponibile - noteCreditoImponibile;
        const taxableIncome = grossRevenue * (coeff / 100);
        const socialSecurity = taxableIncome * (inpsRate / 100);
        const netTaxable = taxableIncome - socialSecurity;
        const tax = (netTaxable > 0) ? netTaxable * (taxRate / 100) : 0;

        const totalDue = socialSecurity + tax;

        const html = `
            <h5>Simulazione Contributi INPS</h5>
            <table class="table table-sm">
                <tbody>
                    <tr>
                        <th>Reddito Lordo Imponibile</th>
                        <td>€ ${taxableIncome.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Aliquota Contributi INPS</th>
                        <td>${inpsRate}%</td>
                    </tr>
                    <tr>
                        <th>Contributi Totali Previsti</th>
                        <td>€ ${socialSecurity.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Stima Primo Acconto (40%)</th>
                        <td>€ ${(socialSecurity * 0.4).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Stima Secondo Acconto (40%)</th>
                        <td>€ ${(socialSecurity * 0.4).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <h5>Simulazione Imposta Sostitutiva (IRPEF)</h5>
            <table class="table table-sm">
                <tbody>
                    <tr>
                        <th>Reddito Lordo Imponibile</th>
                        <td>€ ${taxableIncome.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Contributi INPS Deducibili</th>
                        <td>- € ${socialSecurity.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Reddito Netto Imponibile</th>
                        <td>€ ${netTaxable.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Aliquota Imposta</th>
                        <td>${taxRate}%</td>
                    </tr>
                    <tr>
                        <th>Imposta Totale Prevista</th>
                        <td>€ ${tax.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Stima Primo Acconto (50%)</th>
                        <td>€ ${(tax * 0.5).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Stima Secondo Acconto (50%)</th>
                        <td>€ ${(tax * 0.5).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <h5>Totale Uscite Stimate (Contributi + Imposte)</h5>
            <p class="fw-bold">€ ${totalDue.toFixed(2)}</p>
        `;

        container.html(html);
    }

    function renderCompanyInfoForm() {
        const c = getData('companyInfo') || {};
        for (const k in c) {
            $(`#company-${k}`).val(c[k]);
        }
    }

    function renderProductsTable() {
        const table = $('#products-table-body').empty();
        (getData('products') || []).forEach(p => {
            const price = parseFloat(p.salePrice || 0).toFixed(2);
            table.append(`
                <tr>
                    <td>${p.code || ''}</td>
                    <td>${p.description || ''}</td>
                    <td class="text-end">€ ${price}</td>
                    <td class="text-end">${p.iva || '0'}%</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-secondary btn-edit-product" data-id="${p.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger btn-delete-product" data-id="${p.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    function renderCustomersTable() {
        const table = $('#customers-table-body').empty();
        (getData('customers') || []).forEach(c => {
            table.append(`
                <tr>
                    <td>${c.name || ''}</td>
                    <td>${c.piva || ''}</td>
                    <td>${c.sdi || '-'}</td>
                    <td>${c.address || ''}</td>
                    <td>${c.comune || ''}</td>
                    <td>${c.provincia || ''}</td>
                    <td>${c.cap || ''}</td>
                    <td>${c.nazione || ''}</td>
                    <td class="text-center">
                        <input type="checkbox" disabled ${c.rivalsaInps ? 'checked' : ''}>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-secondary btn-edit-customer" data-id="${c.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger btn-delete-customer" data-id="${c.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    function renderInvoicesTable() {
        const table = $('#invoices-table-body').empty();
        const invoices = (getData('invoices') || []).sort((a, b) =>
            (b.number || '').localeCompare(a.number || '')
        );

        const selectedYear = $('#invoice-year-filter').val();

        const filteredInvoices = invoices.filter(inv => {
            if (!selectedYear) return true;
            if (!inv.date) return false;
            return String(inv.date).substring(0, 4) === String(selectedYear);
        });

        filteredInvoices.forEach(inv => {
            const c = (getData('customers') || []).find(
                cust => String(cust.id) === String(inv.customerId)
            ) || { name: 'Sconosciuto' };

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

            const disableActions = (inv.status === 'Pagata');

            const btnDelete = `
<button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}" ${disableActions ? 'disabled' : ''}>
  <i class="fas fa-trash"></i>
</button>`;

            const btns = `
<div class="btn-group btn-group-sm" role="group">
  <button class="btn ${editClass} btn-edit-invoice" data-id="${inv.id}" ${disableActions ? 'disabled' : ''}>
    <i class="fas fa-edit"></i>
  </button>
  <button class="btn btn-outline-info btn-view-invoice" data-id="${inv.id}">
    <i class="fas fa-eye"></i>
  </button>
  <button class="btn ${payClass} btn-mark-paid" data-id="${inv.id}" ${isPaid ? 'disabled' : ''}>
    <i class="fas fa-euro-sign"></i>
  </button>
  <button class="btn btn-outline-warning btn-export-xml-row" data-id="${inv.id}">
    <i class="fas fa-file-code"></i>
  </button>
  ${btnDelete}
</div>`;

            const total = (parseFloat(inv.total) || 0).toFixed(2);

            table.append(`
<tr class="${inv.status === 'Pagata' ? 'invoice-paid' : ''}">
  <td>${badge}</td>
  <td>${inv.number || ''}</td>
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
                (getData('customers') || []).map(c =>
                    `<option value="${c.id}">${c.name}</option>`
                )
            );

        $('#invoice-product-select')
            .empty()
            .append('<option value="">Seleziona...</option>')
            .append('<option value="manuale">Manuale</option>')
            .append(
                (getData('products') || []).map(p =>
                    `<option value="${p.id}">${p.code} - ${p.description}</option>`
                )
            );
    }

    function populateYearFilter() {
        const select = $('#invoice-year-filter').empty();
        const invoices = getData('invoices') || [];
        const yearsSet = new Set();

        invoices.forEach(inv => {
            if (inv.date && typeof inv.date === 'string' && inv.date.length >= 4) {
                const y = inv.date.substring(0, 4);
                yearsSet.add(y);
            }
        });

        const years = Array.from(yearsSet).sort();

        select.append('<option value="">Tutti</option>');
        years.forEach(y => {
            select.append(`<option value="${y}">${y}</option>`);
        });
    }

    // =========================================================
    // 4. EVENT LISTENERS
    // =========================================================

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;

            $('#login-container').addClass('d-none');
            $('#loading-screen').removeClass('d-none');

            try {
                await loadAllDataFromCloud();

                $('#loading-screen').addClass('d-none');
                $('#main-app').removeClass('d-none');

                bindInactivityHandlers();
                resetInactivityTimer();

                initializeApp();
            } catch (error) {
                alert("Errore DB: " + error.message);
                $('#loading-screen').addClass('d-none');
            }
        } else {
            currentUser = null;

            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = null;
            unbindInactivityHandlers();

            $('#main-app').addClass('d-none');
            $('#loading-screen').addClass('d-none');
            $('#login-container').removeClass('d-none');
        }
    });

    $('#login-form').on('submit', function (e) {
        e.preventDefault();
        const email = $('#email').val();
        const password = $('#password').val();

        $('#login-error').addClass('d-none');

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                resetInactivityTimer();
            })
            .catch(err => {
                console.error("Errore login:", err);
                $('#login-error').removeClass('d-none');
            });
    });

    $('#logout-btn').on('click', function (e) {
        e.preventDefault();
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = null;
        unbindInactivityHandlers();

        auth.signOut()
            .then(() => {
                window.location.href = window.location.pathname + window.location.search;
            })
            .catch(err => {
                console.error("Errore logout:", err);
                window.location.reload(true);
            });
    });

    $('.sidebar .nav-link').on('click', function (e) {
        if (this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return;
        e.preventDefault();

        const target = $(this).data('target');

        if (target === 'nuova-fattura-accompagnatoria') {
            if (this.id === 'menu-nuova-nota-credito') {
                prepareDocumentForm('Nota di Credito');
            } else if (this.id === 'menu-nuova-fattura') {
                prepareDocumentForm('Fattura');
            } else {
                prepareDocumentForm('Fattura');
            }
        }

        if (target === 'statistiche') {
            renderStatisticsPage();
        }

        if (target === 'elenco-fatture') {
            populateYearFilter();
            renderInvoicesTable();
        }

        $('.sidebar .nav-link').removeClass('active');
        $(this).addClass('active');

        $('.content-section').addClass('d-none');
        $('#' + target).removeClass('d-none');
    });

    $('#newInvoiceChoiceModal').on('show.bs.modal', function () {
        const invoices = (getData('invoices') || [])
            .filter(i => i.type === 'Fattura' || i.type === undefined);

        invoices.sort((a, b) => new Date(b.date) - new Date(a.date));

        const options = invoices.map(inv =>
            `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`
        ).join('');

        $('#copy-from-invoice-select').html('<option value="">Copia da esistente...</option>' + options);
    });

    $('#btn-create-new-blank-invoice').click(function () {
        $('#newInvoiceChoiceModal').modal('hide');

        $('.sidebar .nav-link').removeClass('active');
        $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active');

        $('.content-section').addClass('d-none');
        $('#nuova-fattura-accompagnatoria').removeClass('d-none');

        prepareDocumentForm('Fattura');
    });

    $('#btn-copy-from-invoice').click(function () {
        const id = $('#copy-from-invoice-select').val();
        if (!id) return;

        $('#newInvoiceChoiceModal').modal('hide');

        $('.sidebar .nav-link').removeClass('active');
        $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active');

        $('.content-section').addClass('d-none');
        $('#nuova-fattura-accompagnatoria').removeClass('d-none');

        loadInvoiceForEditing(id, true);
    });

    function editItem(type, id) {
        if (type === 'customer' || type === 'product') {
            CURRENT_EDITING_ID = String(id);
        }

        const item = (getData(type + 's') || []).find(
            i => String(i.id) === String(id)
        );
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
            if (item.iva == '0') {
                $('#product-esenzioneIva').val(item.esenzioneIva);
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

        let id = CURRENT_EDITING_ID
            ? CURRENT_EDITING_ID
            : String(getNextId(getData('customers') || []));

        await saveDataToCloud('customers', data, id);

        $('#customerModal').modal('hide');
        renderAll();
    });

    $('#customers-table-body').on('click', '.btn-edit-customer', function (e) {
        editItem('customer', $(e.currentTarget).attr('data-id'));
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function (e) {
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

        let id = CURRENT_EDITING_ID
            ? CURRENT_EDITING_ID
            : 'PRD' + new Date().getTime();

        await saveDataToCloud('products', data, id);

        $('#productModal').modal('hide');
        renderAll();
    });

    $('#products-table-body').on('click', '.btn-edit-product', function (e) {
        editItem('product', $(e.currentTarget).attr('data-id'));
    });

    $('#products-table-body').on('click', '.btn-delete-product', function (e) {
        deleteDataFromCloud('products', $(e.currentTarget).attr('data-id'));
    });

    $('#product-iva').change(function () {
        toggleEsenzioneIvaField('product', $(this).val());
    });

    window.tempInvoiceLines = [];

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
        const inv = (getData('invoices') || []).find(
            i => String(i.id) === String(id)
        );
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
        if (!isCopy) {
            $('#invoice-number').val(inv.number);
        }

        $('#invoice-condizioniPagamento').val(inv.condizioniPagamento || '');
        $('#invoice-modalitaPagamento').val(inv.modalitaPagamento || '');
        $('#invoice-dataScadenza').val(inv.dataScadenza || '');

        if (type === 'Nota di Credito') {
            $('#linked-invoice').val(inv.linkedInvoice || '');
            $('#reason').val(inv.reason || '');
        }

        window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines || []));
        renderLocalInvoiceLines();
        updateTotalsDisplay();
    }

    function updateInvoiceNumber(type, year) {
        if (CURRENT_EDITING_INVOICE_ID) return;

        const invoices = getData('invoices') || [];
        const filtered = invoices.filter(i =>
            (i.type === type || (type === 'Fattura' && !i.type)) &&
            String(i.date || '').substring(0, 4) === String(year)
        );

        let next = 1;
        if (filtered.length > 0) {
            next = Math.max(
                ...filtered.map(i => parseInt((i.number || '').split('-').pop()) || 0)
            ) + 1;
        }

        const prefix = (type === 'Fattura') ? 'FATT' : 'NC';
        $('#invoice-number').val(
            `${prefix}-${year}-${String(next).padStart(2, '0')}`
        );
    }

    $('#add-product-to-invoice-btn').click(() => {
        const selectedProductId = $('#invoice-product-select').val();
        const descrizioneManuale = $('#invoice-product-description').val();

        let description = descrizioneManuale;
        let price = parseFloat($('#invoice-product-price').val()) || 0;
        let iva = $('#invoice-product-iva').val();
        let esenzioneIva = $('#invoice-product-esenzioneIva').val();

        if (selectedProductId && selectedProductId !== 'manuale') {
            const product = (getData('products') || []).find(
                p => String(p.id) === String(selectedProductId)
            );
            if (product) {
                description = product.description || '';
                price = parseFloat(product.salePrice || 0) || 0;
                iva = product.iva || '0';
                esenzioneIva = product.esenzioneIva || 'N2.2';
            }
        }

        if (!description) {
            alert("Inserire una descrizione.");
            return;
        }

        const qty = parseFloat($('#invoice-product-qty').val()) || 1;
        const subtotal = qty * price;

        window.tempInvoiceLines.push({
            productName: description,
            qty,
            price,
            subtotal,
            iva,
            esenzioneIva
        });

        $('#invoice-product-description').val('');
        $('#invoice-product-qty').val('1');
        $('#invoice-product-price').val('');
        $('#invoice-product-iva').val('0');
        $('#invoice-product-esenzioneIva').val('N2.2');

        renderLocalInvoiceLines();
        updateTotalsDisplay();
    });

    $('#invoice-product-select').on('change', function () {
        const selectedId = $(this).val();
        if (!selectedId || selectedId === 'manuale') {
            $('#invoice-product-description').val('');
            $('#invoice-product-price').val('');
            $('#invoice-product-iva').val('0');
            $('#invoice-product-esenzioneIva').val('N2.2');
            toggleEsenzioneIvaField('invoice', '0');
            return;
        }

        const product = (getData('products') || []).find(
            p => String(p.id) === String(selectedId)
        );
        if (!product) return;

        $('#invoice-product-description').val(product.description || '');
        $('#invoice-product-price').val(product.salePrice || 0);
        $('#invoice-product-iva').val(product.iva || '0');
        $('#invoice-product-esenzioneIva').val(product.esenzioneIva || 'N2.2');

        toggleEsenzioneIvaField('invoice', product.iva || '0');
    });

    function renderLocalInvoiceLines() {
        const t = $('#invoice-lines-tbody').empty();
        (window.tempInvoiceLines || []).forEach((l, i) => {
            t.append(`
                <tr>
                    <td>${l.productName || ''}</td>
                    <td class="text-end">${(l.qty || 0).toFixed(2)}</td>
                    <td class="text-end">€ ${(l.price || 0).toFixed(2)}</td>
                    <td class="text-end">€ ${(l.subtotal || 0).toFixed(2)}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger del-line" data-i="${i}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    $('#invoice-lines-tbody').on('click', '.del-line', function () {
        const index = $(this).data('i');
        window.tempInvoiceLines.splice(index, 1);
        renderLocalInvoiceLines();
        updateTotalsDisplay();
    });

    function updateTotalsDisplay() {
        const cid = $('#invoice-customer-select').val();
        const cust = (getData('customers') || []).find(
            c => String(c.id) === String(cid)
        );
        const comp = getData('companyInfo') || {};

        const rows = (window.tempInvoiceLines || []).filter(
            l => String(l.productName || '').toLowerCase() !== 'rivalsa bollo'
        );
        const bollo = (window.tempInvoiceLines || []).find(
            l => String(l.productName || '').toLowerCase() === 'rivalsa bollo'
        );

        const impBollo = bollo ? (parseFloat(bollo.subtotal) || 0) : 0;
        const totPrest = rows.reduce(
            (s, l) => s + (parseFloat(l.subtotal) || 0), 0
        );

        let riv = 0;
        if (cust && cust.rivalsaInps) {
            const aliqInps = parseFloat(comp.aliquotaContributi || comp.aliquotaInps || 0) || 0;
            riv = totPrest * (aliqInps / 100);
        }

        const totImp = totPrest + riv;
        const totDoc = totImp + impBollo;

        $('#invoice-total').text(`€ ${totDoc.toFixed(2)}`);
        $('#invoice-tax-details').text(
            `(Imp: € ${totImp.toFixed(2)} - Bollo: € ${impBollo.toFixed(2)})`
        );

        return {
            totPrest,
            riv,
            impBollo,
            totImp,
            totDoc
        };
    }

    $('#invoice-customer-select').change(updateTotalsDisplay);

    $('#new-invoice-form').submit(async function (e) {
        e.preventDefault();

        const cid = $('#invoice-customer-select').val();
        if (!cid || !window.tempInvoiceLines.length) {
            alert("Dati incompleti. Seleziona cliente e aggiungi almeno una riga.");
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
            const old = (getData('invoices') || []).find(
                i => String(i.id) === CURRENT_EDITING_INVOICE_ID
            );
            if (old) data.status = old.status;
        }

        let id = CURRENT_EDITING_INVOICE_ID
            ? CURRENT_EDITING_INVOICE_ID
            : String(getNextId(getData('invoices') || []));

        await saveDataToCloud('invoices', data, id);
        alert("Documento salvato!");

        populateYearFilter();
        renderInvoicesTable();

        $('.sidebar .nav-link[data-target="elenco-fatture"]').click();
    });

    $('#invoices-table-body').on('click', '.btn-edit-invoice', function () {
        const id = $(this).attr('data-id');
        loadInvoiceForEditing(id, false);
        $('.sidebar .nav-link[data-target="nuova-fattura-accompagnatoria"]').click();
    });

    $('#invoices-table-body').on('click', '.btn-delete-invoice', function () {
        const id = $(this).attr('data-id');
        const inv = (getData('invoices') || []).find(i => String(i.id) === String(id));

        if (inv && inv.status === 'Pagata') {
            alert("Non è possibile eliminare una fattura con stato 'Pagata'.");
            return;
        }

        deleteDataFromCloud('invoices', id);
    });

    $('#invoices-table-body').on('click', '.btn-mark-paid', async function () {
        const id = $(this).attr('data-id');
        const inv = (getData('invoices') || []).find(i => String(i.id) === String(id));
        if (!inv) return;

        let nuovoStato;
        if (inv.type === 'Nota di Credito') {
            nuovoStato = 'Emessa';
        } else {
            nuovoStato = (inv.status === 'Pagata') ? 'Da Incassare' : 'Pagata';
        }

        if (!confirm(`Confermi cambio stato in "${nuovoStato}"?`)) return;

        await saveDataToCloud('invoices', { status: nuovoStato }, id);
        renderInvoicesTable();
    });

    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function () {
        let id = $(this).attr('id') === 'export-xml-btn'
            ? $('#export-xml-btn').data('invoiceId')
            : $(this).attr('data-id');

        if (id) generateInvoiceXML(id);
    });

    function generateInvoiceXML(invoiceId) {
        const invoice = (getData('invoices') || []).find(
            inv => String(inv.id) === String(invoiceId)
        );
        if (!invoice) {
            alert("Fattura non trovata!");
            return;
        }

        const company = getData('companyInfo') || {};
        const customer = (getData('customers') || []).find(
            c => String(c.id) === String(invoice.customerId)
        ) || {};

        let anagraficaCedente = `${escapeXML(company.name || '')}`;
        if (company.nome && company.cognome) {
            anagraficaCedente = `${escapeXML(company.nome)} ${escapeXML(company.cognome)}`;
        }

        const summaryByNature = {};
        (invoice.lines || []).forEach(l => {
            if (String(l.iva) === "0" && l.esenzioneIva) {
                const k = l.esenzioneIva;
                if (!summaryByNature[k]) {
                    summaryByNature[k] = {
                        aliquota: l.iva,
                        natura: k,
                        imponibile: 0
                    };
                }
                summaryByNature[k].imponibile += (l.subtotal || 0);
            }
        });

        if (invoice.rivalsa && invoice.rivalsa.importo > 0) {
            const k = "N4";
            if (!summaryByNature[k]) {
                summaryByNature[k] = {
                    aliquota: "0.00",
                    natura: k,
                    imponibile: 0
                };
            }
            summaryByNature[k].imponibile += invoice.rivalsa.importo;
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

        const codiceFiscaleIT = escapeXML(company.codiceFiscale || '');
        const progressivoInvio = (Math.random().toString(36) + '00000').slice(2, 7).toUpperCase();

        const nazioneCedente = 'IT';
        const nazioneCessionario = (customer.nazione && customer.nazione.trim().length === 2)
            ? customer.nazione.trim().toUpperCase()
            : 'IT';

        const codiceProvinciaCedente = (company.province || '').toUpperCase();
        const codiceProvinciaCessionario = (customer.provincia || '').toUpperCase();

        const prefixFile = `IT${escapeXML(company.piva || '')}_${Math.random().toString(36).substring(2, 7)}`;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 FatturaPA_v1.2.xsd">
<FatturaElettronicaHeader>
    <DatiTrasmissione>
        <IdTrasmittente>
            <IdPaese>IT</IdPaese>
            <IdCodice>${escapeXML(company.piva || '')}</IdCodice>
        </IdTrasmittente>
        <ProgressivoInvio>${progressivoInvio}</ProgressivoInvio>
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
            <CAP>${escapeXML(company.cap || company.zip || '')}</CAP>
            <Comune>${escapeXML(company.city || '')}</Comune>
            <Provincia>${codiceProvinciaCedente}</Provincia>
            <Nazione>${nazioneCedente}</Nazione>
        </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
        <DatiAnagrafici>
            <IdFiscaleIVA>
                <IdPaese>${nazioneCessionario}</IdPaese>
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
            <Provincia>${codiceProvinciaCessionario}</Provincia>
            <Nazione>${nazioneCessionario}</Nazione>
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
            <ImportoTotaleDocumento>${invoice.total.toFixed(2)}</ImportoTotaleDocumento>`;

        if (invoice.type === 'Nota di Credito') {
            xml += `
            <Causale>${escapeXML(invoice.reason || '')}</Causale>`;
        }

        xml += `
        </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>`;

        let ln = 1;
        (invoice.lines || []).forEach(l => {
            xml += `
        <DettaglioLinee>
            <NumeroLinea>${ln++}</NumeroLinea>
            <Descrizione>${escapeXML(l.productName || '')}</Descrizione>
            <Quantita>${(l.qty || 0).toFixed(2)}</Quantita>
            <PrezzoUnitario>${(l.price || 0).toFixed(2)}</PrezzoUnitario>
            <PrezzoTotale>${(l.subtotal || 0).toFixed(2)}</PrezzoTotale>
            <AliquotaIVA>${parseFloat(l.iva || 0).toFixed(2)}</AliquotaIVA>
            <Natura>${escapeXML(l.esenzioneIva || '')}</Natura>
        </DettaglioLinee>`;
        });

        xml += `
        ${riepilogoXml}
    </DatiBeniServizi>
    <DatiPagamento>
        <CondizioniPagamento>TP02</CondizioniPagamento>
        <DettaglioPagamento>
            <ModalitaPagamento>MP05</ModalitaPagamento>
            <DataScadenzaPagamento>${invoice.dataScadenza || invoice.date}</DataScadenzaPagamento>
            <ImportoPagamento>${invoice.total.toFixed(2)}</ImportoPagamento>
            <IBAN>${escapeXML(company.iban || '')}</IBAN>
        </DettaglioPagamento>
    </DatiPagamento>
</FatturaElettronicaBody>
</p:FatturaElettronica>`;

        const a = document.createElement('a');
        a.download = `${prefixFile}.xml`;

        const b = new Blob([xml], { type: 'application/xml' });
        a.href = URL.createObjectURL(b);
        a.click();
    }

    $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
        const id = $(this).attr('data-id');
        const inv = (getData('invoices') || []).find(i => String(i.id) === String(id));
        if (!inv) return;

        const c = (getData('customers') || []).find(
            x => String(x.id) === String(inv.customerId)
        ) || {};

        $('#export-xml-btn').data('invoiceId', inv.id);
        $('#invoiceDetailModalTitle').text(`${inv.type || 'Fattura'} ${inv.number || ''}`);

        const lines = Array.isArray(inv.lines) ? inv.lines : [];

        const righePrestazioni = lines.filter(l =>
            String(l.productName || '').toLowerCase() !== 'rivalsa bollo'
        );
        const rigaBollo = lines.find(l =>
            String(l.productName || '').toLowerCase() === 'rivalsa bollo'
        );

        const totalePrestazioni = (typeof inv.totalePrestazioni === 'number')
            ? inv.totalePrestazioni
            : righePrestazioni.reduce((s, l) => s + (Number(l.subtotal) || 0), 0);

        const importoRivalsa = (inv.rivalsa && typeof inv.rivalsa.importo === 'number')
            ? inv.rivalsa.importo
            : 0;

        const importoBollo = (typeof inv.importoBollo === 'number')
            ? inv.importoBollo
            : (rigaBollo ? (Number(rigaBollo.subtotal) || 0) : 0);

        const totaleImponibile = (typeof inv.totaleImponibile === 'number')
            ? inv.totaleImponibile
            : (totalePrestazioni + importoRivalsa);

        const totaleDocumento = (typeof inv.total === 'number')
            ? inv.total
            : (totaleImponibile + importoBollo);

        // --- Corpo HTML della modale ---
        const company = getData('companyInfo') || {};
        const cedenteNome = (company.name && String(company.name).trim())
            || (`${(company.nome || '').trim()} ${(company.cognome || '').trim()}`.trim());

        let h = `
        <div class="mb-3">
            <div class="row">
                <div class="col-md-6">
                    <h5 class="mb-1">${cedenteNome || ''}</h5>
    `;

        if (company.address || company.numeroCivico) {
            h += `
                    <div>${company.address || ''} ${company.numeroCivico || ''}</div>
            `;
        }

        if (company.cap || company.city || company.province) {
            h += `
                    <div>${company.cap || ''} ${company.city || ''}${company.province ? ' (' + company.province + ')' : ''}</div>
            `;
        }

        if (company.piva || company.codiceFiscale) {
            h += `
                    <div>P.IVA: ${company.piva || ''}${company.codiceFiscale ? ' - C.F: ' + company.codiceFiscale : ''}</div>
            `;
        }

        if (company.regimeFiscale || company.codiceRegimeFiscale) {
            h += `
                    <div>${company.regimeFiscale || ''}${company.codiceRegimeFiscale ? ' (' + company.codiceRegimeFiscale + ')' : ''}</div>
            `;
        }

        h += `
                </div>
                <div class="col-md-6 text-md-end mt-3 mt-md-0">
                    <div class="fw-bold">Spett.le</div>
                    <h5 class="mb-1">${c.name || ''}</h5>
        `;

        if (c.address) {
            h += `
                    <div>${c.address}</div>
            `;
        }

        if (c.cap || c.comune || c.provincia) {
            h += `
                    <div>${c.cap || ''} ${c.comune || ''}${c.provincia ? ' (' + c.provincia + ')' : ''}</div>
            `;
        }

        if (c.piva || c.codiceFiscale) {
            h += `
                    <div>P.IVA: ${c.piva || ''}${c.codiceFiscale ? ' - C.F: ' + c.codiceFiscale : ''}</div>
            `;
        }

        if (c.sdi) {
            h += `
                    <div>Codice S.d.I: ${c.sdi}</div>
            `;
        }

        h += `
                </div>
            </div>
            <hr>
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${inv.type === 'Nota di Credito' ? 'Nota di Credito' : 'Fattura'} N° ${inv.number || ''}</strong>
                </div>
                <div class="text-end">
                    Data: ${formatDateForDisplay(inv.date)}
                </div>
            </div>
        </div>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Descrizione</th>
                    <th class="text-end">Q.tà</th>
                    <th class="text-end">Prezzo</th>
                    <th class="text-end">Totale</th>
                </tr>
            </thead>
            <tbody>
        `;

        lines.forEach(l => {
            h += `
                <tr>
                    <td>${l.productName || ''}</td>
                    <td class="text-end">${(Number(l.qty) || 0).toFixed(2)}</td>
                    <td class="text-end">€ ${(Number(l.price) || 0).toFixed(2)}</td>
                    <td class="text-end">€ ${(Number(l.subtotal) || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        h += `
            </tbody>
        </table>
        <div class="row justify-content-end mt-3">
            <div class="col-md-6">
                <table class="table table-sm mb-0">
                    <tbody>
                        <tr>
                            <th class="text-end">Totale Prestazioni</th>
                            <td class="text-end">€ ${totalePrestazioni.toFixed(2)}</td>
                        </tr>
        `;

        if (importoRivalsa > 0) {
            h += `
                        <tr>
                            <th class="text-end">Rivalsa INPS</th>
                            <td class="text-end">€ ${importoRivalsa.toFixed(2)}</td>
                        </tr>
            `;
        }

        h += `
                        <tr>
                            <th class="text-end">Totale Imponibile</th>
                            <td class="text-end">€ ${totaleImponibile.toFixed(2)}</td>
                        </tr>
        `;

        if (importoBollo > 0) {
            h += `
                        <tr>
                            <th class="text-end">Marca da Bollo</th>
                            <td class="text-end">€ ${importoBollo.toFixed(2)}</td>
                        </tr>
            `;
        }

        h += `
                        <tr class="fw-bold">
                            <th class="text-end">Totale Documento</th>
                            <td class="text-end">€ ${totaleDocumento.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="mt-3 small">
            <p class="mb-2">
                Operazione senza applicazione dell’IVA ai sensi dell’art. 1, commi da 54 a 89,
                Legge n. 190/2014 (Regime Forfettario). Si richiede la non applicazione della
                ritenuta alla fonte a titolo d’acconto ai sensi dell’art. 1, comma 67, Legge
                n. 190/2014.
            </p>
            <p class="mb-1">Condizioni: ${inv.condizioniPagamento || ''}</p>
            <p class="mb-1">Modalità: ${inv.modalitaPagamento || ''}</p>
        `;

        if (inv.dataScadenza) {
            h += `
            <p class="mb-1">Scadenza: ${formatDateForDisplay(inv.dataScadenza)}</p>
            `;
        }

        if (company.banca || company.iban) {
            h += `
            <div class="mt-2">
                <div class="fw-bold">Coordinate Bancarie:</div>
                ${company.banca ? `<div>Banca: ${company.banca}</div>` : ''}
                ${company.iban ? `<div>IBAN: ${company.iban}</div>` : ''}
            </div>
            `;
        }

        h += `
        </div>
        `;

        $('#invoiceDetailModalBody').html(h);

        const modalEl = document.getElementById('invoiceDetailModal');
        if (modalEl && window.bootstrap && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        }
    });

    $('#print-invoice-btn').click(() => window.print());

    $('#company-info-form').on('submit', async function (e) {
        e.preventDefault();
        const d = {};
        $(this).find('input, select, textarea').each(function () {
            if (this.id && this.id.startsWith('company-')) {
                const key = this.id.replace('company-', '');
                d[key] = $(this).val();
            }
        });

        await saveDataToCloud('companyInfo', d, null);
        alert("Anagrafica azienda salvata!");
    });

    $('#save-notes-btn').click(async () => {
        if (!currentUser) {
            alert("Nessun utente loggato.");
            return;
        }
        await saveDataToCloud('notes', {
            userId: currentUser.uid,
            text: $('#notes-textarea').val()
        }, currentUser.uid);
        alert("Note salvate!");
    });

    $('#export-json-btn').click(function () {
        exportCurrentUserData();
    });

    $('#import-json-input').on('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const jsonData = JSON.parse(ev.target.result);
                await importDataForCurrentUserFromJSON(jsonData);
                $('#import-json-input').val('');
            } catch (err) {
                console.error("Errore lettura JSON:", err);
                alert("Errore nella lettura del file JSON: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    $('#invoice-year-filter').on('change', function () {
        renderInvoicesTable();
    });

    function toggleEsenzioneIvaField(context, ivaValue) {
        const isZero = (String(ivaValue) === '0');
        if (context === 'product') {
            if (isZero) {
                $('#esenzione-iva-container').removeClass('d-none');
            } else {
                $('#esenzione-iva-container').addClass('d-none');
                $('#product-esenzioneIva').val('N2.2');
            }
        } else if (context === 'invoice') {
            if (isZero) {
                $('#invoice-esenzioneIva-container').removeClass('d-none');
            } else {
                $('#invoice-esenzioneIva-container').addClass('d-none');
                $('#invoice-product-esenzioneIva').val('N2.2');
            }
        }
    }

    function initializeApp() {
        renderAll();
        populateYearFilter();
    }

});
