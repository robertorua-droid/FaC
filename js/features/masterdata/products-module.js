// js/features/masterdata/products-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.products = window.AppModules.products || {};

  let _bound = false;

  function getProductsStore() {
    if (window.AppStore && typeof window.AppStore.get === 'function') return window.AppStore.get('products') || [];
    if (typeof window.getData === 'function') return window.getData('products') || [];
    return [];
  }

  function getProductTaxDefaults() {
    if (window.TaxRegimePolicy && typeof window.TaxRegimePolicy.getInvoiceDefaults === 'function') {
      return window.TaxRegimePolicy.getInvoiceDefaults();
    }
    return { isForfettario: false, defaultIva: '22', disableIvaFields: false };
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    $('#newProductBtn').click(() => {
      CURRENT_EDITING_ID = null;
      $('#productForm')[0].reset();
      $('#product-id').val('Nuovo');
      const taxDefaults = getProductTaxDefaults();
      $('#product-iva').val(taxDefaults.defaultIva || '22');
      $('#product-iva').prop('disabled', !!taxDefaults.disableIvaFields);
      $('#product-iva').change();
      // Default classificazione: Lavoro (entra in rivalsa INPS)
      $('#product-isLavoro').prop('checked', true);
      $('#product-isCosto').prop('checked', false);
      $('#productModal').modal('show');
    });

    // Checkbox: Lavoro/Costo (mutuamente esclusivi)
    $('#product-isCosto').on('change', function () {
      if ($(this).is(':checked')) {
        $('#product-isLavoro').prop('checked', false);
      } else {
        $('#product-isLavoro').prop('checked', true);
      }
    });

    $('#product-isLavoro').on('change', function () {
      if ($(this).is(':checked')) {
        $('#product-isCosto').prop('checked', false);
      } else {
        // Se tolgo Lavoro, considero automaticamente Costo
        $('#product-isCosto').prop('checked', true);
      }
    });

    $('#saveProductBtn').click(async () => {
      // Normalizzo: esattamente una tra Lavoro e Costo
      const isCosto = $('#product-isCosto').is(':checked');
      const isLavoro = !isCosto;
      const data = {
        description: $('#product-description').val(),
        code: $('#product-code').val(),
        salePrice: $('#product-salePrice').val(),
        iva: getProductTaxDefaults().isForfettario ? '0' : $('#product-iva').val(),
        esenzioneIva: $('#product-esenzioneIva').val(),
        isLavoro: isLavoro,
        isCosto: isCosto
      };

      let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : 'PRD' + new Date().getTime();
      await saveDataToCloud('products', data, id);
      $('#productModal').modal('hide');
      if (window.UiRefresh && typeof window.UiRefresh.refreshMasterDataArea === 'function') window.UiRefresh.refreshMasterDataArea();
      else if (typeof renderMasterDataArea === 'function') renderMasterDataArea();
    });

    $('#products-table-body').on('click', '.btn-edit-product', function (e) {
      window.AppModules.masterdata.editItem('product', $(e.currentTarget).attr('data-id'));
    });

    $('#products-table-body').on('click', '.btn-delete-product', function (e) {
      const id = $(e.currentTarget).attr('data-id');
      if (window.deleteDataFromCloud) window.deleteDataFromCloud('products', id, { skipRender: true }).then(() => {
        if (window.UiRefresh && typeof window.UiRefresh.refreshMasterDataArea === 'function') window.UiRefresh.refreshMasterDataArea();
        else if (typeof renderMasterDataArea === 'function') renderMasterDataArea();
      });
    });

    $('#product-iva').change(function () {
      if (getProductTaxDefaults().isForfettario) {
        $(this).val('0').prop('disabled', true);
      }
      if (typeof window.toggleEsenzioneIvaField === 'function') {
        window.toggleEsenzioneIvaField('product', $(this).val());
      }
    });
  }

  window.AppModules.products.bind = bind;
})();
