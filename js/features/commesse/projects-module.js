// js/features/commesse/projects-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.projects = window.AppModules.projects || {};

  let _bound = false;
  let editingId = null;

  function openModalForNew(prefCommessaId = '') {
    editingId = null;
    $('#project-id').val('');
    $('#project-commessa').val(prefCommessaId || '');
    $('#project-name').val('');
    $('#project-code').val('');
    $('#project-endCustomer').val('');
    $('#project-status').val('attivo');
    $('#project-default-product').val('');
    $('#project-hourly-rate').val('');
    $('#project-isLavoro').prop('checked', true);
    $('#project-isCosto').prop('checked', false);
    $('#projectModalLabel').text('Nuovo Progetto');
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('projectModal'));
    modal.show();
  }

  function openModalForEdit(id) {
    const pr = (getData('projects') || []).find(x => String(x.id) === String(id));
    if (!pr) return;

    editingId = String(pr.id);
    $('#project-id').val(editingId);
    $('#project-commessa').val(String(pr.commessaId || ''));
    $('#project-name').val(pr.name || '');
    $('#project-code').val(pr.code || '');
    $('#project-endCustomer').val(String(pr.endCustomerId || ''));
    $('#project-status').val(pr.status || 'attivo');
    $('#project-default-product').val(String(pr.billingProductId || ''));
    $('#project-hourly-rate').val(pr.hourlyRate != null ? pr.hourlyRate : '');
    const isCosto = (pr.isCosto === true || pr.isCosto === 'true');
    $('#project-isCosto').prop('checked', isCosto);
    $('#project-isLavoro').prop('checked', !isCosto);
    $('#projectModalLabel').text('Modifica Progetto');

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('projectModal'));
    modal.show();
  }

  function canDeleteProject(id) {
    const projectId = String(id);
    const worklogs = getData('worklogs') || [];
    const hasWorklogs = worklogs.some(wl => String(wl.projectId) === projectId);
    if (hasWorklogs) return { ok: false, msg: 'Impossibile eliminare: esistono righe Timesheet collegate a questo Progetto.' };
    return { ok: true };
  }

  async function saveFromModal() {
    const commessaId = String($('#project-commessa').val() || '').trim();
    const name = String($('#project-name').val() || '').trim();

    if (!commessaId) {
      alert('Seleziona la Commessa.');
      return;
    }
    if (!name) {
      alert('Inserisci il nome del Progetto.');
      return;
    }

    const isCosto = $('#project-isCosto').is(':checked');

    const data = {
      commessaId,
      code: String($('#project-code').val() || '').trim(),
      name,
      endCustomerId: String($('#project-endCustomer').val() || '').trim(),
      status: String($('#project-status').val() || 'attivo'),
      billingProductId: String($('#project-default-product').val() || '').trim(),
      hourlyRate: (() => {
        const v = String($('#project-hourly-rate').val() || '').trim();
        if (!v) return '';
        const n = parseFloat(v);
        return isNaN(n) ? '' : n;
      })(),
      isCosto: isCosto
    };

    let id = editingId;
    if (!id) id = String(getNextId(getData('projects') || []));

    await saveDataToCloud('projects', data, id);

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('projectModal'));
    modal.hide();

    if (typeof renderProjectsPage === 'function') renderProjectsPage();
    if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
    if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    $('#btn-new-project').on('click', function () {
      const pref = String($('#projects-commessa-filter').val() || '').trim();
      openModalForNew(pref && pref !== 'all' ? pref : '');
    });

    $('#project-save-btn').on('click', async function () {
      try {
        await saveFromModal();
      } catch (e) {
        console.error('Errore salvataggio progetto:', e);
        alert('Errore salvataggio progetto.');
      }
    });

    $(document).on('click', '.btn-edit-project', function () {
      openModalForEdit($(this).data('id'));
    });

    $(document).on('click', '.btn-delete-project', async function () {
      const id = $(this).data('id');
      const check = canDeleteProject(id);
      if (!check.ok) {
        alert(check.msg);
        return;
      }
      await deleteDataFromCloud('projects', id);
      if (typeof renderProjectsPage === 'function') renderProjectsPage();
      if (typeof renderTimesheetPage === 'function') renderTimesheetPage();
      if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
    });

    // filtro commessa nella pagina progetti
    $('#projects-commessa-filter').on('change', function () {
      if (typeof renderProjectsPage === 'function') renderProjectsPage();
    });

    // Checkboxes mutuamente esclusive (Lavoro / Costo)
    $('#project-isLavoro').on('change', function () {
      if ($(this).is(':checked')) {
        $('#project-isCosto').prop('checked', false);
      } else {
        // evita nessuna scelta: se tolgo lavoro e costo e false, rimetto lavoro
        if (!$('#project-isCosto').is(':checked')) $(this).prop('checked', true);
      }
    });

    $('#project-isCosto').on('change', function () {
      if ($(this).is(':checked')) {
        $('#project-isLavoro').prop('checked', false);
      } else {
        if (!$('#project-isLavoro').is(':checked')) $('#project-isLavoro').prop('checked', true);
      }
    });

    // Selezione servizio: eredita tariffa e tipo (Lavoro/Costo) dal servizio
    $('#project-default-product').on('change', function () {
      try {
        const prodId = String($(this).val() || '').trim();
        if (!prodId) return;
        const prod = (getData('products') || []).find(p => String(p.id) === prodId);
        if (!prod) return;

        // Tariffa: porta dietro il prezzo del servizio (modificabile dall'utente)
        const sp = String(prod.salePrice || '').trim();
        if (sp && !isNaN(parseFloat(sp))) {
          $('#project-hourly-rate').val(parseFloat(sp));
        }

        // Tipo progetto: eredita isCosto/isLavoro dal servizio
        const isCosto = (prod.isCosto === true || prod.isCosto === 'true');
        $('#project-isCosto').prop('checked', isCosto).trigger('change');
        $('#project-isLavoro').prop('checked', !isCosto).trigger('change');
      } catch (e) {
        console.warn('Eredita dati da servizio: errore', e);
      }
    });

  }

  window.AppModules.projects.bind = bind;
})();
