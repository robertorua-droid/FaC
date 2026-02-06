# 2. Manuale utente

## 2.1 Login e primo avvio
1) Apri `index.html` (da hosting o server locale).
2) Effettua login (Firebase Auth).
3) Al primo accesso, entra in **Impostazioni → Azienda** e compila i dati.
4) Seleziona il **Regime fiscale (gestionale)**:
   - **Ordinario**: abilita IVA + acquisti/fornitori.
   - **Forfettario**: semplifica (no acquisti/fornitori, IVA=0).

> Finché il regime non è impostato, alcune sezioni possono essere limitate.

---

## 2.2 Impostazioni → Azienda
Qui inserisci:
- dati anagrafici studio/azienda
- banche/IBAN
- impostazioni IVA (ordinario) e periodicità (mensile/trimestrale)

Salva con **Salva Dati Azienda**.

---

## 2.3 Anagrafiche
### Clienti
Menu: **Anagrafiche → Clienti**
- Inserisci ragione sociale, P.IVA/CF, indirizzo, codice destinatario/PEC.

### Servizi
Menu: **Anagrafiche → Servizi**
- Inserisci codice, descrizione, prezzo e IVA.
- In forfettario l’IVA viene forzata a 0 nei documenti.

### Fornitori (solo Ordinario)
Menu: **Anagrafiche → Fornitori**
- Inserisci ragione sociale, P.IVA, PEC (facoltativa) e dati di contatto.

---

## 2.4 Documenti (Vendite)
### Nuova Fattura / Nota di Credito
Menu: **Documenti → Nuova Fattura** / **Nuova Nota Credito**
- Seleziona cliente e data
- Aggiungi righe (servizio, quantità, prezzo, IVA/natura)
- Imposta pagamento (bonifico/assegno/contanti)
- (Bonifico) Compila termini pagamento per calcolo scadenza

### Elenco Documenti
Menu: **Documenti → Elenco Documenti**
- Filtra per anno
- Azioni tipiche: modifica, elimina, segna pagata, esporta XML

### Export XML FatturaPA
Dall’elenco documenti o dalla pagina documento puoi esportare l’XML.

---

## 2.5 Acquisti (solo Ordinario)
Menu: **Acquisti → Nuovo Acquisto / Elenco Acquisti**

### Nuovo Acquisto
- Seleziona fornitore
- Inserisci numero e data
- Inserisci termini pagamento (data riferimento + giorni) per calcolo scadenza
- Aggiungi righe (descrizione, quantità, prezzo, IVA)
- Salva

### Importa XML (Fattura fornitore)
Nel form **Nuovo Acquisto** c’è il pulsante **Importa XML**.
- Seleziona un file XML FatturaPA (fattura elettronica ricevuta dal fornitore).
- Il documento viene precompilato (fornitore, testata, righe, scadenza se presente).
- Se il fornitore non esiste in anagrafica, viene chiesta conferma per crearlo.

> Dettagli: vedi [Import XML acquisti](./06_IMPORT_XML_ACQUISTI.md).

### Elenco Acquisti
- Filtra per anno
- Toggle stato: **Da Pagare / Pagata**

---

## 2.6 Scadenziario
Menu: **Scadenziario**
- Visualizza eventi nel periodo selezionato:
  - Incassi fatture (data scadenza)
  - Pagamenti acquisti (data scadenza, solo ordinario)
  - Scadenze IVA (solo ordinario; mensile/trimestrale)
- Filtri: intervallo date, mostra pagate, mostra crediti IVA.

---

## 2.7 Commesse, Progetti e Timesheet
### Commesse
Menu: **Commesse → Commesse**
- Una commessa può avere:
  - Cliente finale (testo libero)
  - “Fatturo a” (cliente in anagrafica)
  - Stato (attiva/chiusa)

### Progetti
Menu: **Commesse → Progetti**
- Ogni progetto è collegato a una commessa.
- Puoi impostare:
  - servizio di fatturazione predefinito
  - tariffa oraria
  - tipo (lavoro/costo) se previsto

### Timesheet
Menu: **Commesse → Timesheet**
- Registra worklog giornalieri:
  - data, commessa, progetto
  - ore/minuti
  - flag fatturabile/non fatturabile
  - note

### Import ore in fattura
Nel form fattura è disponibile una funzione di **import ore dal timesheet**:
- selezioni periodo, commessa/progetto e criteri
- il sistema propone righe fattura (con ore e prezzo)
- può collegare i worklog alla fattura (per evitare doppie fatturazioni)

---

## 2.8 Export Timesheet (CSV)
Menu: **Export Timesheet**
- Filtri: periodo, “Fatturo a”, commessa, progetto, fatturabile, già fatturato.
- Formati:
  - **Dettaglio** (default): una riga per worklog
  - Raggruppamenti: giorno+progetto, progetto, commessa
  - **Giorno (progetti in colonne)**: pivot con progetti come colonne

Il CSV usa:
- separatore `;`
- date in formato **gg/mm/aaaa**
- intestazioni: `Date | EndCustomer | BillToCustomer | Commessa | Project | Minutes | Hours | Billable`

Dettagli: vedi [Export Timesheet CSV](./07_EXPORT_TIMESHEET_CSV.md).

---

## 2.9 Impostazioni → Uso dati (stima)
Menu: **Impostazioni → Uso dati (stima)**
- Mostra una stima dello “storage” basata sulla dimensione JSON dei dati caricati.
- Barra di avanzamento su quota di riferimento **1 GiB (Spark)**.

> Dettagli: vedi [Uso dati (stima)](./05_USO_DATI_STIMA.md).

---

## 2.10 Gestione Dati (Backup / Import / Eliminazioni / Reset)
Menu: **Impostazioni → Gestione Dati**
- Backup JSON dal Cloud (utente corrente)
- Importa backup JSON (merge)
- Elimina documenti per anno
- Elimina acquisti per anno
- Ripristino totale (reset + import)
- Reset totale dati (reset classe)

> Dettagli: vedi [Gestione Dati](./04_GESTIONE_DATI.md).


## 2.11 Dashboard (Annuale/Mensile)

La Dashboard riassume le informazioni principali del periodo selezionato.

- Seleziona **Annuale** o **Mensile**.
- Scegli **Anno** (e **Mese** in modalità mensile).
- Premi **Aggiorna** per ricalcolare KPI e tabelle.

In alto trovi le card KPI (con priorità alle **Ore timesheet totali** e **Ore fatturabili**). Sotto, sono presenti tabelline con il dettaglio mensile/giornaliero e i Top Progetti/Commesse per ore fatturabili.
