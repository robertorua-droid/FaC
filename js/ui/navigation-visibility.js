// navigation-visibility.js

function _toggleMenuItem($link, isVisible) {
    const $item = $link.closest('li');
    if (!$item.length) return;
    $item.toggleClass('d-none', !isVisible);
}

function _toggleBlockWithInputs($block, isVisible) {
    if (!$block.length) return;
    $block.toggleClass('d-none', !isVisible);
    $block.find('input, select, textarea, button').prop('disabled', !isVisible);
}

function _toggleScadenziarioFilter($checkbox, isVisible) {
    if (!$checkbox.length) return;
    if (!isVisible) $checkbox.prop('checked', false);
    $checkbox.prop('disabled', !isVisible)
        .closest('.form-check')
        .toggleClass('d-none', !isVisible);
}

function updateCompanyUI() {
    const company = getCurrentCompanyInfo();
    const sidebarName = String((company && (company.name || company.ragioneSociale || company.denominazione || company.nomeStudio)) || '').trim();
    $('#company-name-sidebar').text(sidebarName || 'MIO STUDIO');
    if (currentUser && currentUser.email) $('#user-name-sidebar').text(currentUser.email);

    const regimeCapabilities = getTaxRegimeCapabilities(company);
    const regimeUi = getTaxRegimeUiVisibility(company);

    const $lmLink = $('#menu-simulazione-lm').length ? $('#menu-simulazione-lm') : $('.sidebar .nav-link[data-target="simulazione-lm"]');
    const $ordLink = $('#menu-simulazione-ordinario').length ? $('#menu-simulazione-ordinario') : $('.sidebar .nav-link[data-target="simulazione-ordinario"]');
    const $ivaLink = $('#menu-registri-iva').length ? $('#menu-registri-iva') : $('.sidebar .nav-link[data-target="registri-iva"]');
    const $fornLink = $('#menu-fornitori').length ? $('#menu-fornitori') : $('.sidebar .nav-link[data-target="anagrafica-fornitori"]');
    const $acqTitleItem = $('#menu-acquisti-title').length ? $('#menu-acquisti-title') : $('.sidebar .nav-section-title').filter(function () { return $(this).text().trim() === 'Acquisti'; }).closest('li');
    const $acqNewLink = $('#menu-nuovo-acquisto').length ? $('#menu-nuovo-acquisto') : $('.sidebar .nav-link[data-target="nuovo-acquisto"]');
    const $acqListLink = $('#menu-elenco-acquisti').length ? $('#menu-elenco-acquisti') : $('.sidebar .nav-link[data-target="elenco-acquisti"]');

    _toggleMenuItem($lmLink, regimeUi.showLmMenu);
    _toggleMenuItem($ordLink, regimeUi.showOrdinarioMenu);
    _toggleMenuItem($ivaLink, regimeCapabilities.canUseVatRegisters);
    _toggleMenuItem($fornLink, regimeUi.showSuppliersMenu);
    $acqTitleItem.toggleClass('d-none', !regimeUi.showPurchasesMenu);
    _toggleMenuItem($acqNewLink, regimeUi.showPurchasesMenu);
    _toggleMenuItem($acqListLink, regimeUi.showPurchasesMenu);

    $('#section-acquisti').toggleClass('d-none', !regimeCapabilities.canManagePurchases);
    _toggleBlockWithInputs($('#delete-purchases-year-block'), regimeUi.showPurchaseDelete);

    const scadenziarioVisibility = regimeUi.scadenziario || { showPurchasePayments: false, showVatDeadlines: false };
    _toggleScadenziarioFilter($('#scad-show-pagamenti'), scadenziarioVisibility.showPurchasePayments);
    _toggleScadenziarioFilter($('#scad-show-iva'), scadenziarioVisibility.showVatDeadlines);
    _toggleScadenziarioFilter($('#scad-show-iva-crediti'), scadenziarioVisibility.showVatDeadlines);

    $('#tax-simulation-section').toggleClass('d-none', !regimeCapabilities.isForfettario);
    if (!regimeCapabilities.isForfettario) $('#tax-simulation-container').empty();
}

window.updateCompanyUI = updateCompanyUI;
window.renderNavigationVisibility = updateCompanyUI;
