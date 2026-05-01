
// js/core/app-store.js
// Store applicativo minimo, compatibile con globalData legacy.
(function () {
  const listeners = {};

  function cloneValue(value) {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === 'object') return { ...value };
    return value;
  }

  function ensureGlobalData() {
    if (!window.globalData) {
      window.globalData = {
        companyInfo: {},
        products: [],
        customers: [],
        suppliers: [],
        purchases: [],
        invoices: [],
        notes: [],
        commesse: [],
        projects: [],
        worklogs: []
      };
    }
    return window.globalData;
  }

  function notify(key) {
    const store = ensureGlobalData();
    const callbacks = listeners[key] || [];
    const wildcard = listeners['*'] || [];
    const payload = cloneValue(store[key]);
    callbacks.forEach(cb => {
      try { cb(payload, key, store); } catch (e) { console.warn('AppStore listener error:', e); }
    });
    wildcard.forEach(cb => {
      try { cb(key, payload, store); } catch (e) { console.warn('AppStore wildcard listener error:', e); }
    });
  }

  const AppStore = {
    get(key) {
      const store = ensureGlobalData();
      return key ? store[key] : store;
    },

    set(key, value, options = {}) {
      const store = ensureGlobalData();
      store[key] = value;
      if (!options.silent) notify(key);
      return store[key];
    },

    update(key, updater, options = {}) {
      const store = ensureGlobalData();
      const current = store[key];
      store[key] = (typeof updater === 'function') ? updater(current) : updater;
      if (!options.silent) notify(key);
      return store[key];
    },

    mergeItem(collection, id, dataObj, options = {}) {
      const store = ensureGlobalData();
      if (!Array.isArray(store[collection])) store[collection] = [];
      const strId = String(id);
      const idx = store[collection].findIndex(item => String(item.id) === strId);
      if (idx > -1) store[collection][idx] = { ...store[collection][idx], ...dataObj };
      else store[collection].push({ id: strId, ...dataObj });
      if (!options.silent) notify(collection);
      return store[collection];
    },

    removeItem(collection, id, options = {}) {
      const store = ensureGlobalData();
      if (!Array.isArray(store[collection])) return [];
      const strId = String(id);
      store[collection] = store[collection].filter(item => String(item.id) !== strId);
      if (!options.silent) notify(collection);
      return store[collection];
    },

    subscribe(key, callback) {
      listeners[key] = listeners[key] || [];
      listeners[key].push(callback);
      return () => {
        listeners[key] = (listeners[key] || []).filter(cb => cb !== callback);
      };
    },

    notify,

    snapshot() {
      return cloneValue(ensureGlobalData());
    }
  };

  window.AppStore = AppStore;
})();
