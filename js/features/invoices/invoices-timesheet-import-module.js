// js/features/invoices/invoices-timesheet-import-module.js
// Importa ore dal Timesheet nel form Fattura (azione esplicita e reversibile)

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.invoicesTimesheetImport = window.AppModules.invoicesTimesheetImport || {};
  window.App = window.App || {};
  window.App.invoices = window.App.invoices || {};

  let _bound = false;

  const esc = (s) => {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  // Regime fiscale (gestionale) unificato: usa isForfettario() da utils.js


  function formatMonthLabel(ym) {
    // ym: YYYY-MM
    const parts = String(ym || '').split('-');
    if (parts.length !== 2) return ym;
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${mesi[(m - 1) >= 0 ? (m - 1) : 0]} ${y}`;
  }

  function setAlert(msg, kind = 'info') {
    const $a = $('#tsimp-alert');
    if (!$a.length) return;
    if (!msg) {
      $a.addClass('d-none').removeClass('alert-info alert-warning alert-danger alert-success');
      return;
    }
    $a.removeClass('d-none alert-info alert-warning alert-danger alert-success').addClass(`alert-${kind}`);
    $a.html(msg);
  }

  function getCommessaByIdSafe(id) {
    if (typeof window.getCommessaById === 'function') return window.getCommessaById(id);
    return (getData('commesse') || []).find((c) => String(c.id) === String(id)) || null;
  }

  function getProjectByIdSafe(id) {
    if (typeof window.getProjectById === 'function') return window.getProjectById(id);
    return (getData('projects') || []).find((p) => String(p.id) === String(id)) || null;
  }

  function getProductByIdSafe(id) {
    return (getData('products') || []).find((p) => String(p.id) === String(id)) || null;
  }

  function getInvoiceCustomerId() {
    return String($('#invoice-customer-select').val() || '').trim();
  }

  function getCurrentInvoiceIdSafe() {
    try {
      if (window.App && window.App.invoices && typeof window.App.invoices.getCurrentInvoiceId === 'function') {
        return window.App.invoices.getCurrentInvoiceId();
      }
    } catch (e) {}
    return null;
  }

  function defaultDateRangeFromInvoice() {
    const d = String($('#invoice-date').val() || '').trim();
    if (!d) return { from: '', to: '' };
    const y = d.slice(0, 4);
    const m = d.slice(5, 7);
    return { from: `${y}-${m}-01`, to: d };
  }

  function populateDefaultProductSelect($sel, selectedVal, includeEmpty = true) {
    if (!$sel || !$sel.length) return;
    const prev = selectedVal != null ? String(selectedVal) : String($sel.val() || '');
    $sel.empty();
    if (includeEmpty) $sel.append('<option value="">(seleziona...)</option>');
    (getData('products') || [])
      .slice()
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')))
      .forEach((p) => {
        const label = (p.code ? (p.code + ' - ') : '') + (p.description || '');
        $sel.append(`<option value="${p.id}">${esc(label)}</option>`);
      });
    if (prev && $sel.find(`option[value="${prev}"]`).length) $sel.val(prev);
  }

  function populateCommesseFiltered() {
    const cid = getInvoiceCustomerId();
    const $sel = $('#tsimp-commessa');
    if (!$sel.length) return;

    const commesse = (getData('commesse') || []).slice();

    if (!cid) {
      // Nessun cliente: mostro tutte, ma avviso
      $sel.empty().append('<option value="all">Tutte</option>');
      commesse.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .forEach((c) => $sel.append(`<option value="${c.id}">${esc(c.name || '')}</option>`));
      setAlert('Seleziona prima un <strong>Cliente</strong> nella fattura: il filtro Commessa non può essere limitato.', 'warning');
      return;
    }

    const filtered = commesse.filter((c) => String(c.billToCustomerId || '') === cid);
    const list = filtered.length ? filtered : commesse;

    $sel.empty().append('<option value="all">Tutte</option>');
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .forEach((c) => {
        const note = (filtered.length ? '' : ' (non associata al cliente selezionato)');
        $sel.append(`<option value="${c.id}">${esc((c.name || '') + note)}</option>`);
      });

    if (filtered.length) {
      setAlert('Mostro solo le commesse con <code>billToCustomerId</code> uguale al cliente selezionato in fattura.', 'info');
    } else {
      setAlert('Nessuna commessa trovata per il cliente selezionato: mostro <strong>tutte</strong> le commesse.', 'warning');
    }
  }

  function populateProjectsForCommessaInImport(commessaId) {
    const $sel = $('#tsimp-project');
    if (!$sel.length) return;

    const all = (getData('projects') || []).slice();
    let list = all;
    if (commessaId && commessaId !== 'all') {
      list = all.filter((p) => String(p.commessaId) === String(commessaId));
    }

    $sel.empty().append('<option value="all">Tutti</option>');
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .forEach((p) => $sel.append(`<option value="${p.id}">${esc(p.name || '')}</option>`));
  }

  function buildGroups() {
    const from = String($('#tsimp-from').val() || '').trim();
    const to = String($('#tsimp-to').val() || '').trim();
    const commessaId = String($('#tsimp-commessa').val() || 'all');
    const projectId = String($('#tsimp-project').val() || 'all');
    const onlyBillable = $('#tsimp-only-billable').is(':checked');
    const grouping = String($('#tsimp-grouping').val() || 'project');

    let rows = (getData('worklogs') || []).slice();

    if (from) rows = rows.filter((r) => String(r.date || '') >= from);
    if (to) rows = rows.filter((r) => String(r.date || '') <= to);
    if (commessaId && commessaId !== 'all') rows = rows.filter((r) => String(r.commessaId) === commessaId);
    if (projectId && projectId !== 'all') rows = rows.filter((r) => String(r.projectId) === projectId);
    if (onlyBillable) rows = rows.filter((r) => (r.billable !== false));

    // Step 2: escludo worklog gia' fatturati (salvo se appartengono alla fattura in modifica)
    const _currInvId = getCurrentInvoiceIdSafe();
    const _beforeInv = rows.length;
    rows = rows.filter((r) => {
      if (!r || !r.invoiceId) return true;
      if (_currInvId && String(r.invoiceId) === String(_currInvId)) return true;
      return false;
    });
    const excludedInvoicedCount = _beforeInv - rows.length;
    window._tsimpExcludedInvoiced = excludedInvoicedCount;

    const groups = new Map();

    rows.forEach((wl) => {
      const pid = String(wl.projectId || '');
      const cid = String(wl.commessaId || '');
      const minutes = parseInt(wl.minutes, 10) || 0;
      const ym = String(wl.date || '').slice(0, 7);

      let key = pid || 'no_project';
      let periodLabel = (from && to) ? `${from} - ${to}` : '';

      if (grouping === 'project_month') {
        key = `${pid}__${ym}`;
        periodLabel = formatMonthLabel(ym);
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          projectId: pid,
          commessaId: cid,
          periodLabel,
          minutes: 0,
          worklogIds: []
        });
      }
      const g = groups.get(key);
      g.minutes += minutes;
      g.worklogIds.push(String(wl.id));
    });

    return Array.from(groups.values())
      .filter((g) => g.minutes > 0)
      .sort((a, b) => {
        // sort by commessa then project then period
        return String(a.commessaId).localeCompare(String(b.commessaId)) || String(a.projectId).localeCompare(String(b.projectId)) || String(a.periodLabel).localeCompare(String(b.periodLabel));
      });
  }

  function resolveDefaultServiceForGroup(group) {
    const project = getProjectByIdSafe(group.projectId);
    const projectServiceId = project ? String(project.billingProductId || '').trim() : '';
    const fallback = String($('#tsimp-default-product').val() || '').trim();
    const serviceId = projectServiceId || fallback;
    return serviceId;
  }

  function resolveDefaultRateForGroup(group, serviceId) {
    const project = getProjectByIdSafe(group.projectId);
    const projectRate = project && project.hourlyRate != null && project.hourlyRate !== '' && !isNaN(parseFloat(project.hourlyRate)) ? parseFloat(project.hourlyRate) : null;
    const fallbackRate = (() => {
      const v = String($('#tsimp-default-rate').val() || '').trim();
      if (!v) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    })();

    if (projectRate != null) return projectRate;
    if (fallbackRate != null) return fallbackRate;

    const prod = getProductByIdSafe(serviceId);
    if (prod && prod.salePrice != null && !isNaN(parseFloat(prod.salePrice))) {
      return parseFloat(prod.salePrice);
    }

    return 0;
  }

  function getTipoForProject(project) {
    const isCosto = project ? (project.isCosto === true || project.isCosto === 'true') : false;
    return isCosto ? 'Costo' : 'Lavoro';
  }

  function updatePreview() {
    const $tbody = $('#tsimp-preview-tbody');
    if (!$tbody.length) return;

    const groups = buildGroups();

    // Step 2: avviso se alcuni worklog sono esclusi perche gia fatturati
    const _excluded = parseInt(window._tsimpExcludedInvoiced || '0', 10) || 0;
    if (_excluded > 0) {
      setAlert('Nota: ' + _excluded + ' worklog gia fatturati sono stati esclusi dall\'import.', 'warning');
    }


    // Avviso se sono stati esclusi worklog gia' fatturati
    if (typeof window._tsimpExcludedInvoiced === 'number' && window._tsimpExcludedInvoiced > 0) {
      setAlert(`Ho escluso <strong>${window._tsimpExcludedInvoiced}</strong> worklog gia' fatturati (per evitare doppie fatturazioni).`, 'warning');
    }

    // Totali
    let totMinutes = 0;
    let totAmount = 0;

    $tbody.empty();

    groups.forEach((g) => {
      const cm = getCommessaByIdSafe(g.commessaId);
      const pr = getProjectByIdSafe(g.projectId);

      const hours = g.minutes / 60;
      const hoursDisp = hours.toFixed(2);

      const serviceId = resolveDefaultServiceForGroup(g);
      const rate = resolveDefaultRateForGroup(g, serviceId);
      const tipo = getTipoForProject(pr);

      const serviceSelectId = `tsimp-row-product-${g.key.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
      const rateInputId = `tsimp-row-rate-${g.key.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;

      const amount = (parseFloat(hoursDisp) * (parseFloat(rate) || 0));

      totMinutes += g.minutes;
      totAmount += amount;

      $tbody.append(`
        <tr data-key="${esc(g.key)}" data-commessa="${esc(g.commessaId)}" data-project="${esc(g.projectId)}" data-minutes="${g.minutes}" data-period="${esc(g.periodLabel)}" data-worklog-ids="${esc(g.worklogIds.join(','))}">
          <td>${esc(cm ? (cm.name || '') : '')}</td>
          <td>${esc(pr ? (pr.name || '') : '')}</td>
          <td class="small">${esc(g.periodLabel || '')}</td>
          <td class="text-end">${hoursDisp}</td>
          <td>
            <select class="form-select form-select-sm tsimp-row-product" id="${serviceSelectId}"></select>
          </td>
          <td class="text-end">
            <input type="number" step="0.01" class="form-control form-control-sm text-end tsimp-row-rate" id="${rateInputId}" value="${(parseFloat(rate) || 0).toFixed(2)}" />
          </td>
          <td>${tipo === 'Costo' ? '<span class="badge bg-warning text-dark">Costo</span>' : '<span class="badge bg-primary">Lavoro</span>'}</td>
          <td class="text-end">€ <span class="tsimp-row-amount">${amount.toFixed(2)}</span></td>
        </tr>
      `);

      // popola select prodotti
      const $sel = $('#' + serviceSelectId);
      populateDefaultProductSelect($sel, serviceId, true);
      if (serviceId && $sel.find(`option[value="${serviceId}"]`).length) $sel.val(serviceId);
    });

    $('#tsimp-preview-total-hours').text((totMinutes / 60).toFixed(2));
    $('#tsimp-preview-total-amount').text(totAmount.toFixed(2));

    if (!groups.length) {
      $tbody.append('<tr><td colspan="8" class="text-center text-muted">Nessuna riga trovata con i filtri selezionati.</td></tr>');
    }
  }

  function recalcRowAmount($tr) {
    const minutes = parseInt(String($tr.data('minutes') || '0'), 10) || 0;
    const hours = (minutes / 60);
    const rate = parseFloat($tr.find('.tsimp-row-rate').val()) || 0;
    const amount = (parseFloat(hours.toFixed(2)) * rate);
    $tr.find('.tsimp-row-amount').text(amount.toFixed(2));

    // aggiorna totali
    let tot = 0;
    $('#tsimp-preview-tbody tr').each(function () {
      const v = parseFloat($(this).find('.tsimp-row-amount').text()) || 0;
      tot += v;
    });
    $('#tsimp-preview-total-amount').text(tot.toFixed(2));
  }

  function importIntoInvoice() {
    if (!window.tempInvoiceLines) window.tempInvoiceLines = [];

    const $rows = $('#tsimp-preview-tbody tr');
    if (!$rows.length || ($rows.length === 1 && $rows.first().find('td').length === 1)) {
      alert('Nessuna riga da importare.');
      return;
    }

    const forf = isForfettario();

    const batchId = String(Date.now());

    const tsState = {
      version: 1,
      batchId: batchId,
      importedAt: new Date().toISOString(),
      customerId: getInvoiceCustomerId(),
      from: String($('#tsimp-from').val() || '').trim(),
      to: String($('#tsimp-to').val() || '').trim(),
      grouping: String($('#tsimp-grouping').val() || 'project'),
      onlyBillable: $('#tsimp-only-billable').is(':checked'),
      commessaFilter: String($('#tsimp-commessa').val() || 'all'),
      projectFilter: String($('#tsimp-project').val() || 'all'),
      worklogIds: [],
      groups: []
    };

    $rows.each(function () {
      const $tr = $(this);
      const mins = parseInt(String($tr.data('minutes') || '0'), 10) || 0;
      if (!mins) return;

      const commessaId = String($tr.data('commessa') || '');
      const projectId = String($tr.data('project') || '');
      const periodLabel = String($tr.data('period') || '');

      const worklogIdsStr = String($tr.data('worklog-ids') || '');
      const worklogIds = worklogIdsStr ? worklogIdsStr.split(',').map(s=>String(s).trim()).filter(Boolean) : [];

      const pr = getProjectByIdSafe(projectId);
      const tipo = getTipoForProject(pr);
      const isCosto = (tipo === 'Costo');

      const hours = mins / 60;
      const qty = parseFloat(hours.toFixed(2));

      const serviceId = String($tr.find('.tsimp-row-product').val() || '').trim();
      const prod = serviceId ? getProductByIdSafe(serviceId) : null;

      const serviceLabel = prod ? (prod.description || prod.code || 'Consulenza') : 'Consulenza';
      const projectName = pr ? (pr.name || '') : '';
      const hoursText = hours.toFixed(2).replace('.', ',');

      const desc = `${serviceLabel} - ${projectName}${periodLabel ? (' (' + periodLabel + ')') : ''} - ${hoursText}h`;

      const rate = parseFloat($tr.find('.tsimp-row-rate').val()) || 0;
      const subtotal = qty * rate;

      // IVA/Natura:
      // - Forfettario: IVA=0 + Natura (default N2.2 o quella del prodotto)
      // - Ordinario: IVA di default = aliquota azienda (fallback 22) se il prodotto non specifica un'aliquota > 0
      const comp = getData('companyInfo') || {};
      const ivaAzienda = (() => {
        const n = parseFloat(comp.aliquotaIva || comp.aliquotaIVA || 22);
        return String(isNaN(n) ? 22 : n);
      })();

      const ivaProd = (prod && prod.iva != null && String(prod.iva).trim() !== '') ? String(prod.iva).trim() : '';
      const iva = forf ? '0' : (ivaProd && (parseFloat(ivaProd) > 0) ? ivaProd : ivaAzienda);

      const natura = (parseFloat(iva) === 0)
        ? String((prod && prod.esenzioneIva) ? prod.esenzioneIva : 'N2.2')
        : '';

      window.tempInvoiceLines.push({
        productName: desc,
        qty: qty,
        price: rate,
        subtotal: subtotal,
        iva: iva,
        esenzioneIva: natura,
        isLavoro: !isCosto,
        isCosto: isCosto,
        tsImport: true,
        tsImportBatchId: batchId,
        tsGroupKey: String($tr.data('key') || ''),
        tsWorklogIds: worklogIds,
        tsMeta: {
          commessaId,
          projectId,
          periodLabel,
          worklogIds: worklogIds
        }
      });

      // aggiorna stato import (step 2)
      tsState.worklogIds.push(...worklogIds);
      tsState.groups.push({
        key: String($tr.data('key') || ''),
        commessaId,
        projectId,
        periodLabel,
        minutes: mins,
        hours: qty,
        productId: serviceId || '',
        rate: rate,
        amount: subtotal,
        tipo: tipo,
        worklogIds: worklogIds
      });
    });

    if (typeof window.renderLocalInvoiceLines === 'function') window.renderLocalInvoiceLines();
    if (typeof window.updateTotalsDisplay === 'function') window.updateTotalsDisplay();
    updateUI();

    // Step 2: salvo metadati import per collegare i worklog alla fattura al salvataggio
    try {
      tsState.worklogIds = Array.from(new Set(tsState.worklogIds.map(String).filter(Boolean)));
      window.App = window.App || {};
      window.App.invoices = window.App.invoices || {};
      window.App.invoices.timesheetImportState = tsState;
    } catch (e) {}

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('timesheetImportModal'));
    modal.hide();
  }

  function removeImportedLines() {
    if (!window.tempInvoiceLines) return;
    const before = window.tempInvoiceLines.length;
    window.tempInvoiceLines = window.tempInvoiceLines.filter((l) => !(l && l.tsImport === true));

    // Step 2: pulisco metadati import
    try {
      if (window.App && window.App.invoices) window.App.invoices.timesheetImportState = null;
    } catch (e) {}
    const after = window.tempInvoiceLines.length;

    if (typeof window.renderLocalInvoiceLines === 'function') window.renderLocalInvoiceLines();
    if (typeof window.updateTotalsDisplay === 'function') window.updateTotalsDisplay();
    updateUI();

    if (before !== after) {
      alert('Righe importate rimosse.');
    }
  }

  function updateUI() {
    const $btn = $('#invoice-remove-imported-timesheet-btn');
    if (!$btn.length) return;

    const hasImported = (window.tempInvoiceLines || []).some((l) => l && l.tsImport === true);
    $btn.toggleClass('d-none', !hasImported);
  }

  function openModal() {
    const cid = getInvoiceCustomerId();
    if (!cid) {
      // non blocco: ma avviso
      setAlert('Seleziona un <strong>Cliente</strong> nella fattura per filtrare le commesse automaticamente.', 'warning');
    } else {
      setAlert('', 'info');
    }

    // Date default
    const def = defaultDateRangeFromInvoice();
    if (!$('#tsimp-from').val() && def.from) $('#tsimp-from').val(def.from);
    if (!$('#tsimp-to').val() && def.to) $('#tsimp-to').val(def.to);

    populateCommesseFiltered();
    populateProjectsForCommessaInImport(String($('#tsimp-commessa').val() || 'all'));

    // default products
    populateDefaultProductSelect($('#tsimp-default-product'), $('#tsimp-default-product').val() || '', true);

    updatePreview();

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('timesheetImportModal'));
    modal.show();
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    // API per altri moduli
    window.App.invoices.updateTimesheetImportUI = updateUI;
    window.AppModules.invoicesTimesheetImport.updateUI = updateUI;

    // Bottone nel form fattura
    $('#invoice-import-timesheet-btn').on('click', function () {
      openModal();
    });

    $('#invoice-remove-imported-timesheet-btn').on('click', function () {
      if (confirm('Vuoi rimuovere tutte le righe importate dal Timesheet?')) {
        removeImportedLines();
      }
    });

    // Filtri modal
    $('#tsimp-commessa').on('change', function () {
      populateProjectsForCommessaInImport(String($(this).val() || 'all'));
      updatePreview();
    });

    $('#tsimp-project, #tsimp-from, #tsimp-to, #tsimp-only-billable, #tsimp-grouping, #tsimp-default-product, #tsimp-default-rate').on('change keyup', function () {
      updatePreview();
    });

    // Cambio prodotto/rate per riga
    $('#tsimp-preview-tbody').on('change', '.tsimp-row-product', function () {
      // Se cambio servizio, se rate e 0 provo a prendere il prezzo del servizio
      const $tr = $(this).closest('tr');
      const prodId = String($(this).val() || '').trim();
      const prod = prodId ? getProductByIdSafe(prodId) : null;
      const $rate = $tr.find('.tsimp-row-rate');
      const curRate = parseFloat($rate.val()) || 0;
      if (curRate === 0 && prod && prod.salePrice != null && !isNaN(parseFloat(prod.salePrice))) {
        $rate.val(parseFloat(prod.salePrice).toFixed(2));
      }
      recalcRowAmount($tr);
    });

    $('#tsimp-preview-tbody').on('change keyup', '.tsimp-row-rate', function () {
      const $tr = $(this).closest('tr');
      recalcRowAmount($tr);
    });

    $('#tsimp-confirm-btn').on('click', function () {
      importIntoInvoice();
    });

    // Se cambio cliente in fattura, aggiorno UI e (se modale aperta) i filtri
    $('#invoice-customer-select').on('change', function () {
      updateUI();
      // se la modale e' aperta, aggiorno solo la lista commesse
      const modalEl = document.getElementById('timesheetImportModal');
      if (modalEl && modalEl.classList.contains('show')) {
        populateCommesseFiltered();
        populateProjectsForCommessaInImport(String($('#tsimp-commessa').val() || 'all'));
        updatePreview();
      }
    });

    // init
    updateUI();
  }

  window.AppModules.invoicesTimesheetImport.bind = bind;
})();
