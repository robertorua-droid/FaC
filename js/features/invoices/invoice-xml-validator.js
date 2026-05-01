(function () {
  window.InvoiceXMLValidator = window.InvoiceXMLValidator || {};


  function pickFirst() {
    for (let i = 0; i < arguments.length; i++) {
      const value = arguments[i];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  function resolveAddressData(entity) {
    const e = entity || {};
    return {
      address: pickFirst(e.address, e.indirizzo, e.street),
      cap: pickFirst(e.cap, e.zip, e.postalCode),
      comune: pickFirst(e.comune, e.city, e.town)
    };
  }

  function hasFiscalIdentifier(entity) {
    const e = entity || {};
    return !!pickFirst(e.piva, e.partitaIva, e.vatNumber, e.codiceFiscale, e.cf, e.taxCode);
  }

  function hasCompanyIdentity(company) {
    const c = company || {};
    return !!pickFirst(c.name, c.ragioneSociale, c.nome, c.firstName, c.cognome, c.lastName);
  }

  function isMeaningfulLine(line) {
    if (!line) return false;
    const desc = String(line.productName || '').trim().toLowerCase();
    if (!desc) return false;
    return desc !== 'rivalsa bollo';
  }

  function hasCustomerIdentity(customer) {
    const c = customer || {};
    return !!String(c.name || c.ragioneSociale || '').trim() || (!!String(c.nome || '').trim() && !!String(c.cognome || '').trim());
  }

  function validateExportContext(input) {
    if (window.InvoiceValidationService && typeof window.InvoiceValidationService.validateXmlContext === 'function') {
      const base = window.InvoiceValidationService.validateXmlContext(input);
      if (!base || !base.ok) return base;
    }

    const data = input || {};
    const rawInvoice = data.invoice || {};
    const invoice = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCreditNoteInfo === 'function')
      ? window.DomainNormalizers.normalizeCreditNoteInfo(rawInvoice)
      : rawInvoice;
    const rawCustomer = data.customer || {};
    const customer = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCustomerInfo === 'function')
      ? window.DomainNormalizers.normalizeCustomerInfo(rawCustomer)
      : rawCustomer;
    const rawCompany = data.company || {};
    const company = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCompanyInfo === 'function')
      ? window.DomainNormalizers.normalizeCompanyInfo(rawCompany)
      : rawCompany;

    if (!String(invoice.number || '').trim()) {
      return { ok: false, message: 'Numero documento mancante: completa la fattura prima di esportare XML.' };
    }
    if (!String(invoice.date || '').trim()) {
      return { ok: false, message: 'Data documento mancante: completa la fattura prima di esportare XML.' };
    }
    if (!hasCustomerIdentity(customer)) {
      return { ok: false, message: 'Cliente incompleto: manca la denominazione oppure il nome/cognome del cessionario/committente per il file XML.' };
    }
    if (!hasFiscalIdentifier(customer)) {
      return { ok: false, message: 'Cliente incompleto: indica almeno un identificativo fiscale (P.IVA o Codice Fiscale) prima dell\'export XML.' };
    }
    const customerAddress = resolveAddressData(customer);
    if (!customerAddress.address || !customerAddress.cap || !customerAddress.comune) {
      return { ok: false, message: 'Cliente incompleto: per il file XML servono indirizzo, CAP e comune del cessionario/committente.' };
    }
    if (!Array.isArray(invoice.lines) || !invoice.lines.some(isMeaningfulLine)) {
      return { ok: false, message: 'Il documento non contiene righe descrittive esportabili nel file XML.' };
    }
    if (!String(company.codiceRegimeFiscale || '').trim()) {
      return { ok: false, message: 'Compila il codice regime fiscale azienda prima di esportare XML.' };
    }
    const companyAddress = resolveAddressData(company);
    if (!companyAddress.address || !companyAddress.cap || !companyAddress.comune) {
      return { ok: false, message: 'Dati azienda incompleti: per l\'XML servono indirizzo, CAP e comune del cedente/prestatore.' };
    }
    const paymentInfo = (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoicePaymentInfo === 'function')
      ? window.DomainNormalizers.normalizeInvoicePaymentInfo(invoice, company)
      : null;
    const paymentMethod = String((paymentInfo && paymentInfo.modalitaPagamento) || invoice.modalitaPagamento || '').trim().toLowerCase();
    const isBonifico = !!(paymentInfo && paymentInfo.isBonifico) || paymentMethod.includes('bonifico') || paymentMethod === 'rimessa diretta';
    if (isBonifico) {
      const iban = String((paymentInfo ? paymentInfo.ibanSelezionato : pickFirst(company.iban1, company.iban)) || '').replace(/\s+/g, '').trim();
      if (!iban) {
        return { ok: false, message: 'Dati pagamento incompleti: per l\'XML con bonifico serve un IBAN aziendale valorizzato.' };
      }
    }
    if (String(invoice.type || '') === 'Nota di Credito') {
      const linked = String(invoice.linkedInvoice || '').trim();
      const reason = String(invoice.reason || '').trim();
      if (!linked && !reason) {
        return { ok: false, message: 'Nota di credito incompleta: indica almeno il documento collegato o una causale prima dell\'export XML.' };
      }
      if (linked && linked.length < 3) {
        return { ok: false, message: 'Documento collegato troppo corto: per la nota di credito inserisci un riferimento riconoscibile (es. numero fattura).' };
      }
    }

    return { ok: true };
  }

  window.InvoiceXMLValidator.validateExportContext = validateExportContext;
})();
