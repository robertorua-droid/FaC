==================================================================
DOCUMENTAZIONE TECNICA E FUNZIONALE
Gestionale Semplice per Professionisti (v6.4 - Stabile)
==================================================================

1. ARCHITETTURA E FILOSOFIA DEL PROGETTO
------------------------------------------------------------------

L'applicazione è una Single-Page Application (SPA) costruita interamente con tecnologie front-end.

-   **Stack Tecnologico**: HTML5, Bootstrap 5, Font Awesome, jQuery.
-   **Persistenza dei Dati**: I dati sono salvati nel `localStorage` e gestiti tramite le funzioni `getData(key)` e `saveData(key, data)`. Le chiavi principali sono: `companyInfo`, `products`, `customers`, `users`, `invoices`, `notes`.

==================================================================
2. FLUSSO DI AVVIO E SISTEMA DI LOGIN
==================================================================
-   **Inizializzazione**: La funzione `checkAndSeedData()` popola il `localStorage` con `sampleData` al primo avvio.
-   **Autenticazione**: L'evento `submit` del form `#login-form` verifica le credenziali contro l'array `users`. Una logica di emergenza crea l'utente `admin`/`gestionale` se l'array è vuoto.

==================================================================
3. GESTIONE DEI DOCUMENTI (Fatture e Note di Credito)
------------------------------------------------------------------

3.1. CREAZIONE DI UN NUOVO DOCUMENTO
------------------------------------------------------------------
- **Flusso Fattura**:
    1.  Il click sul link `#menu-nuova-fattura` apre il modale `#newInvoiceChoiceModal`.
    2.  La funzione associata a `show.bs.modal` popola il menu a tendina `#copy-from-invoice-select` con le fatture esistenti (documenti con `type: 'Fattura'` o `type` non definito per retrocompatibilità).
    3.  Il click su `#btn-create-new-blank-invoice` apre il form dei documenti in modalità "Fattura vuota".
    4.  Il click su `#btn-copy-from-invoice` chiama la funzione `loadInvoiceForEditing(id, true)`, che popola il form con i dati della fattura scelta ma lo tratta come un nuovo documento (non imposta l'ID di modifica e ricalcola il numero).
- **Flusso Nota di Credito**:
    1.  Il click su `#menu-nuova-nota-credito` chiama direttamente `prepareDocumentForm('Nota di Credito')`.
- **Preparazione Form (`prepareDocumentForm(type)`)**:
    -   Imposta il valore dell'input nascosto `#document-type`.
    -   Mostra o nasconde la sezione `#credit-note-fields` in base al tipo.
    -   Aggiorna i titoli (`#document-title`) e il testo dei pulsanti (`#save-invoice-btn`).
    -   Chiama `populateDropdowns()` per inizializzare i campi comuni.

3.2. NUMERAZIONE E SALVATAGGIO
------------------------------------------------------------------
- **Numerazione (`updateInvoiceNumber`)**: Viene attivata al cambio di `#invoice-date`. Chiama `generateNextDocumentNumber(type, year)` che filtra l'array `invoices` per `type` e `year` per calcolare il progressivo corretto (es. `FATT-` o `NC-`).
- **Salvataggio**: Al `submit` di `#new-invoice-form`, il codice:
    1.  Legge il tipo da `#document-type`.
    2.  Crea un oggetto `invoiceData` con tutti i campi del form. Aggiunge la proprietà `type`.
    3.  Se `docType` è 'Nota di Credito', aggiunge anche le proprietà `linkedInvoice` e `reason`.
    4.  Controlla `#editing-invoice-id`: se presente, aggiorna il documento esistente; altrimenti, crea un nuovo documento assegnando un nuovo `id` e uno `status` di default (`Da Incassare` o `Bozza`).

3.3. ELENCO E STATI DEI DOCUMENTI
------------------------------------------------------------------
- **Render (`renderInvoicesTable`)**: Itera sull'array `invoices`. Per ogni documento:
    -   Legge la proprietà `type` per mostrare un badge (`Fatt.` o `N.C.`).
    -   Legge la proprietà `status` (`Pagata`, `Emessa`, `Da Incassare`, `Bozza`) per mostrare un badge di stato e disabilitare il pulsante di modifica `.btn-edit-invoice`.
- **Gestione Stato**: Il click su `.btn-mark-paid` aggiorna lo `status` del documento a 'Pagata' (per le fatture) o 'Emessa' (per le note di credito) e ridisegna la tabella.

==================================================================
4. STATISTICHE E SIMULAZIONE FISCALE
==================================================================
- **Logica**: La funzione `renderStatisticsPage()` viene eseguita all'accesso alla sezione.
- **Calcolo Fatturato**: La funzione filtra l'array `invoices` per includere solo i documenti che sono fatture (`type: 'Fattura'` o `type` non definito) ed escludere le note di credito.
- **Simulazione Fiscale (`renderTaxSimulation`)**:
    -   **Fatturato Netto**: Calcola separatamente la somma degli imponibili delle fatture e delle note di credito, per ottenere il `grossRevenue` (Fatturato - Note di Credito).
    -   **Reddito Imponibile**: Applica il `coefficienteRedditivita` al `grossRevenue`.
    -   **Contributi Dovuti**: Applica l'`aliquotaContributi` al reddito imponibile.
    -   **Imposta Dovuta**: Sottrae i contributi dovuti dal reddito imponibile e applica l'`aliquotaSostitutiva`.

==================================================================
5. ESPORTAZIONE XML (CONFORME A FATTURAPA)
------------------------------------------------------------------
- **Funzione Chiave**: `generateInvoiceXML(invoiceId)` è stata pesantemente modificata per la conformità.
- **Logica Chiave Implementata**:
    1.  **Tipo Documento**: Imposta `<TipoDocumento>` a `TD04` se `invoice.type` è 'Nota di Credito', altrimenti `TD01`.
    2.  **Campi Condizionali per NC**: Aggiunge i blocchi `<DatiFattureCollegate>` e `<Causale>` se il documento è una nota di credito.
    3.  **Riepilogo per Natura**: La logica del riepilogo è stata riscritta. Crea un oggetto `summaryByNature` che usa il codice natura (es. 'N2.2', 'N4') come chiave per raggruppare gli imponibili. Successivamente, itera su questo oggetto per generare un blocco `<DatiRiepilogo>` distinto per ogni natura, garantendo la coerenza richiesta dal validatore.
    4.  **Correzioni Minori**: Converte le province in maiuscolo (`.toUpperCase()`), gestisce correttamente l'anagrafica del cedente come persona fisica e include i dati bancari nel blocco `<DatiPagamento>`.
    5.  **Nome File**: Il nome del file viene generato con un progressivo alfanumerico casuale di 5 caratteri per imitare il formato SdI.

==================================================================
6. FUNZIONI AVANZATE E COMPATIBILITÀ
==================================================================
- **Backup/Ripristino**: Gestito tramite serializzazione JSON dell'intero `localStorage`.
- **Compatibilità Dati**: L'applicazione è resiliente a campi mancanti nelle versioni precedenti dei dati. L'interfaccia utente guida l'utente a compilare le nuove informazioni (es. in Anagrafica Azienda), che vengono poi integrate nella struttura dati al primo salvataggio.