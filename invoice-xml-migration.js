// invoice-xml-migration.js

function bindEventListeners() {
    // 4. EVENT LISTENERS
        // =========================================================

        // AUTH
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;

                // Nascondo login, mostro loading
                $('#login-container').addClass('d-none');
                $('#loading-screen').removeClass('d-none');

                try {
                    await loadAllDataFromCloud();
                    $('#loading-screen').addClass('d-none');
                    $('#main-app').removeClass('d-none');
                    renderAll();

                    // Avvio monitoraggio inattività
                    startInactivityWatch();
                } catch (error) {
                    alert("Errore DB: " + error.message);
                    $('#loading-screen').addClass('d-none');
                }
            } else {
                currentUser = null;
                $('#main-app').addClass('d-none');
                $('#loading-screen').addClass('d-none');
                $('#login-container').removeClass('d-none');

                // Stop monitoraggio inattività
                stopInactivityWatch();
            }
        });

        $('#login-form').on('submit', function(e) {
            e.preventDefault();
            $('#login-error').addClass('d-none');
            $('#login-spinner').removeClass('d-none');
            $('#btn-login-submit').prop('disabled', true);

            const email = $('#email').val();
            const password = $('#password').val();

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    $('#login-spinner').addClass('d-none');
                    $('#btn-login-submit').prop('disabled', false);
                })
                .catch(err => {
                    console.error("Login Error:", err);
                    $('#login-error').removeClass('d-none');
                    $('#login-spinner').addClass('d-none');
                    $('#btn-login-submit').prop('disabled', false);
                });
        });

        $('#logout-btn').on('click', function(e) {
            e.preventDefault();
            if (typeof stopInactivityWatch === 'function') { try { stopInactivityWatch(); } catch(e){} }
            auth.signOut().then(() => {
                // signOut risolve -> lo stato auth.onAuthStateChanged farà il resto
                location.reload();
            });
        });

        // Cambio anno → rendo di nuovo l'elenco documenti filtrato
        $('#invoice-year-filter').on('change', function () {
            renderInvoicesTable();
        });

        // filtro anno STATISTICHE
        $('#stats-year-filter').on('change', function () {
            renderStatisticsPage();
        });

        // filtro anno SIMULAZIONE LM
        $('#lm-year-select, #lm-only-paid, #lm-include-bollo').on('change', function () {
            renderLMPage();
        });
        $('#lm-refresh-btn').on('click', function () {
            renderLMPage();
        });


        // NAVIGAZIONE
        $('.sidebar .nav-link').on('click', function(e) { 
            if(this.id === 'logout-btn' || this.getAttribute('data-bs-toggle')) return; 
            e.preventDefault(); 
            const target = $(this).data('target'); 
            if(target === 'nuova-fattura-accompagnatoria') { 
                if(this.id === 'menu-nuova-nota-credito') prepareDocumentForm('Nota di Credito'); 
                else if(this.id === 'menu-nuova-fattura') { 
                    $('#newInvoiceChoiceModal').modal('show'); 
                    return; 
                } else prepareDocumentForm('Fattura'); 
            } 
            if(target === 'statistiche') renderStatisticsPage();
            if(target === 'simulazione-lm') { refreshLMYearFilter(); renderLMPage(); }

            if(target === 'avanzate') {
                refreshDeleteDocumentsYearSelect();
            }

            if (target === 'elenco-fatture') {
                renderInvoicesTable();
            }

            $('.sidebar .nav-link').removeClass('active'); 
            $(this).addClass('active'); 
            $('.content-section').addClass('d-none'); 
            $('#' + target).removeClass('d-none'); 
        });

        // MODALE FATTURA
        $('#newInvoiceChoiceModal').on('show.bs.modal', function () { 
            const invoices = getData('invoices').filter(i => i.type === 'Fattura' || i.type === undefined); 
            invoices.sort((a, b) => new Date(b.date) - new Date(a.date)); 
            const options = invoices.map(inv => `<option value="${inv.id}">${inv.number} - ${formatDateForDisplay(inv.date)}</option>`).join(''); 
            $('#copy-from-invoice-select').html('<option value="">Copia da esistente...</option>' + options); 
        });

        $('#btn-create-new-blank-invoice').click(function() { 
            $('#newInvoiceChoiceModal').modal('hide'); 
            $('.sidebar .nav-link').removeClass('active'); 
            $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active'); 
            $('.content-section').addClass('d-none'); 
            $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
            prepareDocumentForm('Fattura'); 
        });

        $('#btn-copy-from-invoice').click(function() { 
            const id = $('#copy-from-invoice-select').val(); 
            if(!id) return; 
            $('#newInvoiceChoiceModal').modal('hide'); 
            $('.sidebar .nav-link').removeClass('active'); 
            $('[data-bs-target="#newInvoiceChoiceModal"]').addClass('active'); 
            $('.content-section').addClass('d-none'); 
            $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
            loadInvoiceForEditing(id, true); 
        });

        // CRUD ANAGRAFICHE
        function editItem(type, id) { 
            if (type === 'customer' || type === 'product') CURRENT_EDITING_ID = String(id); 
            const item = getData(`${type}s`).find(i => String(i.id) === String(id)); 
            if (!item) return; 
            $(`#${type}Form`)[0].reset(); 
            $(`#${type}ModalTitle`).text(`Modifica`); 
            $(`#${type}-id`).val(String(item.id)); 
            for (const key in item) { 
                const field = $(`#${type}-${key}`); 
                if (field.length) { 
                    if (field.is(':checkbox')) field.prop('checked', item[key]); 
                    else field.val(item[key]); 
                } 
            } 
            if (type === 'product') { 
                $('#product-iva').trigger('change'); 
                if(item.iva == '0') $('#product-esenzioneIva').val(item.esenzioneIva); 
            } 
            $(`#${type}Modal`).modal('show'); 
        }

        $('#newCustomerBtn').click(() => { 
            CURRENT_EDITING_ID = null; 
            $('#customerForm')[0].reset(); 
            $('#customer-id').val('Nuovo'); 
            $('#customerModal').modal('show'); 
        });

        $('#saveCustomerBtn').click(async () => { 
            const data = { 
                name: $('#customer-name').val(), 
                piva: $('#customer-piva').val(), 
                codiceFiscale: $('#customer-codiceFiscale').val(), 
                sdi: $('#customer-sdi').val(), 
                address: $('#customer-address').val(), 
                comune: $('#customer-comune').val(), 
                provincia: ($('#customer-provincia').val() || '').toUpperCase(),
                cap: $('#customer-cap').val(), 
                nazione: $('#customer-nazione').val(), 
                rivalsaInps: $('#customer-rivalsaInps').is(':checked'),
                pec: $('#customer-pec').val() || ''
            }; 
            let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : String(getNextId(getData('customers'))); 
            await saveDataToCloud('customers', data, id); 
            $('#customerModal').modal('hide'); 
            renderAll(); 
        });

        $('#customers-table-body').on('click', '.btn-edit-customer', function(e) { 
            editItem('customer', $(e.currentTarget).attr('data-id')); 
        });

        $('#customers-table-body').on('click', '.btn-delete-customer', function(e) { 
            deleteDataFromCloud('customers', $(e.currentTarget).attr('data-id')); 
        });

        $('#newProductBtn').click(() => { 
            CURRENT_EDITING_ID = null; 
            $('#productForm')[0].reset(); 
            $('#product-id').val('Nuovo'); 
            $('#product-iva').val('0').change(); 
            $('#productModal').modal('show'); 
        });

        $('#saveProductBtn').click(async () => { 
            const data = { 
                description: $('#product-description').val(), 
                code: $('#product-code').val(), 
                salePrice: $('#product-salePrice').val(), 
                iva: $('#product-iva').val(), 
                esenzioneIva: $('#product-esenzioneIva').val() 
            }; 
            let id = CURRENT_EDITING_ID ? CURRENT_EDITING_ID : 'PRD' + new Date().getTime(); 
            await saveDataToCloud('products', data, id); 
            $('#productModal').modal('hide'); 
            renderAll(); 
        });

        $('#products-table-body').on('click', '.btn-edit-product', function(e) { 
            editItem('product', $(e.currentTarget).attr('data-id')); 
        });

        $('#products-table-body').on('click', '.btn-delete-product', function(e) { 
            deleteDataFromCloud('products', $(e.currentTarget).attr('data-id')); 
        });

        $('#product-iva').change(function() { 
            toggleEsenzioneIvaField('product', $(this).val()); 
        });

        function toggleEsenzioneIvaField(prefix, ivaVal) {
            const esenzioneField = $(`#${prefix}-esenzioneIva`);
            if (ivaVal === '0') {
                esenzioneField.prop('disabled', false);
            } else {
                esenzioneField.prop('disabled', true).val('');
            }
        }

        // FATTURE CORE
        window.tempInvoiceLines = []; 

        // Calcolo automatico data di scadenza = Data Riferimento + Giorni Scadenza
        function recalcInvoiceDueDate() {
            const refDateStr = $('#invoice-dataRiferimento').val();
            const giorni = parseInt($('#invoice-giorniTermini').val(), 10);

            if (!refDateStr || isNaN(giorni)) return;

            const refDate = new Date(refDateStr);
            refDate.setDate(refDate.getDate() + giorni);

            const dueStr = refDate.toISOString().slice(0, 10);
            $('#invoice-dataScadenza').val(dueStr);
        }

        function prepareDocumentForm(type) {
            CURRENT_EDITING_INVOICE_ID = null; 

            // reset form e stato
            $('#new-invoice-form')[0].reset();
            $('#invoice-id').val('Nuovo');
            $('#document-type').val(type);

            // righe fattura
            $('#invoice-lines-tbody').empty();
            window.tempInvoiceLines = [];
            populateDropdowns();

            // data documento = oggi
            const today = new Date().toISOString().slice(0, 10);
            $('#invoice-date').val(today);

            // DEFAULT PAGAMENTO
            // Condizioni Pagamento
            $('#invoice-condizioniPagamento').val('Pagamento Completo');
            // Modalità Pagamento
            $('#invoice-modalitaPagamento').val('Bonifico Bancario');

            // DEFAULT DATE PAGAMENTO
            // Data riferimento = data documento
            $('#invoice-dataRiferimento').val(today);
            // Giorni scadenza (se vuoi altro valore cambia 30)
            $('#invoice-giorniTermini').val(30);
            // Calcolo automatica della scadenza
            recalcInvoiceDueDate();

            // Tipo documento / titolo
            if (type === 'Nota di Credito') {
                $('#document-title').text('Nuova Nota di Credito');
                $('#credit-note-fields').removeClass('d-none');
            } else {
                $('#document-title').text('Nuova Fattura');
                $('#credit-note-fields').addClass('d-none');
            }

            // Numero fattura e totali
            updateInvoiceNumber(type, today.substring(0, 4));
            updateTotalsDisplay();
        }

        function loadInvoiceForEditing(id, isCopy) { 
            const inv = getData('invoices').find(i => String(i.id) === String(id)); 
            if (!inv) return; 
            const type = isCopy ? 'Fattura' : (inv.type || 'Fattura'); 
            prepareDocumentForm(type); 
            if (!isCopy) { 
                CURRENT_EDITING_INVOICE_ID = String(inv.id); 
                $('#invoice-id').val(inv.id); 
                $('#document-title').text(`Modifica ${type} ${inv.number}`); 
            } 
            $('#invoice-customer-select').val(inv.customerId); 
            $('#invoice-date').val(isCopy ? new Date().toISOString().slice(0, 10) : inv.date); 
            if(!isCopy) $('#invoice-number').val(inv.number); 
            $('#invoice-condizioniPagamento').val(inv.condizioniPagamento); 
            $('#invoice-modalitaPagamento').val(inv.modalitaPagamento); 
            $('#invoice-dataScadenza').val(inv.dataScadenza); 
            if (type === 'Nota di Credito') { 
                $('#linked-invoice').val(inv.linkedInvoice); 
                $('#reason').val(inv.reason); 
            } 
            window.tempInvoiceLines = JSON.parse(JSON.stringify(inv.lines || [])); 
            renderLocalInvoiceLines(); 
            updateTotalsDisplay(); 
        }

        function updateInvoiceNumber(type, year) { 
            if (CURRENT_EDITING_INVOICE_ID) return; 
            const invs = getData('invoices').filter(i => 
                (i.type === type || (type==='Fattura' && !i.type)) && 
                i.date && i.date.substring(0, 4) === String(year)
            ); 
            let next = 1; 
            if (invs.length > 0) { 
                next = Math.max(...invs.map(i => {
                    const parts = String(i.number || '').split('-');
                    const last = parts[parts.length-1];
                    return parseInt(last) || 0;
                })) + 1; 
            }
            $('#invoice-number').val(`${type==='Fattura'?'FATT':'NC'}-${year}-${String(next).padStart(2, '0')}`);
        }

        $('#add-product-to-invoice-btn').click(() => {
            const d = $('#invoice-product-description').val(); 
            if(!d) return;
            window.tempInvoiceLines.push({
                productName: d,
                qty: parseFloat($('#invoice-product-qty').val())||1,
                price: parseFloat($('#invoice-product-price').val())||0,
                subtotal: (parseFloat($('#invoice-product-qty').val())||1)*(parseFloat($('#invoice-product-price').val())||0),
                iva: $('#invoice-product-iva').val(),
                esenzioneIva: $('#invoice-product-esenzioneIva').val()
            });
            renderLocalInvoiceLines(); 
            updateTotalsDisplay();
        });

        function renderLocalInvoiceLines() {
            const t = $('#invoice-lines-tbody').empty(); 
            window.tempInvoiceLines.forEach((l, i) => { 
                t.append(`
    <tr>
      <td>${l.productName}</td>
      <td class="text-end">${l.qty}</td>
      <td class="text-end">€ ${l.price.toFixed(2)}</td>
      <td class="text-end">€ ${l.subtotal.toFixed(2)}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-danger del-line" data-i="${i}">x</button>
      </td>
    </tr>`);
            });
        }

        $('#invoice-lines-tbody').on('click', '.del-line', function() {
            window.tempInvoiceLines.splice($(this).data('i'), 1); 
            renderLocalInvoiceLines(); 
            updateTotalsDisplay(); 
        });

        function updateTotalsDisplay() {
            const cid = $('#invoice-customer-select').val();
            const cust = getData('customers').find(c => String(c.id) === String(cid));
            const comp = getData('companyInfo');

            if (!cust || !comp) {
                $('#invoice-total').text('€ 0,00');
                $('#invoice-tax-details').text('');
                return { totPrest: 0, riv: 0, impBollo: 0, totImp: 0, totDoc: 0 };
            }

            // 1) Individuare riga "Rivalsa Bollo", se presente
            const rows = window.tempInvoiceLines.filter(l => 
                l.productName.toLowerCase() !== 'rivalsa bollo'
            );
            const bollo = window.tempInvoiceLines.find(l => 
                l.productName.toLowerCase() === 'rivalsa bollo'
            );
            const impBollo = bollo ? (parseFloat(bollo.subtotal) || 0) : 0;

            // 2) Totale prestazioni (senza bollo)
            const totPrest = rows.reduce((s, l) => s + (parseFloat(l.subtotal) || 0), 0);

            // 3) Rivalsa INPS (se il cliente ha la spunta)
            let riv = 0;
            const aliquotaInps = parseFloat(comp.aliquotaInps || comp.aliquotaContributi || 0);
            if (cust.rivalsaInps && aliquotaInps > 0) {
                riv = totPrest * (aliquotaInps / 100);
            }

            // 4) Totale Imponibile (Prestazioni + eventuale rivalsa INPS)
            const totImp = totPrest + riv;

            // 5) Totale Documento (Imponibile + marca da bollo, se presente)
            const totDoc = totImp + impBollo;

            // 6) Aggiornamento UI
            $('#invoice-total').text(`€ ${totDoc.toFixed(2)}`);
            $('#invoice-tax-details').text(
                `(Imp: € ${totImp.toFixed(2)} - Bollo: € ${impBollo.toFixed(2)})`
            );

            return { totPrest, riv, impBollo, totImp, totDoc };
        }

        $('#invoice-customer-select').change(updateTotalsDisplay);

         // Ricalcolo automatico Date di pagamento
        $('#invoice-date').on('change', function() {
            const d = $(this).val();
            if (!d) return;
            // allineo anche la data di riferimento alla nuova data documento
            $('#invoice-dataRiferimento').val(d);
            recalcInvoiceDueDate();
        });

        $('#invoice-dataRiferimento, #invoice-giorniTermini').on('change keyup', function() {
            recalcInvoiceDueDate();
        });

        // Quando seleziono un servizio dalla tendina, compilo automaticamente la riga
        $('#invoice-product-select').on('change', function() {
            const selectedId = $(this).val();
            const descInput = $('#invoice-product-description');
            const priceInput = $('#invoice-product-price');
            const qtyInput = $('#invoice-product-qty');
            const ivaSelect = $('#invoice-product-iva');
            const esenzioneSelect = $('#invoice-product-esenzioneIva');

            if (!selectedId) {
                // Nessuna scelta: reset campi
                descInput.val('');
                priceInput.val('');
                qtyInput.val(1);
                ivaSelect.val('0');
                esenzioneSelect.val('N2.1');
                descInput.prop('readonly', true);
                ivaSelect.prop('disabled', true);
                esenzioneSelect.prop('disabled', true);
                toggleEsenzioneIvaField('invoice', ivaSelect.val());
                return;
            }

            if (selectedId === 'manual') {
                // Modalità manuale: sblocco descrizione/prezzo, IVA libera
                descInput.val('');
                priceInput.val('');
                qtyInput.val(1);
                ivaSelect.val('0');
                esenzioneSelect.val('N2.1');
                descInput.prop('readonly', false);
                ivaSelect.prop('disabled', false);
                esenzioneSelect.prop('disabled', false);
                toggleEsenzioneIvaField('invoice', ivaSelect.val());
                return;
            }

            // Altrimenti è un prodotto standard
            const product = getData('products').find(p => String(p.id) === String(selectedId));
            if (!product) return;

            descInput.val(product.description || '');
            priceInput.val(product.salePrice || 0);
            qtyInput.val(1);

            ivaSelect.val(product.iva || '0');
            esenzioneSelect.val(product.esenzioneIva || 'N2.1');

            // In questo caso descrizione e prezzo sono modificabili?
            // Se vuoi, puoi bloccarli:
            // descInput.prop('readonly', true);
            // priceInput.prop('readonly', true);

            // IVA/Esenzione Iva: gestite come da logica esistente
            ivaSelect.prop('disabled', false);
            esenzioneSelect.prop('disabled', false);
            toggleEsenzioneIvaField('invoice', ivaSelect.val());
        });

        $('#new-invoice-form').submit(async function(e) { 
            e.preventDefault(); 
            const cid = $('#invoice-customer-select').val(); 
            if (!cid || window.tempInvoiceLines.length === 0) { 
                alert("Dati incompleti."); 
                return; 
            } 
            const type = $('#document-type').val(); 
            const calcs = updateTotalsDisplay(); 
            const data = { 
                number: $('#invoice-number').val(), 
                date: $('#invoice-date').val(), 
                customerId: cid, 
                type: type, 
                lines: window.tempInvoiceLines, 
                totalePrestazioni: calcs.totPrest, 
                importoBollo: calcs.impBollo, 
                rivalsa: { importo: calcs.riv }, 
                totaleImponibile: calcs.totImp, 
                total: calcs.totDoc, 
                status: (type === 'Fattura' ? 'Da Incassare' : 'Emessa'), 
                dataScadenza: $('#invoice-dataScadenza').val(), 
                condizioniPagamento: $('#invoice-condizioniPagamento').val(), 
                modalitaPagamento: $('#invoice-modalitaPagamento').val(), 
                linkedInvoice: $('#linked-invoice').val(), 
                reason: $('#reason').val() 
            }; 

            if (CURRENT_EDITING_INVOICE_ID) { 
                const old = getData('invoices').find(i => String(i.id) === CURRENT_EDITING_INVOICE_ID); 
                if(old) data.status = old.status; 
            } 
            let id = CURRENT_EDITING_INVOICE_ID ? CURRENT_EDITING_INVOICE_ID : String(getNextId(getData('invoices'))); 
            await saveDataToCloud('invoices', data, id); 
            alert("Salvato!"); 
            $('.sidebar .nav-link[data-target="elenco-fatture"]').click(); 
        });

        $('#invoices-table-body').on('click', '.btn-edit-invoice', function() { 
            const id = $(this).attr('data-id'); 
            const inv = getData('invoices').find(i => String(i.id) === String(id)); 
            if (!inv) return;

            if (inv.status === 'Pagata') {
                alert("Non è possibile modificare una fattura già pagata.");
                return;
            }
            if (inv.sentToAgenzia === true) {
                alert("Non è possibile modificare una fattura marcata come inviata all'Agenzia delle Entrate.");
                return;
            }

            $('.sidebar .nav-link').removeClass('active'); 
            $('.sidebar .nav-link[data-target="nuova-fattura-accompagnatoria"]').addClass('active'); 
            $('.content-section').addClass('d-none'); 
            $('#nuova-fattura-accompagnatoria').removeClass('d-none'); 
            loadInvoiceForEditing(id, false); 
        });

        $('#invoices-table-body').on('click', '.btn-delete-invoice', function() { 
            const id = $(this).attr('data-id'); 
            const inv = getData('invoices').find(i => String(i.id) === String(id));
            if (!inv) return;

            if (inv.status === 'Pagata') {
                alert("Non è possibile cancellare una fattura pagata.");
                return;
            }
            if (inv.sentToAgenzia === true) {
                alert("Non è possibile cancellare una fattura marcata come inviata all'Agenzia delle Entrate.");
                return;
            }

            deleteDataFromCloud('invoices', id); 
        });

        $('#invoices-table-body').on('click', '.btn-mark-paid', async function() {
            const id = $(this).attr('data-id');
            const inv = getData('invoices').find(i => String(i.id) === String(id));
            if (!inv) return;

            // Le note di credito non hanno lo stato "Pagata"
            if (inv.type === 'Nota di Credito') {
                alert("Le note di credito non possono essere marcate come 'Pagata'.");
                return;
            }

            // Se già pagata, non fare nulla
            if (inv.status === 'Pagata') return;

            const msg = "Sei sicuro? Una volta marcata come PAGATA, la fattura non potrà più essere modificata.\n\nLo stato 'Inviata' (se presente) non viene modificato.";
            if (!confirm(msg)) return;

            await saveDataToCloud('invoices', { status: 'Pagata' }, id);
            renderInvoicesTable();
        });

        // Flag "Inviata ad ADE": blocca modifica/cancellazione
    $('#invoices-table-body').on('click', '.btn-mark-sent', async function() {
            const id = $(this).attr('data-id');
            const inv = getData('invoices').find(i => String(i.id) === String(id));
            if (!inv) return;

            // Irreversibile: una volta inviato non si può più tornare indietro
            if (inv.sentToAgenzia === true) {
                alert("Questo documento è già marcato come inviato all'Agenzia delle Entrate. L'operazione è irreversibile.");
                return;
            }

            const msg = "Sei sicuro? Una volta inviata la fattura/nota di credito non potrà più essere modificata o eliminata.";
            if (!confirm(msg)) return;

            await saveDataToCloud('invoices', { sentToAgenzia: true }, id);
            renderInvoicesTable();
        });


        // XML
        $('#invoices-table-body, #invoiceDetailModal').on('click', '.btn-export-xml, #export-xml-btn, .btn-export-xml-row', function() { 
            let id = $(this).attr('id') === 'export-xml-btn' ? $('#export-xml-btn').data('invoiceId') : $(this).attr('data-id');
            if (id) generateInvoiceXML(id); 
        });

        function generateInvoiceXML(invoiceId) {
        const invoice = getData('invoices').find(inv => String(inv.id) === String(invoiceId));
        if (!invoice) {
            alert("Errore: fattura non trovata.");
            return;
        }

        const company = getData('companyInfo');
        const customer = getData('customers').find(c => String(c.id) === String(invoice.customerId)) || {};

        // Tipo documento ADE (TD01 = Fattura, TD04 = Nota di Credito)
        const tipoDocumento = (invoice.type === "Nota di Credito") ? "TD04" : "TD01";

        // -----------------------------
        // 1. Dati monetari principali
        // -----------------------------
        const totalePrestazioni = safeFloat(invoice.totalePrestazioni);
        const importoBollo = safeFloat(invoice.importoBollo);
        const importoRivalsa = invoice.rivalsa ? safeFloat(invoice.rivalsa.importo) : 0;
        const totaleImponibile = safeFloat(invoice.totaleImponibile);
        const totaleDocumento = safeFloat(invoice.total);

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
        // 3. Riepilogo per Natura (N2.2, N2.1, N4, …)
        // -----------------------------
        const summaryByNature = {};

        // Linee della fattura
        (invoice.lines || []).forEach(l => {
            const iva = (l.iva != null) ? String(l.iva) : "0";
            const natura = (iva === "0" && l.esenzioneIva) ? String(l.esenzioneIva) : null;

            if (natura) {
                if (!summaryByNature[natura]) {
                    summaryByNature[natura] = {
                        aliquota: iva,
                        natura: natura,
                        imponibile: 0
                    };
                }
                summaryByNature[natura].imponibile += safeFloat(l.subtotal);
            }
        });

        // Aggiungo la rivalsa INPS nel riepilogo come N4 (se presente)
        if (importoRivalsa > 0) {
            const k = "N4";
            if (!summaryByNature[k]) {
                summaryByNature[k] = {
                    aliquota: "0.00",
                    natura: k,
                    imponibile: 0
                };
            }
            summaryByNature[k].imponibile += importoRivalsa;
        }

        let riepilogoXml = "";
        Object.values(summaryByNature).forEach(s => {
            riepilogoXml +=
                `<DatiRiepilogo>` +
                    `<AliquotaIVA>${parseFloat(s.aliquota || "0").toFixed(2)}</AliquotaIVA>` +
                    `<Natura>${escapeXML(s.natura)}</Natura>` +
                    `<ImponibileImporto>${s.imponibile.toFixed(2)}</ImponibileImporto>` +
                    `<Imposta>0.00</Imposta>` +
                `</DatiRiepilogo>`;
        });

        // -----------------------------
        // 4. Dati Bollo (se presente)
        // -----------------------------
        let datiBolloXml = "";

        // Regola:
        // - TD01 (Fattura): bollo sempre
        // - TD04 (Nota di Credito): bollo solo se importo (valore assoluto) > 77,47 €
        const importoDocAssoluto = Math.abs(totaleDocumento);

        if (tipoDocumento === "TD01" || (tipoDocumento === "TD04" && importoDocAssoluto > 77.47)) {
            datiBolloXml =
                `<DatiBollo>` +
                    `<BolloVirtuale>SI</BolloVirtuale>` +
                    `<ImportoBollo>2.00</ImportoBollo>` +
                `</DatiBollo>`;
        }

        // -----------------------------
        // 5. Dati Cassa Previdenziale (Rivalsa INPS, se presente)
        // -----------------------------
        let datiCassaXml = "";
        if (importoRivalsa > 0) {
            const aliqRiv = safeFloat(company.aliquotaInps || company.aliquotaContributi || 0);
            datiCassaXml =
                `<DatiCassaPrevidenziale>` +
                    `<TipoCassa>TC22</TipoCassa>` +
                    `<AlCassa>${aliqRiv.toFixed(2)}</AlCassa>` +
                    `<ImportoContributoCassa>${importoRivalsa.toFixed(2)}</ImportoContributoCassa>` +
                    `<ImponibileCassa>${totalePrestazioni.toFixed(2)}</ImponibileCassa>` +
                    `<AliquotaIVA>0.00</AliquotaIVA>` +
                    `<Natura>N4</Natura>` +
                `</DatiCassaPrevidenziale>`;
        }

        // -----------------------------
        // 6. Corpo XML
        // -----------------------------
        const progressivoInvio = (Math.random().toString(36) + "00000").slice(2, 7);
        const dataFattura = invoice.date || new Date().toISOString().slice(0, 10);
        const dataScadenza = invoice.dataScadenza || dataFattura;

        // Province sempre in maiuscolo (richiesta da Fatturacheck)
        const sedeProvinciaCed = escapeXML((company.provincia || "").toString().toUpperCase());
        const sedeProvinciaDest = escapeXML((customer.provincia || "").toString().toUpperCase());

        let xml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<p:FatturaElettronica versione="FPR12"
     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
     xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<FatturaElettronicaHeader>` +
      `<DatiTrasmissione>` +
        `<IdTrasmittente>` +
          `<IdPaese>IT</IdPaese>` +
          `<IdCodice>${escapeXML(company.codiceFiscale || "")}</IdCodice>` +
        `</IdTrasmittente>` +
        `<ProgressivoInvio>${progressivoInvio}</ProgressivoInvio>` +
        `<FormatoTrasmissione>FPR12</FormatoTrasmissione>` +
        `<CodiceDestinatario>${escapeXML(customer.sdi || "0000000")}</CodiceDestinatario>` +
      `</DatiTrasmissione>` +
      `<CedentePrestatore>` +
        `<DatiAnagrafici>` +
          `<IdFiscaleIVA>` +
            `<IdPaese>IT</IdPaese>` +
            `<IdCodice>${escapeXML(company.piva || "")}</IdCodice>` +
          `</IdFiscaleIVA>` +
          `<CodiceFiscale>${escapeXML(company.codiceFiscale || "")}</CodiceFiscale>` +
          anagraficaCedente +
          `<RegimeFiscale>${escapeXML(company.codiceRegimeFiscale || "")}</RegimeFiscale>` +
        `</DatiAnagrafici>` +
        `<Sede>` +
          `<Indirizzo>${escapeXML(company.address || "")}</Indirizzo>` +
          `<NumeroCivico>${escapeXML(company.numeroCivico || "")}</NumeroCivico>` +
          `<CAP>${escapeXML(company.zip || "")}</CAP>` +
          `<Comune>${escapeXML(company.city || "")}</Comune>` +
          `<Provincia>${sedeProvinciaCed}</Provincia>` +
          `<Nazione>IT</Nazione>` +
        `</Sede>` +
      `</CedentePrestatore>` +
      `<CessionarioCommittente>` +
        `<DatiAnagrafici>` +
          (customer.piva ? (
            `<IdFiscaleIVA>` +
              `<IdPaese>IT</IdPaese>` +
              `<IdCodice>${escapeXML(customer.piva)}</IdCodice>` +
            `</IdFiscaleIVA>`
          ) : ``) +
          (customer.codiceFiscale ? `<CodiceFiscale>${escapeXML(customer.codiceFiscale)}</CodiceFiscale>` : ``) +
          `<Anagrafica>` +
            `<Denominazione>${escapeXML(customer.name || "")}</Denominazione>` +
          `</Anagrafica>` +
        `</DatiAnagrafici>` +
        `<Sede>` +
          `<Indirizzo>${escapeXML(customer.address || "")}</Indirizzo>` +
          `<CAP>${escapeXML(customer.cap || "")}</CAP>` +
          `<Comune>${escapeXML(customer.comune || "")}</Comune>` +
          `<Provincia>${sedeProvinciaDest}</Provincia>` +
          `<Provincia>${escapeXML(customer.provincia)}</Provincia><Nazione>${normalizeCountryCode(customer.nazione)}</Nazione></Sede>` +
      `</CessionarioCommittente>` +
    `</FatturaElettronicaHeader>` +
    `<FatturaElettronicaBody>` +
      `<DatiGenerali>` +
        `<DatiGeneraliDocumento>` +
          `<TipoDocumento>${tipoDocumento}</TipoDocumento>` +
          `<Divisa>EUR</Divisa>` +
          `<Data>${dataFattura}</Data>` +
          `<Numero>${escapeXML(invoice.number || "")}</Numero>` +
          datiBolloXml +
          datiCassaXml +
          `<ImportoTotaleDocumento>${totaleDocumento.toFixed(2)}</ImportoTotaleDocumento>` +
        `</DatiGeneraliDocumento>` +
      `</DatiGenerali>` +
      `<DatiBeniServizi>`;

        // Linee
        let ln = 1;
        (invoice.lines || []).forEach(l => {
            const iva = parseFloat(l.iva != null ? l.iva : 0);
            const natura = (iva === 0 && l.esenzioneIva) ? String(l.esenzioneIva) : null;

            xml += `<DettaglioLinee>` +
                    `<NumeroLinea>${ln++}</NumeroLinea>` +
                    `<Descrizione>${escapeXML(l.productName || "")}</Descrizione>` +
                    `<Quantita>${(parseFloat(l.qty) || 0).toFixed(2)}</Quantita>` +
                    `<PrezzoUnitario>${(parseFloat(l.price) || 0).toFixed(2)}</PrezzoUnitario>` +
                    `<PrezzoTotale>${(parseFloat(l.subtotal) || 0).toFixed(2)}</PrezzoTotale>` +
                    `<AliquotaIVA>${iva.toFixed(2)}</AliquotaIVA>` +
                    (natura ? `<Natura>${escapeXML(natura)}</Natura>` : ``) +
                  `</DettaglioLinee>`;
        });

        // Riepilogo IVA / Natura
        xml += riepilogoXml +
              `</DatiBeniServizi>` +
              `<DatiPagamento>` +
                `<CondizioniPagamento>TP02</CondizioniPagamento>` +
                `<DettaglioPagamento>` +
                  `<ModalitaPagamento>MP05</ModalitaPagamento>` +
                  `<DataScadenzaPagamento>${dataScadenza}</DataScadenzaPagamento>` +
                  `<ImportoPagamento>${totaleDocumento.toFixed(2)}</ImportoPagamento>` +
                  (company.iban ? `<IBAN>${escapeXML(company.iban)}</IBAN>` : ``) +
                `</DettaglioPagamento>` +
              `</DatiPagamento>` +
            `</FatturaElettronicaBody>` +
          `</p:FatturaElettronica>`;

        // Download con nome casuale tipo: IT12345678901_abc12.xml
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const filename = `IT${company.piva || ""}_${randomSuffix}.xml`;

        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Cleanup (important for some browsers)
        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 0);
    }
    // VIEW (Dettaglio Fattura)
        // VIEW
        $('#invoices-table-body').on('click', '.btn-view-invoice', function() {
            const id = $(this).attr('data-id');
            const inv = getData('invoices').find(i => String(i.id) === String(id));
            if (!inv) return;

            const company = getData('companyInfo') || {};
            const customer = getData('customers').find(x => String(x.id) === String(inv.customerId)) || {};

            // Imposta il pulsante XML sul documento corrente
            $('#export-xml-btn').data('invoiceId', inv.id);
            $('#invoiceDetailModalTitle').text(`${inv.type} ${inv.number}`);

            // --- RICALCOLO IMPORTI PER VISUALIZZAZIONE (non tocca i dati salvati) ---
            const rowsSenzaBollo = (inv.lines || []).filter(l =>
                (l.productName || '').toLowerCase() !== 'rivalsa bollo'
            );
            const rigaBollo = (inv.lines || []).find(l =>
                (l.productName || '').toLowerCase() === 'rivalsa bollo'
            );

            const totPrest = rowsSenzaBollo.reduce((s, l) => s + (l.subtotal || 0), 0);
            const impBollo = rigaBollo ? (rigaBollo.subtotal || 0) : 0;

            const aliquotaInps = parseFloat(company.aliquotaInps || 0);
            const hasRivInpsFlag = !!(customer && customer.rivalsaInps);
            const rivInps = hasRivInpsFlag ? (totPrest * (aliquotaInps / 100)) : 0;

            const totImponibile = totPrest + rivInps;
            const totDocumento = totImponibile + impBollo;

            const hasRivInps = hasRivInpsFlag && rivInps > 0;
            const hasBollo = impBollo > 0;

            let h = '';

            // --- HEADER: CEDENTE / CESSIONARIO ---
            h += `
            <div class="row mb-3">
                <div class="col-6">
                    <h5 class="mb-1">Cedente / Prestatore</h5>
                    <div><strong>${escapeXML(company.name || '')}</strong></div>
                    ${company.piva ? `<div>P.IVA: ${escapeXML(company.piva)}</div>` : ''}
                    ${company.codiceFiscale ? `<div>C.F.: ${escapeXML(company.codiceFiscale)}</div>` : ''}
                    ${company.address ? `<div>${escapeXML(company.address)}${company.numeroCivico ? ', ' + escapeXML(company.numeroCivico) : ''}</div>` : ''}
                    ${(company.zip || company.city || company.province)
                        ? `<div>${escapeXML(company.zip || '')} ${escapeXML(company.city || '')} ${escapeXML(company.province || '')}</div>`
                        : ''}
                </div>
                <div class="col-6 text-end">
                    <h5 class="mb-1">Cessionario / Committente</h5>
                    <div><strong>${escapeXML(customer.name || '')}</strong></div>
                    ${customer.piva ? `<div>P.IVA: ${escapeXML(customer.piva)}</div>` : ''}
                    ${customer.codiceFiscale ? `<div>C.F.: ${escapeXML(customer.codiceFiscale)}</div>` : ''}
                    ${customer.address ? `<div>${escapeXML(customer.address)}</div>` : ''}
                    ${(customer.cap || customer.comune || customer.provincia)
                        ? `<div>${escapeXML(customer.cap || '')} ${escapeXML(customer.comune || '')} ${escapeXML(customer.provincia || '')}</div>`
                        : ''}
                </div>
            </div>
            `;

            // --- DATI DOCUMENTO (numero, data, tipo) ---
            h += `
            <div class="row mb-3">
                <div class="col-6">
                    <div><strong>Numero:</strong> ${escapeXML(inv.number || '')}</div>
                    <div><strong>Data:</strong> ${formatDateForDisplay(inv.date)}</div>
                </div>
                <div class="col-6 text-end">
                    <div><strong>Tipo documento:</strong> ${inv.type || 'Fattura'}</div>
                </div>
            </div>
            `;

            // --- DETTAGLIO RIGHE ---
            h += `
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Descrizione</th>
                        <th class="text-end">Q.tà</th>
                        <th class="text-end">Prezzo</th>
                        <th class="text-end">Totale</th>
                    </tr>
                </thead>
                <tbody>
            `;
            (inv.lines || []).forEach(l => {
                const qty = typeof l.qty === 'number' ? l.qty : parseFloat(l.qty || 0) || 0;
                const price = typeof l.price === 'number' ? l.price : parseFloat(l.price || 0) || 0;
                const subtotal = typeof l.subtotal === 'number' ? l.subtotal : parseFloat(l.subtotal || 0) || (qty * price);

                h += `
                    <tr>
                        <td>${escapeXML(l.productName || '')}</td>
                        <td class="text-end">${qty.toFixed(2)}</td>
                        <td class="text-end">€ ${price.toFixed(2)}</td>
                        <td class="text-end">€ ${subtotal.toFixed(2)}</td>
                    </tr>
                `;
            });
            h += `
                </tbody>
            </table>
            `;

            // --- RIEPILOGO IMPORTI ---
            h += `
            <div class="row justify-content-end">
                <div class="col-md-5">
                    <table class="table table-sm mb-0">
                        <tbody>
                            <tr>
                                <th>Totale Prestazioni</th>
                                <td class="text-end">€ ${totPrest.toFixed(2)}</td>
                            </tr>
                            ${hasRivInps ? `
                            <tr>
                                <th>Rivalsa INPS</th>
                                <td class="text-end">€ ${rivInps.toFixed(2)}</td>
                            </tr>` : ''}
                            <tr>
                                <th>Totale Imponibile</th>
                                <td class="text-end">€ ${totImponibile.toFixed(2)}</td>
                            </tr>
                            ${hasBollo ? `
                            <tr>
                                <th>Marca da bollo</th>
                                <td class="text-end">€ ${impBollo.toFixed(2)}</td>
                            </tr>` : ''}
                            <tr class="table-light fw-bold">
                                <th>Totale Documento</th>
                                <td class="text-end">€ ${totDocumento.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            `;

            // --- FOOTER: TESTO FISCALE + DATI PAGAMENTO ---
            const condizioni = inv.condizioniPagamento || '';
            const modalita = inv.modalitaPagamento || '';
            const scadenza = inv.dataScadenza ? formatDateForDisplay(inv.dataScadenza) : '';
            const banca = company.banca || '';
            const iban = company.iban || '';

            h += `
            <div class="mt-3 small">
                <p>
                    Operazione senza applicazione dell’IVA ai sensi dell’art. 1, commi da 54 a 89, Legge n. 190/2014 (Regime Forfettario).
                    Si richiede la non applicazione della ritenuta alla fonte a titolo d’acconto ai sensi dell’art. 1, comma 67, Legge n. 190/2014.
                </p>
            </div>
            <div class="mt-2">
                <h6>Dati di pagamento</h6>
                <table class="table table-sm mb-0">
                    <tbody>
                        <tr>
                            <th>Condizioni</th>
                            <td>${escapeXML(condizioni)}</td>
                        </tr>
                        <tr>
                            <th>Modalità</th>
                            <td>${escapeXML(modalita)}</td>
                        </tr>
                        <tr>
                            <th>Scadenza</th>
                            <td>${scadenza}</td>
                        </tr>
                        <tr>
                            <th>Banca</th>
                            <td>${escapeXML(banca)}</td>
                        </tr>
                        <tr>
                            <th>IBAN</th>
                            <td>${escapeXML(iban)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            `;

            $('#invoiceDetailModalBody').html(h);

            // apertura sicura della modale (anche se i data-bs-* non venissero letti)
        const modalEl = document.getElementById('invoiceDetailModal');
        if (modalEl && window.bootstrap && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        }
        });


        $('#print-invoice-btn').click(()=>window.print());

        // Salvataggio anagrafica azienda
        $('#company-info-form').on('submit', async function(e) { 
            e.preventDefault(); 
            const d={}; 
            $(this).find('input, select, textarea').each(function(){
                if(this.id) {
                    const key = this.id.replace('company-','');
                    d[key] = $(this).val();
                }
            }); 
            await saveDataToCloud('companyInfo', d); 
            alert("Anagrafica azienda salvata!"); 
            renderAll();
        });

        // Salvataggio note
        $('#save-notes-btn').click(async()=>{
            if (!currentUser) {
                alert("Utente non autenticato.");
                return;
            }
            await saveDataToCloud('notes', {userId:currentUser.uid, text:$('#notes-textarea').val()}, currentUser.uid); 
            alert("Note salvate!"); 
        });

        // =========================================================
        // BACKUP JSON DAL CLOUD (UTENTE CORRENTE)
        // =========================================================
        $('#export-cloud-json-btn').on('click', async function () {
            try {
                if (!currentUser) {
                    alert('Devi prima effettuare il login.');
                    return;
                }

                // Mi assicuro di avere i dati aggiornati dal Cloud
                await loadAllDataFromCloud();

                const backup = {
                    userId: currentUser.uid,
                    companyInfo: globalData.companyInfo || {},
                    products: globalData.products || [],
                    customers: globalData.customers || [],
                    invoices: globalData.invoices || [],
                    notes: globalData.notes || []
                };

                const blob = new Blob(
                    [JSON.stringify(backup, null, 2)],
                    { type: 'application/json' }
                );

                const a = document.createElement('a');
                const today = new Date().toISOString().slice(0, 10); // es. 2025-12-01
                a.download = `gestionale-backup-${today}.json`;
                a.href = URL.createObjectURL(blob);
                a.click();
                URL.revokeObjectURL(a.href);
            } catch (err) {
                console.error('Errore export backup JSON:', err);
                alert('Errore durante il backup JSON dal Cloud.');
            }
        });


        // =========================================================
        // ELIMINAZIONE DOCUMENTI PER ANNO (UTENTE CORRENTE) - SOLO MIGRAZIONE
        // =========================================================
        function refreshDeleteDocumentsYearSelect() {
            const $sel = $('#delete-year-select');
            if ($sel.length === 0) return;

            const years = new Set();
            const currentYear = String(new Date().getFullYear());
            years.add(currentYear);

            const invs = getData('invoices') || [];
            invs.forEach(inv => {
                const d = (inv && inv.date) ? String(inv.date) : '';
                if (d.length >= 4) years.add(d.substring(0, 4));
            });

            const sorted = Array.from(years)
                .filter(y => /^\d{4}$/.test(y))
                .sort((a, b) => b.localeCompare(a));

            const prev = $sel.val() || '';
            $sel.empty().append('<option value="">Seleziona...</option>');
            sorted.forEach(y => $sel.append(`<option value="${y}">${y}</option>`));

            // default: anno corrente se presente, altrimenti il primo disponibile
            if (sorted.includes(currentYear)) $sel.val(currentYear);
            else if (sorted.length) $sel.val(sorted[0]);
            else $sel.val(prev);
        }

        // Popola la select quando apro la pagina Migrazione
        // (non impatta altre sezioni)
        $('#delete-documents-year-btn').on('click', async function () {
            try {
                if (!currentUser) {
                    alert('Devi prima effettuare il login.');
                    return;
                }

                const year = $('#delete-year-select').val();
                if (!year || !/^\d{4}$/.test(year)) {
                    alert('Seleziona un anno valido.');
                    return;
                }

                const msg1 = `Sei sicuro di voler eliminare TUTTI i documenti (fatture e note di credito) dell'anno ${year}?`;
                if (!confirm(msg1)) return;

                const msg2 = 'OPERAZIONE IRREVERSIBILE. Consigliato: fai prima un Backup JSON.\n\nConfermi eliminazione?';
                if (!confirm(msg2)) return;

                const userRef = getUserDocRef();
                const snap = await userRef.collection('invoices').get();

                const toDelete = snap.docs.filter(doc => {
                    const data = doc.data() || {};
                    const d = data.date ? String(data.date) : '';
                    return d.substring(0, 4) === year;
                });

                if (toDelete.length === 0) {
                    alert(`Nessun documento trovato per l'anno ${year}.`);
                    return;
                }

                // Firestore batch max 500
                let deleted = 0;
                for (let i = 0; i < toDelete.length; i += 450) {
                    const batch = db.batch();
                    const chunk = toDelete.slice(i, i + 450);
                    chunk.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    deleted += chunk.length;
                }

                // aggiorna cache locale
                globalData.invoices = (getData('invoices') || []).filter(inv => {
                    const d = inv && inv.date ? String(inv.date) : '';
                    return d.substring(0, 4) !== year;
                });

                // refresh UI collegati ai documenti
                if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
                if (typeof refreshInvoiceYearFilter === 'function') refreshInvoiceYearFilter();
                if (typeof refreshStatsYearFilter === 'function') refreshStatsYearFilter();
                refreshDeleteDocumentsYearSelect();

                alert(`Eliminati ${deleted} documenti dell'anno ${year}.`);
            } catch (err) {
                console.error('Errore eliminazione documenti per anno:', err);
                alert('Errore durante l\'eliminazione dei documenti. Controlla la console.');
            }
        });

        // Import dal vecchio JSON (localStorage)
        $('#import-file-input').on('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function(ev) {
                try {
                    const oldData = JSON.parse(ev.target.result);
                    if (!currentUser) {
                        alert("Devi essere loggato per importare i dati.");
                        return;
                    }

                    const newStruct = {
                        companyInfo: oldData.companyInfo || {},
                        products: oldData.products || [],
                        customers: oldData.customers || [],
                        invoices: oldData.invoices || [],
                        notes: oldData.notes || []
                    };

                    if (newStruct.companyInfo) {
                        await saveDataToCloud('companyInfo', newStruct.companyInfo, 'companyInfo');
                    }

                    for (const p of newStruct.products) {
                        const id = p.id || ('PRD' + new Date().getTime());
                        await saveDataToCloud('products', p, id);
                    }

                    for (const c of newStruct.customers) {
                        const id = c.id || String(getNextId(getData('customers')));
                        await saveDataToCloud('customers', c, id);
                    }

                    for (const inv of newStruct.invoices) {
                        const id = inv.id || String(getNextId(getData('invoices')));
                        await saveDataToCloud('invoices', inv, id);
                    }

                    for (const n of newStruct.notes) {
                        const id = n.id || currentUser.uid;
                        await saveDataToCloud('notes', n, id);
                    }

                    await loadAllDataFromCloud();
                    renderAll();
                    alert("Importazione dal vecchio formato completata!");

                } catch (err) {
                    console.error("Errore import vecchio JSON:", err);
                    alert("Errore durante l'importazione del vecchio JSON: " + err.message);
                }
            };
            reader.readAsText(file);
        });
}

window.bindEventListeners = bindEventListeners;
