## V.13.10_step 14 — Fix caricamento acquisti dopo login
- Risolto l'errore post-login `getNormalizedPurchases is not defined`, emerso durante il caricamento dei dati/dashboard.
- Aggiunto nel modulo Acquisti un helper locale prudente che normalizza gli acquisti tramite `DomainNormalizers.normalizePurchaseInfo()` quando disponibile, mantenendo fallback sicuro ai dati grezzi.
- Nessuna modifica a recupero password, Timesheet, fatturazione o Google Calendar Home.

## V.13.10_step 13 — Recupero password Firebase in login
- aggiunto nella schermata di accesso il link **Password dimenticata?**.
- introdotta una modale Bootstrap per inserire l'email e richiedere a Firebase Auth l'invio del link di reset password.
- messaggio di conferma neutro: non espone se l'indirizzo email è registrato oppure no.
- nessuna modifica a Firestore, Timesheet, fatture, calendario o modello dati applicativo.

## V.13.10_step 12 — Google Calendar 7 giorni in Home
- aggiunta in **Dati Azienda** l'impostazione opzionale `Google Calendar Home` per inserire un URL embed Google Calendar o un ID calendario.
- la Home usa Google Calendar in modalità `WEEK` quando l'impostazione è presente e valida; in caso contrario mantiene il calendario locale esistente.
- integrazione volutamente prudente: nessun OAuth Calendar, nessuna modifica a Firebase Auth e nessun nuovo backend applicativo.

## V.13.10_step 11 — Dark Mode blocco Allegato XML da Timesheet
- migliorata la leggibilità del blocco **Allegato XML da Timesheet** nel form fattura quando è attiva la Dark Mode.
- aggiunto uno stile mirato per `#invoice-timesheet-attachment-options`, perché la classe Bootstrap `bg-light-subtle` non era coperta dagli override dark mode già presenti per `bg-light` e `bg-white`.
- nessuna modifica al flusso funzionale dell'allegato: il PDF resta descrittivo, opzionale e non modifica righe, totali o documento fiscale principale.

## V.13.10_step 10 — Allegato Timesheet PDF nell'XML della fattura
- aggiunte nel form fattura le opzioni per allegare all'XML un **PDF con il dettaglio non aggregato del timesheet** e per includere le **note operative** dei worklog.
- il dataset dell'allegato viene ricostruito dai worklog collegati alla fattura tramite `timesheetImport` e metadati `tsWorklogIds`, così il dettaglio resta separato dalle righe fiscali aggregate.
- introdotti `invoice-timesheet-attachment-service.js` e `invoice-timesheet-pdf-service.js` per costruire l'allegato e generare un PDF browser-side senza dipendenze esterne.
- `InvoiceExportService` prepara l'allegato solo se richiesto, mentre `InvoiceXMLMapper` serializza il blocco `<Allegati>` nel tracciato FatturaPA senza alterare i totali del documento.

## V.13.10_step 09 — Toggle visibilità password in login
- aggiunto nella schermata di accesso un pulsante con icona **occhio** per mostrare o nascondere la password digitata.
- nessuna modifica alla logica di autenticazione: cambia solo la visibilità del campo password lato interfaccia.

## V.13.10_step 08 — Revisione completa manuale utente
- riscritta e ampliata la sezione **Manuale utente** con spiegazioni più chiare su anagrafica azienda, regimi fiscali, documenti, acquisti, scadenziario e simulazioni.
- estesa la guida passo-passo con un percorso più completo su commesse, progetti, timesheet, import ore in fattura, nota di credito e collaudo finale.
- rigenerata la documentazione in-app (`docs-content.js`) a partire dai file Markdown aggiornati.

## V.13.10_step 08 — Azioni XML contestuali nel dettaglio fattura
- aggiunto nel footer della modale dettaglio documento un menu a tendina **XML** al posto del pulsante singolo di export.
- il menu include: **Genera XML**, **Copia XML**, **Apri FatturaCheck**, **Apri FEX** e **Apri Agenzia Entrate**.
- i validatori esterni si aprono sempre in una **nuova tab** e non ricevono automaticamente il file: il caricamento o l'incolla dell'XML resta sotto controllo dell'utente.
- aggiunto un disclaimer privacy sui servizi di validazione di terze parti.
- spostato anche il toggle **Dark mode** sopra la voce **Home** nella sidebar.

## V.13.10_step 08 — Ripristino toggle Dark Mode
- reintrodotto un toggle **Dark mode on/off** visibile in fondo alla sidebar, così il cambio tema torna accessibile senza entrare nella pagina Azienda
- `theme-module.js` sincronizza ora sia la select completa `#app-theme-select` sia il nuovo switch `#sidebar-darkmode-toggle`
- il toggle laterale forza rapidamente **Chiaro/Scuro**, mentre la select in Preferenze App continua a supportare anche l'opzione **Segui sistema**

## V.13.10_step 04 — Stati documento + audit store/read
- introdotto `normalizeInvoiceStatusInfo()` in `js/core/domain-normalizers.js` per riallineare stato documento, bozza, inviata ad ADE e nota di credito tra lista fatture, scadenziario e flussi di export
- `invoices-list-module.js`, `scadenziario-module.js` e `scadenziario-render.js` leggono ora una shape canonica degli stati, riducendo mismatch tra pagata/inviata/bozza e filtraggio scadenziario
- ridotti altri fallback a `renderAll()` nei CRUD semplici (azienda/anagrafiche/acquisti) e rimossa una lettura legacy diretta di `globalData` dall'import XML acquisti

## V.13.10_step 01 — Timesheet import hardening (checklist punto 6)
- introdotto `normalizeTimesheetImportInfo()` in `js/core/domain-normalizers.js` per riallineare batch import, gruppi, worklog IDs e stato import tra modale fattura, sessione e persistenza
- `InvoiceFormSessionService`, `InvoiceFormStateService` e `InvoiceService` usano ora lo stesso normalizzatore per leggere e salvare `timesheetImport`
- `InvoicePersistenceService` usa anche il fallback dello stato `timesheetImport` per marcare i worklog come fatturati quando le righe importate sono già state trasformate
- estesi i test browser-based dei normalizer con casi dedicati al flusso Timesheet → Fattura

## V.13.00_step 08 — Totali documento hardening (checklist punto 5)
- introdotto `normalizeInvoiceTotalsInfo()` in `js/core/domain-normalizers.js` per riallineare totali, bollo, rivalsa, IVA, ritenuta e netto tra preview, persistenza e export XML
- `InvoiceService`, `invoices-form-module.js`, `invoices-list-module.js` e `InvoiceExportService` usano ora una risoluzione canonica dei totali documento
- aggiunti test browser-based sui fallback dei totali calcolati/persistiti

## V.13.00_step 07 — Credit note hardening (checklist punto 4)
- introdotto `normalizeCreditNoteInfo()` in `js/core/domain-normalizers.js` per riallineare alias legacy e campi canonici di **nota di credito**, documento collegato, data documento collegato e causale
- `InvoiceService`, `InvoiceFormStateService`, `InvoiceValidationService`, `InvoiceXMLValidator` e `InvoiceXMLMapper` usano ora la stessa risoluzione dei dati di nota di credito
- il mapper XML aggiunge `DatiFattureCollegate` quando sono disponibili sia numero sia data del documento collegato
- estesi i test browser-based dei normalizer con casi dedicati alle note di credito

## V.13.00_step 06 — Payment/account selection hardening (checklist punto 3)
- introdotto `normalizeInvoicePaymentInfo()` in `js/core/domain-normalizers.js`
- riallineati metodo di pagamento, `bankChoice`, fallback conto principale/secondario e banca/IBAN selezionati
- preview fattura, validator XML e mapper XML leggono ora la stessa risoluzione del pagamento
- aggiunti test browser-based sui casi `Rimessa Diretta` e conto 2 non configurato

## V.13.00_step 01 (Fase 5 completata – versione ridisegnata)
- Chiusa la Fase 5 del refactoring con una rifinitura finale della strategia di test browser-based.
- Aggiunta `tests/index.html` come pagina indice unica delle suite di dominio: `TaxRegimePolicy`, `InvoiceCalculator`, `InvoiceXMLValidator` e `InvoiceXMLMapper`.
- Nessun cambio funzionale ai flussi gestionali: lo step serve a rendere più semplice l'esecuzione manuale dei test e a segnare il passaggio alla versione ridisegnata del progetto.

## v12.51 (Fase 5 – test unitari InvoiceXMLMapper)
- Aggiunta la suite browser-based `tests/invoice-xml-mapper.spec.js` con pagina dedicata `tests/invoice-xml-mapper.test.html`.
- Esteso `tests/test-harness.js` con `assertIncludes(...)` e `assertMatch(...)` per verificare in modo leggibile frammenti e pattern del tracciato XML.
- Coperti i casi più delicati del mapper: XML ordinario, forfettario con natura `N2.2` e riferimento normativo, note di credito `TD04`, pagamento con banca/IBAN, anagrafiche persona fisica/azienda, bollo, rivalsa previdenziale, scorporo e spezzatura delle causali lunghe.
- Nessun cambio funzionale al flusso applicativo: step dedicato alla qualità del layer di export XML.

## v12.50 (Fase 5 – test unitari InvoiceXMLValidator)
- Aggiunta la suite browser-based `tests/invoice-xml-validator.spec.js` con pagina dedicata `tests/invoice-xml-validator.test.html`.
- Coperti i casi principali del layer `InvoiceXMLValidator`: numero e data documento, identità cliente, identificativi fiscali, indirizzi azienda/cliente, righe esportabili, codice regime fiscale, pagamento con IBAN e note di credito.
- Verificato anche l'aggancio con il controllo base di `InvoiceValidationService.validateXmlContext(...)`, così i test coprono sia i blocchi introdotti in Fase 3 sia i fallback di validazione preesistenti.
- Nessun cambio funzionale alla UI: step dedicato a qualità e affidabilità dell'export XML.

## v12.49 (Fase 5 – test unitari InvoiceCalculator)
- Aggiunta la suite browser-based `tests/invoice-calculator.spec.js` con pagina dedicata `tests/invoice-calculator.test.html`.
- Esteso `tests/test-harness.js` con `assertApprox(...)` per verifiche numeriche affidabili sui calcoli monetari.
- Coperti i casi principali del layer `InvoiceCalculator`: default di regime, aliquota IVA effettiva, errore se il motore comune manca, fattura ordinaria semplice, forfettario con bollo automatico, rivalsa INPS, ritenuta, scorporo e opzione `includeBolloInTotale`.
- Nessun cambio funzionale alla UI: step focalizzato sulla qualità del dominio di calcolo fatture.

## v12.48 (Fase 5 – test unitari TaxRegimePolicy)
- Introdotta la prima suite di test unitari browser-based nella cartella `tests/`.
- Aggiunti `tests/test-harness.js`, `tests/tax-regime-policy.spec.js` e `tests/tax-regime-policy.test.html`.
- Coperti i casi base del layer `TaxRegimePolicy`: risoluzione del regime, fallback da `codiceRegimeFiscale`, capability, visibilità UI e default fattura.
- Nessun cambio funzionale al flusso applicativo: step dedicato alla qualità e verificabilità del dominio.

## v12.47 (Refactoring Fase 4 – store adoption controllata)
- Avviata l'adozione reale di **AppStore** nei moduli semplici: **Azienda, Clienti, Servizi, Fornitori**.
- I renderer di anagrafiche leggono ora in modo esplicito dallo store, con fallback legacy compatibile.
- `company-render.js` supporta refresh dal dato passato o dal dato corrente nello store.
- `masterdata-helpers.js` usa lo store per edit di clienti/prodotti/fornitori e per la lettura del `companyInfo` corrente.
- `company-module.js` è stato collegato allo store anche in lettura, mantenendo compatibilità con il flusso Firestore esistente.

## v12.46 (Refactoring Fase 4 – meno `renderAll()` nei CRUD frequenti)
- **`UiRefresh` esteso ancora**: aggiunti refresh combinati per `fatture + analisi + scadenziario` e `acquisti + analisi + scadenziario`, così le aree dipendenti si aggiornano insieme senza ricorrere al refresh globale.
- **CRUD Fatture più mirati**: cancellazione documento, marcatura come pagata e marcatura come inviata aggiornano ora vendite, analisi e scadenziario tramite refresh selettivi.
- **CRUD Acquisti più mirati**: eliminazione acquisto e cambio stato pagamento aggiornano acquisti, analisi e scadenziario senza passare da `renderAll()` quando non serve.
- **Cambio stato da Scadenziario riallineato**: le azioni sullo scadenziario usano il refresh combinato delle fatture, così tabella vendite, analisi e scadenze restano coerenti con meno lavoro inutile.

## v12.45 (Refactoring Fase 4 – refresh mirati sui flussi frequenti)
- **`UiRefresh` esteso**: aggiunti refresh dedicati per company/navigation, scadenziario e aree dipendenti dal regime, così il layer introdotto in v12.44 copre più casi reali senza forzare `renderAll()`.
- **Salvataggio anagrafica azienda**: `company-module.js` usa ora un refresh mirato di company + navigation + aree dipendenti, invece del redraw completo dell'app dopo ogni modifica aziendale.
- **Fatture e acquisti**: submit fattura e salvataggio acquisto aggiornano in modo selettivo vendite/acquisti/analisi prima di riportare l'utente alla lista.
- **Scadenziario**: il cambio stato di fatture e acquisti da scadenziario aggiorna ora solo le aree interessate (vendite/scadenziario oppure acquisti/analisi), riducendo refresh globali e accoppiamento UI.

## v12.44 (Refactoring Fase 4 – Store minimo e refresh mirati)
- **Introdotto `AppStore`**: layer minimo sopra `globalData` con `get/set/update/mergeItem/removeItem/subscribe`, pensato per avviare la Fase 4 senza rompere la compatibilità legacy.
- **Cloud sincronizzato con lo store**: `loadAllDataFromCloud`, `saveDataToCloud`, `batchSaveDataToCloud` e `deleteDataFromCloud` aggiornano anche lo store applicativo.
- **Introdotto `UiRefresh`**: refresh mirati per masterdata, vendite, acquisti e analisi, così le operazioni più semplici non devono sempre passare da `renderAll()`.
- **Primi moduli aggiornati**: anagrafiche, alcune azioni elenco fatture e toggle stato acquisti usano refresh selettivi e `skipRender` nelle delete.

## v12.43 (Refactoring Fatture – Fase 3 final cleanup)
- **Sessione Modale Fattura**: `InvoiceFormSessionService` ora mantiene stato coerente di documento in editing, righe temporanee e import timesheet, sincronizzando i fallback legacy solo per compatibilità.
- **Import Timesheet**: `invoices-timesheet-import-module.js` usa la sessione fattura al posto di `tempInvoiceLines`/`App.invoices.timesheetImportState` sparsi, riducendo l'accoppiamento tra modale, import e persistenza.
- **Form Fattura**: `invoices-form-module.js` è stato alleggerito ancora nei punti di rimozione righe e bootstrap dello stato in nuovo documento/modifica/copia.
- **XML più robusto**: precheck più stretti su identità fiscale azienda/cliente, controllo migliore sulle note di credito e aggiunta di `DatiFattureCollegate` quando è presente un documento collegato.

## v12.42 (Refactoring Fatture – Fase 3 consolidamento controller/export)
- **Introdotto `InvoiceFormSessionService`**: stato della modale fattura (ID corrente, righe locali, stato import Timesheet) centralizzato in un layer dedicato, così `invoices-form-module.js` riduce ulteriormente la dipendenza da globali sparsi.
- **Introdotto `InvoiceExportService`**: il flusso XML ora passa da un orchestratore dedicato che recupera il contesto, valida l’esportabilità, calcola i totali e gestisce il download senza lasciare questa logica dentro `invoices-xml-module.js`.
- **Confini service più puliti**: `invoices-list-module.js` usa direttamente `InvoicePersistenceService` per sbloccare i worklog collegati durante l’eliminazione documento, evitando di passare dal modulo form.
- **XML ancora più blindato**: `InvoiceXMLValidator` verifica ora anche sede azienda con alias robusti e presenza di un IBAN aziendale quando la modalità di pagamento è bonifico/rimessa diretta.
- **`invoices-form-module.js` alleggerito ancora**: molte letture/scritture dello stato locale passano da helper di sessione (`getCurrentInvoiceIdSafe`, `getInvoiceLinesSafe`, `setInvoiceLinesSafe`) invece di usare direttamente variabili globali.

## v12.41 (Refactoring Fatture – Fase 3 rifinitura prudente)
- **Introdotto `InvoiceFormUiService`**: creazione riga da input UI, aggiornamento inline della riga, modifica descrizione e rimozione riga vengono delegati fuori da `invoices-form-module.js`, che resta più vicino al ruolo di controller della modale.
- **`invoices-form-module.js` alleggerito ancora**: gli handler di aggiunta/modifica/cancellazione righe usano ora un service dedicato invece di contenere direttamente logica su scorporo, classificazione costo/lavoro e mutazioni dell'array locale.
- **XML più robusto senza strappi**: `InvoiceXMLMapper` normalizza meglio anagrafica e indirizzi di azienda/cliente (alias comuni come `zip/cap`, `city/comune`, `address/indirizzo`) e continua a generare il tracciato senza una riscrittura aggressiva.
- **Precheck XML più severi**: `InvoiceXMLValidator` richiede anche un identificativo fiscale del cliente e usa una risoluzione più robusta dei campi sede prima dell'export.

## v12.40 (Refactoring Fatture – Fase 3 hardening XML e submit)
- **Introdotti `InvoiceFormStateService` e `InvoiceSubmitService`**: raccolta stato form, validazione, duplicate check e persistenza del documento vengono orchestrati fuori da `invoices-form-module.js`, che resta più vicino al ruolo di controller UI.
- **`invoices-form-module.js` alleggerito ancora**: l’handler di submit delega ora a service dedicati invece di contenere tutta la procedura di costruzione payload e salvataggio.
- **Confini service più netti**: `InvoiceFormStateService` raccoglie i dati UI, `InvoiceSubmitService` orchestra il flusso di salvataggio, `InvoiceService` continua a costruire il payload, `InvoicePersistenceService` persiste, `InvoiceXMLMapper` trasforma.
- **XML più blindato**: `InvoiceXMLValidator` verifica meglio anagrafica cliente/azienda e nota di credito; `InvoiceXMLMapper` gestisce causali XML e anagrafica cliente persona fisica vs azienda senza riscrivere il tracciato in modo aggressivo.

## v12.39 (Refactoring Fatture – Fase 3 consolidamento prudente)
- **Introdotto `InvoicePersistenceService`**: il salvataggio della fattura e la sincronizzazione dei worklog importati non vivono più nel submit della form, ma in un layer dedicato che centralizza persist e binding documento/worklog.
- **`invoices-form-module.js` alleggerito ancora**: il submit delega il persist al service e mantiene solo orchestrazione UI, validazione finale e gestione feedback.
- **Attenzione ulteriore all’XML**: `InvoiceXMLValidator` verifica ora anche numero/data documento, denominazione cliente, presenza di almeno una riga esportabile e codice regime fiscale azienda prima di chiamare il mapper.
- **Compatibilità mantenuta**: `InvoiceXMLMapper` non viene riscritto e il tracciato FatturaPA resta stabile; il refactor agisce sul contorno per ridurre rischio di regressioni.

## v12.38 (Refactoring Fatture – Fase 3 continuazione cauta)
- **Introdotto `InvoiceValidationService`**: validazione minima del form documento, controllo duplicati soft e messaggi di conferma sono stati centralizzati fuori da `invoices-form-module.js`.
- **Introdotto `InvoiceLineService`**: creazione/aggiornamento righe documento e raccolta degli ID worklog importati passano da un layer dedicato, riducendo logica sparsa nel form.
- **`InvoiceService` esteso**: costruisce ora anche il payload persistito del documento (stato bozza, pagamenti, bollo, dati calcolati), alleggerendo il submit della form.
- **Attenzione all’XML**: aggiunto `InvoiceXMLValidator` come pre-check dedicato per l’export, così la sicurezza del contesto XML aumenta senza riscrivere `InvoiceXMLMapper` né cambiare il tracciato FatturaPA generato.
- **`invoices-form-module.js` ulteriormente alleggerito**: il submit delega validazione, duplicate check e costruzione payload; gli handler riga usano i nuovi service senza cambiare il comportamento funzionale della UI.

## v12.37 (Refactoring Fatture – Fase 3 avviata)
- **Introdotto `InvoiceCalculator`**: il calcolo documento viene richiamato da un layer dedicato, lasciando compatibilità con il motore già presente in `invoices-common-calc.js`.
- **Introdotto `InvoiceService`**: recupero contesto documento (fattura/azienda/cliente), stato iniziale del form e stato di editing/copia centralizzati in un modulo dedicato.
- **Introdotto `InvoiceXMLMapper`**: la costruzione del tracciato XML FatturaPA è stata estratta in un mapper puro, così `invoices-xml-module.js` si occupa solo di orchestrare contesto, calcolo e download del file.
- **Attenzione alla stabilità XML**: il refactor non cambia il flusso di export né il naming del file; isola la costruzione del tracciato per poter evolvere il dominio fatture riducendo il rischio di regressioni sul file XML.
- **`invoices-form-module.js` alleggerito**: default fattura e stato di caricamento documento passano da `InvoiceService`, riducendo logica sparsa nel form.

## v12.36 (Refactoring UI – Fase 2 completata)
- **Estratto `masterdata-render.js`**: ricerca anagrafiche e rendering tabelle di prodotti, clienti e fornitori non vivono più in `js/ui/ui-render.js`.
- **Estratto `analysis-render.js`**: filtri statistiche, registri IVA, Home e calendario sono stati spostati in un modulo dedicato.
- **`ui-render.js` rifinito come orchestratore**: resta il punto di coordinamento alto livello delle aree UI, mentre il dettaglio di rendering è distribuito in moduli specializzati.
- **Approccio prudente mantenuto**: nessun cambio aggressivo ai contratti pubblici dei moduli più fragili (fatture/acquisti), così la Fase 2 si chiude senza anticipare la Fase 3.

## v12.35 (Refactoring UI – Fase 2B cauta)
- **Estratto `tax-render.js`**: le simulazioni fiscali UI (Ordinario e Quadro LM) e i filtri anno dedicati non vivono più direttamente in `js/ui/ui-render.js`.
- **Approccio prudente**: `ui-render.js` mantiene solo wrapper difensivi che delegano a `window.TaxRender`, così il bootstrap legacy e i richiami globali esistenti continuano a funzionare senza cambiare contratto.
- **Ordine script aggiornato**: `index.html` carica ora `js/ui/tax-render.js` prima di `ui-render.js`, riducendo il peso del renderer generale senza toccare ancora le aree più fragili di fatture e acquisti.

## v12.34 (Refactoring UI – Fase 2A rifinitura)
- **Helper UI condivisi**: aggiunto `js/ui/ui-regime-helpers.js` per centralizzare accesso a `companyInfo`, capability del regime fiscale e visibilità UI.
- **Orchestrazione più leggibile**: `renderAll()` in `js/ui/ui-render.js` è stato rifinito in step chiari (`renderMasterDataArea`, `renderPurchasesArea`, `renderSalesArea`, `renderAnalysisArea`) invece di mantenere un unico blocco procedurale.
- **Moduli 2A uniformati**: `company-render`, `navigation-visibility`, `scadenziario-render` e `dashboard-render` usano ora helper condivisi, con meno dipendenze dirette da `globalData` e dalla policy richiamata in modo sparso.

## v12.33 (Refactoring UI – Fase 2A)

- **Estratto `navigation-visibility.js`**: la gestione della visibilità di menu, sezioni e filtri dipendenti dal regime fiscale non è più definita dentro `ui-render.js`.
- **Estratto `company-render.js`**: il rendering della form azienda è stato isolato in un modulo dedicato.
- **Estratto `scadenziario-render.js`**: il rendering della pagina scadenziario è stato separato dal renderer generale.
- **Estratto `dashboard-render.js`**: dashboard mensile/annuale, statistiche e simulazione fiscale lato UI sono stati spostati in un modulo dedicato.
- **`renderAll()` alleggerito**: `js/ui/ui-render.js` rimane l’orchestratore di alto livello, ma non contiene più direttamente queste aree di rendering.
- **`index.html` aggiornato**: caricati i nuovi moduli UI prima di `ui-render.js` per mantenere compatibilità e ordine di bootstrap.

# Changelog (principali aggiunte)

Questo changelog riassume le implementazioni introdotte negli ultimi step fino alla versione “stabile”.

## v12.32 (Tax Regime Policy – chiusura Fase 1)
- **Costanti di dominio**: introdotto `js/core/domain-constants.js` con costanti centralizzate per regime fiscale, codici RF, nature IVA documento e default aziendali.
- **Bonifica fallback residui**: gli ultimi punti ancora legati a controlli diretti su `taxRegime` ora passano dalla policy (`company-module`, `ui-render`).
- **Stringhe fiscali duplicate ridotte**: moduli fattura e XML riallineati all'uso di costanti condivise per `N2.2`, default IVA e tipi documento più sensibili.
- **Base più coerente per Fase 2**: la chiusura della Fase 1 lascia il dominio fiscale centralizzato e pronto per iniziare lo smontaggio di `ui-render.js`.

## v12.31 (Tax Regime Policy – fase 4)
- **UI visibility centralizzata**: aggiunto `getUiVisibility()` nella policy per guidare menu, sezioni azienda e scadenziario senza controlli sparsi nel renderer.
- **Ripulitura moduli legacy**: rimossi altri fallback diretti a `isForfettario()/isOrdinario()` in `ui-render`, `company-module`, `navigation`, `customers`, `products`, `invoice-form`, `invoice-list`, `invoice-calc` e import Timesheet.
- **Renderer più pulito**: `ui-render.js` usa ora helper locali capability/UI-visibility-first, preparando il distacco progressivo delle regole di dominio dal rendering.

## v12.30 (Tax Regime Policy – fase 3)
- **Modulo dedicato**: estratta la policy in `js/core/tax-regime-policy.js`, separando il dominio fiscale da `utils.js`.
- **Compatibilità legacy**: `utils.js` mantiene solo i wrapper globali (`getResolvedTaxRegime`, `isForfettario`, `isOrdinario`, ecc.) che delegano alla policy.
- **Capability-first esteso**: aggiornati render iniziale, navigation e anagrafica prodotti per usare capability/default della policy invece di controlli sparsi.
- **Base per step successivi**: il layer ora è pronto per essere riusato da moduli minori e da eventuali test unitari.

## v12.29 (Tax Regime Policy – fase 2)
- **Capability-first UI**: navigation e `updateCompanyUI()` ora decidono tramite capability della policy (`canManagePurchases`, `canManageSuppliers`, `canUseVatRegisters`, `canUseLmSimulation`, `canUseOrdinarioSimulation`) invece di confronti diretti sul regime.
- **Scadenziario centralizzato**: la visibilità dei filtri pagamenti acquisti / IVA passa da `getScadenziarioVisibility()` della policy.
- **Pulizia moduli**: ridotti ulteriormente i fallback manuali su `taxRegime` nei punti più sensibili (`company-module`, `navigation-module`, `ui-render`, `invoices-form-module`).
- **Nuovo aggregatore capability**: aggiunto `TaxRegimePolicy.getCapabilities()` per fornire un oggetto unico e coerente alle aree UI.

## v12.27 (Stampa fattura: layout tipografico)
- **Dettaglio/Stampa fattura**: rifinita la tabella righe con larghezze colonna più stabili tra descrizione e valori numerici.
- **Importi**: colonne **Prezzo** e **Totale** ora mantengono il valore in una sola riga (`€` + importo senza a capo).
- **Tipografia**: migliorati allineamento numerico, spaziature verticali e resa in stampa/PDF per un layout più pulito.

## v12.25 (Fatture: descrizione righe editabile)
- **Nuova/Modifica fattura**: resa **editabile** la cella *Descrizione* delle righe documento (anche righe importate da Timesheet) tramite edit inline (textarea).
- **Nota**: le fatture in stato **Inviata** restano non modificabili (comportamento invariato).

## v12.24 (Tema scuro: bottoni più leggibili)
- **UI Dark Mode**: aumentato il contrasto dei pulsanti *outline* (`btn-outline-secondary`, `btn-outline-dark`) e dei bottoni `btn-dark` per garantire leggibilità su sfondo scuro.

## v12.23 (Forfettario: Gestione Dati)
- **Impostazioni → Gestione Dati**: in regime **Forfettario** è nascosta la sezione “Elimina Acquisti per Anno”, perché gli acquisti non sono gestiti.

## v12.22 (Forfettario: prefisso descrizione import Timesheet)
- **Anagrafica clienti**: aggiunto campo "Prefisso descrizione import Timesheet (solo Forfettario)".
- **Import ore in fattura**: in regime **Forfettario**, il testo di testa della riga importata può essere personalizzato per cliente (es. "Area di docenza") oppure lasciato vuoto (nessun prefisso). In ordinario il comportamento resta invariato.

## v12.21 (Bollo cliente & Forfettario UI)
- **Forfettario: menu acquisti nascosto**: rimossa la sezione “Fatture di Acquisto” dalla sidebar quando il regime gestionale è Forfettario.
- **Flag cliente Bollo a carico studio**: nuova opzione in anagrafica clienti per non addebitare i 2€ in fattura (Totale Documento invariato), mantenendo comunque l’indicazione del bollo nel file XML.
- **Override sul documento**: il flag viene salvato sul documento (fattura/nota) e ha priorità rispetto all’anagrafica cliente durante calcoli e generazione XML.

## v12.20 (Commesse UI)
- **Allineamento Tabella Commesse**: corretta la generazione righe per rispettare l’intestazione (niente colonne “fantasma”).
- **Colonna “Fatturo a”**: assegnata larghezza più ampia con testo su una riga, ellissi e tooltip (title) per nomi lunghi.

## v12.19 (Timesheet UX)
- **Formattazione Orari Timesheet**: Aggiornato il formato di visualizzazione delle ore da "H / M" a "HH:mm" (es. "03:10") per una migliore leggibilità.
- **Modifica Worklog**: Migliorata l'esperienza di modifica: cliccando su "Modifica", la pagina scorre automaticamente in cima e il focus viene portato sul campo Data.

## v12.18 (Date e Statistiche)
- **Filtri Data Intelligenti**: I filtri del Timesheet (visualizzazione ed export) ora propongono di default il periodo dal 1° del mese corrente fino alla **data odierna** (invece di fine mese).
- **Fix Fuso Orario**: Risolto un problema tecnico nella generazione delle date di default che in alcuni casi causava lo slittamento al giorno precedente.
- **Statistiche Dashboard**: Corretto il calcolo delle ore "Cliente Finale" nei KPI e nelle tabelle: ora i valori a 0 vengono correttamente conteggiati come tali.
- **Totali Progetti**: Aggiunta la colonna "Ore CF Tot" nella tabella Anagrafica Progetti per una rapida consultazione del monte ore lavorato per progetto.

## v12.17 (Fix Timesheet Update & CF Logic)
- **Fix Update Worklog**: Risolto bug critico che impediva il salvataggio delle modifiche ai worklog esistenti (i dati non venivano persistiti correttamente).
- **Data Preservation**: Ora l'aggiornamento preserva correttamente tutti i campi del worklog (inclusi i collegamenti alle fatture `invoiceId`).
- **Logica Ore Cliente Finale**: Migliorata la gestione dei campi "Ore CF" e "Minuti CF". Il sistema ora rispetta i valori inseriti manualmente dall'utente (anche se 0), evitando sovrascritture indesiderate con i valori principali, pur mantenendo il sync automatico di default.

## v12.16 (Documentazione Dinamica & Sync)
- **Documentazione Dinamica**: I manuali non sono più cablati nel codice JavaScript. L'app carica ora i file `.md` direttamente dalla cartella `DOCUMENTAZIONE`.
- **Script di Sincronizzazione**: Introdotto `aggiorna_manuali.py` (e `.ps1`) per generare automaticamente il bundle JavaScript per l'uso offline o su altri dispositivi.
- **Fallback Intelligente**: Sistema di caricamento ibrido (Fetch + Fallback) per garantire il funzionamento dei manuali in ogni ambiente di esecuzione.

## v12.15 (Portale Documentazione Interattivo)
- **Nuovo Visualizzatore**: Trasformazione del manuale in un'app-nella-app. L'indice (`00_INDICE.md`) funge da menu principale interattivo.
- **Navigazione Avanzata**: Supporto per link interni tra file Markdown e pulsante dinamico "Torna all'Indice".
- **Filtro Intelligente**: La sezione Changelog è esclusa automaticamente dall'indice del manuale per una consultazione più pulita.
- **Titoli Dinamici**: L'area documentazione aggiorna il titolo in base alla sezione visualizzata.

## v12.14 (Dark Mode Premium & Sidebar Restruct)
### UI/UX Refinement
- **Dark Mode Premium**: revisione profonda dei contrasti. Eliminati i "blocchi bianchi" (background `bg-light`) in testate fatture, riepiloghi e sezione Versione.
- **Contrasti**: migliorata la leggibilità di breadcrumb, testi secondari (`text-muted`) e campi di sola lettura (`form-control-plaintext`).
- **Uniformità Tabelle**: 
  - **Zebra Striping**: applicato universalmente (Light/Dark) per una scansione dati ottimale.
  - **Header & Footer**: testate e righe totali/footer ora sono in **grassetto** con colori di sfondo distinti dal corpo tabella.
  - **Fix Dark Mode**: rimosso lo sfondo bianco indesiderato sulle testate in modalità scura.

### Sidebar & Navigazione
- **Ristrutturazione Menu**: 
  - Voce **Scadenziario** spostata sotto la sezione **Analisi**.
  - Sezione **Analisi** riposizionata dopo le Fatture di Acquisto per un flusso di lavoro più logico.

## v12.13 (Sidebar Restyle & In-App Docs)
### Sidebar & UI/UX
- **Ristrutturazione Menu**: Sezione "Documenti" divisa in **Fatture di Vendita** (Vendite) e **Fatture di Acquisto** (Acquisti/Scadenziario).
- **Iconografia**: Aggiunte icone a tutte le intestazioni di sezione per una navigazione più intuitiva.
- **Controlli Globali**: Pulsanti **Espandi** e **Comprimi** tutto integrati nella riga "Home".
- **Stabilità Layout**: Fissata larghezza sidebar a 260px con `scrollbar-gutter: stable` per evitare restringimenti su Windows.
- **Custom Scrollbar**: Stilizzata la barra di scorrimento del menu con i colori del tema (`#2c3e50`) per un look più premium.

### Documentazione
- **Asset Bundling**: Manuale e Changelog ora integrati direttamente nel codice (`docs-content.js`).
- **Zero Configuration**: Eliminata la necessità di server locali o file `.bat` per la consultazione dei manuali.
- **Accesso Rapido**: Manuale e Versione accessibili istantaneamente dalla sezione **Info**.

## v12.11 (Binding Timesheet-Fatture e Progetti)
### Timesheet / Fatture
- **Binding Worklog-Fattura**: lo stato "Fatturato" dei worklog viene ora aggiornato solo al salvataggio definitivo della fattura.
- **Riconoscimento automatico**: durante l'importazione ore, il sistema riconosce i worklog già collegati ad altre fatture per evitare duplicationi.
- **Sincronizzazione cancellazione**: eliminando una riga fattura, il relativo worklog viene sbloccato; eliminando l'intera fattura, tutti i worklog collegati tornano disponibili.

### Progetti
- **Spostamento Dati**: i campi **Codice Progetto** e **Cliente finale** sono stati spostati dall'anagrafica Commesse ai singoli Progetti per una gestione più granulare.
- **Miglioramento UI**: popolamento automatico del selettore "Cliente finale" nella modale di creazione/modifica progetto.
- **Consistenza**: le tabelle dei progetti ora mostrano direttamente il codice e il cliente finale associato.

## v11.08 (Stable Cloud)
### Gestione Dati (ex Migrazione)
- Rinomina “Migrazione” → **Gestione Dati**.
- **Backup dal Cloud**: esportazione JSON completa (companyInfo + tutte le collezioni).
- **Importa Backup JSON**: import “merge” (aggiorna per ID, non cancella record extra).
- **Ripristino totale (Reset + Import)** con doppia conferma (prompt `ELIMINA`).
- **Reset totale dati (Reset classe)** con doppia conferma e cancellazione di:
  - tutte le collezioni principali
  - **tutti i doc in `settings/*`** (anche futuri)
- Eliminazioni parziali:
  - **Elimina Documenti per anno** (fatture/NC)
  - **Elimina Acquisti per anno**

### Impostazioni
- **Uso dati (stima)**: tabella + progress bar su 1 GiB (Spark), basata su dimensione JSON dei dati.

### Acquisti
- **Importa XML** (FatturaPA fornitore) nel form Nuovo Acquisto:
  - parsing header/body
  - creazione fornitore con conferma se mancante
  - precompilazione righe e scadenze (se presenti)

### Timesheet / Export CSV
- Esportazione CSV migliorata:
  - date in formato italiano `gg/mm/aaaa`
  - rimozione newline e sequenze `\\n` dai campi testo
  - ordine colonne: `Date|EndCustomer|BillToCustomer|Commessa|Project|Minutes|Hours|Billable`
- Fix popolamento combo filtri (Fatturo a / Commessa / Progetto) all’apertura pagina Export.

### Migliorie UX
- Forzato refresh delle select anno all’apertura della pagina Gestione Dati.

### Dashboard
- Aggiunta pagina **Dashboard** con selettore **Annuale/Mensile**.
- KPI principali: **Ore timesheet totali**, **Ore fatturabili**, **Ore già fatturate**, **N. worklog**.
- Tabelle: dettaglio mensile/giornaliero e Top Progetti/Commesse per ore fatturabili.

## v12.03 (Step39 – Progetti/Timesheet Cliente Finale)
### Progetti
- Aggiunti **Codice Progetto** e **Cliente finale** sul Progetto (non più in Commessa).
- In modale Progetto: quando selezioni un **Servizio**, eredita **tariffa** e flag **Lavoro/Costo** (modificabili).

### Timesheet
- Gestione doppia durata:
  - **Minutes / Hours** = ore da fatturare alla commessa (Fatturo a)
  - **FinalMinutes / FinalHours** = ore valorizzate per il **cliente finale** (di default uguali alle ore commessa)
- Note in timesheet supportano input **multiriga**.
- In modifica worklog, il form torna in testata e porta il focus sui campi principali.

### Export Timesheet
- Aggiunte colonne: **ProjectCode**, **FinalMinutes**, **FinalHours**.
- Nel pivot Giorno+Commessa aggiunti: **FinalTotalMinutes** e **FinalTotalHours**.

### Dashboard
- KPI e tabelle mostrano anche il confronto **Cliente finale (CF)**.
- In Top Commesse/Progetti, la colonna “Cliente finale” è derivata dai Progetti/Worklog del periodo.