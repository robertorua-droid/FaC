// js/features/commesse/timesheet-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.timesheet = window.AppModules.timesheet || {};

  let _bound = false;
  let editingId = null;

  function updateUnlockSelectionUI() {
    const $checks = $('.ts-wl-select');
    const $enabled = $checks.filter(':not(:disabled)');
    const checkedCount = $checks.filter(':checked').length;

    // button
    $('#ts-unlock-selected-btn').prop('disabled', checkedCount === 0);

    // select all checkbox
    const $all = $('#ts-select-all-invoiced');
    if ($all.length) {
      const enabledCount = $enabled.length;
      if (enabledCount === 0) {
        $all.prop('checked', false);
        $all.prop('indeterminate', false);
      } else if (checkedCount === 0) {
        $all.prop('checked', false);
        $all.prop('indeterminate', false);
      } else if (checkedCount === enabledCount) {
        $all.prop('checked', true);
        $all.prop('indeterminate', false);
      } else {
        $all.prop('checked', false);
        $all.prop('indeterminate', true);
      }
    }
  }

  async function unlockSelectedWorklogs() {
    const ids = $('.ts-wl-select:checked').map(function(){ return String($(this).data('id')); }).get();
    if (!ids.length) return;

    const msg = 'Vuoi sbloccare ' + ids.length + ' worklog selezionati?\n\n' +
      'Questa operazione rimuove il collegamento alla fattura e li rende nuovamente importabili.';
    if (!confirm(msg)) return;

    const updates = ids.map(id => ({
      id,
      data: { invoiceId: null, invoiceNumber: null, invoicedAt: null }
    }));

    await batchSaveDataToCloud('worklogs', updates);

    // refresh UI
    try {
      $('#ts-select-all-invoiced').prop('checked', false).prop('indeterminate', false);
      $('#ts-unlock-selected-btn').prop('disabled', true);
    } catch (e) {}

    if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
    if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();

    alert('Worklog sbloccati: ' + ids.length);
  }

  function minutesFromInputs() {
    const h = parseInt($('#ts-hours').val(), 10) || 0;
    const m = parseInt($('#ts-minutes').val(), 10) || 0;
    return h * 60 + m;
  }

  function setInputsFromMinutes(totalMinutes) {
    const mins = parseInt(totalMinutes, 10) || 0;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    $('#ts-hours').val(h);
    $('#ts-minutes').val(m);
  }

  function resetForm() {
    editingId = null;
    $('#ts-id').val('');
    // default oggi
    const today = new Date().toISOString().slice(0, 10);
    if (!$('#ts-date').val()) $('#ts-date').val(today);
    $('#ts-commessa').val('');
    $('#ts-project').val('');
    $('#ts-hours').val(0);
    $('#ts-minutes').val(0);
    $('#ts-billable').prop('checked', true);
    $('#ts-note').val('');
    $('#ts-save-btn').text('Salva');
    $('#ts-cancel-edit-btn').addClass('d-none');
  }

  function loadForEdit(id) {
    const wl = (getData('worklogs') || []).find(x => String(x.id) === String(id));
    if (!wl) return;

    editingId = String(wl.id);
    $('#ts-id').val(editingId);
    $('#ts-date').val(wl.date || '');
    $('#ts-commessa').val(String(wl.commessaId || ''));

    if (typeof window.populateProjectsForCommessa === 'function') {
      window.populateProjectsForCommessa('#ts-project', String(wl.commessaId || ''), wl.projectId);
    } else {
      $('#ts-project').val(String(wl.projectId || ''));
    }

    setInputsFromMinutes(wl.minutes || 0);
    $('#ts-billable').prop('checked', wl.billable !== false);
    $('#ts-note').val(wl.note || '');

    $('#ts-save-btn').text('Aggiorna');
    $('#ts-cancel-edit-btn').removeClass('d-none');
  }

  async function saveWorklog() {
    const date = String($('#ts-date').val() || '').trim();
    const commessaId = String($('#ts-commessa').val() || '').trim();
    const projectId = String($('#ts-project').val() || '').trim();
    const minutes = minutesFromInputs();
    const billable = $('#ts-billable').is(':checked');
    const note = String($('#ts-note').val() || '').trim();

    if (!date) {
      alert('Seleziona una data.');
      return;
    }
    if (!commessaId) {
      alert('Seleziona una Commessa.');
      return;
    }
    if (!projectId) {
      alert('Seleziona un Progetto.');
      return;
    }
    if (!minutes || minutes <= 0) {
      alert('Inserisci una durata valida (minuti/ore).');
      return;
    }

    let id = editingId;
    if (!id) id = String(getNextId(getData('worklogs') || []));

    const data = {
      date,
      commessaId,
      projectId,
      minutes,
      billable,
      note
    };

    await saveDataToCloud('worklogs', data, id);
    resetForm();
    if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
    if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    // default filtri
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    if (!$('#ts-filter-from').val()) $('#ts-filter-from').val(firstDay);
    if (!$('#ts-filter-to').val()) $('#ts-filter-to').val(lastDay);

    // form
    $('#ts-save-btn').on('click', async function () {
      try {
        await saveWorklog();
      } catch (e) {
        console.error('Errore salvataggio timesheet:', e);
        alert('Errore salvataggio timesheet.');
      }
    });

    $('#ts-cancel-edit-btn').on('click', function () {
      resetForm();
    });

    // dipendenza progetto da commessa (form)
    $('#ts-commessa').on('change', function () {
      const commessaId = String($(this).val() || '');
      if (typeof window.populateProjectsForCommessa === 'function') {
        window.populateProjectsForCommessa('#ts-project', commessaId);
      }
    });

    // filtri
    $('#ts-filter-from, #ts-filter-to, #ts-commessa-filter, #ts-project-filter, #ts-billable-filter, #ts-invoiced-filter').on('change', function () {
      if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
    });

    // dipendenza progetto da commessa (filtro)
    $('#ts-commessa-filter').on('change', function () {
      const commessaId = String($(this).val() || '');
      if (typeof window.populateProjectsForCommessa === 'function') {
        window.populateProjectsForCommessa('#ts-project-filter', commessaId === 'all' ? '' : commessaId, 'all', true);
      }
      if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
    });

    // azioni tabella
    $(document).on('click', '.btn-edit-worklog', function () {
      loadForEdit($(this).data('id'));
    });


    // selezione per sblocco (solo worklog fatturati)
    $(document).on('change', '.ts-wl-select', function () {
      updateUnlockSelectionUI();
    });

    $('#ts-select-all-invoiced').on('change', function () {
      const checked = $(this).is(':checked');
      $('.ts-wl-select:not(:disabled)').prop('checked', checked);
      updateUnlockSelectionUI();
    });

    $('#ts-unlock-selected-btn').on('click', async function () {
      try {
        await unlockSelectedWorklogs();
      } catch (e) {
        console.error('Errore sblocco worklog:', e);
        alert('Errore sblocco worklog.');
      }
    });

    $(document).on('click', '.btn-delete-worklog', async function () {
      const id = $(this).data('id');
      const wl = (getData('worklogs') || []).find(x => String(x.id) === String(id));
      if (wl && wl.invoiceId) {
        const invNum = wl.invoiceNumber ? (' ' + wl.invoiceNumber) : '';
        const msg = 'Questo worklog risulta gia collegato ad una fattura' + invNum + '.\n\nEliminandolo potresti perdere il collegamento storico. Vuoi continuare?';
        if (!confirm(msg)) return;
      }
      await deleteDataFromCloud('worklogs', id);
      if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
      if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
    });

    // inizializza form
    resetForm();
  }

  window.AppModules.timesheet.bind = bind;
  window.AppModules.timesheet._resetForm = resetForm; // debug/utility
})();
