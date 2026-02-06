// js/features/masterdata/products-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.products = window.AppModules.products || {};

  let _bound = false;
  // Regime fiscale (gestionale) unificato: usa isForfettario() da utils.js

  function bind() {
    if (_bound) return;
    _bound = true;

    $('#newProductBtn').click(() => {
      CURRENT_EDITING_ID = null;
      $('#productForm')[0].reset();
      $('#product-id').val('Nuovo');
      $('#product-iva').val('0');
      if (isForfettario()) {
        $('#product-iva').prop('disabled', true);
      } else {
        $('#product-iva').prop('disabled', false);
      }
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
        iva: isForfettario() ? '0' : $('#product-iva').val(),
        esenzioneIva: $('#product-esenzioneIva').val(),
        isLavoro: isLavoro,
        isCosto: isCosto
      };

      let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : 'PRD' + new Date().getTime();
      await saveDataToCloud('products', data, id);
      $('#productModal').modal('hide');
      renderAll();
    });

    $('#products-table-body').on('click', '.btn-edit-product', function (e) {
      window.AppModules.masterdata.editItem('product', $(e.currentTarget).attr('data-id'));
    });

    $('#products-table-body').on('click', '.btn-delete-product', function (e) {
      deleteDataFromCloud('products', $(e.currentTarget).attr('data-id'));
    });

    $('#product-iva').change(function () {
      if (isForfettario()) {
        $(this).val('0').prop('disabled', true);
      }
      if (typeof window.toggleEsenzioneIvaField === 'function') {
        window.toggleEsenzioneIvaField('product', $(this).val());
      }
    });
  }

  window.AppModules.products.bind = bind;
})();
