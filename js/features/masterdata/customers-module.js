// js/features/masterdata/customers-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.customers = window.AppModules.customers || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    function syncCustomerGiornoFissoUI() {
      const enabled = $('#customer-giornoFissoEnabled').length ? $('#customer-giornoFissoEnabled').is(':checked') : false;
      if ($('#customer-giornoFissoValue').length) {
        $('#customer-giornoFissoValue').prop('disabled', !enabled);
        if (!enabled) $('#customer-giornoFissoValue').val('');
      }
    }

// =========================================================
// SDI helper (Privato / Estero) + validazioni Nazione/Provincia
// =========================================================
const SDI_PRIVATO = '0000000';
const SDI_ESTERO  = 'XXXXXXX';

function _getNazioneRaw() {
  return String($('#customer-nazione').val() || '').trim();
}

function _isItalia(nazioneRaw) {
  const t = String(nazioneRaw || '').trim().toUpperCase();
  if (t === '' || t === 'IT' || t === 'ITALIA' || t === 'ITALY') return true;
  if (/^[A-Z]{2}$/.test(t)) return t === 'IT';
  // parole diverse da Italia/Italy => estero
  return false;
}

function _normalizeNazioneForSave(nazioneRaw) {
  const t = String(nazioneRaw || '').trim();
  if (t === '') return '';
  const up = t.toUpperCase();
  if (up === 'IT' || up === 'ITALIA' || up === 'ITALY') return 'Italia';
  if (/^[A-Z]{2}$/.test(up)) return up; // es. FR, DE...
  return t;
}

function applyCustomerCountryRules() {
  ensureCountryHint();
  const isIT = _isItalia(_getNazioneRaw());
  $('#customer-nazione').prop('required', true);
  $('#customer-provincia').prop('required', isIT);

  // Messaggio di coerenza quando "Estero" è attivo ma la Nazione risulta Italia.
  const esteroChecked = $('#customer-sdi-estero').is(':checked');
  if (esteroChecked && isIT) {
    showCountryHint("Con 'Estero' selezionato, imposta la Nazione con un codice paese diverso da IT (es. FR, DE, ES).");
  } else {
    hideCountryHint();
  }
}

function ensureCountryHint() {
  if (!$('#customer-nazione').length) return;
  if ($('#customer-nazione-hint').length) return;
  const $hint = $('<div id="customer-nazione-hint" class="form-text text-warning d-none"></div>');
  $('#customer-nazione').closest('div').append($hint);
}

function showCountryHint(msg) {
  ensureCountryHint();
  $('#customer-nazione-hint').removeClass('d-none').text(msg);
}

function hideCountryHint() {
  if (!$('#customer-nazione-hint').length) return;
  $('#customer-nazione-hint').addClass('d-none').text('');
}

function setSdiMode(mode, preserveValue) {
  const $sdi = $('#customer-sdi');
  const $p = $('#customer-sdi-privato');
  const $e = $('#customer-sdi-estero');

  if (mode === 'privato') {
    $p.prop('checked', true);
    $e.prop('checked', false);
    $sdi.val(SDI_PRIVATO).prop('disabled', true);

    // Miglioria: "Privato" implica Italia.
    if (!_isItalia(_getNazioneRaw())) {
      $('#customer-nazione').val('Italia');
    }
    applyCustomerCountryRules();
    return;
  }
  if (mode === 'estero') {
    $e.prop('checked', true);
    $p.prop('checked', false);
    $sdi.val(SDI_ESTERO).prop('disabled', true);

    // Miglioria: se era Italia, imposta un valore guida e avvisa.
    if (_isItalia(_getNazioneRaw())) {
      $('#customer-nazione').val('FR'); // placeholder guida
      showCountryHint("Selezionato 'Estero': Nazione impostata su 'FR' come esempio. Modificala con il codice paese corretto.");
      $('#customer-nazione').focus();
    }
    applyCustomerCountryRules();
    return;
  }

  // manuale
  $p.prop('checked', false);
  $e.prop('checked', false);
  $sdi.prop('disabled', false);
  if (!preserveValue) $sdi.val('');
}

function syncSdiModeFromValue() {
  const v = String($('#customer-sdi').val() || '').trim().toUpperCase();
  if (v === SDI_PRIVATO) return setSdiMode('privato', true);
  if (v === SDI_ESTERO) return setSdiMode('estero', true);

  // manuale (non sovrascrivere)
  $('#customer-sdi').prop('disabled', false);
  $('#customer-sdi-privato').prop('checked', false);
  $('#customer-sdi-estero').prop('checked', false);
}

function validateCustomerBeforeSave() {
  const nazioneRaw = _getNazioneRaw();
  if (!nazioneRaw) {
    alert("Nazione obbligatoria. Inserisci 'Italia'/'IT' oppure il codice paese a 2 lettere (es. FR).");
    $('#customer-nazione').focus();
    return false;
  }
  const up = nazioneRaw.toUpperCase();
  const isItaly = (up === 'IT' || up === 'ITALIA' || up === 'ITALY');
  const isCode2 = /^[A-Z]{2}$/.test(up);

  if (!isItaly && !isCode2) {
    alert("Nazione non valida. Usa 'Italia'/'IT' oppure un codice paese a 2 lettere (es. FR, DE, ES).");
    $('#customer-nazione').focus();
    return false;
  }

  if (_isItalia(nazioneRaw)) {
    const prov = String($('#customer-provincia').val() || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(prov)) {
      alert("Provincia obbligatoria per clienti italiani (sigla 2 lettere, es. TO).");
      $('#customer-provincia').focus();
      return false;
    }
  }

  // Coerenza flag SdI ↔ Nazione
  if ($('#customer-sdi-estero').is(':checked') && _isItalia(nazioneRaw)) {
    alert("Hai selezionato 'Estero' ma la Nazione risulta Italia/IT. Cambia Nazione (es. FR) oppure deseleziona 'Estero'.");
    $('#customer-nazione').focus();
    return false;
  }
  if ($('#customer-sdi-privato').is(':checked') && !_isItalia(nazioneRaw)) {
    alert("Hai selezionato 'Privato' ma la Nazione non è Italia/IT. Cambia Nazione oppure deseleziona 'Privato'.");
    $('#customer-nazione').focus();
    return false;
  }

  return true;
}


    $('#newCustomerBtn').click(() => {
      CURRENT_EDITING_ID = null;
      $('#customerForm')[0].reset();
      $('#customer-id').val('Nuovo');

      // Default Nazione: Italia
      $('#customer-nazione').val('Italia');
      applyCustomerCountryRules();

      // SDI: modalità manuale (nessun flag)
      setSdiMode('manual', false);

      // Defaults termini pagamento
      if ($('#customer-giorniTermini').length) $('#customer-giorniTermini').val('');
      if ($('#customer-fineMese').length) $('#customer-fineMese').prop('checked', false);
      if ($('#customer-giornoFissoEnabled').length) $('#customer-giornoFissoEnabled').prop('checked', false);
      if ($('#customer-giornoFissoValue').length) {
        $('#customer-giornoFissoValue').val('');
        $('#customer-giornoFissoValue').prop('disabled', true);
      }

      $('#customerModal').modal('show');
    });

    // Toggle UI giorno fisso
    $(document).on('change', '#customer-giornoFissoEnabled', function () {
      syncCustomerGiornoFissoUI();
    });

    // Regole Nazione/Provincia (obblighi per IT)
    $(document).on('input change', '#customer-nazione', function () {
      applyCustomerCountryRules();
    });

    // SDI flags: Privato / Estero
    $(document).on('change', '#customer-sdi-privato', function () {
      if ($(this).is(':checked')) setSdiMode('privato', true);
      else setSdiMode('manual', false);
    });

    $(document).on('change', '#customer-sdi-estero', function () {
      if ($(this).is(':checked')) setSdiMode('estero', true);
      else setSdiMode('manual', false);
    });

    // Se l'utente inserisce manualmente 0000000 o XXXXXXX, attiva il flag corrispondente
    $(document).on('change blur', '#customer-sdi', function () {
      if (!$('#customer-sdi').prop('disabled')) syncSdiModeFromValue();
    });

    // Quando apro la modale (sia nuovo che modifica) riallineo l'abilitazione del campo valore
    $('#customerModal').on('shown.bs.modal', function () {
      syncCustomerGiornoFissoUI();
      syncSdiModeFromValue();
      applyCustomerCountryRules();
    });

    $('#saveCustomerBtn').click(async () => {
      applyCustomerCountryRules();
      if (!validateCustomerBeforeSave()) return;

      // SDI: se selezionati i flag, forza il codice
      if ($('#customer-sdi-privato').is(':checked')) $('#customer-sdi').val(SDI_PRIVATO);
      if ($('#customer-sdi-estero').is(':checked')) $('#customer-sdi').val(SDI_ESTERO);

      const nazioneToSave = _normalizeNazioneForSave($('#customer-nazione').val());
      const data = {
        name: $('#customer-name').val(),
        piva: $('#customer-piva').val(),
        codiceFiscale: $('#customer-codiceFiscale').val(),
        sdi: String($('#customer-sdi').val() || '').trim().toUpperCase(),
        address: $('#customer-address').val(),
        comune: $('#customer-comune').val(),
        provincia: ($('#customer-provincia').val() || '').toUpperCase(),
        cap: $('#customer-cap').val(),
        nazione: nazioneToSave,
        rivalsaInps: $('#customer-rivalsaInps').is(':checked'),
        sostitutoImposta: $('#customer-sostitutoImposta').is(':checked'),
        pec: $('#customer-pec').val() || '',

        // Termini pagamento default (opzionali)
        giorniTermini: (() => {
          const raw = $('#customer-giorniTermini').length ? String($('#customer-giorniTermini').val() || '').trim() : '';
          if (raw === '') return null;
          const n = parseInt(raw, 10);
          return isNaN(n) ? null : n;
        })(),
        fineMese: $('#customer-fineMese').length ? $('#customer-fineMese').is(':checked') : false,
        giornoFissoEnabled: $('#customer-giornoFissoEnabled').length ? $('#customer-giornoFissoEnabled').is(':checked') : false,
        giornoFissoValue: (() => {
          const en = $('#customer-giornoFissoEnabled').length ? $('#customer-giornoFissoEnabled').is(':checked') : false;
          if (!en) return null;
          const raw = $('#customer-giornoFissoValue').length ? String($('#customer-giornoFissoValue').val() || '').trim() : '';
          if (raw === '') return null;
          const n = parseInt(raw, 10);
          if (isNaN(n) || n < 1 || n > 31) return null;
          return n;
        })()
      };

      let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : String(getNextId(getData('customers')));
      await saveDataToCloud('customers', data, id);
      $('#customerModal').modal('hide');
      renderAll();
    });

    $('#customers-table-body').on('click', '.btn-edit-customer', function (e) {
      window.AppModules.masterdata.editItem('customer', $(e.currentTarget).attr('data-id'));
    });

    $('#customers-table-body').on('click', '.btn-delete-customer', function (e) {
      deleteDataFromCloud('customers', $(e.currentTarget).attr('data-id'));
    });
  }

  window.AppModules.customers.bind = bind;
})();
