// js/features/navigation/navigation-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.navigation = window.AppModules.navigation || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;
    // Regime fiscale (gestionale) unificato: navigation ragiona solo tramite capability.
    const getRegimeCapabilities = () => {
      if (window.TaxRegimePolicy && typeof window.TaxRegimePolicy.getCurrentCapabilities === 'function') {
        return window.TaxRegimePolicy.getCurrentCapabilities();
      }
      return {
        hasTaxRegime: false,
        canUseLmSimulation: false,
        canUseOrdinarioSimulation: false,
        canUseVatRegisters: false,
        canManageSuppliers: false,
        canManagePurchases: false
      };
    };

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
      const regimeCapabilities = getRegimeCapabilities();
      if (!regimeCapabilities.hasTaxRegime && target !== 'home' && target !== 'dashboard' && target !== 'anagrafica-azienda' && target !== 'avanzate') {
        alert('Prima di usare il gestionale, imposta il Regime fiscale (gestionale) in "Azienda".');
        $('[data-target="anagrafica-azienda"]').click();
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

      if (target === 'statistiche' && typeof renderStatisticsPage === 'function') renderStatisticsPage();
      if (target === 'dashboard' && typeof renderDashboardPage === 'function') renderDashboardPage();

      if (target === 'registri-iva') {
        if (!regimeCapabilities.canUseVatRegisters) { alert('Registri IVA disponibili solo per il regime Ordinario.'); return; }
        if (typeof refreshIvaRegistersYearFilter === 'function') refreshIvaRegistersYearFilter();
        if (typeof renderRegistriIVAPage === 'function') renderRegistriIVAPage();
      }

      if (target === 'simulazione-ordinario') {
        if (!regimeCapabilities.canUseOrdinarioSimulation) { alert('La Simulazione Redditi (Ordinario) è disponibile solo per il regime Ordinario.'); return; }
        if (typeof refreshOrdinarioYearFilter === 'function') refreshOrdinarioYearFilter();
        if (typeof renderOrdinarioSimPage === 'function') renderOrdinarioSimPage();
      }

      if (target === 'simulazione-lm') {
        if (!regimeCapabilities.canUseLmSimulation) { alert('La Simulazione Quadro LM è disponibile solo per il regime Forfettario.'); return; }
        if (typeof refreshLMYearFilter === 'function') refreshLMYearFilter();
        if (typeof renderLMPage === 'function') renderLMPage();
      }

      if (target === 'avanzate' && typeof window.refreshDeleteDocumentsYearSelect === 'function') window.refreshDeleteDocumentsYearSelect();
      if (target === 'elenco-fatture' && typeof renderInvoicesTable === 'function') renderInvoicesTable();

      if (target === 'anagrafica-fornitori') {
        if (!regimeCapabilities.canManageSuppliers) { alert('In regime Forfettario la sezione Fornitori non è utilizzata.'); return; }
        if (typeof renderSuppliersTable === 'function') renderSuppliersTable();
      }

      if (target === 'nuovo-acquisto') {
        if (!regimeCapabilities.canManagePurchases) { alert('In regime Forfettario la gestione Acquisti è disabilitata.'); return; }
        if (typeof preparePurchaseForm === 'function') preparePurchaseForm();
      }

      if (target === 'elenco-acquisti') {
        if (!regimeCapabilities.canManagePurchases) { alert('In regime Forfettario la gestione Acquisti è disabilitata.'); return; }
        if (typeof refreshPurchaseYearFilter === 'function') refreshPurchaseYearFilter();
        if (typeof renderPurchasesTable === 'function') renderPurchasesTable();
      }

      if (target === 'commesse' && typeof renderCommessePage === 'function') renderCommessePage();
      if (target === 'progetti' && typeof renderProjectsPage === 'function') renderProjectsPage();
      if (target === 'timesheet' && typeof renderTimesheetPage === 'function') renderTimesheetPage();
      if ((target === 'export-timesheet' || target === 'timesheet-export') && typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
      if (target === 'scadenziario' && typeof renderScadenziarioPage === 'function') renderScadenziarioPage();

      // DOCUMENTAZIONE IN-APP
      if (target === 'manuale') {
        loadDocumentation('00_INDICE', '#manuale-content', true);
      }

      // Cambia sezione visibile
      $('.sidebar .nav-link').removeClass('active');
      $(this).addClass('active');
      $('.content-section').addClass('d-none');
      $('#' + target).removeClass('d-none');

      // Update Breadcrumb & Header
      updateBreadcrumb($(this).text().trim());

      // Auto-collapse sidebar on mobile
      if (window.innerWidth < 992) {
        $('body').addClass('sidebar-collapsed');
      }
    });

    // GESTIONE LINK DOCUMENTAZIONE e BOTTONE INDIETRO
    $('#btn-back-to-index').on('click', function () {
      loadDocumentation('00_INDICE', '#manuale-content', true);
    });

    $('#manuale-content').on('click', 'a', function (e) {
      const href = $(this).attr('href');
      if (href && href.startsWith('./') && href.endsWith('.md')) {
        e.preventDefault();
        // Estrai il nome del file senza estensione (es. 01_PANORAMICA_PROGETTO)
        const key = href.replace('./', '').replace('.md', '');
        loadDocumentation(key, '#manuale-content', false);
      }
    });

    async function loadDocumentation(key, selector, isIndex) {
      try {
        $(selector).html(`
          <div class="text-center p-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Caricamento in corso...</p>
          </div>
        `);

        let content = '';
        try {
          const response = await fetch(`DOCUMENTAZIONE/${key}.md`);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          content = await response.text();
        } catch (fetchError) {
          console.warn('Fetch failed, trying fallback from window.AppDocumentationContent', fetchError);
          content = window.AppDocumentationContent && window.AppDocumentationContent[key];
          if (!content) throw new Error(`Impossibile caricare il contenuto per: ${key}. Se stai aprendo il file direttamente dal disco, assicurati di aver eseguito lo script di sincronizzazione.`);
        }

        // Se stiamo caricando l'indice, escludiamo la voce 11 (Changelog) come richiesto
        if (isIndex && key === '00_INDICE') {
          const lines = content.split('\n');
          // Filtra via la riga che contiene "11) [Changelog"
          content = lines.filter(line => !line.includes('11) [Changelog')).join('\n');
          $('#btn-back-to-index').addClass('d-none');
          $('#manuale-title').text('Documentazione');
        } else {
          $('#btn-back-to-index').removeClass('d-none');
          // Titolo dinamico dalla prima riga del MD (se è un H1)
          const firstLine = content.split('\n')[0];
          if (firstLine.startsWith('# ')) {
            $('#manuale-title').text(firstLine.replace('# ', '').trim());
          }
        }

        if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
          $(selector).html(marked.parse(content));
        } else {
          $(selector).html(`<pre style="white-space: pre-wrap;">${content}</pre>`);
        }

        // Scroll in alto
        $(selector).scrollTop(0);

      } catch (e) {
        console.error('Documentation error:', e);
        $(selector).html(`
          <div class="alert alert-danger shadow-sm">
            <h6 class="alert-heading"><i class="fas fa-exclamation-circle me-2"></i>Errore caricamento documentazione</h6>
            <p class="small mb-0"><strong>Dettaglio:</strong> ${e.message}</p>
            <hr>
            <p class="small mb-0"><strong>Suggerimento:</strong> Se apri il file direttamente dal disco, usa lo script <code>aggiorna_manuali.py</code> per sincronizzare le modifiche.</p>
          </div>
        `);
      }
    }

    $('#btn-view-changelog').on('click', function () {
      loadDocumentation('11_CHANGELOG', '#changelog-content');
      new bootstrap.Modal('#changelogModal').show();
    });

    // TOGGLE SIDEBAR (HAMBURGER)
    $('#sidebar-toggle-btn').on('click', function () {
      $('body').toggleClass('sidebar-collapsed');
      localStorage.setItem('app_sidebar_hidden', $('body').hasClass('sidebar-collapsed'));
    });

    // GLOBAL EXPAND/COLLAPSE
    $('#btn-expand-all').on('click', function () {
      $('.nav-section-container').removeClass('collapsed');
      $('.nav-section-container').each(function () {
        localStorage.setItem('app_section_' + this.id, 'true');
      });
    });

    // GLOBAL COLLAPSE
    $('#btn-collapse-all').on('click', function () {
      $('.nav-section-container').addClass('collapsed');
      $('.nav-section-container').each(function () {
        localStorage.setItem('app_section_' + this.id, 'false');
      });
    });

    // INDIVIDUAL SECTION TOGGLE
    $('.nav-section-header').on('click', function () {
      const container = $(this).closest('.nav-section-container');
      container.toggleClass('collapsed');
      localStorage.setItem('app_section_' + container.attr('id'), !container.hasClass('collapsed'));
    });

    // RESTORE STATE
    function restoreUiState() {
      if (localStorage.getItem('app_sidebar_hidden') === 'true') {
        $('body').addClass('sidebar-collapsed');
      }
      $('.nav-section-container').each(function () {
        const sid = $(this).attr('id');
        const state = localStorage.getItem('app_section_' + sid);
        if (state === 'true') $(this).removeClass('collapsed');
        else if (state === 'false') $(this).addClass('collapsed');
      });
    }
    restoreUiState();

    function updateBreadcrumb(text) {
      $('#breadcrumb').text(text);
    }

    // MODALE FATTURA
    // Se esiste una bozza in corso, consento di continuarla senza perdere i dati.
    $('#menu-nuova-fattura').on('click', function (e) {
      try {
        const hasDraft = (window.App && window.App.invoices && typeof window.App.invoices.hasUnsavedDraft === 'function') ? window.App.invoices.hasUnsavedDraft() : false;
        if (!hasDraft) return; // lascia aprire la modale standard

        e.preventDefault();
        e.stopImmediatePropagation();

        const ok = confirm('Hai una bozza fattura in corso. Vuoi continuarla?');
        if (ok) {
          $('.sidebar .nav-link').removeClass('active');
          $(this).addClass('active');
          $('.content-section').addClass('d-none');
          $('#nuova-fattura-accompagnatoria').removeClass('d-none');
          if (window.App && window.App.invoices && typeof window.App.invoices.restoreDraftUI === 'function') {
            window.App.invoices.restoreDraftUI();
          }
        } else {
          $('#newInvoiceChoiceModal').modal('show');
        }
        return false;
      } catch (err) {
        // fallback: comportamento standard
      }
    });

    $('#newInvoiceChoiceModal').on('show.bs.modal', function () {
      const invoices = (getData('invoices') || []).filter((i) => i.type === 'Fattura' || i.type === undefined);
      invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
      const options = invoices
        .map((inv) => `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`)
        .join('');
      $('#copy-from-invoice-select').html('<option value="">Copia da esistente...</option>' + options);
    });

    $('#btn-create-new-blank-invoice').click(function () {
      // Se c'è una bozza non salvata, evita reset accidentale
      try {
        const hasDraft = (window.App && window.App.invoices && typeof window.App.invoices.hasUnsavedDraft === 'function') ? window.App.invoices.hasUnsavedDraft() : false;
        if (hasDraft) {
          const ok = confirm('Esiste una bozza fattura in corso. Vuoi continuarla invece di creare una nuova?');
          if (ok) {
            $('#newInvoiceChoiceModal').modal('hide');
            $('.sidebar .nav-link').removeClass('active');
            $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active');
            $('.content-section').addClass('d-none');
            $('#nuova-fattura-accompagnatoria').removeClass('d-none');
            if (window.App && window.App.invoices && typeof window.App.invoices.restoreDraftUI === 'function') {
              window.App.invoices.restoreDraftUI();
            }
            return;
          }
        }
      } catch (err) { }

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

      // Se c'è una bozza in corso avviso che verrà sostituita
      try {
        const hasDraft = (window.App && window.App.invoices && typeof window.App.invoices.hasUnsavedDraft === 'function') ? window.App.invoices.hasUnsavedDraft() : false;
        if (hasDraft) {
          const ok = confirm('Attenzione: hai una bozza fattura in corso. Copiando da esistente perderai i dati non salvati. Continuare?');
          if (!ok) return;
        }
      } catch (err) { }
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
