// utils.js
// Variabili Globali
let db, auth;
let globalData = {
    companyInfo: {},
    products: [],
    customers: [],
    suppliers: [],
    purchases: [],
    invoices: [],
    notes: [],
    commesse: [],
    projects: [],
    worklogs: []
};
let currentUser = null;
let dateTimeInterval = null;
let CURRENT_EDITING_ID = null;         
let CURRENT_EDITING_INVOICE_ID = null; 
let CURRENT_EDITING_PURCHASE_ID = null;
window.tempInvoiceLines = [];
window.tempPurchaseLines = [];

// =========================================================
// TIMEOUT DI INATTIVITÀ (5 minuti)
//
// Queste funzioni devono essere globali perché vengono richiamate
// dal flusso di autenticazione e da altri moduli.
// =========================================================
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minuti
let inactivityTimer = null;
let inactivityHandlersBound = false;

function handleInactivityLogout() {
    if (!currentUser) return; // già disconnesso
    alert("Sessione scaduta per inattività. Verrai disconnesso.");
    // Sign-out Firebase + reload pulito
    if (auth && typeof auth.signOut === 'function') {
        auth.signOut().then(() => location.reload()).catch(() => location.reload());
    } else {
        location.reload();
    }
}

function resetInactivityTimer() {
    if (!currentUser) return; // timer attivo solo se loggato
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
}

function startInactivityWatch() {
    if (inactivityHandlersBound) {
        resetInactivityTimer();
        return;
    }
    inactivityHandlersBound = true;
    // Qualsiasi interazione “normale” resetta il timer
    $(document).on('mousemove.inactivity keydown.inactivity click.inactivity scroll.inactivity touchstart.inactivity', () => {
        resetInactivityTimer();
    });
    resetInactivityTimer();
}

function stopInactivityWatch() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    if (inactivityHandlersBound) {
        $(document).off('.inactivity');
        inactivityHandlersBound = false;
    }
}

// Esponi globalmente (modularizzazione senza bundler)
window.startInactivityWatch = startInactivityWatch;
window.stopInactivityWatch = stopInactivityWatch;

// 1. FUNZIONI DI UTILITÀ
    // =========================================================

    function formatDateForDisplay(dateString) {
        if (!dateString) return '-';
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString; 
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    function sanitizeTextForAgenzia(str) {
        if (typeof str !== 'string') return '';
        // Normalizza caratteri che possono essere rifiutati da validatori FatturaPA
        // (es. frecce utilizzate in descrizioni periodo: "→", "←").
        return str.replace(/[→←]/g, '-');
    }
    // Esponi per riuso in UI/PDF
    window.sanitizeTextForAgenzia = sanitizeTextForAgenzia;


    function escapeXML(str) {
        if (typeof str !== 'string') return '';
        // Evita caratteri notoriamente rifiutati da validatori FatturaPA (es. freccia "→").
        // Manteniamo solo sostituzioni mirate per non alterare testi comuni (accenti, ecc.).
        const safe = sanitizeTextForAgenzia(str);
        return safe.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]);
    }
    function normalizeCountryCode(raw) {
        if (!raw) return 'IT';
        const t = String(raw).trim().toUpperCase();

        // se è già un codice a 2 lettere lo uso così com'è
        if (t.length === 2) return t;

        // casi più probabili digitati a mano
        if (t === 'ITALIA' || t === 'ITALY') return 'IT';

        // fallback sicuro
        return 'IT';
    }


    function getNextId(items) { 
        if (!items || items.length === 0) return 1;
        const numericIds = items.map(i => parseInt(i.id)).filter(id => !isNaN(id));
        return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1; 
    }

    function getData(key) { return globalData[key] || []; }
    function safeFloat(val) { const n = parseFloat(val); return isNaN(n) ? 0 : n; }

    
    // =========================================================
    // REGIME FISCALE (GESTIONALE) - FUNZIONI UNIFICATE
    //
    // `taxRegime` (ordinario/forfettario) è la fonte primaria.
    // Se non è impostato, facciamo fallback su `codiceRegimeFiscale`
    // (es. RF19 per il Forfettario) per mantenere il comportamento coerente
    // in tutto il progetto.
    // =========================================================

    function _normalizeTaxRegime(v) {
        const t = String(v || '').trim().toLowerCase();
        if (t === 'forfettario' || t === 'ordinario') return t;
        return '';
    }

    function _extractRFCode(v) {
        const raw = String(v || '').trim().toUpperCase();
        if (!raw) return '';
        // Accetta sia "RF19" che stringhe più lunghe che contengono il codice
        const m = raw.match(/RF\d{2}/);
        return m ? m[0] : raw;
    }

    // Ritorna: 'forfettario' | 'ordinario' | '' (sconosciuto)
    function getResolvedTaxRegime(companyInfo) {
        const ci = companyInfo || ((typeof getData === 'function') ? (getData('companyInfo') || {}) : {});
        const explicit = _normalizeTaxRegime(ci.taxRegime);
        if (explicit) return explicit;

        const rf = _extractRFCode(ci.codiceRegimeFiscale);
        if (!rf) return '';
        if (rf === 'RF19') return 'forfettario';
        if (/^RF\d{2}$/.test(rf)) return 'ordinario';
        return '';
    }

    function hasTaxRegime(companyInfo) {
        const r = getResolvedTaxRegime(companyInfo);
        return r === 'forfettario' || r === 'ordinario';
    }

    function isForfettario(companyInfo) {
        return getResolvedTaxRegime(companyInfo) === 'forfettario';
    }

    function isOrdinario(companyInfo) {
        return getResolvedTaxRegime(companyInfo) === 'ordinario';
    }

// Restituisce il riferimento al document utente: /users/{uid}
    function getUserDocRef() {
        if (!currentUser || !currentUser.uid) {
            throw new Error("Nessun utente loggato, impossibile accedere ai dati utente.");
        }
        return db.collection('users').doc(currentUser.uid);
    }

    // =========================================================
