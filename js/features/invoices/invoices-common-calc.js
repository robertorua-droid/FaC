
(function () {
    window.AppModules = window.AppModules || {};
    window.AppModules.invoicesCommonCalc = window.AppModules.invoicesCommonCalc || {};

    /**
     * Calcola i totali di un documento (Fattura / Nota di Credito)
     * Centralizza la logica di calcolo precedentemente sparsa tra form e list view.
     * 
     * @param {Array} lines - Array di oggetti riga { qty, price, subtotal, iva, esenzioneIva, productName, isCosto, priceType }
     * @param {Object} companyInfo - Oggetto info azienda (per aliquote default, regime, ecc.)
     * @param {Object} customerInfo - Oggetto info cliente (per rivalsa, ritenuta, scorporo, ecc.)
     * @param {String} documentType - 'Fattura' o 'Nota di Credito'
     * @returns {Object} - { totPrest, riv, impBollo, totImp, ivaTot, ritenuta, totDoc, nettoDaPagare, vatMap }
     */
    const C = window.DomainConstants || {};
    const INVOICE_NATURE_FORFETTARIO = (C.INVOICE_NATURES && C.INVOICE_NATURES.FORFETTARIO) || 'N2.2';
    const INVOICE_NATURE_DEFAULT = (C.INVOICE_NATURES && C.INVOICE_NATURES.VAT_EXEMPT_DEFAULT) || INVOICE_NATURE_FORFETTARIO;
    const DEFAULT_IVA_ORDINARIO = (C.COMPANY_DEFAULTS && C.COMPANY_DEFAULTS.IVA_ORDINARIO) || 22;
    const DOCUMENT_TYPE_NOTA_DI_CREDITO = (C.INVOICE_TYPES && C.INVOICE_TYPES.NOTA_DI_CREDITO) || 'Nota di Credito';

    function calculateInvoiceTotals(lines, companyInfo, customerInfo, documentType, options) {
        const opts = options || {};
        const includeBolloInTotale = (opts.includeBolloInTotale !== false);
        const comp = companyInfo || {};
        const cust = customerInfo || {}; // Può essere {}, se non selezionato
        const linesSafe = Array.isArray(lines) ? lines : [];

        // Helper sicuro per float
        const sf = (typeof window.safeFloat === 'function') ? window.safeFloat : (v) => {
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        };

        // Regime fiscale azienda: passa sempre dalla TaxRegimePolicy
        const isForfettario = window.TaxRegimePolicy
            ? window.TaxRegimePolicy.isForfettario(comp)
            : false;

        // Aliquote base
        const aliqIva = isForfettario ? 0 : sf(comp.aliquotaIva || comp.aliquotaIVA || DEFAULT_IVA_ORDINARIO);
        const aliqInps = sf(comp.aliquotaInps || comp.aliquotaContributi || 0);
        const aliqRitenuta = sf(comp.aliquotaRitenuta || 20);

        // 1) Individuare riga "Rivalsa Bollo", se presente (NON entra in IVA e ritenuta)
        const bolloLines = linesSafe.filter((l) => String(l.productName || '').trim().toLowerCase() === 'rivalsa bollo');
        // Calcolo importo bollo manuale
        const impBolloLine = bolloLines.reduce((s, l) => s + sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price)), 0);

        // 2) Linee prestazioni (escludo eventuale riga bollo)
        const baseLines = linesSafe.filter((l) => String(l.productName || '').trim().toLowerCase() !== 'rivalsa bollo');

        // --- Calcolo Totale Prestazioni (NETTO) ---
        // Gestione Scorporo Rivalsa INPS: se attivo su cliente, prezzi sono LORDI e vanno scorporati
        const hasRivalsa = (cust.rivalsaInps === true || cust.rivalsaInps === 'true');
        const wantsScorporo = (cust.scorporoRivalsaInps === true || cust.scorporoRivalsaInps === 'true');
        const factorScorporo = (hasRivalsa && wantsScorporo && aliqInps > 0) ? (1 + (aliqInps / 100)) : 1;

        let totPrest = 0;
        let vatMap = new Map(); // Mappa per riepilogo IVA (Aliquota -> { imponibile, imposta })

        baseLines.forEach(l => {
            // Valore riga (subtotal se esiste, altrimenti calcolo)
            // Attenzione: se priceType == 'gross', questo 'val' è LORDO
            let val = sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price));

            // Calcolo imponibile netto della riga
            let imponibile = val;
            if (l.priceType === 'gross' && factorScorporo > 1) {
                imponibile = val / factorScorporo;
            }

            totPrest += imponibile;

            // Calcolo IVA riga
            let ivaPerc = isForfettario ? 0 : sf(l.iva != null ? l.iva : aliqIva);
            // Se l'aliquota è 0 (es. non specificata), fallback su aziendale se non forfettario
            // Ma attenzione: l.iva potrebbe essere esplicitamente 0. 
            // La logica originale usava: if (!ivaPerc && ivaPerc !== 0) ivaPerc = aliqIva;
            // Replichiamo:
            if (ivaPerc === 0 && (l.iva === null || l.iva === undefined || l.iva === '')) {
                if (!isForfettario) ivaPerc = aliqIva;
            }

            const imposta = (ivaPerc > 0) ? (imponibile * (ivaPerc / 100)) : 0;

            // Aggiornamento Mappa IVA
            let label = '';
            let aliquota = 0;
            let natura = '';

            if (ivaPerc > 0) {
                label = `IVA ${Math.round(ivaPerc)}%`;
                aliquota = ivaPerc;
            } else {
                const nat = isForfettario ? INVOICE_NATURE_FORFETTARIO : (l.esenzioneIva || INVOICE_NATURE_DEFAULT);
                label = `IVA 0% (${nat})`;
                aliquota = 0;
                natura = nat;
            }

            const g = vatMap.get(label) || { label, aliquota, natura, imponibile: 0, imposta: 0 };
            g.imponibile += imponibile;
            g.imposta += imposta;
            vatMap.set(label, g);
        });

        // --- Calcolo Rivalsa INPS ---
        // Base Rivalsa: escludo le righe marcate come 'Costo'
        let totPrestRivalsaBase = 0;
        baseLines.forEach(l => {
            const isCosto = (l.isCosto === true || l.isCosto === 'true');
            if (isCosto) return;

            // Uso nomi diversi per evitare conflitti con eventuali let precedenti se non minificato
            let valRiv = sf(l.subtotal != null ? l.subtotal : sf(l.qty) * sf(l.price));
            let imponibileRiv = valRiv;
            if (l.priceType === 'gross' && factorScorporo > 1) {
                imponibileRiv = valRiv / factorScorporo;
            }
            totPrestRivalsaBase += imponibileRiv;
        });

        const riv = hasRivalsa ? totPrestRivalsaBase * (aliqInps / 100) : 0;

        // --- Aggiunta Rivalsa a IVA e Totali ---
        // Rivalsa INPS: 
        // - In ordinario: soggetta IVA (aliquota azienda)
        // - In forfettario: NON soggetta IVA (N2.2)

        if (riv > 0) {
            if (isForfettario) {
                const nat = INVOICE_NATURE_FORFETTARIO;
                const label = `IVA 0% (${nat})`;
                const g = vatMap.get(label) || { label, aliquota: 0, natura: nat, imponibile: 0, imposta: 0 };
                g.imponibile += riv;
                vatMap.set(label, g);
            } else if (aliqIva > 0) {
                const label = `IVA ${Math.round(aliqIva)}%`;
                const g = vatMap.get(label) || { label, aliquota: aliqIva, natura: '', imponibile: 0, imposta: 0 };
                g.imponibile += riv;
                g.imposta += riv * (aliqIva / 100);
                vatMap.set(label, g);
            }
        }

        // Calcolo totali IVA dalla mappa
        let ivaTot = 0;
        for (const val of vatMap.values()) {
            ivaTot += val.imposta;
        }

        // Totale Imponibile (Prestazioni + Rivalsa)
        const totImp = totPrest + riv;

        // --- Calcolo Bollo ---
        let impBolloEff = impBolloLine;

        // Auto-calcolo bollo in forfettario se supera soglia
        const baseForBollo = totImp + ivaTot;
        const baseAbsForBollo = Math.abs(baseForBollo);
        const isNC = (documentType === DOCUMENT_TYPE_NOTA_DI_CREDITO);

        if (impBolloEff === 0 && isForfettario && baseAbsForBollo > 77.47) {
            if (!isNC || (isNC && baseAbsForBollo > 77.47)) {
                // Nota: La logica originale per NC era: se <= 77.47 bollo = 0. Se > 77.47 bollo = 2.
                // Qui semplifico: se forfettario e > 77.47, metto 2 euro.
                // Controllo specifico originale: if (isNC && baseAbsForBollo <= 77.47) impBolloEff = 0; -> implicito
                impBolloEff = 2.00;
            }
        }

        const totDoc = baseForBollo + (includeBolloInTotale ? impBolloEff : 0);

        // --- Ritenuta d'acconto ---
        const hasRitenuta = (cust.sostitutoImposta === true || cust.sostitutoImposta === 'true');
        const ritenuta = hasRitenuta ? totImp * (aliqRitenuta / 100) : 0;

        const nettoDaPagare = totDoc - ritenuta;

        return {
            totPrest,
            riv,
            impBollo: impBolloEff,
            totImp,
            ivaTot,
            ritenuta,
            totDoc,
            nettoDaPagare,
            vatMap,
            isForfettario,
            factorScorporo, // utile per debug
            bolloIncludedInTotale: includeBolloInTotale
        };
    }

    window.AppModules.invoicesCommonCalc.calculateInvoiceTotals = calculateInvoiceTotals;

})();
