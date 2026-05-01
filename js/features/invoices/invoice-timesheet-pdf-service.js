(function () {
  window.InvoiceTimesheetPdfService = window.InvoiceTimesheetPdfService || {};

  function escText(v) {
    return String(v == null ? '' : v)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  function splitText(text, maxLen) {
    const src = String(text == null ? '' : text).replace(/\r/g, '');
    if (!src.trim()) return [''];
    const lines = [];
    src.split('\n').forEach(function (line) {
      const words = line.split(/\s+/);
      let current = '';
      words.forEach(function (word) {
        const candidate = current ? (current + ' ' + word) : word;
        if (candidate.length <= maxLen) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          while (word.length > maxLen) {
            lines.push(word.slice(0, maxLen));
            word = word.slice(maxLen);
          }
          current = word;
        }
      });
      if (current) lines.push(current);
      if (!line.trim()) lines.push('');
    });
    return lines.length ? lines : [''];
  }

  function buildPrintableLines(dataset) {
    const lines = [];
    lines.push('Dettaglio Timesheet allegato alla fattura');
    lines.push('Documento: ' + (dataset.invoiceType || 'Fattura') + ' ' + (dataset.invoiceNumber || ''));
    lines.push('Data documento: ' + (dataset.invoiceDate || ''));
    lines.push('Cliente: ' + (dataset.customerName || ''));
    if (dataset.fromDate || dataset.toDate) {
      lines.push('Periodo: ' + (dataset.fromDate || '') + (dataset.toDate ? ' - ' + dataset.toDate : ''));
    }
    lines.push('Totale ore: ' + (dataset.totalHoursText || '0:00'));
    lines.push('');
    lines.push('Data | Commessa | Progetto | Ore | Note');
    lines.push('-----------------------------------------------------------------------');
    (dataset.rows || []).forEach(function (row, idx) {
      lines.push((idx + 1) + '. ' + [row.date || '', row.commessa || '-', row.progetto || '-', row.ore || '0:00'].join(' | '));
      if (row.note) {
        splitText('Note: ' + row.note, 92).forEach(function (line) { lines.push('   ' + line); });
      }
      lines.push('');
    });
    lines.push('Allegato descrittivo di supporto alla fattura elettronica.');
    return lines;
  }

  function createPdfString(lines) {
    const width = 595;
    const height = 842;
    const marginLeft = 36;
    const marginTop = 40;
    const lineHeight = 14;
    const maxLinesPerPage = 52;
    const pages = [];
    for (let i = 0; i < lines.length; i += maxLinesPerPage) pages.push(lines.slice(i, i + maxLinesPerPage));
    const objects = {};
    const pageCount = pages.length || 1;
    const fontId = 3 + pageCount * 2;
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    const kids = [];
    pages.forEach(function (pageLines, idx) {
      const pageId = 3 + idx * 2;
      const contentId = 4 + idx * 2;
      kids.push(pageId + ' 0 R');
      let content = 'BT\n/F1 10 Tf\n';
      const yStart = height - marginTop;
      pageLines.forEach(function (line, lineIdx) {
        const y = yStart - lineIdx * lineHeight;
        content += '1 0 0 1 ' + marginLeft + ' ' + y + ' Tm (' + escText(line) + ') Tj\n';
      });
      content += 'ET';
      objects[contentId] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
      objects[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + width + ' ' + height + '] /Resources << /Font << /F1 ' + fontId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>';
    });
    objects[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pageCount + ' >>';
    objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    const maxId = Math.max.apply(null, Object.keys(objects).map(function (v) { return parseInt(v, 10); }));
    for (let id = 1; id <= maxId; id++) {
      offsets[id] = pdf.length;
      pdf += id + ' 0 obj\n' + objects[id] + '\nendobj\n';
    }
    const xrefPos = pdf.length;
    pdf += 'xref\n';
    pdf += '0 ' + (maxId + 1) + '\n';
    pdf += '0000000000 65535 f \n';
    for (let id = 1; id <= maxId; id++) {
      pdf += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
    }
    pdf += 'trailer\n<< /Size ' + (maxId + 1) + ' /Root 1 0 R >>\n';
    pdf += 'startxref\n' + xrefPos + '\n%%EOF';
    return pdf;
  }

  function createAttachment(dataset, filename) {
    const lines = buildPrintableLines(dataset);
    const pdfString = createPdfString(lines);
    return {
      filename: filename,
      format: 'PDF',
      mimeType: 'application/pdf',
      base64: btoa(pdfString)
    };
  }

  window.InvoiceTimesheetPdfService.buildPrintableLines = buildPrintableLines;
  window.InvoiceTimesheetPdfService.createAttachment = createAttachment;
})();
