// js/app/invoice-xml-migration.js
// Orchestratore: mantiene il nome originale ma delega ai moduli.

function bindEventListeners() {
  // Inizializza i bind dei moduli (ognuno e idempotente)
  try {
    if (window.AppModules && window.AppModules.auth && typeof window.AppModules.auth.bind === 'function') {
      window.AppModules.auth.bind();
    }
    if (window.AppModules && window.AppModules.navigation && typeof window.AppModules.navigation.bind === 'function') {
      window.AppModules.navigation.bind();
    }
    if (window.AppModules && window.AppModules.dashboard && typeof window.AppModules.dashboard.bind === 'function') {
      window.AppModules.dashboard.bind();
    }

        // COMMESSE / PROGETTI / TIMESHEET
    if (window.AppModules && window.AppModules.commesse && typeof window.AppModules.commesse.bind === 'function') {
      window.AppModules.commesse.bind();
    }
    if (window.AppModules && window.AppModules.projects && typeof window.AppModules.projects.bind === 'function') {
      window.AppModules.projects.bind();
    }
    if (window.AppModules && window.AppModules.timesheet && typeof window.AppModules.timesheet.bind === 'function') {
      window.AppModules.timesheet.bind();
    }
    if (window.AppModules && window.AppModules.timesheetExport && typeof window.AppModules.timesheetExport.bind === 'function') {
      window.AppModules.timesheetExport.bind();
    }

if (window.AppModules && window.AppModules.registriIva && typeof window.AppModules.registriIva.bind === 'function') {
      window.AppModules.registriIva.bind();
    }

    if (window.AppModules && window.AppModules.customers && typeof window.AppModules.customers.bind === 'function') {
      window.AppModules.customers.bind();
    }
    if (window.AppModules && window.AppModules.products && typeof window.AppModules.products.bind === 'function') {
      window.AppModules.products.bind();
    }
    if (window.AppModules && window.AppModules.suppliers && typeof window.AppModules.suppliers.bind === 'function') {
      window.AppModules.suppliers.bind();
    }

    if (window.AppModules && window.AppModules.invoicesForm && typeof window.AppModules.invoicesForm.bind === 'function') {
      window.AppModules.invoicesForm.bind();
    }
    if (window.AppModules && window.AppModules.invoicesTimesheetImport && typeof window.AppModules.invoicesTimesheetImport.bind === 'function') {
      window.AppModules.invoicesTimesheetImport.bind();
    }
    if (window.AppModules && window.AppModules.invoicesList && typeof window.AppModules.invoicesList.bind === 'function') {
      window.AppModules.invoicesList.bind();
    }
    if (window.AppModules && window.AppModules.invoicesXML && typeof window.AppModules.invoicesXML.bind === 'function') {
      window.AppModules.invoicesXML.bind();
    }

    if (window.AppModules && window.AppModules.company && typeof window.AppModules.company.bind === 'function') {
      window.AppModules.company.bind();
    }

    // Simulazione Redditi (Ordinario)
    if (window.AppModules && window.AppModules.ordinarioSim && typeof window.AppModules.ordinarioSim.bind === 'function') {
      window.AppModules.ordinarioSim.bind();
    }

    if (window.AppModules && window.AppModules.scadenziario && typeof window.AppModules.scadenziario.bind === 'function') {
      window.AppModules.scadenziario.bind();
    }
    if (window.AppModules && window.AppModules.notes && typeof window.AppModules.notes.bind === 'function') {
      window.AppModules.notes.bind();
    }
    if (window.AppModules && window.AppModules.migration && typeof window.AppModules.migration.bind === 'function') {
      window.AppModules.migration.bind();
    }

    // ACQUISTI (modulo separato)
    if (typeof initPurchasesModule === 'function') {
      initPurchasesModule();
    }
  } catch (e) {
    console.error('Errore bindEventListeners:', e);
  }
}

window.bindEventListeners = bindEventListeners;
