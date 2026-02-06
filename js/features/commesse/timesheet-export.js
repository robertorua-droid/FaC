// js/features/commesse/timesheet-export.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.timesheetExport = window.AppModules.timesheetExport || {};

  let _bound = false;

  function cleanText(val) {
    // Remove real newlines and also literal "\\n" sequences.
    return String(val ?? '')
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/\\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatDateIT(dateStr) {
    const s = cleanText(dateStr);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return s;
  }

  function escapeCsvField(val) {
    const s = String(val ?? '');
    if (/[";\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function minutesToHours(mins) {
    const n = (parseInt(mins, 10) || 0) / 60;
    return n.toFixed(2);
  }

  function withinRange(dateStr, from, to) {
    if (!dateStr) return false;
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  }

  function getNamesCache() {
    const commesse = getData('commesse') || [];
    const projects = getData('projects') || [];
    const customers = getData('customers') || [];

    const commessaById = new Map(commesse.map(c => [String(c.id), c]));
    const projectById = new Map(projects.map(p => [String(p.id), p]));
    const customerById = new Map(customers.map(c => [String(c.id), c]));

    return { commessaById, projectById, customerById };
  }

  function buildRowsFiltered() {
    const from = String($('#ts-exp-from').val() || '').trim();
    const to = String($('#ts-exp-to').val() || '').trim();
    const commessaId = String($('#ts-exp-commessa').val() || '').trim();
    const projectId = String($('#ts-exp-project').val() || '').trim();
    const billToId = String($('#ts-exp-billto').val() || '').trim();
    const billable = String($('#ts-exp-billable').val() || 'all');
    const invoiced = String($('#ts-exp-invoiced-filter').val() || 'all');

    const { commessaById, projectById, customerById } = getNamesCache();

    let worklogs = (getData('worklogs') || []).slice();

    worklogs = worklogs.filter(wl => withinRange(String(wl.date || ''), from, to));

    if (commessaId && commessaId !== 'all') {
      worklogs = worklogs.filter(wl => String(wl.commessaId) === commessaId);
    }

    if (projectId && projectId !== 'all') {
      worklogs = worklogs.filter(wl => String(wl.projectId) === projectId);
    }

    if (billable !== 'all') {
      const want = billable === 'billable';
      worklogs = worklogs.filter(wl => (wl.billable !== false) === want);
    }

    if (invoiced !== 'all') {
      const wantInv = invoiced === 'invoiced';
      worklogs = worklogs.filter(wl => (!!wl.invoiceId) === wantInv);
    }

    if (billToId && billToId !== 'all') {
      worklogs = worklogs.filter(wl => {
        const cm = commessaById.get(String(wl.commessaId));
        return cm && String(cm.billToCustomerId || '') === billToId;
      });
    }

    // Enrich
    const enriched = worklogs.map(wl => {
      const cm = commessaById.get(String(wl.commessaId));
      const pr = projectById.get(String(wl.projectId));
      const billTo = cm ? customerById.get(String(cm.billToCustomerId || '')) : null;
      return {
        ...wl,
        commessaName: cm ? (cm.name || '') : '',
        endCustomerName: cm ? (cm.endCustomerName || '') : '',
        projectName: pr ? (pr.name || '') : '',
        billToCustomerName: billTo ? (billTo.name || '') : ''
      };
    });

    // sort by date asc, then commessa, project
    enriched.sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d !== 0) return d;
      const c = String(a.commessaName || '').localeCompare(String(b.commessaName || ''));
      if (c !== 0) return c;
      return String(a.projectName || '').localeCompare(String(b.projectName || ''));
    });

    return enriched;
  }

  function groupRows(rows, mode) {
    if (mode === 'detail') return rows.map(r => ({ key: r.id, rows: [r] }));

    const groups = new Map();

    function add(key, item) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    rows.forEach(r => {
      let key = '';
      if (mode === 'day_project') {
        key = `${r.date}||${r.commessaId}||${r.projectId}`;
      } else if (mode === 'project') {
        key = `${r.commessaId}||${r.projectId}`;
      } else if (mode === 'commessa') {
        key = `${r.commessaId}`;
      } else {
        key = r.id;
      }
      add(key, r);
    });

    return Array.from(groups.entries()).map(([key, list]) => ({ key, rows: list }));
  }

  function buildPivotDayCsv(rows) {
    // Pivot: 1 riga per Giorno+Commessa, con Progetti in colonne (ore)
    const projectNames = Array.from(
      new Set(rows.map(r => String(r.projectName || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const groups = new Map();

    rows.forEach(r => {
      const key = `${r.date || ''}||${r.commessaId || ''}`;
      if (!groups.has(key)) {
        groups.set(key, {
          base: r,
          minutesByProject: new Map(),
          notes: [],
          billableStates: []
        });
      }
      const g = groups.get(key);
      const pn = String(r.projectName || '').trim();
      const mins = parseInt(r.minutes, 10) || 0;
      if (pn) {
        g.minutesByProject.set(pn, (g.minutesByProject.get(pn) || 0) + mins);
      }
      g.billableStates.push(r.billable !== false);
      if (cleanText(r.note || '')) {
        const note = cleanText(r.note || '');
        g.notes.push(pn ? `[${pn}] ${note}` : note);
      }
    });

    const sorted = Array.from(groups.values()).sort((a, b) => {
      const d = String(a.base.date || '').localeCompare(String(b.base.date || ''));
      if (d !== 0) return d;
      return String(a.base.commessaName || '').localeCompare(String(b.base.commessaName || ''));
    });

    const header = ['Date', 'EndCustomer', 'BillToCustomer', 'Commessa', ...projectNames, 'TotalHours', 'Billable', 'Note'];
    const lines = [header.map(escapeCsvField).join(';')];

    sorted.forEach(g => {
      const base = g.base || {};
      const totalMinutes = Array.from(g.minutesByProject.values()).reduce((s, n) => s + (parseInt(n, 10) || 0), 0);

      const allTrue = g.billableStates.every(v => v === true);
      const allFalse = g.billableStates.every(v => v === false);
      const billableOut = allTrue ? 'SI' : (allFalse ? 'NO' : 'MISTO');

      const row = [
        formatDateIT(base.date || ''),
        cleanText(base.endCustomerName || ''),
        cleanText(base.billToCustomerName || ''),
        cleanText(base.commessaName || ''),
        ...projectNames.map(pn => {
          const m = g.minutesByProject.get(pn) || 0;
          return m ? minutesToHours(m) : '';
        }),
        minutesToHours(totalMinutes),
        billableOut,
        g.notes.join(' | ')
      ].map(escapeCsvField).join(';');

      lines.push(row);
    });

    return lines.join('\r\n');
  }

  function buildCsv(groups, mode) {
    // Column order requested: Date | EndCustomer | BillToCustomer | Commessa | Project | Minutes | Hours | Billable
    const header = ['Date', 'EndCustomer', 'BillToCustomer', 'Commessa', 'Project', 'Minutes', 'Hours', 'Billable'];
    const lines = [header.join(';')];

    // Dettaglio: una riga per ogni worklog
    if (mode === 'detail') {
      groups.forEach(g => {
        (g.rows || []).forEach(r => {
          const mins = parseInt(r.minutes, 10) || 0;
          const line = [
            formatDateIT(r.date || ''),
            cleanText(r.endCustomerName || ''),
            cleanText(r.billToCustomerName || ''),
            cleanText(r.commessaName || ''),
            cleanText(r.projectName || ''),
            String(mins),
            minutesToHours(mins),
            (r.billable !== false) ? 'SI' : 'NO'
          ].map(escapeCsvField).join(';');
          lines.push(line);
        });
      });
      return lines.join('\r\n');
    }

    // Raggruppamenti: una riga per gruppo
    groups.forEach(g => {
      const list = g.rows || [];
      if (!list.length) return;

      const totalMinutes = list.reduce((s, r) => s + (parseInt(r.minutes, 10) || 0), 0);
      const base = list[0];
      const dateOut = (mode === 'day_project') ? formatDateIT(base.date || '') : '';

      const allTrue = list.every(r => (r.billable !== false) === true);
      const allFalse = list.every(r => (r.billable !== false) === false);
      const billableOut = allTrue ? 'SI' : (allFalse ? 'NO' : 'MISTO');

      const row = [
        dateOut,
        cleanText(base.endCustomerName || ''),
        cleanText(base.billToCustomerName || ''),
        cleanText(base.commessaName || ''),
        cleanText(base.projectName || ''),
        String(totalMinutes),
        minutesToHours(totalMinutes),
        billableOut
      ].map(escapeCsvField).join(';');

      lines.push(row);
    });

    return lines.join('\r\n');
  }

  function updatePreview(rows) {
    const totalMinutes = rows.reduce((s, r) => s + (parseInt(r.minutes, 10) || 0), 0);
    $('#ts-exp-preview-count').text(rows.length);
    $('#ts-exp-preview-minutes').text(totalMinutes);
    $('#ts-exp-preview-hours').text((totalMinutes / 60).toFixed(2));
  }

  function downloadCsv(csvText, filename) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.download = filename;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    // default date range: mese corrente
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    if (!$('#ts-exp-from').val()) $('#ts-exp-from').val(firstDay);
    if (!$('#ts-exp-to').val()) $('#ts-exp-to').val(lastDay);

    // dipendenza progetto da commessa
    $('#ts-exp-commessa').on('change', function () {
      const commessaId = String($(this).val() || '');
      if (typeof window.populateProjectsForCommessa === 'function') {
        window.populateProjectsForCommessa('#ts-exp-project', commessaId === 'all' ? '' : commessaId, 'all', true);
      }
      if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
    });

    // update preview
    $('#ts-exp-from, #ts-exp-to, #ts-exp-commessa, #ts-exp-project, #ts-exp-billto, #ts-exp-billable, #ts-exp-invoiced-filter, #ts-exp-groupby').on('change', function () {
      if (typeof renderTimesheetExportPage === 'function') renderTimesheetExportPage();
    });

    $('#ts-export-btn').on('click', function () {
      const rows = buildRowsFiltered();
      const mode = String($('#ts-exp-groupby').val() || 'detail');

      let csv = '';
      if (mode === 'day_pivot') {
        csv = buildPivotDayCsv(rows);
      } else {
        const groups = groupRows(rows, mode);
        csv = buildCsv(groups, mode);
      }

      const from = String($('#ts-exp-from').val() || '').replace(/-/g, '');
      const to = String($('#ts-exp-to').val() || '').replace(/-/g, '');
      const filename = `timesheet_${from || 'all'}_${to || 'all'}.csv`;
      downloadCsv(csv, filename);
    });

    // expose for render
    window._timesheetExport_buildRowsFiltered = buildRowsFiltered;
    window._timesheetExport_updatePreview = updatePreview;
  }

  window.AppModules.timesheetExport.bind = bind;
})();
