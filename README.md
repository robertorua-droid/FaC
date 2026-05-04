## Versione corrente

V.13.10_step 21

- **Tema sidebar/menu – V.13.10_step 16**: il toggle Chiaro/Scuro ora cambia anche la sidebar di navigazione e la barra menu, non solo l'area contenuto principale; in Light Mode il menu usa sfondi e testi chiari, mentre in Dark Mode mantiene il look blu notte.
- **Timesheet Ticket e CSV – V.13.10_step 15**: aggiunto campo opzionale **Ticket** nelle righe Timesheet; l’export CSV include ora sia **Ticket** sia **Note** nei formati dettaglio e raggruppati.
- **Fix login/caricamento acquisti – V.13.10_step 14**: ripristinato il normalizzatore elenco acquisti usato dopo il login, evitando l'errore `getNormalizedPurchases is not defined` durante il caricamento dashboard/DB.
- **Recupero password Firebase – V.13.10_step 13**: aggiunta nella schermata di login la funzione **Password dimenticata?** per inviare il link di reset password tramite Firebase Auth, senza backend custom e senza modifiche ai dati applicativi.

- **Google Calendar in Home – V.13.10_step 12**: la Home può sostituire il calendario locale con un Google Calendar incorporato in vista 7 giorni, configurabile da Dati Azienda tramite URL embed o ID calendario. Se non configurato, resta il calendario locale precedente.

- **Dark Mode Allegato Timesheet XML – V.13.10_step 11**: migliorata la leggibilità del blocco “Allegato XML da Timesheet” nel form fattura in modalità scura, con sfondo, bordo, testi e stato disabilitato coerenti con il tema.

- **Allegato Timesheet XML – V.13.10_step 10**: aggiunta in fattura l'opzione per allegare all'XML un PDF con il dettaglio non aggregato dei worklog importati dal Timesheet, con note operative opzionali. L'allegato è descrittivo e non modifica i totali fiscali del documento.

- **Stati documento + audit store/read – V.13.10_step 04**: aggiunto `normalizeInvoiceStatusInfo()` per riallineare bozza/emessa/inviata/pagata tra lista fatture e scadenziario, ridotti altri fallback a `renderAll()` nei CRUD semplici e rimossa una lettura legacy diretta di `globalData` nell'import XML acquisti.

- **Versione ridisegnata – V.13.10_step 01**: completato il controllo checklist punto 6 sul flusso **Timesheet → Fattura**, con `normalizeTimesheetImportInfo()` che riallinea stato import, worklog IDs, gruppi importati e persistenza del collegamento worklog/fattura.
- **Acquisti/scadenziario hardening – V.13.10_step 04**: introdotto `normalizePurchaseInfo()` per riallineare alias legacy di acquisto (fornitore, numero, date, stato, righe, totali) e collegato ai punti più sensibili: salvataggio manuale acquisti, import XML acquisti, tabelle elenco, scadenziario e analisi.
- **Test simulatori fiscali – V.13.10_step 04**: aggiunte le suite browser-based `tests/forfettario-calc.spec.js` e `tests/ordinario-calc.spec.js`, con pagine dedicate e indice aggiornato per verificare aggregazioni annuali, contributi, imposta sostitutiva, IRPEF e acconti dei due motori fiscali.
- **Refactoring Fase 5 – Step 4 test unitari `InvoiceXMLMapper` (v12.51)**: aggiunta una suite browser-based per il mapper XML FatturaPA, con copertura dei frammenti più delicati: ordinario, forfettario, nota di credito, anagrafiche, pagamento, bollo, rivalsa e scorporo.
- **Refactoring Fase 5 – Step 3 test unitari `InvoiceXMLValidator` (v12.50)**: aggiunta una suite browser-based per i controlli di esportabilità XML, con copertura di dati obbligatori, identità fiscali, indirizzi, IBAN e casi delicati di nota di credito.
- **Refactoring Fase 5 – Step 2 test unitari `InvoiceCalculator` (v12.49)**: aggiunta una suite browser-based per il calcolo documento, con copertura di casi ordinario/forfettario, rivalsa INPS, ritenuta, scorporo e bollo.
- **Refactoring Fase 5 – Step 1 test unitari `TaxRegimePolicy` (v12.48)**: introdotta una prima suite di test browser-based per il layer `TaxRegimePolicy`, con harness leggero e copertura dei casi base di risoluzione regime, capability, visibilità UI e default fattura.
- **Refactoring Fase 4 – Step 4 store adoption controllata (v12.47)**: primi moduli semplici (Azienda, Clienti, Servizi, Fornitori) leggono ora in modo esplicito da `AppStore`, con renderer anagrafiche più allineati allo store e minore dipendenza diretta da `globalData`.
- **Refactoring Fase 4 – Step 3 riduzione `renderAll()` nei CRUD più usati (v12.46)**: `UiRefresh` copre ora anche combinazioni vendite/acquisti + scadenziario/analisi; azioni frequenti su fatture e acquisti evitano più spesso il refresh globale completo.
- **Refactoring Fatture – Fase 3 rifinitura prudente (v12.41)**: aggiunto `InvoiceFormUiService` per togliere altra logica di righe documento da `invoices-form-module.js`; il mapper/validator XML usano ora normalizzazione più robusta di anagrafica e indirizzi, con precheck più stretti su identificativi fiscali e dati sede.
- **Refactoring Fatture – Fase 3 hardening XML e submit (v12.40)**: aggiunti `InvoiceFormStateService` e `InvoiceSubmitService` per togliere altro peso a `invoices-form-module.js`, mentre `InvoiceXMLValidator` e `InvoiceXMLMapper` vengono irrigiditi sui casi delicati (nota di credito, anagrafica cliente PF/azienda, causale XML).
- **Refactoring Fatture – Fase 3 continuazione cauta (v12.38)**: aggiunti `InvoiceValidationService`, `InvoiceLineService` e `InvoiceXMLValidator`. Il form fattura delega validazione, controllo duplicati, costruzione righe e payload di salvataggio, mentre l’export XML guadagna una pre-validazione dedicata senza cambiare il mapper del tracciato.
- **UI Render Split – Fase 2A Rifinitura (v12.34)**: aggiunto `js/ui/ui-regime-helpers.js` per centralizzare helper UI del regime fiscale e del `companyInfo` corrente. `ui-render.js` usa ora step di orchestrazione più leggibili (`renderMasterDataArea`, `renderPurchasesArea`, `renderSalesArea`, `renderAnalysisArea`), mentre i moduli estratti della Fase 2A dipendono da helper condivisi invece di duplicare fallback e accessi diretti allo stato.
# Gestionale Cloud – Professionisti (didattico)

Questo progetto simula la gestione di un professionista e supporta due modalità **gestionali**:

- **Ordinario** (IVA + acquisti/fornitori + registri IVA + simulazione redditi ordinario)
- **Forfettario** (no IVA: semplifica UI e flussi; simulazione quadro LM)

> Il rendering UI è in transizione: `js/ui/ui-render.js` resta l'orchestratore alto livello, mentre alcune aree sono già state estratte in moduli dedicati.

---

## Documentazione aggiornata
La documentazione completa (manuale utente, guida laboratorio, workflow tecnico, etc.) è in:
- `DOCUMENTAZIONE/00_INDICE.md`

---

## Novità principali (versione ridisegnata)
- **Refactoring Fatture – Fase 3 continuazione cauta (v12.38)**: introdotti `InvoiceValidationService`, `InvoiceLineService` e `InvoiceXMLValidator`. `InvoiceService` ora costruisce anche il payload persistito del documento, il form riduce validazione/duplicate-check/logica righe, e l’export XML verifica prima il contesto senza cambiare il mapper del tracciato.
- **Tax Regime Policy (v12.31)**: fase 4 del refactoring. Aggiunti helper UI centralizzati nella policy (`getUiVisibility`), rimossi altri fallback legacy dai moduli residui e spostata `ui-render.js` su approccio capability/UI-visibility-first.
- **Adozione estesa**: navigation usa `getCurrentCapabilities()`, il render iniziale usa capability-first anche per acquisti/fornitori/registri IVA, e i default prodotti/fatture riusano la policy invece di logiche duplicate.
- **Fatture (v12.25)**: In Nuova/Modifica fattura la colonna **Descrizione** delle righe è editabile (anche righe importate da Timesheet).
- **Gestione Dati (v12.23)**: In regime Forfettario è nascosta l’azione “Elimina Acquisti per Anno” (gli acquisti non sono gestiti).
- **Dark mode (v12.24)**: Migliorato il contrasto dei pulsanti *outline* (es. `btn-outline-secondary`, `btn-outline-dark`) e dei bottoni `btn-dark` quando il tema è scuro.
- **Prefisso import Timesheet (v12.22)**: (Solo Forfettario) in anagrafica cliente puoi impostare un prefisso per la descrizione delle righe create dall’import Timesheet in fattura (es. “Area di docenza”) oppure lasciarlo vuoto (nessun prefisso).
- **Bollo & Forfettario UI (v12.21)**: In forfettario la sezione menu “Fatture di Acquisto” è nascosta. Aggiunto flag cliente “Bollo a carico dello studio” per non addebitarlo in fattura (totale invariato) ma indicarlo comunque nell’XML; il flag viene salvato sul documento e ha priorità rispetto all’anagrafica.
- **Commesse UI (v12.20)**: Tabella commesse riallineata e colonna “Fatturo a” ottimizzata (più spazio, ellissi e tooltip su nomi lunghi).
- **Timesheet UX (v12.19)**: Formattazione orari "HH:mm" e miglioramento focus in modifica (scroll automatico).
- **Refactoring & Date (v12.18)**: Filtri timesheet e export ottimizzati (default "Oggi"), fix fuso orario date, statistiche dashboard corrette (gestione ore CF=0), nuova colonna totali in Progetti.
- **Fix Timesheet (v12.17)**: Risolti problemi di salvataggio modifiche e logica ore cliente finale (supporto valori 0 espliciti).
- **Documentazione Dinamica (v12.16)**: Implementazione del caricamento asincrono dei manuali direttamente dai file Markdown. Introdotto script di sincronizzazione per l'uso offline/locale e sistema di fallback intelligente.
- **Portale Documentazione (v12.15)**: Trasformazione del manuale in un sistema interattivo con indice cliccabile, navigazione tra documenti e pulsante "Torna all'indice". Esclusione intelligente del Changelog dall'indice manuale.
- **UI/UX Premium (v12.14)**: Introduzione della **Dark Mode rifinita** (contrasti migliorati, zero blocchi bianchi), **uniformità globale delle tabelle** (zebra-striping, testate e totali in grassetto) e **ristrutturazione sidebar** (Scadenziario spostato in Analisi).
- **Documentazione In-App (Bundled)**: Manuale utente e Changelog integrati direttamente nell'app per consultazione immediata offline/locale senza server.
- **Impostazioni → Uso dati (stima)**: stima dimensione dati su quota 1 GiB (Spark).
- **Impostazioni → Gestione Dati** (ex “Migrazione”): backup JSON completo, import merge, eliminazioni per anno, ripristino totale (reset+import), reset totale “classe”.
- **Acquisti**: import XML FatturaPA fornitore con creazione fornitore su conferma.
- **Export Timesheet CSV**: date `gg/mm/aaaa`, pulizia `\n`, ordine colonne stabile, filtri funzionanti.

---

## Struttura cartelle

- `index.html` – entrypoint UI
- `css/` – stili
- `docs/` – note di step storici (step-by-step)
- `DOCUMENTAZIONE/` – **documentazione aggiornata**
- `js/`
  - `core/`
    - `utils.js` (store in memoria `globalData`, helper numerici/date, inattività)
    - `form-helpers.js` (helper UI: natura/esenzione IVA, ecc.)
  - `services/`
    - `firebase-cloud.js` (load/save/delete su Firestore)
  - `ui/`
    - `ui-render.js` (orchestratore alto livello dei render principali)
    - `navigation-visibility.js`, `company-render.js`, `scadenziario-render.js`, `dashboard-render.js` (moduli estratti in Fase 2A)
  - `features/` (moduli per area funzionale, ognuno con `bind()` idempotente)
    - `auth/` – login/logout, `auth.onAuthStateChanged`
    - `navigation/` – sidebar + guard (regime obbligatorio)
    - `company/` – anagrafica azienda + show/hide campi per regime
    - `masterdata/` – clienti/servizi/fornitori
    - `invoices/` – form fattura + elenco + export XML + import ore timesheet
    - `purchases/` – acquisti (solo ordinario) + import XML (modulo separato)
    - `registri-iva/` – totali IVA mensili/trimestrali (solo ordinario)
    - `scadenziario/` – scadenze incassi/pagamenti/IVA (in forfettario solo incassi)
    - `tax/` – simulazioni: quadro LM (forfettario) + ordinario (RE/RN/RR)
    - `notes/`, `migration/` (uso dati + gestione dati)
  - `app/`
    - `invoice-xml-migration.js` (**orchestratore**, mantiene nome storico)
    - `app-bootstrap.js`

---

## Avvio applicazione

1. `app-bootstrap.js` → `initFirebase()` → `bindEventListeners()`
2. `invoice-xml-migration.js` registra i listener chiamando i `bind()` dei moduli.
3. Se l’utente è loggato: `loadAllDataFromCloud()` → `renderAll()`.

---

## Regime fiscale (gestionale) – comportamento UI

In **Azienda** il campo **Regime fiscale (gestionale)** è **obbligatorio**.

### Ordinario
- Menu: visibili **Registri IVA**, **Acquisti**, **Fornitori**, **Simulazione Redditi (Ordinario)**.
- Anagrafica azienda: visibili campi IVA (aliquota, periodicità).

### Forfettario
- Menu: nascosti **Registri IVA**, **Fornitori** e l’intera sezione **Acquisti**.
- IVA: in servizi e in fattura l’IVA è **forzata a 0**.
- Visualizzazione documento: riepilogo IVA nascosto (evita confusione).

---

## Nota tecnica
Ogni modulo feature usa un `bind()` **idempotente** (non registra più volte gli stessi listener).


---

## Step24
- Coerenza regime fiscale: introdotti helper unificati (getResolvedTaxRegime / isForfettario / isOrdinario / hasTaxRegime) e aggiornati i moduli UI/calcolo per usarli.

## Stato Refactoring
- **Fase 4 avviata**: presente un `AppStore` minimale compatibile con `globalData` e un layer `UiRefresh` per i primi refresh mirati.
- In questa fase il progetto usa ancora `renderAll()` come fallback sicuro, ma alcune operazioni CRUD semplici passano già da refresh selettivi.

## Test unitari

Per la Fase 5 è stata introdotta una suite browser-based nella cartella `tests/`, ora raccolta anche nella pagina indice `tests/index.html`.

- Apri `tests/tax-regime-policy.test.html`
- La pagina esegue automaticamente i test del layer `TaxRegimePolicy`
- La suite attuale copre risoluzione del regime, fallback RF, capability, visibilità UI e default fattura


- V.13.10_step 09: aggiunto nel dettaglio fattura un menu **XML** con azioni per generare l'XML, copiarlo negli appunti e aprire validatori esterni in una nuova tab.
