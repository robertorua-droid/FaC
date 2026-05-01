// purchase-xml-import-module.js
// Import XML FatturaPA (fattura fornitore) nel form "Nuovo Acquisto".
// Modulo separato per non impattare la logica core degli acquisti.
// Dipendenze: jQuery, utils.js (getData/getNextId/sanitizeTextForAgenzia), firebase-cloud.js (saveDataToCloud), ui-render.js (populateDropdowns)

(function () {
  const NS = '.purchaseXmlImport';
  let _bound = false;
  // Import "a due fasi":
  // 1) leggo e parsifico il file, mostro un riepilogo in una modale
  // 2) solo su conferma applico i dati al form (e, se serve, creo il fornitore)
  let _pending = null; // { file, parsed, supplierId }
  let _pendingMulti = null; // { items: [{ file, parsed, supplierId, error, recipientMismatch }] }

  function ensureConfirmModal() {
    if ($('#purchase-xml-confirm-modal').length) return;
    const modalHtml = `
<div class="modal fade" id="purchase-xml-confirm-modal" tabindex="-1" aria-labelledby="purchaseXmlConfirmTitle" aria-hidden="true">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="purchaseXmlConfirmTitle">Conferma import XML acquisto</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div id="purchase-xml-confirm-summary"></div>
        <div class="small text-muted mt-2">Nota: questa conferma applica i dati al modulo di inserimento. Il salvataggio su Cloud avviene solo quando premi "Salva Acquisto".</div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="purchase-xml-confirm-cancel" data-bs-dismiss="modal">Annulla</button>
        <button type="button" class="btn btn-outline-primary" id="purchase-xml-confirm-apply">Applica al modulo</button>
        <button type="button" class="btn btn-primary" id="purchase-xml-confirm-save">Importa e salva</button>
      </div>
    </div>
  </div>
</div>`;
    $('body').append(modalHtml);
  }

  function _getModalInstance() {
    const el = document.getElementById('purchase-xml-confirm-modal');
    if (!el) return null;
    // Bootstrap 5: prefer native API
    if (window.bootstrap && typeof window.bootstrap.Modal === 'function') {
      try {
        return window.bootstrap.Modal.getOrCreateInstance(el);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function showConfirmModal() {
    const inst = _getModalInstance();
    if (inst) {
      inst.show();
      return;
    }
    // fallback (in caso di bridge jQuery)
    try { $('#purchase-xml-confirm-modal').modal('show'); } catch (e) { /* no-op */ }
  }

  function hideConfirmModal() {
    const inst = _getModalInstance();
    if (inst) {
      inst.hide();
      return;
    }
    try { $('#purchase-xml-confirm-modal').modal('hide'); } catch (e) { /* no-op */ }
  }

function setConfirmModalMode(mode, count) {
  // mode: 'single' | 'multi'
  const isMulti = mode === 'multi';
  $('#purchase-xml-confirm-apply').toggle(!isMulti);
  const label = isMulti ? ('Importa e salva (' + (count || 0) + ')') : 'Importa e salva';
  $('#purchase-xml-confirm-save').text(label).show();
}

function setupRecipientConfirmGate() {
  const $chk = $('#purchase-xml-recipient-confirm');
  const $btnApply = $('#purchase-xml-confirm-apply');
  const $btnSave = $('#purchase-xml-confirm-save');

  if (!$chk.length) {
    $btnApply.prop('disabled', false);
    $btnSave.prop('disabled', false);
    return;
  }

  function sync() {
    const ok = !!$chk.prop('checked');
    $btnApply.prop('disabled', !ok);
    $btnSave.prop('disabled', !ok);
  }

  $chk.off('change' + NS).on('change' + NS, sync);
  sync();
}


  function fmtMoney(v) {
    const n = (v != null && v !== '') ? Number(v) : NaN;
    if (isNaN(n)) return '';
    return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  

function _normalizeUpper(x) { return String(x || '').trim().toUpperCase(); }

function getCompanyRecipientInfo() {
  const company = (window.AppStore && typeof window.AppStore.get === 'function')
    ? (window.AppStore.get('companyInfo') || {})
    : ((typeof getData === 'function') ? (getData('companyInfo') || {}) : {});
  const vatDigits = normalizeVat(company.piva || '');
  const cf = _normalizeUpper(company.codiceFiscale || '');
  const label = safeText(company.name || 'Azienda') +
    ((company.piva || company.codiceFiscale) ? (' (P.IVA ' + safeText(company.piva || '-') + (company.codiceFiscale ? (' / CF ' + safeText(company.codiceFiscale)) : '') + ')') : '');
  return { company, vatDigits, cf, label };
}

function getBuyerRecipientInfo(parsed) {
  const buyer = parsed && parsed.buyer ? parsed.buyer : null;
  if (!buyer) return { buyer: null, vatDigits: '', cf: '', label: '' };
  const vatDigits = normalizeVat(buyer.pivaFull || buyer.pivaDigits || '');
  const cf = _normalizeUpper(buyer.codiceFiscale || '');
  const label = safeText(buyer.name || 'Cessionario') +
    ((buyer.pivaFull || buyer.codiceFiscale) ? (' (P.IVA ' + safeText(buyer.pivaFull || '-') + (buyer.codiceFiscale ? (' / CF ' + safeText(buyer.codiceFiscale)) : '') + ')') : '');
  return { buyer, vatDigits, cf, label };
}

function checkRecipientMismatch(parsed) {
  const c = getCompanyRecipientInfo();
  const b = getBuyerRecipientInfo(parsed);

  const hasCompany = !!(c.vatDigits || c.cf);
  const hasBuyer = !!(b.vatDigits || b.cf);

  let mismatch = false;
  if (hasCompany && hasBuyer) {
    if (c.vatDigits && b.vatDigits && c.vatDigits !== b.vatDigits) mismatch = true;
    if (c.cf && b.cf && c.cf !== b.cf) mismatch = true;
    // se uno dei due non ha IVA ma ha CF, prova il confronto sul CF
    if (!mismatch && !c.vatDigits && c.cf && b.cf && c.cf !== b.cf) mismatch = true;
  }
  return {
    mismatch,
    companyLabel: c.label,
    buyerLabel: b.label,
    companyVatDigits: c.vatDigits,
    buyerVatDigits: b.vatDigits
  };
}
function buildConfirmHtml(file, parsed, supplierId) {
    const sup = parsed && parsed.supplier ? parsed.supplier : {};
    const doc = parsed && parsed.doc ? parsed.doc : {};
    const lines = Array.isArray(parsed && parsed.lines) ? parsed.lines : [];

    const warnings = [];
    if (!supplierId) warnings.push('Fornitore non presente in anagrafica: ti verrà chiesto se crearlo automaticamente.');
    if (!doc.dueDate && (doc.giorniTermini == null || isNaN(doc.giorniTermini))) warnings.push('Scadenza/termini pagamento non trovati: verifica la data scadenza.');

    // Coerenza imponibile: confronto la somma delle righe che importeremo con l'imponibile del riepilogo XML.
    const hasImponibileXml = (doc.imponibileFromXmlNum != null && !isNaN(doc.imponibileFromXmlNum));
    if (hasImponibileXml && doc.linesTotal != null) {
      const deltaImp = Number(doc.imponibileFromXmlNum) - Number(doc.linesTotal);
      if (Math.abs(deltaImp) > 0.05) {
        warnings.push(`Imponibile (XML) diverso dalla somma righe importate: scarto € ${fmtMoney(deltaImp)}. Verifica righe/arrotondamenti/sconti.`);
      }
    }

    // Coerenza totali: confronto ImportoTotaleDocumento con (Imponibile + IVA) + eventuali bollo/arrotondamento.
    // Nota: la Ritenuta NON va sottratta dal Totale Documento (incide sul netto a pagare).
    const hasTotXml = (doc.totalFromXmlNum != null && !isNaN(doc.totalFromXmlNum));
    const hasExpected = (doc.expectedTotalNum != null && !isNaN(doc.expectedTotalNum));
    if (hasTotXml && hasExpected) {
      const delta = Number(doc.totalFromXmlNum) - Number(doc.expectedTotalNum);
      if (Math.abs(delta) > 0.05) {
        warnings.push(
          'Totale documento (XML) diverso da (righe + IVA' +
          (doc.bolloNum ? ' + bollo' : '') +
          (doc.arrotondamentoNum ? ' + arrotondamento' : '') +
          `): scarto € ${fmtMoney(delta)}. Verifica cassa/bollo/arrotondamenti.`
        );
      }
    }

    const warnHtml = warnings.length
      ? `<div class="alert alert-warning py-2"><ul class="mb-0">${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>`
      : `<div class="alert alert-success py-2 mb-2">Nessuna anomalia rilevata.</div>`;

    const topLines = lines.slice(0, 6);
    const linesPreview = topLines.map(l => {
      const tot = (Number(l.qty || 0) * Number(l.price || 0));
      return `<tr>
        <td>${escapeHtml(l.description || '')}</td>
        <td class="text-right">${escapeHtml(l.qty)}</td>
        <td class="text-right">${fmtMoney(l.price)}</td>
        <td class="text-right">${escapeHtml(l.iva)}</td>
        <td class="text-right">${fmtMoney(tot)}</td>
      </tr>`;
    }).join('');
    const more = lines.length > topLines.length ? `<div class="small text-muted">… +${lines.length - topLines.length} righe</div>` : '';

    return `
${warnHtml}

<div class="mb-2"><strong>File:</strong> ${escapeHtml(file && file.name ? file.name : '')}</div>

<div class="row">
  <div class="col-md-6">
    <div class="card mb-2"><div class="card-body py-2">
      <div class="font-weight-bold mb-1">Fornitore</div>
      <div>${escapeHtml(sup.name || '')}</div>
      ${sup.pivaFull ? `<div class="small text-muted">P.IVA: ${escapeHtml(sup.pivaFull)}</div>` : ''}
      ${sup.codiceFiscale ? `<div class="small text-muted">CF: ${escapeHtml(sup.codiceFiscale)}</div>` : ''}
      <div class="small ${supplierId ? 'text-success' : 'text-warning'} mt-1">${supplierId ? 'Presente in anagrafica' : 'Non presente in anagrafica'}</div>
    </div></div>
  </div>
  <div class="col-md-6">
    <div class="card mb-2"><div class="card-body py-2">
      <div class="font-weight-bold mb-1">Documento</div>
      <div><span class="text-muted">N°</span> ${escapeHtml(doc.number || '')} <span class="text-muted ml-2">Data</span> ${escapeHtml(doc.date || '')}</div>
      ${doc.dueDate ? `<div class="small text-muted">Scadenza: ${escapeHtml(doc.dueDate)}</div>` : ''}
      ${hasTotXml ? `<div class="small text-muted">Totale (XML): € ${fmtMoney(doc.totalFromXmlNum)}</div>` : (doc.totalFromXml ? `<div class="small text-muted">Totale (XML): € ${fmtMoney(doc.totalFromXml)}</div>` : '')}
      ${(doc.linesTotal != null) ? `<div class="small text-muted">Somma righe importate (imponibile): € ${fmtMoney(doc.linesTotal)}</div>` : ''}
      ${(doc.imponibileFromXmlNum != null && !isNaN(doc.imponibileFromXmlNum)) ? `<div class="small text-muted">Imponibile (da XML): € ${fmtMoney(doc.imponibileFromXmlNum)}</div>` : ''}
      ${(doc.ivaFromXmlNum != null && !isNaN(doc.ivaFromXmlNum)) ? `<div class="small text-muted">IVA (da XML): € ${fmtMoney(doc.ivaFromXmlNum)}</div>` : ''}
      ${(doc.expectedTotalNum != null && !isNaN(doc.expectedTotalNum) && hasTotXml)
        ? `<div class="small ${Math.abs(doc.totalFromXmlNum - doc.expectedTotalNum) > 0.05 ? 'text-warning' : 'text-success'}">
            Totale atteso (righe + IVA${doc.bolloNum ? ' + bollo' : ''}${doc.arrotondamentoNum ? ' + arrotond.' : ''}): € ${fmtMoney(doc.expectedTotalNum)}
          </div>`
        : ''}
      ${(doc.ritenutaTotalNum != null && !isNaN(doc.ritenutaTotalNum) && doc.ritenutaTotalNum > 0 && hasTotXml)
        ? `<div class="small text-muted">Ritenuta: € ${fmtMoney(doc.ritenutaTotalNum)} — Netto atteso: € ${fmtMoney(doc.expectedNetNum)}</div>`
        : ''}
    </div></div>
  
<div class="row">
  <div class="col-md-6">
    <div class="card mb-2"><div class="card-body py-2">
      <div class="font-weight-bold mb-1">Pagamento (da XML)</div>
      ${(() => {
        const pay = parsed && parsed.payment ? parsed.payment : {};
        const p = pay && pay.first ? pay.first : null;
        if (!p) return `<div class="text-muted small">Nessun dettaglio pagamento trovato.</div>`;
        const parts = [];
        if (p.modalita) parts.push(`<div><span class="text-muted">Modalità:</span> ${escapeHtml(p.modalita)}</div>`);
        if (doc.dueDate) parts.push(`<div><span class="text-muted">Scadenza:</span> ${escapeHtml(doc.dueDate)}</div>`);
        if (p.importo) parts.push(`<div><span class="text-muted">Importo:</span> € ${fmtMoney(p.importo)}</div>`);
        if (p.istituto) parts.push(`<div><span class="text-muted">Istituto:</span> ${escapeHtml(p.istituto)}</div>`);
        if (p.iban) parts.push(`<div><span class="text-muted">IBAN:</span> ${escapeHtml(p.iban)}</div>`);
        if (p.bic) parts.push(`<div><span class="text-muted">BIC:</span> ${escapeHtml(p.bic)}</div>`);
        if (pay.count && pay.count > 1) parts.push(`<div class="small text-muted mt-1">Rate trovate: ${pay.count} (mostrata la prima)</div>`);
        return parts.join('');
      })()}
    </div></div>
  </div>
  <div class="col-md-6">
    <div class="card mb-2"><div class="card-body py-2">
      <div class="font-weight-bold mb-1">Anomalie / elementi da verificare</div>
      ${(() => {
        const an = parsed && parsed.anomalies ? parsed.anomalies : {};
        const items = [];
        if (an.ritenute && an.ritenute.length) {
          items.push(`<li><strong>Ritenuta:</strong> ${an.ritenute.map(x => escapeHtml(x)).join(' | ')}</li>`);
        }
        if (an.cassa && an.cassa.length) {
          const s = an.cassa.map(c => {
            const label = [c.tipo ? ('Tipo ' + c.tipo) : '', c.alCassa ? ('Al ' + c.alCassa + '%') : ''].filter(Boolean).join(' ');
            const iva = (c.iva != null && !isNaN(c.iva)) ? (String(Math.round(c.iva)) + '%') : '';
            return `${escapeHtml(label || 'Cassa')} — € ${fmtMoney(c.importo)}${iva ? (' (IVA ' + escapeHtml(iva) + ')') : ''}`;
          }).join(' | ');
          items.push(`<li><strong>Cassa previdenziale:</strong> ${s}</li>`);
        }
        if (an.bollo && an.bollo.importo) {
          items.push(`<li><strong>Bollo:</strong> € ${fmtMoney(an.bollo.importo)}${an.bollo.virtuale ? (' (Virtuale ' + escapeHtml(an.bollo.virtuale) + ')') : ''}</li>`);
        }
        if (an.arrotondamento) {
          items.push(`<li><strong>Arrotondamento:</strong> ${escapeHtml(an.arrotondamento)}</li>`);
        }
        if (!items.length) return `<div class="text-muted small">Nessuna anomalia rilevata.</div>`;
        return `<ul class="mb-0 small">${items.join('')}</ul>`;
      })()}
    </div></div>
  </div>
</div>

</div>
</div>

<div class="card"><div class="card-body py-2">
  <div class="font-weight-bold mb-2">Righe importate (anteprima)</div>
  <div class="table-responsive">
    <table class="table table-sm mb-1">
      <thead><tr>
        <th>Descrizione</th>
        <th class="text-right">Q.tà</th>
        <th class="text-right">Prezzo</th>
        <th class="text-right">IVA%</th>
        <th class="text-right">Tot.</th>
      </tr></thead>
      <tbody>${linesPreview}</tbody>
    </table>
  </div>
  ${more}
</div></div>`;
  }

  function normalizeVat(raw) {
    if (!raw) return '';
    // tiene solo cifre (IT123 -> 123) per confronto robusto
    return String(raw).toUpperCase().replace(/[^0-9]/g, '');
  }

  function normalizeCF(raw) {
    if (!raw) return '';
    return String(raw).trim().toUpperCase().replace(/\s+/g, '');
  }

  function safeText(v) {
    if (typeof window.sanitizeTextForAgenzia === 'function') return window.sanitizeTextForAgenzia(String(v || ''));
    return String(v || '');
  }

  function setStatus(msg, isError) {
    const $el = $('#purchase-import-xml-status');
    if (!$el.length) return;
    $el.text(msg || '');
    $el.toggleClass('text-danger', !!isError);
    $el.toggleClass('text-muted', !isError);
  }

  function getFirst(el, tag) {
    if (!el) return null;
    const nodes = el.getElementsByTagName(tag);
    return nodes && nodes.length ? nodes[0] : null;
  }

  function textOf(el, tag) {
    const n = getFirst(el, tag);
    return n && n.textContent != null ? String(n.textContent).trim() : '';
  }

  function parseXmlFatturaPA(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const perr = xml.getElementsByTagName('parsererror');
    if (perr && perr.length) {
      throw new Error('XML non valido o non ben formato.');
    }

    const header = getFirst(xml, 'FatturaElettronicaHeader');
    const body = getFirst(xml, 'FatturaElettronicaBody');
    if (!header || !body) throw new Error('XML non riconosciuto come FatturaPA (Header/Body mancanti).');

    // ===== Fornitore (CedentePrestatore)
    const cedente = getFirst(header, 'CedentePrestatore');
    const datiAnag = getFirst(cedente, 'DatiAnagrafici');
    const anag = getFirst(datiAnag, 'Anagrafica');

    const idIva = getFirst(datiAnag, 'IdFiscaleIVA');
    const idPaese = textOf(idIva, 'IdPaese') || 'IT';
    const idCodice = textOf(idIva, 'IdCodice');

    const cf = textOf(datiAnag, 'CodiceFiscale');

    const denominazione = textOf(anag, 'Denominazione');
    const nome = textOf(anag, 'Nome');
    const cognome = textOf(anag, 'Cognome');
    const supplierName = safeText(denominazione || (nome || cognome ? (nome + ' ' + cognome).trim() : 'Fornitore'));

    const sede = getFirst(cedente, 'Sede');
    const indirizzo = safeText(textOf(sede, 'Indirizzo'));
    const civico = safeText(textOf(sede, 'NumeroCivico'));
    const cap = safeText(textOf(sede, 'CAP'));
    const comune = safeText(textOf(sede, 'Comune'));
    const provincia = safeText(textOf(sede, 'Provincia'));
    const nazione = safeText(textOf(sede, 'Nazione') || idPaese || 'IT');

    const supplier = {
      name: supplierName,
      pivaFull: (idPaese && idCodice) ? (String(idPaese).toUpperCase() + String(idCodice)) : '',
      pivaDigits: normalizeVat((idPaese && idCodice) ? (String(idPaese).toUpperCase() + String(idCodice)) : ''),
      codiceFiscale: safeText(cf),
      indirizzo: (indirizzo + (civico ? (' ' + civico) : '')).trim(),
      cap,
      comune,
      provincia,
      nazione
    };


// ===== Acquirente (CessionarioCommittente) - per check destinatario (fatture di acquisto)
const cessionario = getFirst(header, 'CessionarioCommittente');
let buyer = null;
try {
  if (cessionario) {
    const bDatiAnag = getFirst(cessionario, 'DatiAnagrafici');
    const bAnag = getFirst(bDatiAnag, 'Anagrafica');
    const bIdIva = getFirst(bDatiAnag, 'IdFiscaleIVA');
    const bIdPaese = textOf(bIdIva, 'IdPaese') || 'IT';
    const bIdCodice = textOf(bIdIva, 'IdCodice');
    const bCf = textOf(bDatiAnag, 'CodiceFiscale');

    const bDen = textOf(bAnag, 'Denominazione');
    const bNome = textOf(bAnag, 'Nome');
    const bCognome = textOf(bAnag, 'Cognome');
    const buyerName = safeText(bDen || (bNome || bCognome ? (bNome + ' ' + bCognome).trim() : 'Cessionario'));

    buyer = {
      name: buyerName,
      pivaFull: (bIdPaese && bIdCodice) ? (String(bIdPaese).toUpperCase() + String(bIdCodice)) : '',
      pivaDigits: normalizeVat((bIdPaese && bIdCodice) ? (String(bIdPaese).toUpperCase() + String(bIdCodice)) : ''),
      codiceFiscale: safeText(bCf || ''),
      idPaese: safeText(bIdPaese || 'IT')
    };
  }
} catch (e) {
  buyer = null;
}

const datiTrasmissione = getFirst(header, 'DatiTrasmissione');
const codiceDestinatario = safeText(textOf(datiTrasmissione, 'CodiceDestinatario') || '');

    // ===== Dati documento
    const datiGenerali = getFirst(body, 'DatiGenerali');
    const dgd = getFirst(datiGenerali, 'DatiGeneraliDocumento');

    const docDate = textOf(dgd, 'Data');
    const docNumber = safeText(textOf(dgd, 'Numero'));
    const totaleDoc = textOf(dgd, 'ImportoTotaleDocumento');

    // ===== Pagamento (rilevo tutti i DettaglioPagamento; per il pre-fill uso il primo)
    const payments = [];
    const datiPagamentoNodes = body.getElementsByTagName('DatiPagamento');
    for (let i = 0; i < (datiPagamentoNodes ? datiPagamentoNodes.length : 0); i++) {
      const dpBlock = datiPagamentoNodes[i];
      const detNodes = dpBlock ? dpBlock.getElementsByTagName('DettaglioPagamento') : [];
      for (let j = 0; j < (detNodes ? detNodes.length : 0); j++) {
        const det = detNodes[j];
        const p = {
          modalita: safeText(textOf(det, 'ModalitaPagamento')),
          refDate: textOf(det, 'DataRiferimentoTerminiPagamento') || '',
          giorniTermini: textOf(det, 'GiorniTerminiPagamento') || '',
          dueDate: textOf(det, 'DataScadenzaPagamento') || '',
          importo: textOf(det, 'ImportoPagamento') || '',
          beneficiario: safeText(textOf(det, 'Beneficiario')),
          istituto: safeText(textOf(det, 'IstitutoFinanziario')),
          iban: safeText(textOf(det, 'IBAN')),
          bic: safeText(textOf(det, 'BIC'))
        };
        if (Object.values(p).some(v => String(v || '').trim() !== '')) payments.push(p);
      }
    }

    const firstPay = payments.length ? payments[0] : null;
    const refDate = firstPay ? firstPay.refDate : '';
    const giorniTermini = firstPay ? firstPay.giorniTermini : '';
    const dueDate = firstPay ? firstPay.dueDate : '';
    const importoPagamento = firstPay ? firstPay.importo : '';
    const iban = firstPay ? firstPay.iban : '';
    const istituto = firstPay ? firstPay.istituto : '';

    // ===== Righe
    const lines = [];
    const beniServizi = getFirst(body, 'DatiBeniServizi');
    const dettaglioLineeNodes = beniServizi ? beniServizi.getElementsByTagName('DettaglioLinee') : [];

    for (let i = 0; i < (dettaglioLineeNodes ? dettaglioLineeNodes.length : 0); i++) {
      const l = dettaglioLineeNodes[i];
      const descr = safeText(textOf(l, 'Descrizione'));
      const qRaw = textOf(l, 'Quantita');
      const qty = (qRaw !== '' ? parseFloat(qRaw) : 1);
      const puRaw = textOf(l, 'PrezzoUnitario');
      const ptRaw = textOf(l, 'PrezzoTotale');
      let price = puRaw !== '' ? parseFloat(puRaw) : NaN;
      if (isNaN(price)) {
        const pt = ptRaw !== '' ? parseFloat(ptRaw) : 0;
        const q = (!isNaN(qty) && qty !== 0) ? qty : 1;
        price = pt / q;
      }
      const ivaRaw = textOf(l, 'AliquotaIVA');
      const iva = ivaRaw !== '' ? parseFloat(ivaRaw) : 0;
      const natura = safeText(textOf(l, 'Natura'));

      if (!descr) continue;
      lines.push({
        description: descr,
        qty: (!isNaN(qty) && qty > 0) ? qty : 1,
        price: (!isNaN(price)) ? price : 0,
        iva: (!isNaN(iva)) ? iva : 0,
        natura: (String(iva) === '0' ? (natura || 'N2.2') : '')
      });
    }

    // ===== Riepilogo IVA (per controllo coerenza totali)
    // In FatturaPA il totale documento è dato da: somma (ImponibileImporto + Imposta) dei DatiRiepilogo
    // + eventuali ImportoBollo + Arrotondamento. La Ritenuta NON va sottratta dal totale documento.
    const riepilogoNodes = beniServizi ? beniServizi.getElementsByTagName('DatiRiepilogo') : [];
    const riepilogoCount = (riepilogoNodes ? riepilogoNodes.length : 0);
    let imponibileFromXmlNum = NaN;
    let ivaFromXmlNum = NaN;
    if (riepilogoCount) {
      imponibileFromXmlNum = 0;
      ivaFromXmlNum = 0;
      for (let i = 0; i < riepilogoCount; i++) {
        const r = riepilogoNodes[i];
        const impon = textOf(r, 'ImponibileImporto');
        const imposta = textOf(r, 'Imposta');
        const imponNum = (impon !== '' ? parseFloat(impon) : 0);
        const impostaNum = (imposta !== '' ? parseFloat(imposta) : 0);
        if (!isNaN(imponNum)) imponibileFromXmlNum += imponNum;
        if (!isNaN(impostaNum)) ivaFromXmlNum += impostaNum;
      }
    }

    // ===== Cassa previdenziale (se presente): aggiungo come riga extra
    const cassaInfo = [];
    const cassaNodes = dgd ? dgd.getElementsByTagName('DatiCassaPrevidenziale') : [];
    for (let i = 0; i < (cassaNodes ? cassaNodes.length : 0); i++) {
      const c = cassaNodes[i];
      const tipo = safeText(textOf(c, 'TipoCassa'));
      const alCassa = safeText(textOf(c, 'AlCassa'));
      const importo = textOf(c, 'ImportoContributoCassa');
      const ivaRaw = textOf(c, 'AliquotaIVA');
      const iva = ivaRaw !== '' ? parseFloat(ivaRaw) : 0;
      const amount = importo !== '' ? parseFloat(importo) : 0;
      if (!amount) continue;
      cassaInfo.push({ tipo, alCassa, importo: amount, iva: (!isNaN(iva)) ? iva : 0 });
      lines.push({
        description: safeText(`Contributo cassa previdenziale ${tipo}${alCassa ? ' (' + alCassa + '%)' : ''}`),
        qty: 1,
        price: amount,
        iva: (!isNaN(iva)) ? iva : 0,
        natura: (String(iva) === '0' ? 'N2.2' : '')
      });
    }

    // ===== Ritenuta (se presente): metto in note
    const ritenutaNodes = dgd ? dgd.getElementsByTagName('DatiRitenuta') : [];
    const ritenuteInfo = [];
    let ritenutaTotalNum = 0;
    for (let i = 0; i < (ritenutaNodes ? ritenutaNodes.length : 0); i++) {
      const r = ritenutaNodes[i];
      const tipoR = safeText(textOf(r, 'TipoRitenuta'));
      const aliqR = safeText(textOf(r, 'AliquotaRitenuta'));
      const impRaw = textOf(r, 'ImportoRitenuta');
      const impR = safeText(impRaw);
      const impNum = (impRaw !== '' ? parseFloat(impRaw) : 0);
      if (!isNaN(impNum)) ritenutaTotalNum += impNum;
      const caus = safeText(textOf(r, 'CausalePagamento'));
      const parts = [];
      if (tipoR) parts.push(tipoR);
      if (aliqR) parts.push(aliqR + '%');
      if (impR) parts.push('€ ' + impR);
      if (caus) parts.push('Causale ' + caus);
      if (parts.length) ritenuteInfo.push(parts.join(' - '));
    }

    // ===== Bollo / Arrotondamento (anomalie frequenti)
    const datiBollo = dgd ? getFirst(dgd, 'DatiBollo') : null;
    const bolloVirtuale = datiBollo ? safeText(textOf(datiBollo, 'BolloVirtuale')) : '';
    const importoBollo = datiBollo ? textOf(datiBollo, 'ImportoBollo') : '';
    const arrotondamento = dgd ? textOf(dgd, 'Arrotondamento') : '';

    // Numeri utili per controllo totali e preview (tolleranza gestita nella UI)
    const totalFromXmlNum = (totaleDoc !== '' ? parseFloat(totaleDoc) : NaN);
    const bolloNum = (importoBollo !== '' ? parseFloat(importoBollo) : 0);
    const arrotondamentoNum = (arrotondamento !== '' ? parseFloat(arrotondamento) : 0);
    const expectedTotalNum = (!isNaN(imponibileFromXmlNum) && !isNaN(ivaFromXmlNum))
      ? (imponibileFromXmlNum + ivaFromXmlNum + (Number(bolloNum) || 0) + (Number(arrotondamentoNum) || 0))
      : NaN;
    const expectedNetNum = (!isNaN(totalFromXmlNum) ? (totalFromXmlNum - (Number(ritenutaTotalNum) || 0)) : NaN);
    const paymentFromXmlNum = (importoPagamento !== '' ? parseFloat(importoPagamento) : NaN);


    const notesParts = [];
    if (totaleDoc) notesParts.push('Totale documento (da XML): € ' + safeText(totaleDoc));
    if (ritenuteInfo.length) notesParts.push('Ritenuta: ' + ritenuteInfo.join(' | '));
    if (importoBollo) notesParts.push('Bollo (da XML): € ' + safeText(importoBollo) + (bolloVirtuale ? (' (Virtuale ' + bolloVirtuale + ')') : ''));
    if (arrotondamento) notesParts.push('Arrotondamento (da XML): ' + safeText(arrotondamento));
    if (importoPagamento) notesParts.push('Importo pagamento (da XML): € ' + safeText(importoPagamento));
    if (payments.length > 1) notesParts.push('Rate pagamento (da XML): ' + payments.length + ' (importata la prima)');
    if (istituto || iban) notesParts.push('Pagamento: ' + [istituto, (iban ? ('IBAN ' + iban) : '')].filter(Boolean).join(' - '));

    // somma righe (solo per warning/preview)
    const linesTotal = lines.reduce((acc, l) => acc + (Number(l.qty || 0) * Number(l.price || 0)), 0);

    return {
      supplier,
      doc: {
        number: docNumber,
        date: docDate,
        refDate: refDate || docDate,
        giorniTermini: giorniTermini !== '' ? parseInt(giorniTermini, 10) : null,
        dueDate: dueDate || '',
        notesExtra: notesParts.join(' | '),
        totalFromXml: totaleDoc || '',
        totalFromXmlNum,
        imponibileFromXmlNum,
        ivaFromXmlNum,
        bolloNum,
        arrotondamentoNum,
        expectedTotalNum,
        ritenutaTotalNum,
        expectedNetNum,
        paymentFromXmlNum,
        linesTotal
      },
      payment: {
        first: firstPay || null,
        count: payments.length,
        preview: payments.slice(0, 3)
      },
      anomalies: {
        ritenute: ritenuteInfo,
        cassa: cassaInfo,
        bollo: { importo: importoBollo || '', virtuale: bolloVirtuale || '' },
        arrotondamento: arrotondamento || ''
      },
      lines
    };
  }

  function findExistingSupplierId(parsedSupplier) {
    const suppliers = (typeof getData === 'function') ? (getData('suppliers') || []) : [];
    const vatDigits = normalizeVat(parsedSupplier.pivaFull || parsedSupplier.pivaDigits);
    const cf = normalizeCF(parsedSupplier.codiceFiscale);

    for (const s of suppliers) {
      const sVat = normalizeVat(s.piva);
      const sCf = normalizeCF(s.codiceFiscale);
      if (vatDigits && sVat && vatDigits === sVat) return String(s.id);
      if (cf && sCf && cf === sCf) return String(s.id);
    }
    return '';
  }

  async function createSupplierWithConfirm(parsedSupplier) {
    const name = parsedSupplier.name || 'Fornitore';
    const vatShow = parsedSupplier.pivaFull || '';
    const cfShow = parsedSupplier.codiceFiscale || '';

    const msg = `Fornitore non presente in Anagrafica.\n\n` +
      `Nome: ${name}\n` +
      (vatShow ? `P.IVA: ${vatShow}\n` : '') +
      (cfShow ? `Cod. Fiscale: ${cfShow}\n` : '') +
      `\nVuoi crearlo automaticamente?`;

    if (!confirm(msg)) {
      return { created: false, supplierId: '' };
    }

    const data = {
      name: safeText(name),
      piva: safeText(parsedSupplier.pivaFull || ''),
      codiceFiscale: safeText(parsedSupplier.codiceFiscale || ''),
      pec: '',
      email: '',
      telefono: '',
      indirizzo: safeText(parsedSupplier.indirizzo || ''),
      cap: safeText(parsedSupplier.cap || ''),
      comune: safeText(parsedSupplier.comune || ''),
      provincia: safeText(parsedSupplier.provincia || ''),
      nazione: safeText(parsedSupplier.nazione || 'IT'),
      codiceDestinatario: '',
      note: 'Creato automaticamente da import XML fattura fornitore.'
    };

    const id = (typeof getNextId === 'function') ? String(getNextId(getData('suppliers'))) : String(Date.now());
    await saveDataToCloud('suppliers', data, id);

    // aggiorna dropdown
    if (typeof populateDropdowns === 'function') populateDropdowns();

    return { created: true, supplierId: String(id) };
  }

  async function applyParsedImport(file, parsed) {
    if (!file || !parsed) return;
    if (!currentUser) {
      alert('Utente non autenticato. Effettua il login prima di importare un XML.');
      return;
    }

    setStatus('Import in corso...', false);

    // Assicurati che il form sia pronto (solo ora, dopo conferma)
    if (typeof window.preparePurchaseForm === 'function') {
      window.preparePurchaseForm();
    }

    // Fornitore: esiste?
    let supplierId = findExistingSupplierId(parsed.supplier);
    if (!supplierId) {
      const res = await createSupplierWithConfirm(parsed.supplier);
      if (!res.created) {
        setStatus('Import annullato: fornitore mancante non creato.', true);
        alert('Import annullato. Crea o seleziona un fornitore e riprova.');
        return;
      }
      supplierId = res.supplierId;
    }

    // Popola campi testata
    if (typeof populateDropdowns === 'function') populateDropdowns();
    $('#purchase-supplier-select').val(String(supplierId));

    $('#purchase-number').val(parsed.doc.number || '');
    if (parsed.doc.date) $('#purchase-date').val(parsed.doc.date);

    if (parsed.doc.refDate) $('#purchase-dataRiferimento').val(parsed.doc.refDate);

    if (parsed.doc.giorniTermini != null && !isNaN(parsed.doc.giorniTermini)) {
      $('#purchase-giorniTermini').val(String(parsed.doc.giorniTermini));
    }

    // Trigger per calcolo scadenza automatico (se presente nel modulo acquisti)
    $('#purchase-dataRiferimento').trigger('change');
    $('#purchase-giorniTermini').trigger('change');

    if (parsed.doc.dueDate) {
      $('#purchase-dataScadenza').val(parsed.doc.dueDate);
    }

    // Note
    const existingNotes = ($('#purchase-notes').val() || '').trim();
    const notePrefix = `Importato da XML: ${safeText(file.name)}`;
    const combinedNotes = [notePrefix, parsed.doc.notesExtra, existingNotes].filter(Boolean).join(' | ');
    $('#purchase-notes').val(combinedNotes);


// Se presente bollo, aggiungilo come riga extra per allineare i totali (non sempre è presente nelle righe)
try {
  if (parsed && parsed.doc && parsed.doc.bolloNum && !isNaN(parsed.doc.bolloNum) && Number(parsed.doc.bolloNum) > 0) {
    const hasBolloLine = (lines || []).some(l => String(l.description || '').toLowerCase().includes('bollo'));
    if (!hasBolloLine) {
      lines.push({ description: 'Imposta di bollo', qty: 1, price: Number(parsed.doc.bolloNum), iva: 0, natura: 'N2.2' });
    }
  }
} catch(e) { /* no-op */ }

    // Righe: uso il flusso nativo (compilo input e click su "Aggiungi riga")
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    if (!lines.length) {
      setStatus('XML letto ma nessuna riga documento trovata.', true);
      alert('Attenzione: XML letto ma non sono state trovate righe documento.');
      return;
    }

    // reset righe (preparePurchaseForm ha gia' resettato tempPurchaseLines)
    for (const l of lines) {
      $('#purchase-line-description').val(l.description || '');
      $('#purchase-line-qty').val(l.qty != null ? l.qty : 1);
      $('#purchase-line-price').val(l.price != null ? l.price : 0);

      // IVA
      const ivaVal = (l.iva != null && !isNaN(l.iva)) ? String(Math.round(l.iva)) : '0';
      $('#purchase-line-iva').val(ivaVal).trigger('change');

      // Natura (solo se iva=0)
      if (ivaVal === '0') {
        $('#purchase-line-esenzione-iva').val(l.natura || 'N2.2');
      }

      $('#add-purchase-line-btn').trigger('click');
    }

    // sicurezza: evita che il salvataggio venga interpretato come "modifica" (se qualche script precedente ha settato un ID)
    try {
      CURRENT_EDITING_PURCHASE_ID = null;
      $('#purchase-id').val('Nuovo');
    } catch (e) {
      // no-op
    }

    setStatus('Import completato: ' + safeText(file.name), false);
  }

  async function prepareImportWithConfirm(file) {
    if (!file) return;
    if (!currentUser) {
      alert('Utente non autenticato. Effettua il login prima di importare un XML.');
      return;
    }

    setStatus('Lettura XML...', false);
    const xmlText = await file.text();
    const parsed = parseXmlFatturaPA(xmlText);

    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    if (!lines.length) {
      setStatus('XML letto ma nessuna riga documento trovata.', true);
      alert('Attenzione: XML letto ma non sono state trovate righe documento.');
      return;
    }

    const supplierId = findExistingSupplierId(parsed.supplier);
    _pendingMulti = null;
    _pending = { file, parsed, supplierId };

    ensureConfirmModal();
    setConfirmModalMode('single', 1);
    $('#purchase-xml-confirm-summary').html(buildConfirmHtml(file, parsed, supplierId));
    showConfirmModal();
    setupRecipientConfirmGate();
  }


  async function prepareMultiImportWithConfirm(files) {
    if (!files || !files.length) return;
    if (!currentUser) {
      alert('Utente non autenticato. Effettua il login prima di importare un XML.');
      return;
    }

    setStatus('Lettura XML multipla...', false);
    const items = [];
    for (const f of files) {
      const item = { file: f, parsed: null, supplierId: '', error: '', recipientMismatch: false };
      try {
        const xmlText = await f.text();
        const parsed = parseXmlFatturaPA(xmlText);
        const supplierId = findExistingSupplierId(parsed.supplier);
        const rec = checkRecipientMismatch(parsed);
        item.parsed = parsed;
        item.supplierId = supplierId || '';
        item.recipientMismatch = !!(rec && rec.mismatch);
      } catch (e) {
        item.error = (e && e.message) ? e.message : String(e || 'Errore parsing');
      }
      items.push(item);
    }

    _pending = null;
    _pendingMulti = { items };

    setConfirmModalMode('multi', items.length);
    $('#purchase-xml-confirm-summary').html(buildConfirmHtmlMulti(items));
    showConfirmModal();
    setupRecipientConfirmGate();
  }

  function buildConfirmHtmlMulti(items) {
    const ok = items.filter(i => !i.error && i.parsed);
    const err = items.filter(i => i.error);
    const missingSup = ok.filter(i => !i.supplierId).length;
    const mism = ok.filter(i => i.recipientMismatch).length;

    const topAlert = (mism > 0)
      ? `<div class="alert alert-warning py-2 mb-2">
          <div><strong>Attenzione:</strong> ${mism} file risultano intestati a un destinatario diverso dalla tua azienda.</div>
          <div class="form-check mt-2">
            <input class="form-check-input" type="checkbox" id="purchase-xml-recipient-confirm">
            <label class="form-check-label" for="purchase-xml-recipient-confirm">Confermo: importa comunque</label>
          </div>
        </div>`
      : ``;

    const infoAlert = `<div class="alert alert-info py-2 mb-2">
      File selezionati: <strong>${items.length}</strong> — Validati: <strong>${ok.length}</strong> — Errori: <strong>${err.length}</strong>
      ${missingSup ? `<div class="small mt-1">Fornitori mancanti: <strong>${missingSup}</strong> (verranno creati automaticamente durante il salvataggio).</div>` : ``}
    </div>`;

    const rows = items.map((it) => {
      if (it.error) {
        return `<tr>
          <td>${escapeHtml(it.file && it.file.name ? it.file.name : '')}</td>
          <td colspan="4" class="text-danger">${escapeHtml(it.error)}</td>
        </tr>`;
      }
      const sup = it.parsed && it.parsed.supplier ? it.parsed.supplier : {};
      const doc = it.parsed && it.parsed.doc ? it.parsed.doc : {};
      const tot = (doc && doc.totalFromXmlNum != null && !isNaN(doc.totalFromXmlNum)) ? fmtMoney(doc.totalFromXmlNum) : (doc.totalFromXml ? fmtMoney(doc.totalFromXml) : '');
      const badge = it.recipientMismatch ? `<span class="badge bg-warning text-dark ms-1">Destinatario diverso</span>` : '';
      const supBadge = (!it.supplierId) ? `<span class="badge bg-secondary ms-1">Fornitore da creare</span>` : `<span class="badge bg-success ms-1">Fornitore ok</span>`;
      return `<tr>
        <td>${escapeHtml(it.file && it.file.name ? it.file.name : '')}</td>
        <td>${escapeHtml(sup.name || '')}${supBadge}${badge}</td>
        <td class="text-nowrap">${escapeHtml(doc.number || '')}</td>
        <td class="text-nowrap">${escapeHtml(doc.date || '')}</td>
        <td class="text-nowrap">€ ${escapeHtml(tot)}</td>
      </tr>`;
    }).join('');

    return `
${topAlert}
${infoAlert}
<div class="table-responsive">
<table class="table table-sm table-striped align-middle">
  <thead>
    <tr>
      <th>File</th>
      <th>Fornitore</th>
      <th>N°</th>
      <th>Data</th>
      <th>Totale XML</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</div>
`;
  }

  function _computeTotalsFromLines(lines) {
    let imponibile = 0;
    let ivaTot = 0;
    (lines || []).forEach(l => {
      const qty = parseFloat(l.qty) || 0;
      const price = parseFloat(l.price) || 0;
      const sub = qty * price;
      const ivaPerc = parseFloat(l.iva) || 0;
      imponibile += sub;
      ivaTot += sub * (ivaPerc / 100);
    });
    const totale = imponibile + ivaTot;
    return { imponibile, ivaTot, totale };
  }

  function _computeDueDate(refDate, giorni) {
    try {
      if (!refDate) return '';
      const g = parseInt(giorni, 10) || 0;
      if (!g) return '';
      const d = new Date(refDate);
      if (isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + g);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) { return ''; }
  }

  async function createSupplierAuto(parsedSupplier) {
    const name = safeText(parsedSupplier && parsedSupplier.name ? parsedSupplier.name : 'Fornitore');
    const data = {
      name: safeText(name),
      piva: safeText((parsedSupplier && parsedSupplier.pivaFull) ? parsedSupplier.pivaFull : ''),
      codiceFiscale: safeText((parsedSupplier && parsedSupplier.codiceFiscale) ? parsedSupplier.codiceFiscale : ''),
      pec: '',
      email: '',
      telefono: '',
      indirizzo: safeText((parsedSupplier && parsedSupplier.indirizzo) ? parsedSupplier.indirizzo : ''),
      cap: safeText((parsedSupplier && parsedSupplier.cap) ? parsedSupplier.cap : ''),
      comune: safeText((parsedSupplier && parsedSupplier.comune) ? parsedSupplier.comune : ''),
      provincia: safeText((parsedSupplier && parsedSupplier.provincia) ? parsedSupplier.provincia : ''),
      nazione: safeText((parsedSupplier && parsedSupplier.nazione) ? parsedSupplier.nazione : 'IT'),
      codiceDestinatario: '',
      note: 'Creato automaticamente da import multipla XML fattura fornitore.'
    };

    const id = (typeof getNextId === 'function') ? String(getNextId(getData('suppliers'))) : String(Date.now());
    await saveDataToCloud('suppliers', data, id);
    return String(id);
  }

  async function saveParsedAsPurchase(file, parsed, options) {
    options = options || {};
    if (!file || !parsed) return null;

    // Fornitore
    let supplierId = findExistingSupplierId(parsed.supplier);
    if (!supplierId) {
      if (options.autoCreateSupplier) {
        supplierId = await createSupplierAuto(parsed.supplier);
      } else {
        const res = await createSupplierWithConfirm(parsed.supplier);
        if (!res.created) return null;
        supplierId = res.supplierId;
      }
    }

    const doc = parsed.doc || {};
    let lines = Array.isArray(parsed.lines) ? parsed.lines.slice() : [];
    // bollo come riga extra
    try {
      if (doc.bolloNum && !isNaN(doc.bolloNum) && Number(doc.bolloNum) > 0) {
        const hasBolloLine = lines.some(l => String(l.description || '').toLowerCase().includes('bollo'));
        if (!hasBolloLine) lines.push({ description: 'Imposta di bollo', qty: 1, price: Number(doc.bolloNum), iva: 0, natura: 'N2.2' });
      }
    } catch(e){}

    // normalizza IVA a stringa come il form
    lines = lines.map(l => {
      const ivaVal = (l.iva != null && !isNaN(l.iva)) ? String(Math.round(l.iva)) : String(l.iva || '0');
      return {
        description: l.description || '',
        qty: (l.qty != null ? l.qty : 1),
        price: (l.price != null ? l.price : 0),
        iva: ivaVal,
        natura: (ivaVal === '0' ? (l.natura || 'N2.2') : '')
      };
    });

    const totals = _computeTotalsFromLines(lines);

    const rawData = {
      supplierId: String(supplierId),
      number: doc.number || '',
      date: doc.date || '',
      dataRiferimento: doc.refDate || doc.date || '',
      giorniTermini: (doc.giorniTermini != null && !isNaN(doc.giorniTermini)) ? parseInt(doc.giorniTermini, 10) : 0,
      dataScadenza: doc.dueDate || _computeDueDate(doc.refDate || doc.date || '', doc.giorniTermini || 0),
      status: 'Da Pagare',
      notes: [(`Importato da XML: ${safeText(file.name)}`), (doc.notesExtra || '')].filter(Boolean).join(' | '),
      lines: lines,
      imponibile: totals.imponibile,
      ivaTotale: totals.ivaTot,
      totaleDocumento: totals.totale
    };
    const data = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizePurchaseInfo === 'function')
      ? window.DomainNormalizers.normalizePurchaseInfo(rawData)
      : rawData;

    const id = (typeof getNextId === 'function') ? String(getNextId(getData('purchases'))) : String(Date.now());
    await saveDataToCloud('purchases', data, id);
    return { id, data };
  }

  async function saveMultiPurchases(items) {
    const okItems = (items || []).filter(i => i && !i.error && i.parsed);
    let saved = 0;
    let failed = 0;
    const errors = [];

    setStatus('Salvataggio acquisti importati...', false);

    for (const it of okItems) {
      try {
        const res = await saveParsedAsPurchase(it.file, it.parsed, { autoCreateSupplier: true });
        if (res) saved++; else failed++;
      } catch (e) {
        failed++;
        errors.push((it.file && it.file.name ? it.file.name + ': ' : '') + ((e && e.message) ? e.message : 'Errore'));
      }
    }

    setStatus('Importazione completata: salvati ' + saved + ', errori ' + failed, failed > 0);
    if (errors.length) console.warn('Errori import multiplo:', errors);
    alert('Importazione completata. Salvati: ' + saved + ' — Errori: ' + failed + (errors.length ? ('\n\nDettagli in console.') : ''));
    // Vai all'elenco acquisti
    try { $('.sidebar .nav-link[data-target="elenco-acquisti"]').click(); } catch(e) {}
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    ensureConfirmModal();

    // Applica import solo su conferma
    $(document)
      .off('click' + NS, '#purchase-xml-confirm-apply')
      .on('click' + NS, '#purchase-xml-confirm-apply', async function () {
        const p = _pending;
        _pending = null;
        _pendingMulti = null;
        hideConfirmModal();
        if (!p) return;
        try {
          await applyParsedImport(p.file, p.parsed);
        } catch (err) {
          console.error('Errore applicazione import XML acquisto:', err);
          setStatus('Errore import: ' + (err && err.message ? err.message : 'imprevisto'), true);
          alert('Errore import XML: ' + (err && err.message ? err.message : 'imprevisto'));
        }

// Importa e salva (senza passare dal bottone "Salva" del modulo)
$(document)
  .off('click' + NS, '#purchase-xml-confirm-save')
  .on('click' + NS, '#purchase-xml-confirm-save', async function () {
    const multi = _pendingMulti;
    const single = _pending;
    _pending = null;
    _pendingMulti = null;
    hideConfirmModal();

    try {
      if (multi && multi.items && multi.items.length) {
        await saveMultiPurchases(multi.items);
        return;
      }
      if (single && single.file && single.parsed) {
        const res = await saveParsedAsPurchase(single.file, single.parsed, { autoCreateSupplier: false });
        if (res) {
          setStatus('Acquisto importato e salvato: ' + safeText(single.file.name), false);
          alert('Acquisto importato e salvato!');
          try { $('.sidebar .nav-link[data-target="elenco-acquisti"]').click(); } catch(e) {}
        } else {
          setStatus('Import annullato.', true);
        }
      }
    } catch (err) {
      console.error('Errore import+salva XML acquisto:', err);
      setStatus('Errore import+salva: ' + (err && err.message ? err.message : 'imprevisto'), true);
      alert('Errore import XML: ' + (err && err.message ? err.message : 'imprevisto'));
    }
  });

      });

    // Cancella/chiudi (robusto: funziona anche se data-bs-dismiss non dovesse agganciarsi)
    $(document)
      .off('click' + NS, '#purchase-xml-confirm-cancel')
      .on('click' + NS, '#purchase-xml-confirm-cancel', function () {
        _pending = null;
        _pendingMulti = null;
        hideConfirmModal();
      });

    // UI può non esserci (es. forfettario) → bind safe
    $('#purchase-import-xml-btn')
      .off('click' + NS)
      .on('click' + NS, function () {
        setStatus('', false);
        const $file = $('#purchase-xml-file');
        if (!$file.length) {
          alert('Input file XML non trovato (UI non inizializzata).');
          return;
        }
        $file.val('');
        $file.trigger('click');
      });

    $('#purchase-xml-file')
      .off('change' + NS)
      .on('change' + NS, async function (e) {
        const files = (e && e.target && e.target.files) ? Array.from(e.target.files) : [];
        if (!files.length) return;

        try {
          if (files.length === 1) {
            _pendingMulti = null;
            await prepareImportWithConfirm(files[0]);
          } else {
            await prepareMultiImportWithConfirm(files);
          }
        } catch (err) {
          console.error('Errore import XML acquisto:', err);
          setStatus('Errore import: ' + (err && err.message ? err.message : 'imprevisto'), true);
          alert('Errore import XML: ' + (err && err.message ? err.message : 'imprevisto'));
        }
      });
  }

  // bind al DOM ready
  $(bind);
})();
