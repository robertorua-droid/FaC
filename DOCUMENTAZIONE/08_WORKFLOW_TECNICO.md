# 8. Workflow tecnico (sviluppo/manutenzione)

Questa guida è per chi modifica il progetto.

## 8.1 Avvio in locale
Essendo una single page app con Firebase, è consigliato servirla via HTTP.

Opzioni semplici:
- VS Code: estensione **Live Server**
- Python: `python -m http.server 8080`

Apri poi `http://localhost:8080`.

## 8.2 Struttura moduli
- `index.html`: layout e sezioni (`div.content-section`) con `id` uguale al `data-target` del menu.
- `js/services/firebase-cloud.js`: init Firebase + CRUD su Firestore.
- `js/ui/ui-render.js`: orchestratore UI di alto livello.
- `js/ui/*-render.js`: moduli di rendering per area (company, dashboard, scadenziario, tax, masterdata, analysis).
- `js/features/*`: moduli funzionali; ciascuno espone `bind()` idempotente.
- `js/features/invoices/invoices-xml-module.js`: gestisce sia l’export XML singolo sia l’export massivo XML forfettario, riusando `InvoiceExportService`.
- `js/features/invoices/invoice-print-service.js`: renderer read-only per la stampa dei documenti emessi.
- `js/features/invoices/invoices-pdf-module.js`: gestisce la stampa massiva PDF come fascicolo unico browser-based.
- `js/app/invoice-xml-migration.js`: orchestratore che chiama i `bind()` dei moduli.

## 8.3 Convenzioni importanti
### `globalData` come store in memoria
I dati caricati dal cloud finiscono in `globalData` (vedi `utils.js` e `firebase-cloud.js`).

### `bind()` idempotente
Ogni modulo feature deve:
- controllare una flag `_bound`
- registrare eventi una sola volta

### Refresh UI
Pattern tipico dopo una modifica dati:
1) aggiornare cloud (`saveDataToCloud` / `batchSaveDataToCloud` / delete)
2) ricaricare dati (`loadAllDataFromCloud`) se necessario
3) ridisegnare (`renderAll` oppure render specifici)

## 8.4 Aggiungere una nuova funzione (approccio “sicuro”)
1) Creare un nuovo file modulo in `js/features/<area>/...`.
2) Esportare `window.AppModules.<nome>.bind = bind;`.
3) Includere il file nello script loader (di solito in `index.html` o nel bootstrap, a seconda della versione).
4) Chiamare il `bind()` dall’orchestratore (`invoice-xml-migration.js`).
5) Evitare di toccare `ui-render.js` se non necessario.


### Export massivo XML forfettario
Lo step 31 mantiene l’export massivo nel modulo `invoices-xml-module.js` per evitare nuove dipendenze e non introdurre un packaging ZIP.

Principi tecnici:
- il pannello UI è in `index.html` nella sezione dedicata `#esportazioni-documenti`;
- la visibilità è limitata al regime Forfettario tramite `TaxRegimePolicy`;
- ogni XML viene generato con `InvoiceExportService.buildXmlPayload(invoice.id)`, quindi eredita le stesse validazioni dell’export singolo;
- il download è sequenziale e produce file XML separati;
- nessuna scrittura Firestore e nessuna modifica a stati, Timesheet, calcoli fiscali o mapper XML.

### PDF unico documenti emessi forfettario
Lo step 32 aggiunge una stampa massiva PDF senza introdurre librerie PDF e senza packaging ZIP.

Principi tecnici:
- il pannello UI è in `index.html` nella sezione dedicata `#esportazioni-documenti`;
- la visibilità è limitata al regime Forfettario tramite `TaxRegimePolicy`;
- `invoices-pdf-module.js` filtra i documenti per data/tipo, esclude le bozze e prepara il contenuto da stampare;
- `invoice-print-service.js` genera HTML read-only del documento usando i normalizzatori e il calcolo fattura già disponibili;
- `#bulkPdfPrintArea` e gli stili `body.bulk-pdf-print-mode` in `css/style.css` isolano la stampa massiva dalla UI ordinaria;
- l’utente ottiene il PDF tramite stampa browser → **Salva come PDF**;
- nessuna scrittura Firestore e nessuna modifica a XML, Timesheet, stati o calcoli fiscali.

### Sezione dedicata Esportazioni Documenti
Lo step 33 separa la UI degli export dalla pagina `#elenco-fatture` senza modificare i moduli funzionali degli step 31–32.

Principi tecnici:
- nuova voce sidebar `#menu-esportazioni-documenti` con `data-target="esportazioni-documenti"`;
- nuova `content-section` `#esportazioni-documenti` contenente gli stessi pannelli e gli stessi ID dei controlli esistenti;
- visibilità della voce gestita da `navigation-visibility.js` tramite `TaxRegimePolicy`;
- guard aggiuntivo in `navigation-module.js` per il regime Ordinario;
- nessuna duplicazione degli handler e nessun nuovo accesso a Firestore.

### Pulizia UI Esportazioni Documenti
Lo step 34 pulisce la nuova pagina export senza cambiare la logica funzionale.

Principi tecnici:
- rimossi da `index.html` i badge tecnici di step presenti nella pagina `#esportazioni-documenti`;
- rimossi i pulsanti **Anno filtro** perché poco chiari dopo la separazione dalla pagina elenco fatture;
- la precompilazione automatica dei campi `Da/A` resta gestita da `setBulkXmlDefaultPeriod(false)` e `setBulkPdfDefaultPeriod(false)` all’aggiornamento dei pannelli;
- rimossi solo i binding dei pulsanti non più presenti, mantenendo invariati gli handler principali di export XML e stampa PDF;
- nessuna modifica a navigazione, Firestore, stati documento, XML mapper, stampa documento singolo, Timesheet o calcoli fiscali.


### Riquadro Versamenti stimati FAC
Lo step V.13.20_step 03 reintroduce un riepilogo sintetico dei versamenti nella UI forfettaria, senza cambiare il modello dati e senza alterare le formule principali.

Principi tecnici:
- il riquadro è renderizzato in `tax-render.js` usando il `summary` già calcolato da `ForfettarioCalc.computeYearlySummary`;
- i dati provengono da `forfettarioSimulation.versamenti` e dai valori annuali `companyInfo.taxAdjustmentsByYear`;
- se sono presenti valori F24/manuali vengono mostrati come fonte operativa, altrimenti resta visibile la stima FAC;
- le scadenze 30/06 e 30/11 sono riepilogative e didattiche, senza introdurre nuove logiche di rateazione, proroga, interessi o compensazione F24;
- nessun impatto su fatture, XML, Timesheet, export documenti, Firestore esistente o regime Ordinario.

### Riporto assistito acconti F24
Lo step V.13.20_step 04 aggiunge un suggerimento UI per gli acconti F24 già salvati sull’anno selezionato.

Principi tecnici:
- `tax-render.js` legge gli acconti già presenti in `companyInfo.taxAdjustmentsByYear[anno].lm.acconto1F24/acconto2F24` e `companyInfo.taxAdjustmentsByYear[anno].inps.acconto1F24/acconto2F24`;
- il riquadro appare solo se l’anno specifico selezionato contiene acconti F24 registrati;
- i pulsanti compilano solo i campi UI `#lm-dich-acconti-imposta` e `#lm-dich-inps-versati-anno`;
- nessun salvataggio automatico viene eseguito: l’utente deve premere **Salva e ricalcola**;
- non vengono modificate formule fiscali, schema dati, fatture, XML, Timesheet, export documenti o regime Ordinario.

### Quadro RR/PXX e Help F24 Fiscalità
Lo step V.13.20_step 02 è una rifinitura prudente della UI fiscale forfettaria.

Principi tecnici:
- il modello dati `companyInfo.taxAdjustmentsByYear` resta invariato;
- la logica di calcolo del motore forfettario non cambia nelle formule principali;
- il prospetto UI distingue meglio **Quadro LM** e **Quadro RR/PXX**;
- il pulsante **Help compilazione F24** usa un collapse Bootstrap locale, senza nuovi moduli o nuove dipendenze;
- i campi dichiarativi manuali accettano anche importi copiati in formato italiano (`1.513,52`) tramite normalizzazione locale in `tax-render.js` e nel parser puro di `forfettario-calc.js`;
- nessun impatto su fatture, XML, Timesheet, export documenti, Firestore esistente o regime Ordinario.

### Dati dichiarativi annuali Fiscalità
Lo step V.13.20_step 01 introduce un modello additivo per i dati dichiarativi annuali del regime Forfettario.

Principi tecnici:
- i parametri fiscali stabili restano in `companyInfo` come campi globali (`taxRegime`, `codiceRegimeFiscale`, `coefficienteRedditivita`, `aliquotaSostitutiva`, `aliquotaContributi`, `aliquotaInps`);
- i dati variabili per anno sono salvati in `companyInfo.taxAdjustmentsByYear`;
- la struttura è indicizzata per anno fiscale e distingue `lm` e `inps`;
- la pagina **Fiscalità** scrive solo patch additive via `saveDataToCloud('companyInfo', patch)`;
- `forfettario-calc.js` resta una funzione pura e legge i dati annuali senza accedere a DOM/Firebase;
- se i nuovi campi annuali sono assenti, il motore preserva il comportamento teorico precedente;
- per compatibilità vengono ancora letti, se presenti, i vecchi mapping per anno `contributiVersatiByYear`, `accontiVersatiByYear` e `creditiImpostaByYear`; i vecchi campi globali semplici non vengono più usati come fallback automatico.

Schema indicativo:
```js
companyInfo.taxAdjustmentsByYear = {
  "2025": {
    lm: {
      contributiDeducibiliVersati: 3267.75,
      accontiImpostaVersati: 0,
      creditiImposta: 0,
      saldoF24: 0
    },
    inps: {
      versatiAnno: 3267.75,
      saldoF24: 516.00
    },
    notes: "Dichiarazione 2026 su redditi 2025"
  },
  "2026": {
    lm: {
      acconto1F24: 229.00,
      acconto2F24: 229.00
    },
    inps: {
      acconto1F24: 1513.52,
      acconto2F24: 1513.52
    }
  }
};
```

La modifica non tocca fatture, XML, Timesheet, registri IVA, acquisti o regime Ordinario.


## 8.5 Firestore: collezioni e batch
- Batch Firestore: limite 500 operazioni; nel progetto si usa ~450 come margine.
- Collezioni per utente: `users/{uid}/<collection>`
- Settings: `users/{uid}/settings/*`

## 8.6 Backup/Import: note per manutenzione
- Il backup JSON include tutte le collezioni principali + `companyInfo`.
- L’import “merge” aggiorna per ID e non cancella record extra.
- Il “ripristino totale” esegue prima reset completo (incl. `settings/*`) e poi importa.

## 8.7 Modificare Firebase (nuovo progetto)
In `js/services/firebase-cloud.js` aggiorna:
- `firebaseConfig` (apiKey, projectId, ...)

Ricorda di configurare:
- Authentication provider (es. Email/Password)
- Firestore rules (accesso per `uid`)

