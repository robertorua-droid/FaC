// js/features/masterdata/suppliers-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.suppliers = window.AppModules.suppliers || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    // FORNITORI (CRUD)
    $('#newSupplierBtn').click(() => {
      CURRENT_EDITING_ID = null;
      $('#supplierForm')[0].reset();
      $('#supplier-id').val('Nuovo');
      $('#supplierModalTitle').text('Nuovo Fornitore');
      $('#supplierModal').modal('show');
    });

    $('#saveSupplierBtn').click(async () => {
      const data = {
        name: $('#supplier-name').val(),
        piva: $('#supplier-piva').val(),
        codiceFiscale: $('#supplier-codiceFiscale').val(),
        pec: $('#supplier-pec').val(),
        email: $('#supplier-email').val(),
        telefono: $('#supplier-telefono').val(),
        indirizzo: $('#supplier-indirizzo').val(),
        cap: $('#supplier-cap').val(),
        comune: $('#supplier-comune').val(),
        provincia: $('#supplier-provincia').val(),
        nazione: $('#supplier-nazione').val(),
        codiceDestinatario: $('#supplier-codiceDestinatario').val(),
        note: $('#supplier-note').val() || ''
      };

      let id = CURRENT_EDITING_ID ? String(CURRENT_EDITING_ID) : String(getNextId(getData('suppliers')));
      await saveDataToCloud('suppliers', data, id);
      $('#supplierModal').modal('hide');
      renderAll();
    });

    $('#suppliers-table-body').on('click', '.btn-edit-supplier', function (e) {
      window.AppModules.masterdata.editItem('supplier', $(e.currentTarget).attr('data-id'));
    });

    $('#suppliers-table-body').on('click', '.btn-delete-supplier', function (e) {
      deleteDataFromCloud('suppliers', $(e.currentTarget).attr('data-id'));
    });
  }

  window.AppModules.suppliers.bind = bind;
})();
