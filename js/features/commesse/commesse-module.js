// js/features/commesse/commesse-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.commesse = window.AppModules.commesse || {};

  let _bound = false;
  let editingId = null;

  function openModalForNew() {
    editingId = null;
    $('#commessa-id').val('');
    $('#commessa-name').val('');
    $('#commessa-billToCustomer').val('');
    $('#commessa-status').val('attiva');
    $('#commessa-notes').val('');
    $('#commessa-estimated-hours').val('');
    $('#commessaModalLabel').text('Nuova Commessa');
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('commessaModal'));
    modal.show();
  }

  function openModalForEdit(id) {
    const cm = (getData('commesse') || []).find(x => String(x.id) === String(id));
    if (!cm) return;

    editingId = String(cm.id);
    $('#commessa-id').val(editingId);
    $('#commessa-name').val(cm.name || '');
    $('#commessa-billToCustomer').val(cm.billToCustomerId || '');
    $('#commessa-status').val(cm.status || 'attiva');
    $('#commessa-notes').val(cm.notes || '');
    $('#commessa-estimated-hours').val(cm.estimatedHours != null && cm.estimatedHours !== '' ? cm.estimatedHours : '');
    $('#commessaModalLabel').text('Modifica Commessa');

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('commessaModal'));
    modal.show();
  }

  function canDeleteCommessa(id) {
    const commessaId = String(id);
    const projects = getData('projects') || [];
    const worklogs = getData('worklogs') || [];

    const hasProjects = projects.some(p => String(p.commessaId) === commessaId);
    if (hasProjects) return { ok: false, msg: 'Impossibile eliminare: esistono Progetti collegati a questa Commessa.' };

    const hasWorklogs = worklogs.some(wl => String(wl.commessaId) === commessaId);
    if (hasWorklogs) return { ok: false, msg: 'Impossibile eliminare: esistono righe Timesheet collegate a questa Commessa.' };

    return { ok: true };
  }

  function getActiveProjectsForCommessa(commessaId) {
    const id = String(commessaId || '');
    if (!id) return [];
    return (getData('projects') || []).filter(project => {
      const projectCommessaId = String(project.commessaId || '');
      const status = String(project.status || 'attivo').trim().toLowerCase();
      return projectCommessaId === id && status !== 'archiviato';
    });
  }

  async function archiveProjectsForClosedCommessa(projects) {
    const list = Array.isArray(projects) ? projects : [];
    if (!list.length) return;

    const updates = list
      .filter(project => project && project.id != null)
      .map(project => ({
        id: String(project.id),
        data: { status: 'archiviato' }
      }));

    if (!updates.length) return;

    if (typeof batchSaveDataToCloud === 'function') {
      await batchSaveDataToCloud('projects', updates);
      if (window.AppStore && typeof window.AppStore.notify === 'function') {
        window.AppStore.notify('projects');
      }
      return;
    }

    for (const update of updates) {
      await saveDataToCloud('projects', update.data, update.id);
    }
  }

  async function maybeArchiveProjectsAfterClosingCommessa(commessaId, wasOpen, isNowClosed) {
    if (!wasOpen || !isNowClosed) return;

    const activeProjects = getActiveProjectsForCommessa(commessaId);
    if (!activeProjects.length) return;

    const noun = activeProjects.length === 1 ? 'progetto collegato ancora attivo' : 'progetti collegati ancora attivi';
    const ok = confirm(`La commessa è stata chiusa. Sono presenti ${activeProjects.length} ${noun}.\n\nVuoi archiviarli ora?`);
    if (!ok) return;

    await archiveProjectsForClosedCommessa(activeProjects);
    alert(activeProjects.length === 1
      ? 'Il progetto collegato è stato archiviato.'
      : `Sono stati archiviati ${activeProjects.length} progetti collegati.`);
  }

  async function saveFromModal() {
    const name = String($('#commessa-name').val() || '').trim();
    if (!name) {
      alert('Inserisci il nome della Commessa.');
      return;
    }

    const previousCommessa = editingId
      ? (getData('commesse') || []).find(x => String(x.id) === String(editingId))
      : null;
    const previousStatus = String((previousCommessa && previousCommessa.status) || 'attiva').trim().toLowerCase();

    const estimatedHoursRaw = String($('#commessa-estimated-hours').val() || '').trim().replace(',', '.');
    const estimatedHours = estimatedHoursRaw === '' ? null : parseFloat(estimatedHoursRaw);
    if (estimatedHoursRaw !== '' && (!isFinite(estimatedHours) || estimatedHours < 0)) {
      alert('Inserisci un valore valido per le Ore previste, oppure lascia il campo vuoto.');
      return;
    }

    const data = {
      name,
      billToCustomerId: String($('#commessa-billToCustomer').val() || '').trim(),
      status: String($('#commessa-status').val() || 'attiva'),
      notes: String($('#commessa-notes').val() || '').trim(),
      estimatedHours: estimatedHoursRaw === '' ? null : estimatedHours,
    };

    let id = editingId;
    if (!id) {
      id = String(getNextId(getData('commesse') || []));
    }

    const currentStatus = String(data.status || 'attiva').trim().toLowerCase();
    const wasOpen = !!previousCommessa && previousStatus !== 'chiusa';
    const isNowClosed = currentStatus === 'chiusa';

    await saveDataToCloud('commesse', data, id);

    // chiudi
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('commessaModal'));
    modal.hide();

    await maybeArchiveProjectsAfterClosingCommessa(id, wasOpen, isNowClosed);

    // refresh
    if (typeof renderCommessePage === 'function') renderCommessePage();
    if (typeof renderProjectsPage === 'function') renderProjectsPage();
    if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
    if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    $('#btn-new-commessa').on('click', function () {
      openModalForNew();
    });

    $('#commessa-save-btn').on('click', async function () {
      try {
        await saveFromModal();
      } catch (e) {
        console.error('Errore salvataggio commessa:', e);
        alert('Errore salvataggio commessa.');
      }
    });

    // azioni tabella
    $(document).on('click', '.btn-edit-commessa', function () {
      openModalForEdit($(this).data('id'));
    });

    $(document).on('click', '.btn-delete-commessa', async function () {
      const id = $(this).data('id');
      const check = canDeleteCommessa(id);
      if (!check.ok) {
        alert(check.msg);
        return;
      }
      await deleteDataFromCloud('commesse', id);
      if (typeof renderCommessePage === 'function') renderCommessePage();
      if (typeof renderProjectsPage === 'function') renderProjectsPage();
      if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
      if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
    });
  }

  window.AppModules.commesse.bind = bind;
})();
