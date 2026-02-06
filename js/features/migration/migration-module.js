// js/features/migration/migration-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.migration = window.AppModules.migration || {};

  let _bound = false;


  // =====================
  // Uso dati (stima)
  // =====================
  const SPARK_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GiB

  function _estimateBytes(value) {
    try {
      const json = JSON.stringify(value ?? null);
      // Blob calcola in UTF-8
      return new Blob([json]).size;
    } catch (e) {
      try {
        const json = String(value ?? '');
        return (new TextEncoder().encode(json)).length;
      } catch (e2) {
        return 0;
      }
    }
  }

  function _formatBytes(bytes) {
    const b = Number(bytes || 0);
    if (!isFinite(b) || b <= 0) return '0 B';
    const units = ['B', 'KiB', 'MiB', 'GiB'];
    let v = b;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    const decimals = i === 0 ? 0 : (i === 1 ? 1 : 2);
    return v.toFixed(decimals) + ' ' + units[i];
  }

  function renderDataUsagePage() {
    const $container = $('#data-usage-table-container');
    const $bar = $('#data-usage-progress');
    if ($container.length === 0) return;

    const items = [
      { label: 'Azienda (companyInfo)', value: (globalData && globalData.companyInfo) ? globalData.companyInfo : {}, count: 1 },
      { label: 'Clienti', value: (getData('customers') || []) },
      { label: 'Servizi', value: (getData('products') || []) },
      { label: 'Documenti (fatture/NC)', value: (getData('invoices') || []) },
      { label: 'Acquisti', value: (getData('purchases') || []) },
      { label: 'Fornitori', value: (getData('suppliers') || []) },
      { label: 'Note', value: (getData('notes') || []) },
      { label: 'Commesse', value: (getData('commesse') || []) },
      { label: 'Progetti', value: (getData('projects') || []) },
      { label: 'Worklog (timesheet)', value: (getData('worklogs') || []) }
    ];

    let total = 0;
    const rows = items
      .map((it) => {
        const bytes = _estimateBytes(it.value);
        total += bytes;
        const count = (typeof it.count === 'number') ? it.count : (Array.isArray(it.value) ? it.value.length : (it.value ? 1 : 0));
        const pct = SPARK_QUOTA_BYTES ? (bytes / SPARK_QUOTA_BYTES * 100) : 0;
        return { label: it.label, count, bytes, pct };
      })
      .sort((a, b) => b.bytes - a.bytes);

    const tableHtml = `
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead>
            <tr>
              <th>Categoria</th>
              <th class="text-end" style="width:120px">Record</th>
              <th class="text-end" style="width:170px">Stima</th>
              <th class="text-end" style="width:120px">%</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td>${r.label}</td>
                <td class="text-end">${r.count}</td>
                <td class="text-end">${_formatBytes(r.bytes)}</td>
                <td class="text-end">${r.pct.toFixed(2)}%</td>
              </tr>`
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr>
              <th>Totale</th>
              <th class="text-end">—</th>
              <th class="text-end">${_formatBytes(total)}</th>
              <th class="text-end">${(SPARK_QUOTA_BYTES ? (total / SPARK_QUOTA_BYTES * 100) : 0).toFixed(2)}%</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    $container.html(tableHtml);

    const pctTotal = SPARK_QUOTA_BYTES ? (total / SPARK_QUOTA_BYTES * 100) : 0;
    const pctClamped = Math.max(0, Math.min(100, pctTotal));
    if ($bar.length) {
      $bar.css('width', pctClamped.toFixed(2) + '%');
      $bar.attr('aria-valuenow', pctClamped.toFixed(2));
      $bar.text(`${_formatBytes(total)} / 1 GiB (${pctTotal.toFixed(2)}%)`);
    }

    const $updated = $('#data-usage-updated-at');
    if ($updated.length) {
      $updated.text('Aggiornato: ' + new Date().toLocaleString());
    }
  }

  function refreshDeletePurchasesYearSelect() {
    const $sel = $('#delete-purchases-year-select');
    if ($sel.length === 0) return;

    const years = new Set();
    const currentYear = String(new Date().getFullYear());
    years.add(currentYear);

    const purchases = getData('purchases') || [];
    purchases.forEach((p) => {
      const d = p && p.date ? String(p.date) : '';
      if (d.length >= 4) years.add(d.substring(0, 4));
    });

    const sorted = Array.from(years)
      .filter((y) => /^\d{4}$/.test(y))
      .sort((a, b) => b.localeCompare(a));

    const prev = $sel.val() || '';
    $sel.empty().append('<option value="">Seleziona...</option>');
    sorted.forEach((y) => $sel.append(`<option value="${y}">${y}</option>`));

    if (sorted.includes(currentYear)) $sel.val(currentYear);
    else if (sorted.length) $sel.val(sorted[0]);
    else $sel.val(prev);
  }


  function refreshDeleteDocumentsYearSelect() {
    const $sel = $('#delete-year-select');

    // Quando si apre Migrazione, questa funzione viene chiamata dalla navigazione.
    // Qui forziamo anche il refresh della select acquisti (se presente) senza toccare altri moduli.
    if ($sel.length === 0) {
      try { refreshDeletePurchasesYearSelect(); } catch (e) {}
      return;
    }

    const years = new Set();
    const currentYear = String(new Date().getFullYear());
    years.add(currentYear);

    const invs = getData('invoices') || [];
    invs.forEach((inv) => {
      const d = inv && inv.date ? String(inv.date) : '';
      if (d.length >= 4) years.add(d.substring(0, 4));
    });

    const sorted = Array.from(years)
      .filter((y) => /^\d{4}$/.test(y))
      .sort((a, b) => b.localeCompare(a));

    const prev = $sel.val() || '';
    $sel.empty().append('<option value="">Seleziona...</option>');
    sorted.forEach((y) => $sel.append(`<option value="${y}">${y}</option>`));

    if (sorted.includes(currentYear)) $sel.val(currentYear);
    else if (sorted.length) $sel.val(sorted[0]);
    else $sel.val(prev);

    try { refreshDeletePurchasesYearSelect(); } catch (e) {}
  }



  // =====================
  // Reset totale + Ripristino totale
  // =====================

  function _confirmDangerTyped(title, bodyLines) {
    const body = Array.isArray(bodyLines) ? bodyLines.join('\n') : String(bodyLines || '');
    const msg = (title ? (title + "\n\n") : '') + body;
    if (!confirm(msg)) return false;
    const typed = prompt('Per confermare digita ELIMINA e premi OK. (Annulla per uscire)');
    if (typed !== 'ELIMINA') {
      alert('Operazione annullata.');
      return false;
    }
    return true;
  }

  async function _deleteDocsInCollection(userRef, collectionName) {
    const snap = await userRef.collection(collectionName).get();
    const docs = snap.docs || [];
    let deleted = 0;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = db.batch();
      docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
      await batch.commit();
      deleted += Math.min(450, docs.length - i);
    }
    return deleted;
  }

  async function _resetAllUserData() {
    if (!currentUser) throw new Error('Utente non autenticato');
    const userRef = getUserDocRef();

    // 1) settings/* (cancella TUTTI i documenti presenti, anche futuri)
    let deletedSettings = 0;
    try {
      deletedSettings = await _deleteDocsInCollection(userRef, 'settings');
    } catch (e) {
      // se la collection non esiste o non si riesce a leggerla, continuiamo con le altre
      console.warn('Reset: errore cancellazione settings:', e);
    }

    // 2) Collezioni principali
    const collections = ['products', 'customers', 'suppliers', 'purchases', 'invoices', 'notes', 'commesse', 'projects', 'worklogs'];
    const perCol = {};
    for (const col of collections) {
      try {
        perCol[col] = await _deleteDocsInCollection(userRef, col);
      } catch (e) {
        console.warn('Reset: errore cancellazione ' + col + ':', e);
        perCol[col] = 0;
      }
    }

    // Aggiorna cache locale
    globalData.companyInfo = {};
    collections.forEach(c => { globalData[c] = []; });

    return { deletedSettings, perCol };
  }

  function _normalizeBackup(raw) {
    const r = raw || {};
    return {
      userId: r.userId || r.uid || null,
      companyInfo: r.companyInfo || {},
      products: Array.isArray(r.products) ? r.products : [],
      customers: Array.isArray(r.customers) ? r.customers : [],
      invoices: Array.isArray(r.invoices) ? r.invoices : [],
      notes: Array.isArray(r.notes) ? r.notes : [],
      suppliers: Array.isArray(r.suppliers) ? r.suppliers : [],
      purchases: Array.isArray(r.purchases) ? r.purchases : [],
      commesse: Array.isArray(r.commesse) ? r.commesse : [],
      projects: Array.isArray(r.projects) ? r.projects : [],
      worklogs: Array.isArray(r.worklogs) ? r.worklogs : []
    };
  }

  async function _importBackupNormalized(backup) {
    const stripId = (obj) => {
      const data = { ...(obj || {}) };
      delete data.id;
      delete data.__meta;
      delete data._meta;
      return data;
    };

    const buildUpdates = (arr) => {
      const list = Array.isArray(arr) ? arr : [];
      const updates = [];
      for (const it of list) {
        if (!it) continue;
        const id = (it.id != null && String(it.id).trim() !== '') ? String(it.id) : null;
        if (!id) continue;
        updates.push({ id, data: stripId(it) });
      }
      return updates;
    };

    // 1) Company info
    if (backup.companyInfo && typeof backup.companyInfo === 'object') {
      await saveDataToCloud('companyInfo', backup.companyInfo, 'companyInfo');
    }

    // 2) Collections (batch)
    const collections = [
      ['products', backup.products],
      ['customers', backup.customers],
      ['suppliers', backup.suppliers],
      ['purchases', backup.purchases],
      ['commesse', backup.commesse],
      ['projects', backup.projects],
      ['worklogs', backup.worklogs],
      ['invoices', backup.invoices],
      ['notes', backup.notes]
    ];

    for (const [col, arr] of collections) {
      const updates = buildUpdates(arr);
      if (!updates.length) continue;
      for (let i = 0; i < updates.length; i += 450) {
        await batchSaveDataToCloud(col, updates.slice(i, i + 450));
      }
    }
  }

  function bind() {
    if (_bound) return;
    _bound = true;


    // USO DATI (STIMA)
    $('#data-usage-refresh-btn').on('click', function () {
      try { renderDataUsagePage(); } catch (e) {}
    });
    $('#menu-uso-dati').on('click', function () {
      try { setTimeout(renderDataUsagePage, 0); } catch (e) {}
    });

    // Quando entro in Migrazione, popola le select anno
    $('.sidebar .nav-link[data-target="avanzate"]').on('click', function () {
      try { refreshDeleteDocumentsYearSelect(); } catch (e) {}
      try { refreshDeletePurchasesYearSelect(); } catch (e2) {}
    });

    // BACKUP JSON DAL CLOUD (UTENTE CORRENTE)
    $('#export-cloud-json-btn').on('click', async function () {
      try {
        if (!currentUser) {
          alert('Devi prima effettuare il login.');
          return;
        }

        // Mi assicuro di avere i dati aggiornati dal Cloud
        await loadAllDataFromCloud();

        const backup = {
          userId: currentUser.uid,
          companyInfo: globalData.companyInfo || {},
          products: globalData.products || [],
          customers: globalData.customers || [],
          invoices: globalData.invoices || [],
          notes: globalData.notes || [],
          suppliers: globalData.suppliers || [],
          purchases: globalData.purchases || [],
          commesse: globalData.commesse || [],
          projects: globalData.projects || [],
          worklogs: globalData.worklogs || []
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });

        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        a.download = `gestionale-backup-${today}.json`;
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        console.error('Errore export backup JSON:', err);
        alert('Errore durante il backup JSON dal Cloud.');
      }
    });



    // ELIMINAZIONE ACQUISTI PER ANNO (MIGRAZIONE)
    $('#delete-purchases-year-btn').on('click', async function () {
      try {
        if (!currentUser) {
          alert('Devi prima effettuare il login.');
          return;
        }

        const year = $('#delete-purchases-year-select').val();
        if (!year || !/^\d{4}$/.test(year)) {
          alert('Seleziona un anno valido.');
          return;
        }

        const msg1 = `Sei sicuro di voler eliminare TUTTI i documenti di acquisto dell'anno ${year}?`;
        if (!confirm(msg1)) return;

        const msg2 = 'OPERAZIONE IRREVERSIBILE. Consigliato: fai prima un Backup JSON.\n\nConfermi eliminazione?';
        if (!confirm(msg2)) return;

        const userRef = getUserDocRef();
        const snap = await userRef.collection('purchases').get();

        const toDelete = snap.docs.filter((doc) => {
          const data = doc.data() || {};
          const d = data.date ? String(data.date) : '';
          return d.substring(0, 4) === year;
        });

        if (toDelete.length === 0) {
          alert(`Nessun acquisto trovato per l'anno ${year}.`);
          return;
        }

        // Firestore batch max 500
        let deleted = 0;
        for (let i = 0; i < toDelete.length; i += 450) {
          const batch = db.batch();
          const chunk = toDelete.slice(i, i + 450);
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          deleted += chunk.length;
        }

        // aggiorna cache locale
        globalData.purchases = (getData('purchases') || []).filter((p) => {
          const d = p && p.date ? String(p.date) : '';
          return d.substring(0, 4) !== year;
        });

        // refresh UI collegati agli acquisti
        if (typeof refreshPurchaseYearFilter === 'function') refreshPurchaseYearFilter();
        if (typeof renderPurchasesTable === 'function') renderPurchasesTable();
        if (typeof refreshIvaRegistersYearFilter === 'function') refreshIvaRegistersYearFilter();
        if (typeof renderRegistriIVAPage === 'function') {
          try { renderRegistriIVAPage(); } catch (e) {}
        }
        if (typeof renderScadenziarioPage === 'function') {
          try { renderScadenziarioPage(); } catch (e2) {}
        }

        // aggiorna combo anno in Migrazione
        try { refreshDeletePurchasesYearSelect(); } catch (e3) {}

        alert(`Eliminati ${deleted} acquisti dell'anno ${year}.`);
      } catch (err) {
        console.error('Errore eliminazione acquisti per anno:', err);
        alert("Errore durante l'eliminazione degli acquisti. Controlla la console.");
      }
    });

    // ELIMINAZIONE DOCUMENTI PER ANNO (MIGRAZIONE)
    $('#delete-documents-year-btn').on('click', async function () {
      try {
        if (!currentUser) {
          alert('Devi prima effettuare il login.');
          return;
        }

        const year = $('#delete-year-select').val();
        if (!year || !/^\d{4}$/.test(year)) {
          alert('Seleziona un anno valido.');
          return;
        }

        const msg1 = `Sei sicuro di voler eliminare TUTTI i documenti (fatture e note di credito) dell'anno ${year}?`;
        if (!confirm(msg1)) return;

        const msg2 = 'OPERAZIONE IRREVERSIBILE. Consigliato: fai prima un Backup JSON.\n\nConfermi eliminazione?';
        if (!confirm(msg2)) return;

        const userRef = getUserDocRef();
        const snap = await userRef.collection('invoices').get();

        const toDelete = snap.docs.filter((doc) => {
          const data = doc.data() || {};
          const d = data.date ? String(data.date) : '';
          return d.substring(0, 4) === year;
        });

        if (toDelete.length === 0) {
          alert(`Nessun documento trovato per l'anno ${year}.`);
          return;
        }

        // Firestore batch max 500
        let deleted = 0;
        for (let i = 0; i < toDelete.length; i += 450) {
          const batch = db.batch();
          const chunk = toDelete.slice(i, i + 450);
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          deleted += chunk.length;
        }

        // aggiorna cache locale
        globalData.invoices = (getData('invoices') || []).filter((inv) => {
          const d = inv && inv.date ? String(inv.date) : '';
          return d.substring(0, 4) !== year;
        });

        // refresh UI collegati ai documenti
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof refreshInvoiceYearFilter === 'function') refreshInvoiceYearFilter();
        if (typeof refreshStatsYearFilter === 'function') refreshStatsYearFilter();
        refreshDeleteDocumentsYearSelect();

        alert(`Eliminati ${deleted} documenti dell'anno ${year}.`);
      } catch (err) {
        console.error('Errore eliminazione documenti per anno:', err);
        alert("Errore durante l'eliminazione dei documenti. Controlla la console.");
      }
    });


    // IMPORT BACKUP JSON (progetto corrente)
    // Accetta il file creato con "Scarica Backup JSON" e salva i dati nel Cloud dell'utente corrente.
    // Nota: per sicurezza non elimina dati presenti nel Cloud ma non inclusi nel backup; sovrascrive/aggiorna solo gli ID presenti nel file.
    $('#import-file-input').on('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (ev) {
        try {
          const raw = JSON.parse(ev.target.result || '{}');
          if (!currentUser) {
            alert('Devi essere loggato per importare i dati.');
            return;
          }

          const backup = _normalizeBackup(raw);

          let warn = 'Importa Backup JSON:\n\n' +
            '- I dati verranno salvati nel Cloud dell\'utente corrente.\n' +
            '- Record con lo stesso ID verranno aggiornati.\n' +
            '- Non verranno eliminati record già presenti ma non nel backup.\n\n' +
            'Vuoi continuare?';

          if (backup.userId && String(backup.userId) !== String(currentUser.uid)) {
            warn = 'ATTENZIONE: questo backup risulta creato per un altro utente.\n\n' +
              'Backup userId: ' + backup.userId + '\n' +
              'Utente corrente: ' + currentUser.uid + '\n\n' +
              warn;
          }

          if (!confirm(warn)) return;

          await _importBackupNormalized(backup);

          await loadAllDataFromCloud();
          renderAll();
          alert('Importazione Backup completata!');
        } catch (err) {
          console.error('Errore import backup JSON:', err);
          alert("Errore durante l'importazione del backup JSON: " + (err && err.message ? err.message : err));
        } finally {
          // reset input per poter ricaricare lo stesso file
          try { $('#import-file-input').val(''); } catch (e) {}
        }
      };

      reader.readAsText(file);
    });

    // RIPRISTINO TOTALE (RESET + IMPORT)
    // Cancella TUTTI i dati dell'utente corrente (incluse eventuali doc future in settings) e poi importa il backup.
    $('#restore-file-input').on('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (ev) {
        try {
          const raw = JSON.parse(ev.target.result || '{}');
          if (!currentUser) {
            alert('Devi essere loggato per ripristinare i dati.');
            return;
          }

          const backup = _normalizeBackup(raw);

          const lines = [
            'Questa operazione cancella TUTTI i dati nel Cloud dell\'utente corrente (incluse eventuali impostazioni future in settings) e poi importa il backup.',
            'È IRREVERSIBILE (consigliato: fai prima un Backup JSON).',
            '',
            'Utente corrente: ' + currentUser.uid
          ];

          if (backup.userId && String(backup.userId) !== String(currentUser.uid)) {
            lines.push('');
            lines.push('ATTENZIONE: backup creato per un altro utente.');
            lines.push('Backup userId: ' + backup.userId);
          }

          if (!_confirmDangerTyped('Ripristino totale da Backup JSON', lines)) return;

          // Reset totale
          await _resetAllUserData();

          // Import
          await _importBackupNormalized(backup);

          await loadAllDataFromCloud();
          renderAll();
          alert('Ripristino totale completato!');
        } catch (err) {
          console.error('Errore ripristino totale:', err);
          alert('Errore durante il ripristino totale: ' + (err && err.message ? err.message : err));
        } finally {
          try { $('#restore-file-input').val(''); } catch (e) {}
        }
      };

      reader.readAsText(file);
    });

    // RESET TOTALE DATI (RESET CLASSE)
    $('#reset-all-data-btn').on('click', async function () {
      try {
        if (!currentUser) {
          alert('Devi prima effettuare il login.');
          return;
        }

        const ok = _confirmDangerTyped(
          'Reset totale dati (Reset classe)',
          [
            'Questa operazione elimina dal Cloud TUTTI i dati dell\'utente corrente:',
            '- anagrafiche (clienti/fornitori/servizi)',
            '- documenti (fatture/NC) e acquisti',
            '- commesse, progetti, worklog/timesheet, note',
            '- impostazioni in settings (incluse eventuali doc future)',
            '',
            'Operazione IRREVERSIBILE.'
          ]
        );
        if (!ok) return;

        await _resetAllUserData();
        await loadAllDataFromCloud();
        renderAll();
        alert('Reset totale completato.');
      } catch (err) {
        console.error('Errore reset totale:', err);
        alert('Errore durante il reset totale: ' + (err && err.message ? err.message : err));
      }
    });

    // Popola la select quando si entra in Migrazione (se esiste)
    // (non impatta altre sezioni)
    try {
      refreshDeleteDocumentsYearSelect();
    } catch (e2) {}

    // Esposizione globale (usata da navigazione)
    window.refreshDeleteDocumentsYearSelect = refreshDeleteDocumentsYearSelect;
    window.refreshDeletePurchasesYearSelect = refreshDeletePurchasesYearSelect;
    window.renderDataUsagePage = renderDataUsagePage;
  }

  window.AppModules.migration.bind = bind;
  window.AppModules.migration.refreshDeleteDocumentsYearSelect = refreshDeleteDocumentsYearSelect;
  window.AppModules.migration.refreshDeletePurchasesYearSelect = refreshDeletePurchasesYearSelect;
  window.AppModules.migration.renderDataUsagePage = renderDataUsagePage;
})();
