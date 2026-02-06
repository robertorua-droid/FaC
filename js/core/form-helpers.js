// js/core/form-helpers.js
// Helper UI condivisi (nessun bundler)

(function () {
  function toggleEsenzioneIvaField(prefix, ivaVal) {
    // Gestione coerente per:
    // - product: #product-esenzioneIva (solo enable/disable)
    // - invoice: #invoice-product-esenzioneIva + container #invoice-esenzione-iva-container
    // - purchase: #purchase-line-esenzione-iva + container #purchase-esenzione-iva-container
    let esenzioneField;
    let container = null;

    if (prefix === 'invoice') {
      esenzioneField = $('#invoice-product-esenzioneIva');
      container = $('#invoice-esenzione-iva-container');
    } else if (prefix === 'purchase') {
      esenzioneField = $('#purchase-line-esenzione-iva');
      container = $('#purchase-esenzione-iva-container');
    } else {
      esenzioneField = $(`#${prefix}-esenzioneIva`);
    }

    if (ivaVal === '0' || ivaVal === 0) {
      esenzioneField.prop('disabled', false);
      if (container) container.removeClass('d-none');
    } else {
      esenzioneField.prop('disabled', true).val('');
      if (container) container.addClass('d-none');
    }
  }

  window.toggleEsenzioneIvaField = toggleEsenzioneIvaField;
})();
