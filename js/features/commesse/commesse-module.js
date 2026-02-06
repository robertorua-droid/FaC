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
    $('#commessa-endCustomer').val('');
    $('#commessa-billToCustomer').val('');
    $('#commessa-status').val('attiva');
    $('#commessa-notes').val('');
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
    $('#commessa-endCustomer').val(cm.endCustomerName || '');
    $('#commessa-billToCustomer').val(cm.billToCustomerId || '');
    $('#commessa-status').val(cm.status || 'attiva');
    $('#commessa-notes').val(cm.notes || '');
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

  async function saveFromModal() {
    const name = String($('#commessa-name').val() || '').trim();
    if (!name) {
      alert('Inserisci il nome della Commessa.');
      return;
    }

    const data = {
      name,
      endCustomerName: String($('#commessa-endCustomer').val() || '').trim(),
      billToCustomerId: String($('#commessa-billToCustomer').val() || '').trim(),
      status: String($('#commessa-status').val() || 'attiva'),
      notes: String($('#commessa-notes').val() || '').trim(),
    };

    let id = editingId;
    if (!id) {
      id = String(getNextId(getData('commesse') || []));
    }

    await saveDataToCloud('commesse', data, id);

    // chiudi
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('commessaModal'));
    modal.hide();

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
