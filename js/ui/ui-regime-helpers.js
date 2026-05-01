// ui-regime-helpers.js
(function () {
    function getCurrentCompanyInfo() {
        try {
            if (typeof window.getData === 'function') return window.getData('companyInfo') || {};
        } catch (e) { }
        return {};
    }

    function getTaxRegimeCapabilities(companyInfo) {
        const resolved = (companyInfo && typeof companyInfo === 'object') ? companyInfo : getCurrentCompanyInfo();
        if (window.TaxRegimePolicy && typeof window.TaxRegimePolicy.getCapabilities === 'function') {
            return window.TaxRegimePolicy.getCapabilities(resolved);
        }
        return {
            regime: '',
            hasTaxRegime: false,
            isForfettario: false,
            isOrdinario: false,
            canManagePurchases: false,
            canManageSuppliers: false,
            canUseVatRegisters: false,
            canUseLmSimulation: false,
            canUseOrdinarioSimulation: false,
            shouldShowPurchaseDelete: false
        };
    }

    function getTaxRegimeUiVisibility(companyInfo) {
        const resolved = (companyInfo && typeof companyInfo === 'object') ? companyInfo : getCurrentCompanyInfo();
        if (window.TaxRegimePolicy && typeof window.TaxRegimePolicy.getUiVisibility === 'function') {
            return window.TaxRegimePolicy.getUiVisibility(resolved);
        }
        return {
            showForfettarioFields: false,
            showOrdinarioFields: false,
            showLmMenu: false,
            showOrdinarioMenu: false,
            showVatRegistersMenu: false,
            showSuppliersMenu: false,
            showPurchasesMenu: false,
            showPurchaseDelete: false,
            scadenziario: { showPurchasePayments: false, showVatDeadlines: false }
        };
    }

    window.getCurrentCompanyInfo = getCurrentCompanyInfo;
    window.getTaxRegimeCapabilities = getTaxRegimeCapabilities;
    window.getTaxRegimeUiVisibility = getTaxRegimeUiVisibility;
})();
