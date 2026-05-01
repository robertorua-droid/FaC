// js/features/company/company-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.company = window.AppModules.company || {};

  let _bound = false;

  function getStoredCompanyInfo() {
    const raw = (window.AppStore && typeof window.AppStore.get === 'function') ? (window.AppStore.get('companyInfo') || {}) : ((typeof window.getData === 'function') ? (window.getData('companyInfo') || {}) : {});
    return (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function') ? window.DomainNormalizers.normalizeCompanyInfo(raw) : raw;
  }

  const DEFAULT_GESTIONE_SEPARATA = (window.DomainConstants && window.DomainConstants.COMPANY_DEFAULTS && window.DomainConstants.COMPANY_DEFAULTS.GESTIONE_SEPARATA_ORDINARIO) || '26.07';

  function applyCompanyTaxRegimeVisibility() {
    const policy = window.TaxRegimePolicy;
    const regime = policy ? policy.fromFormValues($('#company-taxRegime').val(), $('#company-codiceRegimeFiscale').val()) : '';
    if (regime) {
      try { $('#company-taxRegime').val(regime); } catch (e) {}
    }
    const capabilities = policy ? policy.getCapabilities({ taxRegime: regime }) : { isForfettario: false, isOrdinario: false };
    const isForfettario = !!capabilities.isForfettario;
    const isOrdinario = !!capabilities.isOrdinario;

    // Blocchi specifici
    const $forfBlocks = $('.forfettario-only');
    const $ordBlocks = $('.ordinario-only');

    if ($forfBlocks.length) {
      $forfBlocks.toggleClass('d-none', !isForfettario);
      $forfBlocks.find('input, select, textarea').prop('disabled', !isForfettario);
    }

    if ($ordBlocks.length) {
      $ordBlocks.toggleClass('d-none', !isOrdinario);
      $ordBlocks.find('input, select, textarea').prop('disabled', !isOrdinario);
    }

    // Default ordinario: Gestione Separata 26.07% se vuoto
    if (isOrdinario) {
      const $gs = $('#company-aliquotaGestioneSeparata');
      if ($gs.length) {
        const v = String($gs.val() || '').trim();
        if (v === '' || !isFinite(parseFloat(v))) {
          $gs.val(DEFAULT_GESTIONE_SEPARATA);
        }
      }
    }
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    // Toggle campi in base al regime selezionato
    $('#company-taxRegime').on('change', applyCompanyTaxRegimeVisibility);
    // Se l'utente cambia il codice RFxx e taxRegime è vuoto, riallinea automaticamente la UI
    $('#company-codiceRegimeFiscale').on('change input', applyCompanyTaxRegimeVisibility);
    applyCompanyTaxRegimeVisibility();

    if (window.AppStore && typeof window.AppStore.subscribe === 'function') {
      window.AppStore.subscribe('companyInfo', function (companyInfo) {
        if (typeof window.renderCompanyInfoForm === 'function') window.renderCompanyInfoForm(companyInfo || getStoredCompanyInfo());
      });
    }

    // Aggiorna subito il nome studio in sidebar mentre scrivi
    $('#company-name').on('input', function () {
      const v = String($(this).val() || '').trim();
      $('#company-name-sidebar').text(v || 'MIO STUDIO');
    });

    // Salvataggio anagrafica azienda
    $('#company-info-form').on('submit', async function (e) {
      e.preventDefault();
      const d = {};
      $(this)
        .find('input, select, textarea')
        .each(function () {
          if (!this.id) return;
          if ($(this).prop('disabled')) return; // evita di sovrascrivere campi nascosti
          const key = this.id.replace('company-', '');
          d[key] = $(this).val();      });

      const normalizedCompany = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function')
        ? window.DomainNormalizers.normalizeCompanyInfo(d)
        : d;

      // Compatibilità: il form usa 'company-province' -> chiave 'province'.
      // L'export XML fatture storicamente usa 'provincia': manteniamo entrambe allineate.
      if (normalizedCompany.province && !normalizedCompany.provincia) {
        normalizedCompany.provincia = normalizedCompany.province;
      }

      // Regime fiscale (gestionale) obbligatorio
      if (!(window.TaxRegimePolicy && window.TaxRegimePolicy.has(normalizedCompany))) {
        alert('Seleziona il Regime fiscale (gestionale) prima di salvare.');
        const $f = $('#company-taxRegime');
        if ($f.length) $f.focus();
        return;
      }

      // Ordinario: salva default Gestione Separata se vuoto
      if (window.TaxRegimePolicy && window.TaxRegimePolicy.canUseOrdinarioSimulation(normalizedCompany)) {
        const v = String(normalizedCompany.aliquotaGestioneSeparata || '').trim();
        if (v === '' || !isFinite(parseFloat(v))) {
          normalizedCompany.aliquotaGestioneSeparata = DEFAULT_GESTIONE_SEPARATA;
        }
      }

      await saveDataToCloud('companyInfo', normalizedCompany);
      alert('Anagrafica azienda salvata!');
      if (window.UiRefresh && typeof window.UiRefresh.refreshCompanyAndDependentAreas === 'function') window.UiRefresh.refreshCompanyAndDependentAreas(normalizedCompany);
      else {
        if (typeof renderCompanyInfoForm === 'function') renderCompanyInfoForm(normalizedCompany);
        if (typeof renderNavigationVisibility === 'function') renderNavigationVisibility(normalizedCompany);
        if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
      }
    });
  }

  window.AppModules.company.bind = bind;
  // Usata anche dal render quando carica i dati azienda
  window.applyCompanyTaxRegimeVisibility = applyCompanyTaxRegimeVisibility;
})();
