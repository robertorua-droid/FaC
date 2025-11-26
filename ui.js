function renderInvoicesTable() {
    const table = $('#invoices-table-body').empty();
    const invoices = getData('invoices').sort((a, b) => (b.number || '').localeCompare(a.number || ''));
    
    invoices.forEach(inv => {
        const c = getData('customers').find(cust => String(cust.id) === String(inv.customerId)) || { name: 'Sconosciuto' };
        const isPaid = inv.status === 'Pagata' || inv.status === 'Emessa';
        
        const badge = inv.type === 'Nota di Credito' ? '<span class="badge bg-warning text-dark">NdC</span>' : '<span class="badge bg-primary">Fatt.</span>';
        
        // IMPORTANTE: data-id="${inv.id}" deve essere presente in tutti i bottoni
        const btns = `
            <div class="d-flex justify-content-end gap-1">
                <button class="btn btn-sm btn-info btn-view-invoice text-white" data-id="${inv.id}" data-bs-toggle="modal" data-bs-target="#invoiceDetailModal"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm ${isPaid?'btn-secondary':'btn-secondary'} btn-edit-invoice" data-id="${inv.id}" ${isPaid?'disabled':''}><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-warning btn-export-xml-row" data-id="${inv.id}"><i class="fas fa-file-code"></i></button>
                <button class="btn btn-sm ${isPaid?'btn-secondary':'btn-success'} btn-mark-paid" data-id="${inv.id}" ${isPaid?'disabled':''}><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-danger btn-delete-invoice" data-id="${inv.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        const total = (parseFloat(inv.total) || 0).toFixed(2);
        table.append(`<tr class="${isPaid?'table-light text-muted':''}"><td>${badge}</td><td class="fw-bold">${inv.number}</td><td>${formatDateForDisplay(inv.date)}</td><td>${c.name}</td><td class="text-end">€ ${total}</td><td class="text-end">${formatDateForDisplay(inv.dataScadenza)}</td><td>${inv.status}</td><td class="text-end">${btns}</td></tr>`);
    });
}