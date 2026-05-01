// masterdata-render.js

function getStoreValue(key, fallback) {
    if (window.AppStore && typeof window.AppStore.get === 'function') {
        const value = window.AppStore.get(key);
        if (value !== undefined && value !== null) return value;
    }
    if (typeof window.getData === 'function') return window.getData(key);
    return fallback;
}

// Bind (una sola volta) dei campi ricerca per Anagrafiche (Clienti/Fornitori)
let __anagraficheSearchBound = false;
function bindAnagraficheSearchOnce() {
    if (__anagraficheSearchBound) return;
    __anagraficheSearchBound = true;

    $('#customers-search-filter').off('input.custSearch').on('input.custSearch', function () {
        if (typeof renderCustomersTable === 'function') renderCustomersTable();
    });
    $('#customers-reset-search-btn').off('click.custSearch').on('click.custSearch', function () {
        try { $('#customers-search-filter').val(''); } catch (e) { }
        if (typeof renderCustomersTable === 'function') renderCustomersTable();
    });

    $('#suppliers-search-filter').off('input.supSearch').on('input.supSearch', function () {
        if (typeof renderSuppliersTable === 'function') renderSuppliersTable();
    });
    $('#suppliers-reset-search-btn').off('click.supSearch').on('click.supSearch', function () {
        try { $('#suppliers-search-filter').val(''); } catch (e) { }
        if (typeof renderSuppliersTable === 'function') renderSuppliersTable();
    });
}

function renderProductsTable() {
    const table = $('#products-table-body').empty();
    const ci = getStoreValue('companyInfo', {}) || {};
    const isForf = window.TaxRegimePolicy ? window.TaxRegimePolicy.isForfettario(ci) : false;
    (getStoreValue('products', []) || []).forEach(p => {
        const price = parseFloat(p.salePrice || 0).toFixed(2);
        table.append(`
<tr>
  <td>${p.code || ''}</td>
  <td>${p.description || ''}</td>
  <td class="text-end-numbers col-price pe-5">€ ${price}</td>
  <td class="text-end-numbers">${(isForf ? '0' : (p.iva || '0'))}%</td>
  <td class="text-end col-actions">
    <button class="btn btn-sm btn-outline-secondary btn-edit-product" data-id="${p.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${p.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
    });
}

function renderCustomersTable() {
    const table = $('#customers-table-body').empty();
    const q = String($('#customers-search-filter').val() || '').trim().toLowerCase();

    let customers = (getStoreValue('customers', []) || []).slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    if (q) {
        customers = customers.filter(c => {
            const name = String(c.name || '').toLowerCase();
            const piva = String(c.piva || '').toLowerCase();
            const sdi = String(c.sdi || '').toLowerCase();
            const addr = String(c.address || '').toLowerCase();
            return name.includes(q) || piva.includes(q) || sdi.includes(q) || addr.includes(q);
        });
    }

    customers.forEach(c => {
        table.append(`
<tr>
  <td>${c.name || ''}</td>
  <td>${c.piva || ''}</td>
  <td>${c.sdi || '-'}</td>
  <td>${c.address || ''}</td>
  <td class="text-end">
    <button class="btn btn-sm btn-outline-secondary btn-edit-customer" data-id="${c.id}"><i class="fas fa-edit"></i></button>
    <button class="btn btn-sm btn-outline-danger btn-delete-customer" data-id="${c.id}"><i class="fas fa-trash"></i></button>
  </td>
</tr>`);
    });
}

function renderSuppliersTable() {
    const table = $('#suppliers-table-body');
    if (!table.length) return;
    table.empty();

    const q = String($('#suppliers-search-filter').val() || '').trim().toLowerCase();

    let suppliers = (getStoreValue('suppliers', []) || [])
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    if (q) {
        suppliers = suppliers.filter(s => {
            const name = String(s.name || '').toLowerCase();
            const piva = String(s.piva || '').toLowerCase();
            const pec = String(s.pec || '').toLowerCase();
            return name.includes(q) || piva.includes(q) || pec.includes(q);
        });
    }

    suppliers.forEach(s => {
        table.append(`
            <tr>
                <td>${s.name || ''}</td>
                <td>${s.piva || ''}</td>
                <td>${s.pec || ''}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary btn-edit-supplier" data-id="${s.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-supplier" data-id="${s.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `);
    });
}

window.bindAnagraficheSearchOnce = bindAnagraficheSearchOnce;
window.renderProductsTable = renderProductsTable;
window.renderCustomersTable = renderCustomersTable;
window.renderSuppliersTable = renderSuppliersTable;
