// Funzioni di Utilità
function formatDateForDisplay(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; 
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function escapeXML(str) { 
    if (typeof str !== 'string') return ''; 
    return str.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]); 
}

function getNextId(items) { 
    if (!items || items.length === 0) return 1;
    const numericIds = items.map(i => parseInt(i.id)).filter(id => !isNaN(id));
    return numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1; 
}

function toggleEsenzioneIvaField(container, ivaValue) { 
    const div = (container === 'product') ? $('#esenzione-iva-container') : $('#invoice-esenzione-iva-container'); 
    if (ivaValue == '0') div.removeClass('d-none'); else div.addClass('d-none'); 
}