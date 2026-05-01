(function () {
  window.InvoiceCalculator = window.InvoiceCalculator || {};

  function getCommonCalc() {
    return window.AppModules && window.AppModules.invoicesCommonCalc && window.AppModules.invoicesCommonCalc.calculateInvoiceTotals;
  }

  function calculateTotals(lines, companyInfo, customerInfo, documentType, options) {
    const calcFn = getCommonCalc();
    if (typeof calcFn !== 'function') {
      throw new Error('Modulo invoicesCommonCalc non disponibile');
    }
    return calcFn(lines, companyInfo, customerInfo, documentType, options);
  }

  function getInvoiceDefaults(companyInfo) {
    const comp = companyInfo || {};
    if (window.TaxRegimePolicy && typeof window.TaxRegimePolicy.getInvoiceDefaults === 'function') {
      return window.TaxRegimePolicy.getInvoiceDefaults(comp);
    }
    const aliq = comp.aliquotaIva != null ? String(comp.aliquotaIva) : '22';
    return {
      isForfettario: false,
      defaultIva: aliq
    };
  }

  function getEffectiveCompanyVatRate(companyInfo) {
    const comp = companyInfo || {};
    const sf = (typeof window.safeFloat === 'function')
      ? window.safeFloat
      : function (v) {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };
    const defaults = getInvoiceDefaults(comp);
    if (defaults && defaults.isForfettario) return 0;
    return sf(comp.aliquotaIva || comp.aliquotaIVA || (defaults ? defaults.defaultIva : 22) || 22);
  }

  window.InvoiceCalculator.calculateTotals = calculateTotals;
  window.InvoiceCalculator.getInvoiceDefaults = getInvoiceDefaults;
  window.InvoiceCalculator.getEffectiveCompanyVatRate = getEffectiveCompanyVatRate;
})();
