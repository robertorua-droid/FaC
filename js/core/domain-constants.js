// js/core/domain-constants.js
(function () {
  const DomainConstants = {
    TAX_REGIMES: {
      ORDINARIO: 'ordinario',
      FORFETTARIO: 'forfettario'
    },
    RF_CODES: {
      FORFETTARIO: 'RF19'
    },
    INVOICE_NATURES: {
      FORFETTARIO: 'N2.2',
      VAT_EXEMPT_DEFAULT: 'N2.2'
    },
    INVOICE_TYPES: {
      FATTURA: 'Fattura',
      NOTA_DI_CREDITO: 'Nota di Credito'
    },
    COMPANY_DEFAULTS: {
      IVA_ORDINARIO: 22,
      GESTIONE_SEPARATA_ORDINARIO: '26.07'
    }
  };

  window.DomainConstants = DomainConstants;
})();
