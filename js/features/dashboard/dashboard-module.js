// js/features/dashboard/dashboard-module.js
// Dashboard KPI (Annuale/Mensile) - modulo separato

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.dashboard = window.AppModules.dashboard || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    // Toggle mese
    function syncMonthVisibility() {
      const mode = String($('#dash-mode').val() || 'year');
      if (mode === 'month') {
        $('#dash-month-wrap').show();
      } else {
        $('#dash-month-wrap').hide();
      }
    }

    // Handlers
    $('#dash-mode').on('change', function () {
      syncMonthVisibility();
      if (typeof renderDashboardPage === 'function') renderDashboardPage();
    });

    $('#dash-year, #dash-month').on('change', function () {
      if (typeof renderDashboardPage === 'function') renderDashboardPage();
    });

    $('#dash-refresh-btn').on('click', function () {
      if (typeof renderDashboardPage === 'function') renderDashboardPage();
    });

    // Stato iniziale
    syncMonthVisibility();
  }

  window.AppModules.dashboard.bind = bind;
})();
