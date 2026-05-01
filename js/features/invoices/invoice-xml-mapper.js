(function () {
  window.InvoiceXMLMapper = window.InvoiceXMLMapper || {};

  const C = window.DomainConstants || {};
  const INVOICE_NATURE_FORFETTARIO = (C.INVOICE_NATURES && C.INVOICE_NATURES.FORFETTARIO) || 'N2.2';
  const DEFAULT_IVA_ORDINARIO = (C.COMPANY_DEFAULTS && C.COMPANY_DEFAULTS.IVA_ORDINARIO) || 22;

  function sf(v) {
    if (typeof window.safeFloat === 'function') return window.safeFloat(v);
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function esc(v) {
    if (typeof window.escapeXML === 'function') return window.escapeXML(v || '');
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function normalizeCountry(v) {
    if (typeof window.normalizeCountryCode === 'function') return window.normalizeCountryCode(v);
    return String(v || 'IT').trim().toUpperCase() || 'IT';
  }

  function pickFirst() {
    for (let i = 0; i < arguments.length; i++) {
      const value = arguments[i];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  function resolveAddressData(entity, kind) {
    const e = entity || {};
    const isCompany = kind === 'company';
    return {
      address: pickFirst(e.address, e.indirizzo, e.street),
      numeroCivico: pickFirst(e.numeroCivico, e.number, e.civicNumber),
      cap: pickFirst(e.zip, e.cap, e.postalCode),
      comune: pickFirst(e.city, e.comune, e.town),
      provincia: pickFirst(e.provincia, e.province, e.siglaProvincia),
      nazione: normalizeCountry(pickFirst(e.nazione, e.country, isCompany ? 'IT' : 'IT'))
    };
  }

  function resolveCustomerIdentity(customer) {
    const c = customer || {};
    const nome = pickFirst(c.nome, c.firstName);
    const cognome = pickFirst(c.cognome, c.lastName);
    const denominazione = pickFirst(c.name, c.ragioneSociale, [nome, cognome].filter(Boolean).join(' '));
    return {
      nome: nome,
      cognome: cognome,
      denominazione: denominazione,
      piva: pickFirst(c.piva, c.partitaIva, c.vatNumber),
      codiceFiscale: pickFirst(c.codiceFiscale, c.cf, c.taxCode)
    };
  }

  function resolveCompanyIdentity(company) {
    const c = company || {};
    const nome = pickFirst(c.nome, c.firstName);
    const cognome = pickFirst(c.cognome, c.lastName);
    const denominazione = pickFirst(c.name, c.ragioneSociale, [nome, cognome].filter(Boolean).join(' '));
    return {
      nome: nome,
      cognome: cognome,
      denominazione: denominazione,
      piva: pickFirst(c.piva, c.partitaIva, c.vatNumber),
      codiceFiscale: pickFirst(c.codiceFiscale, c.cf, c.taxCode)
    };
  }


  function splitCausali(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const chunks = [];
    for (let i = 0; i < text.length; i += 200) {
      chunks.push(text.slice(i, i + 200));
    }
    return chunks;
  }

  function buildCustomerAnagraficaXml(customer) {
    const identity = resolveCustomerIdentity(customer);
    if (identity.nome && identity.cognome) {
      return '<Anagrafica>\n' +
        '\t<Nome>' + esc(identity.nome) + '</Nome>\n' +
        '\t<Cognome>' + esc(identity.cognome) + '</Cognome>\n' +
        '</Anagrafica>';
    }
    return '<Anagrafica><Denominazione>' + esc(identity.denominazione || '') + '</Denominazione></Anagrafica>';
  }


  function buildCompanyAnagraficaXml(company) {
    const identity = resolveCompanyIdentity(company);
    if (identity.nome && identity.cognome) {
      return '<Anagrafica>\n' +
        '\t<Nome>' + esc(identity.nome) + '</Nome>\n' +
        '\t<Cognome>' + esc(identity.cognome) + '</Cognome>\n' +
        '</Anagrafica>';
    }
    return '<Anagrafica><Denominazione>' + esc(identity.denominazione || '') + '</Denominazione></Anagrafica>';
  }


  function buildGeneralCausaliXml(invoice, isForfettario, rifNormForfettario) {
    const out = [];
    if (String(invoice.type || '') === 'Nota di Credito') {
      if (String(invoice.linkedInvoice || '').trim()) {
        out.push('Nota di credito collegata al documento ' + String(invoice.linkedInvoice).trim());
      }
      if (String(invoice.reason || '').trim()) {
        out.push(String(invoice.reason).trim());
      }
    }
    if (isForfettario) out.push(rifNormForfettario);
    return out.reduce(function (acc, item) {
      return acc.concat(splitCausali(item));
    }, []).map(function (line) {
      return '\t\t\t\t<Causale>' + esc(line) + '</Causale>\n';
    }).join('');
  }

  function buildInvoiceXmlPayload(params) {
    const rawInvoice = params.invoice || {};
    const company = params.company || {};
    let invoice = rawInvoice;
    if (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeCreditNoteInfo === 'function') {
      invoice = window.DomainNormalizers.normalizeCreditNoteInfo(invoice);
    }
    if (window.DomainNormalizers && typeof window.DomainNormalizers.normalizeInvoicePaymentInfo === 'function') {
      invoice = window.DomainNormalizers.normalizeInvoicePaymentInfo(invoice, company);
    }
    const customer = params.customer || {};
    const calc = params.calc;
    const bolloAcaricoEmittente = !!params.bolloAcaricoEmittente;
    const attachments = Array.isArray(params.attachments) ? params.attachments : [];
    const companyIdentity = resolveCompanyIdentity(company);
    const customerIdentity = resolveCustomerIdentity(customer);
    const companyAddress = resolveAddressData(company, 'company');
    const customerAddress = resolveAddressData(customer, 'customer');

    if (!calc) throw new Error('Calcolo documento mancante per XML');

    const tipoDocumento = invoice.type === 'Nota di Credito' ? 'TD04' : 'TD01';
    const isNotaCredito = invoice.type === 'Nota di Credito';
    const signed = function (v) {
      const n = sf(v);
      if (!isNotaCredito) return n;
      return n > 0 ? -n : n;
    };
    const signedQty = function (q) {
      const n = sf(q);
      if (!isNotaCredito) return n;
      return n > 0 ? -n : n;
    };

    const totalePrestazioni = calc.totPrest;
    const importoRivalsa = calc.riv;
    const totaleDocumento = calc.totDoc;
    const impBolloEff = calc.impBollo;
    const ritenutaAcconto = calc.ritenuta;
    const nettoDaPagare = calc.nettoDaPagare;
    const isForfettario = calc.isForfettario;
    const ivaAzienda = sf(company.aliquotaIva || company.aliquotaIVA || DEFAULT_IVA_ORDINARIO);
    const aliqRitenuta = sf(company.aliquotaRitenuta || 20);
    const naturaForfettario = INVOICE_NATURE_FORFETTARIO;
    const rifNormForfettario = "Operazione in franchigia da IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014";

    let datiRitenutaXml = '';
    if (ritenutaAcconto > 0) {
      datiRitenutaXml =
        `<DatiRitenuta>\n` +
        `\t<TipoRitenuta>RT01</TipoRitenuta>\n` +
        `\t<ImportoRitenuta>${signed(ritenutaAcconto).toFixed(2)}</ImportoRitenuta>\n` +
        `\t<AliquotaRitenuta>${aliqRitenuta.toFixed(2)}</AliquotaRitenuta>\n` +
        `\t<CausalePagamento>A</CausalePagamento>\n` +
        `</DatiRitenuta>`;
    }

    let datiBolloXml = '';
    if (impBolloEff > 0) {
      datiBolloXml =
        `<DatiBollo>\n` +
        `\t<BolloVirtuale>SI</BolloVirtuale>\n` +
        `\t<ImportoBollo>${impBolloEff.toFixed(2)}</ImportoBollo>\n` +
        `</DatiBollo>`;
    }

    let datiCassaXml = '';
    if (importoRivalsa > 0) {
      const aliqRiv = sf(company.aliquotaInps || company.aliquotaContributi || 0);
      const aliqIvaCassa = isForfettario ? 0 : ivaAzienda;
      const natCassa = isForfettario ? naturaForfettario : (aliqIvaCassa > 0 ? null : 'N4');
      datiCassaXml =
        `<DatiCassaPrevidenziale>\n` +
        `\t<TipoCassa>TC22</TipoCassa>\n` +
        `\t<AlCassa>${aliqRiv.toFixed(2)}</AlCassa>\n` +
        `\t<ImportoContributoCassa>${signed(importoRivalsa).toFixed(2)}</ImportoContributoCassa>\n` +
        `\t<ImponibileCassa>${signed(totalePrestazioni).toFixed(2)}</ImponibileCassa>\n` +
        `\t<AliquotaIVA>${aliqIvaCassa.toFixed(2)}</AliquotaIVA>\n` +
        (natCassa ? `\t<Natura>${esc(natCassa)}</Natura>\n` : ``) +
        (isForfettario ? `\t<RiferimentoNormativo>${esc(rifNormForfettario)}</RiferimentoNormativo>\n` : ``) +
        `</DatiCassaPrevidenziale>`;
    }

    let riepilogoXml = '';
    const vatMap = calc.vatMap || new Map();
    Array.from(vatMap.values())
      .sort(function (a, b) {
        return sf(a.aliquota) - sf(b.aliquota) || String(a.natura || '').localeCompare(String(b.natura || ''));
      })
      .forEach(function (s) {
        const aliq = sf(s.aliquota);
        const nat = s.natura;
        let rifNorm = null;
        if (isForfettario && nat === INVOICE_NATURE_FORFETTARIO) {
          rifNorm = rifNormForfettario;
        }
        riepilogoXml +=
          `\t\t\t<DatiRiepilogo>\n` +
          `\t\t\t\t<AliquotaIVA>${aliq.toFixed(2)}</AliquotaIVA>\n` +
          (aliq > 0 ? `` : `\t\t\t\t<Natura>${esc(nat || INVOICE_NATURE_FORFETTARIO)}</Natura>\n`) +
          (aliq > 0 || !rifNorm ? `` : `\t\t\t\t<RiferimentoNormativo>${esc(rifNorm)}</RiferimentoNormativo>\n`) +
          `\t\t\t\t<ImponibileImporto>${signed(s.imponibile || 0).toFixed(2)}</ImponibileImporto>\n` +
          `\t\t\t\t<Imposta>${signed(s.imposta || 0).toFixed(2)}</Imposta>\n` +
          (aliq > 0 ? `\t\t\t\t<EsigibilitaIVA>I</EsigibilitaIVA>\n` : ``) +
          `\t\t\t</DatiRiepilogo>\n`;
      });

    const progressivoInvio = (Math.random().toString(36) + '00000').slice(2, 7);
    const dataFattura = invoice.date || new Date().toISOString().slice(0, 10);
    const normalizeTP = function (v) {
      const s = String(v || '').trim().toUpperCase();
      return ['TP01', 'TP02', 'TP03'].includes(s) ? s : 'TP02';
    };
    const mapMetodoToMP = function (method) {
      const m = String(method || '').trim().toLowerCase();
      if (m === 'contanti') return 'MP01';
      if (m === 'assegno') return 'MP02';
      if (m.includes('bonifico')) return 'MP05';
      return 'MP05';
    };
    const cleanIban = function (iban) {
      return String(iban || '').replace(/\s+/g, '').trim();
    };

    const condizioniPagamentoTP = normalizeTP(invoice.condizioniPagamento);
    const metodoPagamentoUI = invoice.modalitaPagamento || 'Bonifico Bancario';
    const modalitaPagamentoMP = mapMetodoToMP(metodoPagamentoUI);
    const isBonifico = String(metodoPagamentoUI).trim().toLowerCase().includes('bonifico') ||
      String(metodoPagamentoUI).trim().toLowerCase() === 'rimessa diretta';

    let dataScadenza = invoice.dataScadenza || '';
    if (!dataScadenza && isBonifico && invoice.dataRiferimento) {
      const giorni = parseInt(invoice.giorniTermini, 10);
      const fineMese = invoice.fineMese === true || invoice.fineMese === 'true';
      const gfEnabled = invoice.giornoFissoEnabled === true || invoice.giornoFissoEnabled === 'true';
      const gfVal = parseInt(invoice.giornoFissoValue, 10);
      const d0 = new Date(invoice.dataRiferimento);
      if (!isNaN(d0.getTime())) {
        let d = new Date(d0);
        if (!isNaN(giorni)) d.setDate(d.getDate() + giorni);
        if (fineMese) d = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        if (gfEnabled && !isNaN(gfVal) && gfVal >= 1 && gfVal <= 31) {
          d = new Date(d.getFullYear(), d.getMonth(), Math.min(gfVal, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
        }
        dataScadenza = d.toISOString().slice(0, 10);
      }
    }
    if (!dataScadenza) dataScadenza = dataFattura;

    const bankChoice = String(invoice.bankChoice || '1');
    const bancaToUse = invoice.bancaSelezionata || '';
    const ibanToUse = cleanIban(invoice.ibanSelezionato || '');
    const sedeProvinciaCed = esc(String(companyAddress.provincia || '').toUpperCase());
    const sedeProvinciaDest = esc(String(customerAddress.provincia || '').toUpperCase());
    const anagraficaCedente = buildCompanyAnagraficaXml(company);

    let xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n` +
      `\t<FatturaElettronicaHeader>\n` +
      `\t\t<DatiTrasmissione>\n` +
      `\t\t\t<IdTrasmittente>\n` +
      `\t\t\t\t<IdPaese>IT</IdPaese>\n` +
      `\t\t\t\t<IdCodice>${esc(companyIdentity.codiceFiscale || companyIdentity.piva || '')}</IdCodice>\n` +
      `\t\t\t</IdTrasmittente>\n` +
      `\t\t\t<ProgressivoInvio>${progressivoInvio}</ProgressivoInvio>\n` +
      `\t\t\t<FormatoTrasmissione>FPR12</FormatoTrasmissione>\n` +
      `\t\t\t<CodiceDestinatario>${esc(customer.sdi || '0000000')}</CodiceDestinatario>\n` +
      (customer.pec ? `\t\t\t<PECDestinatario>${esc(customer.pec)}</PECDestinatario>\n` : ``) +
      `\t\t</DatiTrasmissione>\n` +
      `\t\t<CedentePrestatore>\n` +
      `\t\t\t<DatiAnagrafici>\n` +
      (company.piva ? `\t\t\t\t<IdFiscaleIVA>\n\t\t\t\t\t<IdPaese>IT</IdPaese>\n\t\t\t\t\t<IdCodice>${esc(companyIdentity.piva)}</IdCodice>\n\t\t\t\t</IdFiscaleIVA>\n` : ``) +
      (company.codiceFiscale ? `\t\t\t\t<CodiceFiscale>${esc(companyIdentity.codiceFiscale)}</CodiceFiscale>\n` : ``) +
      `\t\t\t\t${anagraficaCedente.split('\n').map(function (line, idx) { return idx === 0 ? line : '\t\t\t\t' + line; }).join('\n')}\n` +
      `\t\t\t\t<RegimeFiscale>${esc(company.codiceRegimeFiscale || '')}</RegimeFiscale>\n` +
      `\t\t\t</DatiAnagrafici>\n` +
      `\t\t\t<Sede>\n` +
      `\t\t\t\t<Indirizzo>${esc(companyAddress.address || '')}</Indirizzo>\n` +
      `\t\t\t\t<NumeroCivico>${esc(companyAddress.numeroCivico || '')}</NumeroCivico>\n` +
      `\t\t\t\t<CAP>${esc(companyAddress.cap || '')}</CAP>\n` +
      `\t\t\t\t<Comune>${esc(companyAddress.comune || '')}</Comune>\n` +
      (sedeProvinciaCed ? `\t\t\t\t<Provincia>${sedeProvinciaCed}</Provincia>\n` : ``) +
      `\t\t\t\t<Nazione>${companyAddress.nazione}</Nazione>\n` +
      `\t\t\t</Sede>\n` +
      `\t\t</CedentePrestatore>\n` +
      `\t\t<CessionarioCommittente>\n` +
      `\t\t\t<DatiAnagrafici>\n` +
      (customer.piva ? `\t\t\t\t<IdFiscaleIVA>\n\t\t\t\t\t<IdPaese>IT</IdPaese>\n\t\t\t\t\t<IdCodice>${esc(customerIdentity.piva)}</IdCodice>\n\t\t\t\t</IdFiscaleIVA>\n` : ``) +
      (customer.codiceFiscale ? `\t\t\t\t<CodiceFiscale>${esc(customerIdentity.codiceFiscale)}</CodiceFiscale>\n` : ``) +
      `\t\t\t\t<Anagrafica>\n` +
      `\t\t\t\t\t${buildCustomerAnagraficaXml(customer).replace('<Anagrafica>', '').replace('</Anagrafica>', '')}\n` +
      `\t\t\t\t</Anagrafica>\n` +
      `\t\t\t</DatiAnagrafici>\n` +
      `\t\t\t<Sede>\n` +
      `\t\t\t\t<Indirizzo>${esc(customerAddress.address || '')}</Indirizzo>\n` +
      `\t\t\t\t<CAP>${esc(customerAddress.cap || '')}</CAP>\n` +
      `\t\t\t\t<Comune>${esc(customerAddress.comune || '')}</Comune>\n` +
      (sedeProvinciaDest ? `\t\t\t\t<Provincia>${sedeProvinciaDest}</Provincia>\n` : ``) +
      `\t\t\t\t<Nazione>${customerAddress.nazione}</Nazione>\n` +
      `\t\t\t</Sede>\n` +
      `\t\t</CessionarioCommittente>\n` +
      `\t</FatturaElettronicaHeader>\n` +
      `\t<FatturaElettronicaBody>\n` +
      `\t\t<DatiGenerali>\n` +
      `\t\t\t<DatiGeneraliDocumento>\n` +
      `\t\t\t\t<TipoDocumento>${tipoDocumento}</TipoDocumento>\n` +
      `\t\t\t\t<Divisa>EUR</Divisa>\n` +
      `\t\t\t\t<Data>${dataFattura}</Data>\n` +
      `\t\t\t\t<Numero>${esc(invoice.number || '')}</Numero>\n` +
      (datiBolloXml ? `\t\t\t\t${datiBolloXml.split('\n').map(function (line, idx) { return idx === 0 ? line : '\t\t\t\t' + line; }).join('\n')}\n` : '') +
      (datiRitenutaXml ? `\t\t\t\t${datiRitenutaXml.split('\n').map(function (line, idx) { return idx === 0 ? line : '\t\t\t\t' + line; }).join('\n')}\n` : '') +
      (datiCassaXml ? `\t\t\t\t${datiCassaXml.split('\n').map(function (line, idx) { return idx === 0 ? line : '\t\t\t\t' + line; }).join('\n')}\n` : '') +
      `\t\t\t\t<ImportoTotaleDocumento>${signed(totaleDocumento).toFixed(2)}</ImportoTotaleDocumento>\n` +
      `\t\t\t</DatiGeneraliDocumento>\n` +
      `\t\t</DatiGenerali>\n` +
      `\t\t<DatiBeniServizi>\n`;

    let ln = 1;
    (invoice.lines || []).forEach(function (l) {
      const descrLc = String(l.productName || '').trim().toLowerCase();
      if (descrLc === 'rivalsa bollo') return;
      let imponibileRiga = sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price));
      let priceUnit = sf(l.price);
      if (l.priceType === 'gross' && calc.factorScorporo > 1) {
        imponibileRiga = imponibileRiga / calc.factorScorporo;
        priceUnit = priceUnit / calc.factorScorporo;
      }
      const iva = isForfettario ? 0 : sf(l.iva != null ? l.iva : ivaAzienda);
      const natura = iva === 0 ? (isForfettario ? naturaForfettario : String(l.esenzioneIva || INVOICE_NATURE_FORFETTARIO)) : null;
      const qtyXml = signedQty(sf(l.qty));
      const prezzoUnitarioXml = priceUnit;
      const prezzoTotaleXml = signed(imponibileRiga);
      xml +=
        `\t\t\t<DettaglioLinee>\n` +
        `\t\t\t\t<NumeroLinea>${ln++}</NumeroLinea>\n` +
        `\t\t\t\t<Descrizione>${esc(l.productName || '')}</Descrizione>\n` +
        `\t\t\t\t<Quantita>${qtyXml.toFixed(2)}</Quantita>\n` +
        `\t\t\t\t<PrezzoUnitario>${prezzoUnitarioXml.toFixed(8)}</PrezzoUnitario>\n` +
        `\t\t\t\t<PrezzoTotale>${prezzoTotaleXml.toFixed(2)}</PrezzoTotale>\n` +
        `\t\t\t\t<AliquotaIVA>${iva.toFixed(2)}</AliquotaIVA>\n` +
        (natura ? `\t\t\t\t<Natura>${esc(natura)}</Natura>\n` : ``) +
        `\t\t\t</DettaglioLinee>\n`;
    });

    xml += riepilogoXml;
    xml += `\t\t</DatiBeniServizi>\n`;
    xml +=
      `\t\t<DatiPagamento>\n` +
      `\t\t\t<CondizioniPagamento>${condizioniPagamentoTP}</CondizioniPagamento>\n` +
      `\t\t\t<DettaglioPagamento>\n` +
      `\t\t\t\t<ModalitaPagamento>${modalitaPagamentoMP}</ModalitaPagamento>\n` +
      (isBonifico && invoice.dataRiferimento ? `\t\t\t\t<DataRiferimentoTerminiPagamento>${esc(invoice.dataRiferimento)}</DataRiferimentoTerminiPagamento>\n` : ``) +
      (isBonifico && invoice.giorniTermini != null ? `\t\t\t\t<GiorniTerminiPagamento>${parseInt(invoice.giorniTermini, 10) || 0}</GiorniTerminiPagamento>\n` : ``) +
      `\t\t\t\t<DataScadenzaPagamento>${dataScadenza}</DataScadenzaPagamento>\n` +
      `\t\t\t\t<ImportoPagamento>${signed(nettoDaPagare).toFixed(2)}</ImportoPagamento>\n` +
      (isBonifico && bancaToUse ? `\t\t\t\t<IstitutoFinanziario>${esc(bancaToUse)}</IstitutoFinanziario>\n` : ``) +
      (isBonifico && ibanToUse ? `\t\t\t\t<IBAN>${esc(ibanToUse)}</IBAN>\n` : ``) +
      `\t\t\t</DettaglioPagamento>\n` +
      `		</DatiPagamento>
` +
      (attachments.length ? attachments.map(function (att) {
        return `		<Allegati>
` +
          `			<NomeAttachment>${esc(att.filename || 'allegato.pdf')}</NomeAttachment>
` +
          `			<FormatoAttachment>${esc(att.format || 'PDF')}</FormatoAttachment>
` +
          `			<Attachment>${esc(att.base64 || '')}</Attachment>
` +
          `		</Allegati>
`;
      }).join('') : '') +
      `	</FatturaElettronicaBody>
` +
      `</p:FatturaElettronica>`;

    xml = xml.replace(/(<Provincia>[^<]*<\/Provincia>)\s*<Provincia>[^<]*<\/Provincia>/g, '$1');
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const idForFilename = company.piva || company.codiceFiscale || '';
    const filename = `IT${idForFilename}_${randomSuffix}.xml`;
    return { xml: xml, filename: filename, bolloAcaricoEmittente: bolloAcaricoEmittente };
  }

  window.InvoiceXMLMapper.buildInvoiceXmlPayload = buildInvoiceXmlPayload;
})();