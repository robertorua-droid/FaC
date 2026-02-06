// js/features/invoices/invoices-xml-module.js
// Export XML Fattura/Nota di Credito (FPR12)

(function () {
  window.AppModules = window.AppModules || {};
  window.AppModules.invoicesXML = window.AppModules.invoicesXML || {};

  let _bound = false;

  function generateInvoiceXML(invoiceId) {
    const invoice = getData('invoices').find((inv) => String(inv.id) === String(invoiceId));
    if (!invoice) {
      alert('Errore: fattura non trovata.');
      return;
    }

    // Bozza: non generare XML
    if (invoice.isDraft === true || String(invoice.status || '') === 'Bozza') {
      alert('Questo documento è in BOZZA. Finalizzalo prima di esportare XML.');
      return;
    }

    const company = getData('companyInfo');

    // Validazioni minime per la generazione XML
    if (!company || (!company.piva && !company.codiceFiscale)) {
      alert(
        "Compila i dati azienda: serve almeno P.IVA o Codice Fiscale per generare la fattura elettronica (IdTrasmittente/IdCodice)."
      );
      return;
    }
    const customer = getData('customers').find((c) => String(c.id) === String(invoice.customerId)) || {};

    // Tipo documento ADE (TD01 = Fattura, TD04 = Nota di Credito)
    const tipoDocumento = invoice.type === 'Nota di Credito' ? 'TD04' : 'TD01';

    // Gestione Nota di Credito: in XML rendiamo gli importi negativi in modo coerente
    const isNotaCredito = invoice.type === 'Nota di Credito';
    const signed = (v) => {
      const n = safeFloat(v);
      if (!isNotaCredito) return n;
      return n > 0 ? -n : n;
    };

    const signedQty = (q) => {
      const n = safeFloat(q);
      if (!isNotaCredito) return n;
      return n > 0 ? -n : n;
    };

    // -----------------------------
    // 1. Dati monetari principali
    // -----------------------------
    const totalePrestazioni = safeFloat(invoice.totalePrestazioni);
    const importoBollo = safeFloat(invoice.importoBollo);
    const importoRivalsa = invoice.rivalsa ? safeFloat(invoice.rivalsa.importo) : 0;
    const totaleImponibile = safeFloat(invoice.totaleImponibile);
    const totaleDocumento = safeFloat(invoice.total);
    // Regime fiscale gestionale (ordinario/forfettario)
    // - taxRegime: campo gestionale introdotto nell'app
    // - codiceRegimeFiscale: codice RFxx per FatturaPA (es. RF19)
    const taxRegimeGest = String(company.taxRegime || '').trim().toLowerCase();
    const isForfettario = (typeof window.isForfettario === 'function') ? window.isForfettario(company) : (taxRegimeGest === 'forfettario' || String(company.codiceRegimeFiscale || '').trim().toUpperCase() === 'RF19');
    const naturaForfettario = 'N2.2';
    const rifNormForfettario = 'Operazione in franchigia da IVA ai sensi dell\'art. 1, commi 54-89, L. 190/2014';

    // Parametri IVA (ordinario) / natura (forfettario)
    const ivaAzienda = safeFloat(company.aliquotaIva || company.aliquotaIVA || 22);
    const ivaAziendaXml = isForfettario ? 0 : ivaAzienda;
    const aliqRitenuta = safeFloat(company.aliquotaRitenuta || 20);

    // Ritenuta (se cliente sostituto d'imposta). Base didattica: imponibile (prestazioni + rivalsa)
    let ritenutaAcconto = safeFloat(invoice.ritenutaAcconto);
    if ((!ritenutaAcconto || ritenutaAcconto === 0) && (customer.sostitutoImposta === true || customer.sostitutoImposta === 'true')) {
      ritenutaAcconto = totaleImponibile * (aliqRitenuta / 100);
    }

    // Netto da pagare = Totale documento - Ritenuta
    let nettoDaPagare = safeFloat(invoice.nettoDaPagare);
    if (!nettoDaPagare || nettoDaPagare === 0) {
      nettoDaPagare = totaleDocumento - ritenutaAcconto;
    }

    // DatiRitenuta (XML) solo se presente
    let datiRitenutaXml = '';
    if (ritenutaAcconto > 0) {
      datiRitenutaXml =
        `<DatiRitenuta>` +
        `<TipoRitenuta>RT01</TipoRitenuta>` +
        `<ImportoRitenuta>${signed(ritenutaAcconto).toFixed(2)}</ImportoRitenuta>` +
        `<AliquotaRitenuta>${aliqRitenuta.toFixed(2)}</AliquotaRitenuta>` +
        `<CausalePagamento>A</CausalePagamento>` +
        `</DatiRitenuta>`;
    }

    // -----------------------------
    // 2. Anagrafica Cedente/Prestatore
    // -----------------------------
    let anagraficaCedente = `<Anagrafica><Denominazione>${escapeXML(company.name || '')}</Denominazione></Anagrafica>`;
    if (company.nome && company.cognome) {
      anagraficaCedente =
        `<Anagrafica>` +
        `<Nome>${escapeXML(company.nome)}</Nome>` +
        `<Cognome>${escapeXML(company.cognome)}</Cognome>` +
        `</Anagrafica>`;
    }

    // -----------------------------
    // 3. Riepilogo IVA (per aliquota) e/o Natura (solo se IVA=0)
    // -----------------------------
    const summary = {};

    // Linee della fattura: escludo eventuale riga "Rivalsa Bollo" dal riepilogo IVA
    (invoice.lines || []).forEach((l) => {
      const descr = String(l.productName || '').trim().toLowerCase();
      if (descr === 'rivalsa bollo') return;

      // Uso SEMPRE lo stesso imponibile per DettaglioLinee e DatiRiepilogo (evita mismatch su arrotondamenti)
      const imponibile = safeFloat(l.subtotal != null ? l.subtotal : safeFloat(l.qty) * safeFloat(l.price));

      // In forfettario l'IVA è sempre 0 nel tracciato; si usa Natura.
      const ivaPerc = isForfettario ? 0 : safeFloat(l.iva != null ? l.iva : ivaAziendaXml);

      if (ivaPerc > 0) {
        const key = `A:${ivaPerc.toFixed(2)}`;
        if (!summary[key]) summary[key] = { aliquota: ivaPerc, natura: null, imponibile: 0, imposta: 0, rifNorm: null };
        summary[key].imponibile += imponibile;
        summary[key].imposta += imponibile * (ivaPerc / 100);
      } else {
        const natura = isForfettario ? naturaForfettario : (l.esenzioneIva ? String(l.esenzioneIva) : 'N2.2');
        const key = `N:${natura}`;
        if (!summary[key]) summary[key] = { aliquota: 0, natura: natura, imponibile: 0, imposta: 0, rifNorm: isForfettario ? rifNormForfettario : null };
        summary[key].imponibile += imponibile;
      }
    });

    // Rivalsa INPS: in ordinario didattico è soggetta a IVA (stessa aliquota azienda),
    // in forfettario è sempre IVA=0 con Natura.
    if (importoRivalsa > 0) {
      if (!isForfettario && ivaAziendaXml > 0) {
        const key = `A:${ivaAziendaXml.toFixed(2)}`;
        if (!summary[key]) summary[key] = { aliquota: ivaAziendaXml, natura: null, imponibile: 0, imposta: 0, rifNorm: null };
        summary[key].imponibile += importoRivalsa;
        summary[key].imposta += importoRivalsa * (ivaAziendaXml / 100);
      } else {
        const nat = isForfettario ? naturaForfettario : 'N4';
        const key = `N:${nat}`;
        if (!summary[key]) summary[key] = { aliquota: 0, natura: nat, imponibile: 0, imposta: 0, rifNorm: isForfettario ? rifNormForfettario : null };
        summary[key].imponibile += importoRivalsa;
      }
    }

    // Costruzione XML riepilogo
    let riepilogoXml = '';
    // Totali ricostruiti secondo specifiche (evita scarti su FatturaCheck)
    let imponibileDocCalc = 0;
    let impostaDocCalc = 0;

    Object.values(summary)
      .sort((a, b) => safeFloat(a.aliquota) - safeFloat(b.aliquota) || String(a.natura || '').localeCompare(String(b.natura || '')))
      .forEach((s) => {
        imponibileDocCalc += safeFloat(s.imponibile || 0);
        impostaDocCalc += safeFloat(s.imposta || 0);
        riepilogoXml +=
          `<DatiRiepilogo>` +
          `<AliquotaIVA>${(s.aliquota || 0).toFixed(2)}</AliquotaIVA>` +
          (s.aliquota > 0 ? `` : `<Natura>${escapeXML(s.natura || '')}</Natura>`) +
          (s.aliquota > 0 || !s.rifNorm ? `` : `<RiferimentoNormativo>${escapeXML(s.rifNorm)}</RiferimentoNormativo>`) +
          `<ImponibileImporto>${signed(s.imponibile || 0).toFixed(2)}</ImponibileImporto>` +
          `<Imposta>${signed(s.imposta || 0).toFixed(2)}</Imposta>` +
          (s.aliquota > 0 ? `<EsigibilitaIVA>I</EsigibilitaIVA>` : ``) +
          `</DatiRiepilogo>`;
      });
    // -----------------------------
    // 4. Dati Bollo (se presente)
    // -----------------------------

    let datiBolloXml = '';

    // Regole bollo (didattiche ma coerenti con UI e FatturaCheck):
    // - Forfettario: bollo 2.00 se imponibile+imposta (senza bollo) > 77,47
    // - Ordinario: bollo solo se l'utente lo ha richiesto (riga "Rivalsa Bollo" o importoBollo > 0)
    // - Nota di credito (TD04): bollo solo se valore assoluto (senza bollo) > 77,47
    let bolloXmlAmount = 0.00;
    const baseForBollo = imponibileDocCalc + impostaDocCalc;
    const baseAbsForBollo = Math.abs(baseForBollo);

    const hasBolloLine = (invoice.lines || []).some(
      (l) => String(l.productName || '').trim().toLowerCase() === 'rivalsa bollo'
    );
    const userRequestedBollo = safeFloat(invoice.importoBollo) > 0 || hasBolloLine;

    if (isForfettario) {
      bolloXmlAmount = baseAbsForBollo > 77.47 ? 2.00 : 0.00;
    } else if (userRequestedBollo) {
      bolloXmlAmount = 2.00;
    }

    if (tipoDocumento === 'TD04' && baseAbsForBollo <= 77.47) bolloXmlAmount = 0.00;

    if (bolloXmlAmount > 0) {
      datiBolloXml =
        `<DatiBollo>` +
        `<BolloVirtuale>SI</BolloVirtuale>` +
        `<ImportoBollo>${bolloXmlAmount.toFixed(2)}</ImportoBollo>` +
        `</DatiBollo>`;
    }


    // -----------------------------
    // 5. Dati Cassa Previdenziale (Rivalsa INPS, se presente)
    // -----------------------------
    let datiCassaXml = '';
    if (importoRivalsa > 0) {
      const aliqRiv = safeFloat(company.aliquotaInps || company.aliquotaContributi || 0);
      const aliqIvaCassa = isForfettario ? 0 : ivaAziendaXml;
      const natCassa = isForfettario ? naturaForfettario : (aliqIvaCassa > 0 ? null : 'N4');
      datiCassaXml =
        `<DatiCassaPrevidenziale>` +
        `<TipoCassa>TC22</TipoCassa>` +
        `<AlCassa>${aliqRiv.toFixed(2)}</AlCassa>` +
        `<ImportoContributoCassa>${signed(importoRivalsa).toFixed(2)}</ImportoContributoCassa>` +
        `<ImponibileCassa>${signed(totalePrestazioni).toFixed(2)}</ImponibileCassa>` +
        `<AliquotaIVA>${aliqIvaCassa.toFixed(2)}</AliquotaIVA>` +
        (natCassa ? `<Natura>${escapeXML(natCassa)}</Natura>` : ``) +
        (isForfettario ? `<RiferimentoNormativo>${escapeXML(rifNormForfettario)}</RiferimentoNormativo>` : ``) +
        `</DatiCassaPrevidenziale>`;
    }

    // Totale documento e importo pagamento ricostruiti coerentemente (FatturaCheck)
    const totalDocComputed = imponibileDocCalc + impostaDocCalc + bolloXmlAmount;
    const totaleDocumentoXml = (isForfettario || Math.abs(safeFloat(totaleDocumento) - totalDocComputed) > 0.01) ? totalDocComputed : safeFloat(totaleDocumento);
    const nettoDaPagareXml = totaleDocumentoXml - safeFloat(ritenutaAcconto);

    // -----------------------------
    // 6. Corpo XML
    // -----------------------------
    const progressivoInvio = (Math.random().toString(36) + '00000').slice(2, 7);
    const dataFattura = invoice.date || new Date().toISOString().slice(0, 10);

    // -----------------------------
    // 6. Dati pagamento (Step 3)
    // -----------------------------
    // Condizioni pagamento (TP01/TP02/TP03). Default: TP02 (pagamento completo).
    const normalizeTP = (v) => {
      const s = String(v || '').trim().toUpperCase();
      return ['TP01', 'TP02', 'TP03'].includes(s) ? s : 'TP02';
    };

    // Modalità pagamento (MPxx) per FatturaPA.
    // Mapping didattico e prudente:
    // - Bonifico Bancario => MP05
    // - Contanti => MP01
    // - Assegno => MP02
    const mapMetodoToMP = (method) => {
      const m = String(method || '').trim().toLowerCase();
      if (m === 'contanti') return 'MP01';
      if (m === 'assegno') return 'MP02';
      if (m.includes('bonifico')) return 'MP05';
      return 'MP05';
    };

    const cleanIban = (iban) => String(iban || '').replace(/\s+/g, '').trim();

    const condizioniPagamentoTP = normalizeTP(invoice.condizioniPagamento);
    const metodoPagamentoUI = invoice.modalitaPagamento || 'Bonifico Bancario';
    const modalitaPagamentoMP = mapMetodoToMP(metodoPagamentoUI);
    // Legacy: "Rimessa Diretta" può esistere su documenti salvati in versioni precedenti.
    // La trattiamo come bonifico (MP05) per compatibilità.
    const isBonifico = String(metodoPagamentoUI).trim().toLowerCase().includes('bonifico') ||
      String(metodoPagamentoUI).trim().toLowerCase() === 'rimessa diretta';

    // Data scadenza: uso quella salvata; se mancante e ho termini (bonifico), la ricavo.
    // Supporta anche Fine Mese + Giorno Fisso (step "termini pagamento").
    let dataScadenza = invoice.dataScadenza || '';
    if (!dataScadenza && isBonifico && invoice.dataRiferimento) {
      const giorni = parseInt(invoice.giorniTermini, 10);
      const fineMese = invoice.fineMese === true || invoice.fineMese === 'true';
      const gfEnabled = invoice.giornoFissoEnabled === true || invoice.giornoFissoEnabled === 'true';
      const gfVal = parseInt(invoice.giornoFissoValue, 10);

      const d0 = new Date(invoice.dataRiferimento);
      if (!isNaN(d0.getTime())) {
        let base = new Date(d0.getTime());
        if (fineMese) {
          base = new Date(base.getFullYear(), base.getMonth() + 1, 0); // ultimo giorno del mese
        }
        if (!isNaN(giorni)) {
          base.setDate(base.getDate() + giorni);
        }
        if (gfEnabled && !isNaN(gfVal) && gfVal >= 1) {
          // prima data >= base con giorno mese = gfVal (se non esiste, ultimo giorno del mese)
          const targetDay = Math.min(gfVal, 31);
          const y = base.getFullYear();
          const m = base.getMonth();
          const lastDay = new Date(y, m + 1, 0).getDate();
          const dayThisMonth = Math.min(targetDay, lastDay);
          let candidate = new Date(y, m, dayThisMonth);
          if (candidate < base) {
            const y2 = base.getMonth() === 11 ? y + 1 : y;
            const m2 = (base.getMonth() + 1) % 12;
            const lastDay2 = new Date(y2, m2 + 1, 0).getDate();
            const day2 = Math.min(targetDay, lastDay2);
            candidate = new Date(y2, m2, day2);
          }
          base = candidate;
        }
        dataScadenza = base.toISOString().slice(0, 10);
      }
    }
    if (!dataScadenza) dataScadenza = dataFattura;

    // IBAN/Banca: valorizzati SOLO se bonifico.
    const bankChoice = String(invoice.bankChoice || '1');
    const ibanToUse = isBonifico ? cleanIban(bankChoice === '2' ? company.iban2 : company.iban) : '';
    const bancaToUse = isBonifico ? String(bankChoice === '2' ? company.banca2 : company.banca || '') : '';

    // Province sempre in maiuscolo (richiesta da Fatturacheck)
    const sedeProvinciaCed = escapeXML(((company.provincia || company.province || '')).toString().toUpperCase());
    const sedeProvinciaDest = escapeXML(((customer.provincia || customer.province || '')).toString().toUpperCase());

    // Validazione Provincia (obbligatoria per IT)
    const cedCountry = normalizeCountryCode(company.nazione || 'IT');
    const destCountry = normalizeCountryCode(customer.nazione || 'IT');
    const isProvinceSigla = (v) => /^[A-Z]{2}$/.test(String(v || '').trim());
    if (cedCountry === 'IT' && !isProvinceSigla(sedeProvinciaCed)) {
      alert("Provincia (sigla 2 lettere, es. TO) mancante o non valida nei dati azienda. Compilala in 'Azienda' prima di generare l'XML.");
      return;
    }
    if (destCountry === 'IT' && !isProvinceSigla(sedeProvinciaDest)) {
      alert("Provincia (sigla 2 lettere, es. TO) mancante o non valida nell'anagrafica cliente. Compilala prima di generare l'XML.");
      return;
    }


    let xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<p:FatturaElettronica versione="FPR12"
        xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
        xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<FatturaElettronicaHeader>` +
      `<DatiTrasmissione>` +
      `<IdTrasmittente>` +
      `<IdPaese>IT</IdPaese>` +
      `<IdCodice>${escapeXML(company.piva || company.codiceFiscale || '')}</IdCodice>` +
      `</IdTrasmittente>` +
      `<ProgressivoInvio>${progressivoInvio}</ProgressivoInvio>` +
      `<FormatoTrasmissione>FPR12</FormatoTrasmissione>` +
      `<CodiceDestinatario>${escapeXML(customer.sdi || '0000000')}</CodiceDestinatario>` +
      `</DatiTrasmissione>` +
      `<CedentePrestatore>` +
      `<DatiAnagrafici>` +
      (company.piva
        ? `<IdFiscaleIVA>` + `<IdPaese>IT</IdPaese>` + `<IdCodice>${escapeXML(company.piva)}</IdCodice>` + `</IdFiscaleIVA>`
        : ``) +
      `${company.codiceFiscale ? `<CodiceFiscale>${escapeXML(company.codiceFiscale)}</CodiceFiscale>` : ``}` +
      anagraficaCedente +
      `<RegimeFiscale>${escapeXML(company.codiceRegimeFiscale || '')}</RegimeFiscale>` +
      `</DatiAnagrafici>` +
      `<Sede>` +
      `<Indirizzo>${escapeXML(company.address || '')}</Indirizzo>` +
      `<NumeroCivico>${escapeXML(company.numeroCivico || '')}</NumeroCivico>` +
      `<CAP>${escapeXML(company.zip || '')}</CAP>` +
      `<Comune>${escapeXML(company.city || '')}</Comune>` +
      (sedeProvinciaCed ? `<Provincia>${sedeProvinciaCed}</Provincia>` : ``) +
      `<Nazione>IT</Nazione>` +
      `</Sede>` +
      `</CedentePrestatore>` +
      `<CessionarioCommittente>` +
      `<DatiAnagrafici>` +
      (customer.piva
        ? `<IdFiscaleIVA>` + `<IdPaese>IT</IdPaese>` + `<IdCodice>${escapeXML(customer.piva)}</IdCodice>` + `</IdFiscaleIVA>`
        : ``) +
      (customer.codiceFiscale ? `<CodiceFiscale>${escapeXML(customer.codiceFiscale)}</CodiceFiscale>` : ``) +
      `<Anagrafica>` +
      `<Denominazione>${escapeXML(customer.name || '')}</Denominazione>` +
      `</Anagrafica>` +
      `</DatiAnagrafici>` +
      `<Sede>` +
      `<Indirizzo>${escapeXML(customer.address || '')}</Indirizzo>` +
      `<CAP>${escapeXML(customer.cap || '')}</CAP>` +
      `<Comune>${escapeXML(customer.comune || '')}</Comune>` +
      (sedeProvinciaDest ? `<Provincia>${sedeProvinciaDest}</Provincia>` : ``) +
      `<Nazione>${normalizeCountryCode(customer.nazione)}</Nazione>` +
      `</Sede>` +
      `</CessionarioCommittente>` +
      `</FatturaElettronicaHeader>` +
      `<FatturaElettronicaBody>` +
      `<DatiGenerali>` +
      `<DatiGeneraliDocumento>` +
      `<TipoDocumento>${tipoDocumento}</TipoDocumento>` +
      `<Divisa>EUR</Divisa>` +
      `<Data>${dataFattura}</Data>` +
      `<Numero>${escapeXML(invoice.number || '')}</Numero>` +
      datiBolloXml +
      datiCassaXml +
      datiRitenutaXml +
      `<ImportoTotaleDocumento>${signed(totaleDocumentoXml).toFixed(2)}</ImportoTotaleDocumento>` +
      `</DatiGeneraliDocumento>` +
      `</DatiGenerali>` +
      `<DatiBeniServizi>`;

    // Linee
    let ln = 1;
    (invoice.lines || []).forEach((l) => {
      const descrLc = String(l.productName || "").trim().toLowerCase();
      // Non includere la riga "Rivalsa Bollo" nel tracciato XML: il bollo va in <DatiBollo>
      if (descrLc === "rivalsa bollo") return;

      // Imponibile riga: uso lo stesso valore del riepilogo (evita mismatch)
      const imponibileRiga = safeFloat(l.subtotal != null ? l.subtotal : safeFloat(l.qty) * safeFloat(l.price));

      // IVA per riga:
      // - forfettario => sempre 0 (Natura obbligatoria)
      // - ordinario => iva di riga o default azienda
      const iva = isForfettario ? 0 : safeFloat(l.iva != null ? l.iva : ivaAziendaXml);
      const natura = iva === 0 ? (isForfettario ? naturaForfettario : String(l.esenzioneIva || 'N2.2')) : null;

      const qtyRaw = safeFloat(l.qty);
      const priceRaw = safeFloat(l.price);
      const qtyXml = signedQty(qtyRaw);
      const prezzoUnitarioXml = priceRaw;
      const prezzoTotaleXml = signed(imponibileRiga);

      xml +=
        `<DettaglioLinee>` +
        `<NumeroLinea>${ln++}</NumeroLinea>` +
        `<Descrizione>${escapeXML(l.productName || '')}</Descrizione>` +
        `<Quantita>${qtyXml.toFixed(2)}</Quantita>` +
        `<PrezzoUnitario>${prezzoUnitarioXml.toFixed(2)}</PrezzoUnitario>` +
        `<PrezzoTotale>${prezzoTotaleXml.toFixed(2)}</PrezzoTotale>` +
        `<AliquotaIVA>${iva.toFixed(2)}</AliquotaIVA>` +
        (natura ? `<Natura>${escapeXML(natura)}</Natura>` : ``) +
        `</DettaglioLinee>`;
    });

    // Riepilogo IVA / Natura
    xml +=
      riepilogoXml +
      `</DatiBeniServizi>` +
      `<DatiPagamento>` +
      `<CondizioniPagamento>${condizioniPagamentoTP}</CondizioniPagamento>` +
      `<DettaglioPagamento>` +
      `<ModalitaPagamento>${modalitaPagamentoMP}</ModalitaPagamento>` +
      // Termini pagamento (solo bonifico): data riferimento + giorni
      (isBonifico && invoice.dataRiferimento ? `<DataRiferimentoTerminiPagamento>${escapeXML(invoice.dataRiferimento)}</DataRiferimentoTerminiPagamento>` : ``) +
      (isBonifico && invoice.giorniTermini != null ? `<GiorniTerminiPagamento>${parseInt(invoice.giorniTermini, 10) || 0}</GiorniTerminiPagamento>` : ``) +
      `<DataScadenzaPagamento>${dataScadenza}</DataScadenzaPagamento>` +
      `<ImportoPagamento>${signed(nettoDaPagareXml).toFixed(2)}</ImportoPagamento>` +
      (isBonifico && bancaToUse ? `<IstitutoFinanziario>${escapeXML(bancaToUse)}</IstitutoFinanziario>` : ``) +
      (isBonifico && ibanToUse ? `<IBAN>${escapeXML(ibanToUse)}</IBAN>` : ``) +
      `</DettaglioPagamento>` +
      `</DatiPagamento>` +
      `</FatturaElettronicaBody>` +
      `</p:FatturaElettronica>`;

    // Download con nome casuale tipo: IT12345678901_abc12.xml
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const idForFilename = company.piva || company.codiceFiscale || '';
    const filename = `IT${idForFilename}_${randomSuffix}.xml`;

        // Sanity check: evita duplicazioni consecutive di <Provincia> (XML non conforme)
    xml = xml.replace(/(<Provincia>[^<]*<\/Provincia>)\s*<Provincia>[^<]*<\/Provincia>/g, '$1');

const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  function bind() {
    if (_bound) return;
    _bound = true;

    // XML
    $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function () {
      const id = $(this).attr('id') === 'export-xml-btn' ? $('#export-xml-btn').data('invoiceId') : $(this).attr('data-id');
      if (id) generateInvoiceXML(id);
    });

    window.generateInvoiceXML = generateInvoiceXML;
  }

  window.AppModules.invoicesXML.bind = bind;
})();
