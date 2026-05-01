// js/features/masterdata/masterdata-helpers.js
// Helper condivisi per anagrafiche (nessun bundler)

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.masterdata = window.AppModules.masterdata || {};

  function getStoreCollection(name) {
    if (window.AppStore && typeof window.AppStore.get === 'function') return window.AppStore.get(name) || [];
    if (typeof window.getData === 'function') return window.getData(name) || [];
    return [];
  }

  function getStoreCompanyInfo() {
    if (window.AppStore && typeof window.AppStore.get === 'function') return window.AppStore.get('companyInfo') || {};
    if (typeof window.getData === 'function') return window.getData('companyInfo') || {};
    return {};
  }

  function editItem(type, id) {
    // type: 'customer' | 'product' | 'supplier'
    if (type === 'customer' || type === 'product' || type === 'supplier') {
      CURRENT_EDITING_ID = String(id);
    }

    let item = getStoreCollection(`${type}s`).find(i => String(i.id) === String(id));
    if (!item) return;
    if (type === 'customer' && window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCustomerInfo === 'function') item = window.DomainNormalizers.normalizeCustomerInfo(item);

    $(`#${type}Form`)[0].reset();
    $(`#${type}ModalTitle`).text('Modifica');
    $(`#${type}-id`).val(String(item.id));

    for (const key in item) {
      const field = $(`#${type}-${key}`);
      if (field.length) {
        if (field.is(':checkbox')) field.prop('checked', item[key]);
        else field.val(item[key]);
      }
    }

    if (type === 'product') {
      const ci = getStoreCompanyInfo();
      const isForf = window.TaxRegimePolicy ? window.TaxRegimePolicy.isForfettario(ci) : false;

      // Default classificazione servizi: se isCosto non è impostato, considero Lavoro
      if ($('#product-isCosto').length && $('#product-isLavoro').length) {
        const isCosto = (item.isCosto === true || item.isCosto === 'true');
        $('#product-isCosto').prop('checked', isCosto);
        $('#product-isLavoro').prop('checked', !isCosto);
      }

      if (isForf) {
        $('#product-iva').val('0').prop('disabled', true);
      } else {
        $('#product-iva').prop('disabled', false);
      }

      $('#product-iva').trigger('change');
      if (item.iva == '0') $('#product-esenzioneIva').val(item.esenzioneIva);
    }

    $(`#${type}Modal`).modal('show');
  }

  window.AppModules.masterdata.editItem = editItem;
  // compatibilita (se qualche parte del codice la richiamasse direttamente)
  window.editItem = editItem;
})();
