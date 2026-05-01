(function () {
  window.InvoiceSubmitService = window.InvoiceSubmitService || {};

  function validateFormState(formState) {
    if (!window.InvoiceValidationService || typeof window.InvoiceValidationService.validateDocumentForm !== 'function') {
      return { ok: true };
    }
    return window.InvoiceValidationService.validateDocumentForm({
      customerId: formState && formState.customerId,
      lines: formState && formState.lines
    });
  }

  function buildInvoicePayload(formState) {
    if (!window.InvoiceService || typeof window.InvoiceService.buildInvoicePayload !== 'function') {
      throw new Error('InvoiceService non disponibile. Impossibile costruire il documento da salvare.');
    }
    return window.InvoiceService.buildInvoicePayload(formState);
  }

  function confirmDuplicateIfNeeded(invoicePayload, currentInvoiceId) {
    if (!invoicePayload || invoicePayload.isDraft) return true;
    if (!window.InvoiceValidationService) return true;

    const duplicates = typeof window.InvoiceValidationService.findPotentialDuplicates === 'function'
      ? window.InvoiceValidationService.findPotentialDuplicates({
        invoices: (typeof window.getData === 'function' ? window.getData('invoices') : null) || [],
        currentInvoiceId: currentInvoiceId,
        customerId: invoicePayload.customerId,
        type: invoicePayload.type,
        number: invoicePayload.number,
        date: invoicePayload.date
      })
      : [];

    if (!duplicates.length) return true;

    const message = typeof window.InvoiceValidationService.buildDuplicateConfirmMessage === 'function'
      ? window.InvoiceValidationService.buildDuplicateConfirmMessage({
        customerId: invoicePayload.customerId,
        type: invoicePayload.type,
        number: invoicePayload.number,
        date: invoicePayload.date
      }, duplicates)
      : 'Possibile duplicato documento. Vuoi salvare comunque?';

    return typeof window.confirm !== 'function' ? true : !!window.confirm(message);
  }

  async function persistInvoice(invoicePayload, currentInvoiceId, lines) {
    if (window.InvoicePersistenceService && typeof window.InvoicePersistenceService.saveInvoiceDocument === 'function') {
      return window.InvoicePersistenceService.saveInvoiceDocument({
        currentInvoiceId: currentInvoiceId,
        invoicePayload: invoicePayload,
        lines: lines || invoicePayload.lines || []
      });
    }

    if (typeof window.saveDataToCloud !== 'function') {
      throw new Error('saveDataToCloud non disponibile');
    }
    let id = currentInvoiceId ? currentInvoiceId : String(window.getNextId((typeof window.getData === 'function' ? window.getData('invoices') : null) || []));
    await window.saveDataToCloud('invoices', invoicePayload, id);
    return { invoiceId: id, invoicePayload: invoicePayload };
  }

  async function submitDocument(formState) {
    const validation = validateFormState(formState);
    if (!validation.ok) {
      return { ok: false, stage: 'validation', validation: validation };
    }

    const payload = buildInvoicePayload(formState || {});
    const canProceed = confirmDuplicateIfNeeded(payload, formState && formState.currentInvoiceId);
    if (!canProceed) {
      return { ok: false, stage: 'duplicate-confirm-cancelled' };
    }

    const saveResult = await persistInvoice(payload, formState && formState.currentInvoiceId, formState && formState.lines);
    return { ok: true, invoicePayload: payload, saveResult: saveResult };
  }

  window.InvoiceSubmitService.validateFormState = validateFormState;
  window.InvoiceSubmitService.buildInvoicePayload = buildInvoicePayload;
  window.InvoiceSubmitService.confirmDuplicateIfNeeded = confirmDuplicateIfNeeded;
  window.InvoiceSubmitService.persistInvoice = persistInvoice;
  window.InvoiceSubmitService.submitDocument = submitDocument;
})();
