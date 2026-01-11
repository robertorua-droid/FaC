// app-bootstrap.js
// Entry point: inizializza Firebase e registra gli event listeners

$(document).ready(function () {
    const ok = (typeof initFirebase === 'function') ? initFirebase() : false;
    if (!ok) return;
    if (typeof bindEventListeners === 'function') {
        bindEventListeners();
    } else {
        console.error("bindEventListeners non definita");
        alert("Errore applicazione: event listeners non caricati.");
    }
});
