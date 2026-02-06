// js/features/navigation/navigation-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.navigation = window.AppModules.navigation || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;
    // Regime fiscale (gestionale) unificato: usa gli helper in utils.js
    // Nota: gli helper sono funzioni globali definite in js/core/utils.js
    // (isForfettario, isOrdinario, hasTaxRegime) e NON hanno suffissi "Regime"/"Resolved".
    const isForfettarioRegime = () => (typeof window.isForfettario === 'function') ? window.isForfettario() : false;
    const isOrdinarioRegime  = () => (typeof window.isOrdinario === 'function') ? window.isOrdinario() : false;
    const hasTaxRegimeResolved = () => (typeof window.hasTaxRegime === 'function') ? window.hasTaxRegime() : false;

    // Cambio anno -> elenco documenti filtrato
    $('#invoice-year-filter').on('change', function () {
      if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
    });

    // filtro anno STATISTICHE
    $('#stats-year-filter').on('change', function () {
      if (typeof renderStatisticsPage === 'function') renderStatisticsPage();
    });

    // filtro anno SIMULAZIONE LM
    $('#lm-year-select, #lm-only-paid, #lm-include-bollo').on('change', function () {
      if (typeof renderLMPage === 'function') renderLMPage();
    });
    $('#lm-refresh-btn').on('click', function () {
      if (typeof renderLMPage === 'function') renderLMPage();
    });

    // NAVIGAZIONE
    $('.sidebar .nav-link').on('click', function (e) {
      if (this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return;
      e.preventDefault();

      const target = $(this).data('target');

      // Regime fiscale (gestionale) obbligatorio: finché non è selezionato,
      // consenti solo Home / Azienda / Migrazione.
      if (!hasTaxRegimeResolved() && target !== 'home' && target !== 'dashboard' && target !== 'anagrafica-azienda' && target !== 'avanzate') {
        alert('Prima di usare il gestionale, imposta il Regime fiscale (gestionale) in "Azienda".');
        // forza navigazione su Azienda
        $('.sidebar .nav-link').removeClass('active');
        $('[data-target="anagrafica-azienda"]').addClass('active');
        $('.content-section').addClass('d-none');
        $('#anagrafica-azienda').removeClass('d-none');
        return;
      }

      if (target === 'nuova-fattura-accompagnatoria') {
        if (this.id === 'menu-nuova-nota-credito') {
          if (typeof window.prepareDocumentForm === 'function') window.prepareDocumentForm('Nota di Credito');
        } else if (this.id === 'menu-nuova-fattura') {
          $('#newInvoiceChoiceModal').modal('show');
          return;
        } else {
          if (typeof window.prepareDocumentForm === 'function') window.prepareDocumentForm('Fattura');
        }
      }

      if (target === 'statistiche') {
        if (typeof renderStatisticsPage === 'function') renderStatisticsPage();
      }

      if (target === 'dashboard') {
        if (typeof renderDashboardPage === 'function') renderDashboardPage();
      }

      if (target === 'registri-iva') {
        // Sezione solo per ordinario (in forfettario l'IVA non si liquida)
        if (!isOrdinarioRegime()) {
          alert('Registri IVA disponibili solo per il regime Ordinario.');
          return;
        }
        if (typeof refreshIvaRegistersYearFilter === 'function') refreshIvaRegistersYearFilter();
        if (typeof renderRegistriIVAPage === 'function') renderRegistriIVAPage();
      }

      if (target === 'simulazione-ordinario') {
        // Sezione solo per ordinario
        if (!isOrdinarioRegime()) {
          alert('La Simulazione Redditi (Ordinario) è disponibile solo per il regime Ordinario.');
          return;
        }
        if (typeof refreshOrdinarioYearFilter === 'function') refreshOrdinarioYearFilter();
        if (typeof renderOrdinarioSimPage === 'function') renderOrdinarioSimPage();
      }

      if (target === 'simulazione-lm') {
        // Sezione solo per forfettari
        if (!isForfettarioRegime()) {
          alert('La Simulazione Quadro LM è disponibile solo per il regime Forfettario.');
          return;
        }
        if (typeof refreshLMYearFilter === 'function') refreshLMYearFilter();
        if (typeof renderLMPage === 'function') renderLMPage();
      }

      if (target === 'avanzate') {
        // Popola select anno per eliminazione documenti
        if (typeof window.refreshDeleteDocumentsYearSelect === 'function') {
          window.refreshDeleteDocumentsYearSelect();
        } else if (window.AppModules && window.AppModules.migration && typeof window.AppModules.migration.refreshDeleteDocumentsYearSelect === 'function') {
          window.AppModules.migration.refreshDeleteDocumentsYearSelect();
        }
      }

      if (target === 'elenco-fatture') {
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
      }

      if (target === 'anagrafica-fornitori') {
        if (isForfettarioRegime()) {
          alert('In regime Forfettario la sezione Fornitori non è utilizzata in questo gestionale didattico.');
          return;
        }
        if (typeof renderSuppliersTable === 'function') renderSuppliersTable();
      }

      if (target === 'nuovo-acquisto') {
        if (isForfettarioRegime()) {
          alert('In regime Forfettario la gestione Acquisti è disabilitata.');
          return;
        }
        if (typeof preparePurchaseForm === 'function') preparePurchaseForm();
      }

      if (target === 'elenco-acquisti') {
        if (isForfettarioRegime()) {
          alert('In regime Forfettario la gestione Acquisti è disabilitata.');
          return;
        }
        if (typeof refreshPurchaseYearFilter === 'function') refreshPurchaseYearFilter();
        if (typeof renderPurchasesTable === 'function') renderPurchasesTable();
      }

      
      if (target === 'commesse') {
        if (typeof renderCommessePage === 'function') renderCommessePage();
      }

      if (target === 'progetti') {
        if (typeof renderProjectsPage === 'function') renderProjectsPage();
      }

      if (target === 'timesheet') {
        if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
      }

      if (target === 'export-timesheet' || target === 'timesheet-export') {
        if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
      }


      // Cambia sezione visibile
      $('.sidebar .nav-link').removeClass('active');
      $(this).addClass('active');
      $('.content-section').addClass('d-none');
      $('#' + target).removeClass('d-none');

      if (target === 'scadenziario') {
        try {
          if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
        } catch (e2) {}
      }
    });

    // MODALE FATTURA
    $('#newInvoiceChoiceModal').on('show.bs.modal', function () {
      const invoices = getData('invoices').filter((i) => i.type === 'Fattura' || i.type === undefined);
      invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
      const options = invoices
        .map((inv) => `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`)
        .join('');
      $('#copy-from-invoice-select').html('<option value="">Copia da esistente...</option>' + options);
    });

    $('#btn-create-new-blank-invoice').click(function () {
      $('#newInvoiceChoiceModal').modal('hide');
      $('.sidebar .nav-link').removeClass('active');
      $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active');
      $('.content-section').addClass('d-none');
      $('#nuova-fattura-accompagnatoria').removeClass('d-none');
      if (typeof window.prepareDocumentForm === 'function') window.prepareDocumentForm('Fattura');
    });

    $('#btn-copy-from-invoice').click(function () {
      const id = $('#copy-from-invoice-select').val();
      if (!id) return;
      $('#newInvoiceChoiceModal').modal('hide');
      $('.sidebar .nav-link').removeClass('active');
      $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active');
      $('.content-section').addClass('d-none');
      $('#nuova-fattura-accompagnatoria').removeClass('d-none');
      if (typeof window.loadInvoiceForEditing === 'function') window.loadInvoiceForEditing(id, true);
    });
  }

  window.AppModules.navigation.bind = bind;
})();
