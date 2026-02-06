// js/features/company/company-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.company = window.AppModules.company || {};

  let _bound = false;

  function applyCompanyTaxRegimeVisibility() {
    // Regime fiscale unificato: se taxRegime non è valorizzato, inferiamo da codiceRegimeFiscale (es. RF19)
    let regime = String($('#company-taxRegime').val() || '').trim().toLowerCase();
    if (!regime) {
      const codice = String($('#company-codiceRegimeFiscale').val() || '').trim().toUpperCase();
      const derived = (typeof window.getResolvedTaxRegime === 'function') ? window.getResolvedTaxRegime({ taxRegime: '', codiceRegimeFiscale: codice }) : (codice === 'RF19' ? 'forfettario' : '');
      if (derived) {
        regime = derived;
        // Precompila la select per coerenza UI (non salva automaticamente)
        try { $('#company-taxRegime').val(derived); } catch (e) {}
      }
    }
    const isForfettario = regime === 'forfettario';
    const isOrdinario = regime === 'ordinario';

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
          $gs.val('26.07');
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

      // Compatibilità: il form usa 'company-province' -> chiave 'province'.
      // L'export XML fatture storicamente usa 'provincia': manteniamo entrambe allineate.
      if (d.province && !d.provincia) {
        d.provincia = d.province;
      }

      // Regime fiscale (gestionale) obbligatorio
      if (!d.taxRegime || String(d.taxRegime).trim() === '') {
        alert('Seleziona il Regime fiscale (gestionale) prima di salvare.');
        const $f = $('#company-taxRegime');
        if ($f.length) $f.focus();
        return;
      }

      // Ordinario: salva default Gestione Separata se vuoto
      if (String(d.taxRegime).toLowerCase() === 'ordinario') {
        const v = String(d.aliquotaGestioneSeparata || '').trim();
        if (v === '' || !isFinite(parseFloat(v))) {
          d.aliquotaGestioneSeparata = '26.07';
        }
      }

      await saveDataToCloud('companyInfo', d);
      alert('Anagrafica azienda salvata!');
      if (typeof renderAll === 'function') renderAll();
    });
  }

  window.AppModules.company.bind = bind;
  // Usata anche dal render quando carica i dati azienda
  window.applyCompanyTaxRegimeVisibility = applyCompanyTaxRegimeVisibility;
})();
