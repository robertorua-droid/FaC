// utils.js
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

    function escapeXML(str) { 
        if (typeof str !== 'string') return ''; 
        return str.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]); 
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

    // Restituisce il riferimento al document utente: /users/{uid}
    function getUserDocRef() {
        if (!currentUser || !currentUser.uid) {
            throw new Error("Nessun utente loggato, impossibile accedere ai dati utente.");
        }
        return db.collection('users').doc(currentUser.uid);
    }

    // =========================================================
