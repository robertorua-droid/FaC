(function () {
  function resolveCompanyInfo(companyInfo) {
    return companyInfo || (typeof getCurrentCompanyInfo === 'function' ? getCurrentCompanyInfo() : {});
  }

  function refreshNavigationArea(companyInfo) {
    const info = resolveCompanyInfo(companyInfo);
    if (typeof renderNavigationVisibility === 'function') renderNavigationVisibility(info);
  }

  function refreshCompanyArea(companyInfo) {
    const info = resolveCompanyInfo(companyInfo);
    if (typeof renderCompanyInfoForm === 'function') renderCompanyInfoForm(info);
    refreshNavigationArea(info);
  }

  function refreshMasterDataArea() {
    if (typeof renderMasterDataArea === 'function') renderMasterDataArea();
  }

  function refreshSalesArea() {
    if (typeof refreshInvoiceYearFilter === 'function') refreshInvoiceYearFilter();
    if (typeof refreshInvoiceCustomerFilter === 'function') refreshInvoiceCustomerFilter();
    if (typeof refreshInvoiceStatusFilter === 'function') refreshInvoiceStatusFilter();
    if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
  }

  function refreshPurchasesArea(companyInfo) {
    const info = resolveCompanyInfo(companyInfo);
    if (typeof renderPurchasesArea === 'function') renderPurchasesArea(info);
  }

  function refreshScadenziarioArea() {
    if (typeof renderScadenziarioPage === 'function') renderScadenziarioPage();
  }

  function refreshAnalysisArea(companyInfo) {
    const info = resolveCompanyInfo(companyInfo);
    if (typeof renderAnalysisArea === 'function') renderAnalysisArea(info);
  }

  function refreshInvoicesAndAnalysis(companyInfo) {
    refreshSalesArea();
    refreshAnalysisArea(companyInfo);
  }

  function refreshSalesAndScadenziario(companyInfo) {
    refreshSalesArea();
    refreshScadenziarioArea();
    refreshAnalysisArea(companyInfo);
  }

  function refreshInvoicesAnalysisAndScadenziario(companyInfo) {
    refreshSalesAndScadenziario(companyInfo);
  }

  function refreshPurchasesAndAnalysis(companyInfo) {
    refreshPurchasesArea(companyInfo);
    refreshAnalysisArea(companyInfo);
  }

  function refreshPurchasesAnalysisAndScadenziario(companyInfo) {
    refreshPurchasesArea(companyInfo);
    refreshScadenziarioArea();
    refreshAnalysisArea(companyInfo);
  }

  function refreshCompanyAndDependentAreas(companyInfo) {
    const info = resolveCompanyInfo(companyInfo);
    refreshCompanyArea(info);
    refreshSalesArea();
    refreshPurchasesArea(info);
    refreshScadenziarioArea();
    refreshAnalysisArea(info);
  }

  window.UiRefresh = {
    refreshNavigationArea,
    refreshCompanyArea,
    refreshMasterDataArea,
    refreshSalesArea,
    refreshPurchasesArea,
    refreshScadenziarioArea,
    refreshAnalysisArea,
    refreshInvoicesAndAnalysis,
    refreshSalesAndScadenziario,
    refreshInvoicesAnalysisAndScadenziario,
    refreshPurchasesAndAnalysis,
    refreshPurchasesAnalysisAndScadenziario,
    refreshCompanyAndDependentAreas
  };
})();
