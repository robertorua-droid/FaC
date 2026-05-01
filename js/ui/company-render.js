// company-render.js

function renderCompanyInfoForm(companyInfo) {
    const rawCompanyInfo = companyInfo || (window.AppStore ? (window.AppStore.get('companyInfo') || {}) : getCurrentCompanyInfo());
    const resolvedCompanyInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function')
        ? window.DomainNormalizers.normalizeCompanyInfo(rawCompanyInfo)
        : rawCompanyInfo;
    for (const key in resolvedCompanyInfo) {
        $(`#company-${key}`).val(resolvedCompanyInfo[key]);
    }

    if (window.TaxRegimePolicy && !window.TaxRegimePolicy.normalizeTaxRegime(resolvedCompanyInfo.taxRegime)) {
        const derivedRegime = window.TaxRegimePolicy.resolve(resolvedCompanyInfo);
        if (derivedRegime) {
            try { $('#company-taxRegime').val(derivedRegime); } catch (e) { }
        }
    }

    if (typeof window.applyCompanyTaxRegimeVisibility === 'function') {
        window.applyCompanyTaxRegimeVisibility();
    }
}

window.renderCompanyInfoForm = renderCompanyInfoForm;
