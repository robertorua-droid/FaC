// js/core/tax-regime-policy.js
(function () {
  const C = window.DomainConstants || {};
  const TAX_REGIME_ORDINARIO = (C.TAX_REGIMES && C.TAX_REGIMES.ORDINARIO) || 'ordinario';
  const TAX_REGIME_FORFETTARIO = (C.TAX_REGIMES && C.TAX_REGIMES.FORFETTARIO) || 'forfettario';
  const TAX_REGIME_RF_FORFETTARIO = (C.RF_CODES && C.RF_CODES.FORFETTARIO) || 'RF19';
  const INVOICE_NATURE_FORFETTARIO = (C.INVOICE_NATURES && C.INVOICE_NATURES.FORFETTARIO) || 'N2.2';
  const DEFAULT_IVA_ORDINARIO = (C.COMPANY_DEFAULTS && C.COMPANY_DEFAULTS.IVA_ORDINARIO) || 22;

  function normalizeTaxRegime(v) {
    const t = String(v || '').trim().toLowerCase();
    if (t === TAX_REGIME_FORFETTARIO || t === TAX_REGIME_ORDINARIO) return t;
    return '';
  }

  function extractRFCode(v) {
    const raw = String(v || '').trim().toUpperCase();
    if (!raw) return '';
    const m = raw.match(/RF\d{2}/);
    return m ? m[0] : raw;
  }

  function resolveCompanyInfo(companyInfo) {
    if (companyInfo && typeof companyInfo === 'object') return companyInfo;
    try {
      if (typeof window.getData === 'function') {
        return window.getData('companyInfo') || {};
      }
    } catch (e) {}
    return {};
  }

  const TaxRegimePolicy = {
    constants: {
      ORDINARIO: TAX_REGIME_ORDINARIO,
      FORFETTARIO: TAX_REGIME_FORFETTARIO,
      RF_FORFETTARIO: TAX_REGIME_RF_FORFETTARIO
    },

    resolve(companyInfo) {
      const ci = resolveCompanyInfo(companyInfo);
      const explicit = normalizeTaxRegime(ci.taxRegime);
      if (explicit) return explicit;

      const rf = extractRFCode(ci.codiceRegimeFiscale);
      if (!rf) return '';
      if (rf === TAX_REGIME_RF_FORFETTARIO) return TAX_REGIME_FORFETTARIO;
      if (/^RF\d{2}$/.test(rf)) return TAX_REGIME_ORDINARIO;
      return '';
    },

    has(companyInfo) {
      const r = this.resolve(companyInfo);
      return r === TAX_REGIME_FORFETTARIO || r === TAX_REGIME_ORDINARIO;
    },

    isForfettario(companyInfo) {
      return this.resolve(companyInfo) === TAX_REGIME_FORFETTARIO;
    },

    isOrdinario(companyInfo) {
      return this.resolve(companyInfo) === TAX_REGIME_ORDINARIO;
    },

    canManagePurchases(companyInfo) {
      return this.isOrdinario(companyInfo);
    },

    canManageSuppliers(companyInfo) {
      return this.isOrdinario(companyInfo);
    },

    canUseVatRegisters(companyInfo) {
      return this.isOrdinario(companyInfo);
    },

    canUseLmSimulation(companyInfo) {
      return this.isForfettario(companyInfo);
    },

    canUseOrdinarioSimulation(companyInfo) {
      return this.isOrdinario(companyInfo);
    },

    shouldShowPurchaseDelete(companyInfo) {
      return this.canManagePurchases(companyInfo);
    },

    getCapabilities(companyInfo) {
      const regime = this.resolve(companyInfo);
      return {
        regime,
        hasTaxRegime: regime === TAX_REGIME_FORFETTARIO || regime === TAX_REGIME_ORDINARIO,
        isForfettario: regime === TAX_REGIME_FORFETTARIO,
        isOrdinario: regime === TAX_REGIME_ORDINARIO,
        canManagePurchases: regime === TAX_REGIME_ORDINARIO,
        canManageSuppliers: regime === TAX_REGIME_ORDINARIO,
        canUseVatRegisters: regime === TAX_REGIME_ORDINARIO,
        canUseLmSimulation: regime === TAX_REGIME_FORFETTARIO,
        canUseOrdinarioSimulation: regime === TAX_REGIME_ORDINARIO,
        shouldShowPurchaseDelete: regime === TAX_REGIME_ORDINARIO
      };
    },

    getCurrentCapabilities() {
      return this.getCapabilities(resolveCompanyInfo());
    },

    getUiVisibility(companyInfo) {
      const caps = this.getCapabilities(companyInfo);
      return {
        regime: caps.regime,
        hasTaxRegime: caps.hasTaxRegime,
        showForfettarioFields: caps.isForfettario,
        showOrdinarioFields: caps.isOrdinario,
        showLmMenu: caps.canUseLmSimulation,
        showOrdinarioMenu: caps.canUseOrdinarioSimulation,
        showVatRegistersMenu: caps.canUseVatRegisters,
        showSuppliersMenu: caps.canManageSuppliers,
        showPurchasesMenu: caps.canManagePurchases,
        showPurchaseDelete: caps.shouldShowPurchaseDelete,
        scadenziario: this.getScadenziarioVisibility(companyInfo)
      };
    },

    getCurrentUiVisibility() {
      return this.getUiVisibility(resolveCompanyInfo());
    },

    getInvoiceDefaults(companyInfo) {
      const ci = resolveCompanyInfo(companyInfo);
      const caps = this.getCapabilities(ci);
      return {
        regime: caps.regime,
        isForfettario: caps.isForfettario,
        isOrdinario: caps.isOrdinario,
        defaultIva: caps.isForfettario ? '0' : String(ci.aliquotaIva != null ? ci.aliquotaIva : (ci.aliquotaIVA != null ? ci.aliquotaIVA : DEFAULT_IVA_ORDINARIO)),
        disableIvaFields: caps.isForfettario,
        vatNatureDefault: caps.isForfettario ? INVOICE_NATURE_FORFETTARIO : ''
      };
    },

    getScadenziarioVisibility(companyInfo) {
      const caps = this.getCapabilities(companyInfo);
      return {
        showPurchasePayments: caps.canManagePurchases,
        showVatDeadlines: caps.canUseVatRegisters
      };
    },

    fromFormValues(taxRegime, codiceRegimeFiscale) {
      return this.resolve({ taxRegime, codiceRegimeFiscale });
    },

    resolveCompanyInfo,
    normalizeTaxRegime,
    extractRFCode
  };

  window.TaxRegimePolicy = TaxRegimePolicy;
})();
