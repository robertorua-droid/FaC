// js/features/tax/ordinario-sim-module.js

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.ordinarioSim = window.AppModules.ordinarioSim || {};

  let _bound = false;

  function bind() {
    if (_bound) return;
    _bound = true;

    const rerender = () => {
      try {
        if (typeof renderOrdinarioSimPage === 'function') renderOrdinarioSimPage();
      } catch (e) {
        console.error('renderOrdinarioSimPage error', e);
      }
    };

    // Filtri / input pagina
    $('#ord-year-select, #ord-only-paid, #ord-include-bollo, #ord-inps-aliquota, #ord-inps-versati, #ord-detrazioni, #ord-crediti, #ord-acconti-irpef').on('change', rerender);
    $('#ord-refresh-btn').on('click', rerender);
  }

  window.AppModules.ordinarioSim.bind = bind;
})();
