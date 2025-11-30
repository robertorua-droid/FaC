# Gestionale FPRF – Versione Cloud Stabile

Gestionale didattico per la fatturazione di un professionista in **regime forfettario**, versione cloud multi‑utente basata su Firebase.

---

## PARTE 1 – MANUALE TECNICO

### 1. Stack Tecnologico

- **Frontend**
  - HTML5 + CSS3
  - [Bootstrap 5](https://getbootstrap.com/) per layout e componenti
  - [Font Awesome](https://fontawesome.com/) per le icone
  - jQuery per la gestione degli eventi e del DOM
- **Backend (BaaS)**
  - Firebase Authentication (login con email/password)
  - Cloud Firestore (database NoSQL per i dati)
  - Firebase Hosting (facoltativo per la pubblicazione)

Tutta la logica è concentrata nel file:

- `index.html`: struttura dell’interfaccia e modali
- `style.css`: personalizzazioni grafiche
- `script.js`: logica applicativa (auth, CRUD, calcoli, XML, import/export, ecc.) :contentReference[oaicite:0]{index=0}  

---

### 2. Modello Dati (Cloud Firestore)

Le principali “entità logiche” sono:

- **Azienda (companyInfo)**  
- **Prodotti/Servizi (products)**
- **Clienti (customers)**
- **Documenti (invoices)** – fatture e note di credito
- **Note / appunti utente (notes)**

Lo script sincronizza i dati da/verso Firestore in `globalData` tramite funzioni tipo:

- `loadAllDataFromCloud()`
- `saveDataToCloud(collection, data, id)`
- `deleteDataFromCloud(collection, id)` :contentReference[oaicite:1]{index=1}  

Ogni documento memorizza i campi necessari per costruire sia la stampa che il file XML.

#### 2.1. Anagrafica azienda (`companyInfo`)

Esempio di campi:

- Dati fiscali: `name`, `piva`, `codiceFiscale`, `codiceRegimeFiscale`
- Sede: `address`, `numeroCivico`, `zip`, `city`, `province`, `nazione`
- Contatti: `pec` (opzionale)
- Parametri fiscali:  
  - `coefficienteRedditivita`  
  - `aliquotaSostitutiva` (imposta sostitutiva)  
  - `aliquotaContributi` / `aliquotaInps`  
- Banca: `banca`, `iban` :contentReference[oaicite:2]{index=2}  

#### 2.2. Clienti (`customers`)

Campi principali:

- `name` – ragione sociale
- `piva`, `codiceFiscale`
- `sdi` – codice destinatario
- `pec` (opzionale)
- Indirizzo: `address`, `cap`, `comune`, `provincia`, `nazione`
- Flag `rivalsaInps` (boolean) – **determina se applicare o no la rivalsa INPS** nel calcolo delle fatture. :contentReference[oaicite:3]{index=3}  

#### 2.3. Prodotti / Servizi (`products`)

Campi:

- `id` (es. generato tipo `PRD + timestamp`)
- `description`
- `code` (codice interno, opzionale)
- `salePrice` (prezzo unitario)
- `iva` (tipicamente 0 per forfettario)
- `esenzioneIva` – natura esenzione (es. `N2.2`, `N4`, ecc.)

È previsto un servizio particolare con descrizione **“Rivalsa Bollo”** che viene trattato in modo speciale nei calcoli (ignorato nel totale prestazioni, ma sommato come bollo). :contentReference[oaicite:4]{index=4}  

#### 2.4. Documenti emessi (`invoices`)

Ogni documento contiene, tra gli altri:

- `id`
- `number` – es. `FATT-2025-01` o `NC-2025-01`
- `type` – `"Fattura"` o `"Nota di Credito"`
- `date` – data documento (ISO `YYYY-MM-DD`)
- `customerId` – riferimento al cliente
- `lines` – array di righe:
  - `productName`, `qty`, `price`, `subtotal`, `iva`, `esenzioneIva`
- Campi di calcolo:
  - `totalePrestazioni`
  - `rivalsa` (con `importo`)
  - `importoBollo`
  - `totaleImponibile`
  - `total` – **Totale documento**
- Pagamenti:
  - `condizioniPagamento`
  - `modalitaPagamento`
  - `dataScadenza`
- Stato:
  - `status` – `"Da Incassare"`, `"Pagata"` o (per NdC) `"Emessa"`
- Per Note di credito:
  - `linkedInvoice` (fattura collegata)
  - `reason` (motivo)

---

### 3. Logica Contabile

#### 3.1. Totali e rivalsa INPS

Calcolo svolto in `updateTotalsDisplay()` quando si modifica cliente o righe: :contentReference[oaicite:5]{index=5}  

1. Si separano le righe normali dalla riga “Rivalsa Bollo”:
   - `rows` = tutte le righe tranne quella con `productName.toLowerCase() === 'rivalsa bollo'`
   - `bollo` = eventuale riga “Rivalsa Bollo”
2. **Totale Prestazioni**  
   `totPrest = somma(subtotal delle righe in rows)`
3. **Rivalsa INPS**  
   - Se il cliente ha `rivalsaInps = true` →  
     `riv = totPrest * (aliquotaInps / 100)` dove `aliquotaInps` viene dall’azienda
   - Altrimenti `riv = 0`
4. **Imp. Bollo**
   - `impBollo = bollo ? bollo.subtotal : 0`
5. **Totale Imponibile** = `totPrest + riv`
6. **Totale Documento** = `totPrest + riv + impBollo`

La UI mostra:

- totale documento (`#invoice-total`)
- dettaglio imponibile/bollo (`#invoice-tax-details`).

Questi valori vengono anche salvati nel documento `invoice` e usati per XML e statistiche.

#### 3.2. Regole di edit e stato

- Documenti con stato **“Pagata”** (o NdC già “Emessa”) non sono più modificabili né cancellabili.
- Finché lo stato è **“Da Incassare”**:
  - è possibile modificare la fattura
  - è possibile cancellarla
- Il bottone “Segna come Pagata” cambia lo stato (e impedisce modifiche successive).

---

### 4. XML Fattura Elettronica

La funzione `generateInvoiceXML(invoiceId)` costruisce un XML in formato **FPR12** conforme al tracciato ADE, passando la validazione su FatturaCheck. :contentReference[oaicite:6]{index=6}  

Caratteristiche principali:

- `FatturaElettronicaHeader`
  - `DatiTrasmissione`:
    - `IdTrasmittente` → `IT` + cod. fiscale azienda
    - `ProgressivoInvio` → 5 caratteri alfanumerici casuali
    - `FormatoTrasmissione` → `FPR12`
    - `CodiceDestinatario` → da cliente (`sdi`) o `0000000`
  - `CedentePrestatore`:
    - `IdFiscaleIVA` (`IT` + P.IVA azienda)
    - `CodiceFiscale` azienda
    - `Anagrafica` → nome/cognome o denominazione
    - `RegimeFiscale` (es. `RF19` per forfettario)
    - `Sede` (indirizzo, comune, **Provincia**, `Nazione=IT`)
  - `CessionarioCommittente`:
    - `IdFiscaleIVA` e `CodiceFiscale` cliente
    - `Denominazione` cliente
    - `Sede` con indirizzo, CAP, comune, provincia (upper case), nazione `IT` anche se in anagrafica è “Italia”.

- `FatturaElettronicaBody`
  - `DatiGeneraliDocumento`
    - `TipoDocumento` → `TD01` (fattura) o `TD04` (nota di credito)
    - `Divisa` → `EUR`
    - `Data`, `Numero`, `ImportoTotaleDocumento`
    - Eventuale causale (es. testo regime forfettario)
  - `DatiBeniServizi`
    - Una `DettaglioLinee` per ogni riga di fattura
    - `DatiRiepilogo` aggregato per natura IVA, includendo anche la rivalsa INPS con `N4` e aliquota 0.

Il nome file viene generato come:

`IT<PIVA>_<5caratteri_alfa_num>.xml`

---

### 5. Timeout di sessione e login/logout

- Timer di inattività: **5 minuti**
  - Monitorati eventi: click, keypress, movimento mouse, scroll.
  - Dopo 5 minuti senza attività:
    - logout automatico (`auth.signOut()`)
    - redirect alla schermata di login.
- Logout manuale:
  - Bottone in sidebar → `auth.signOut().then(() => location.reload())`
  - Azzeramento timer e stato utente.

---

### 6. Import / Export JSON

#### 6.1. Import “vecchio backup”

Nella sezione **“Migrazione Dati”**:

- Bottone **“Carica Backup JSON”** + input file `#import-file-input`. :contentReference[oaicite:7]{index=7}  
- Lo script:
  - legge il `.json` del vecchio gestionale
  - converte in struttura dati corrente
  - popola Firestore usando `saveDataToCloud`
  - **associa i dati all’utente corrente** (coerente con il modello multi‑utente).

#### 6.2. Backup dal Cloud (utente corrente)

Nella stessa pagina:

- Bottone **“Backup dal Cloud (utente corrente)”** / “Scarica Backup JSON” (`#export-cloud-json-btn`). :contentReference[oaicite:8]{index=8}  
- Lo script:
  - prende `globalData` sincronizzato dal Cloud
  - genera un JSON con:
    - `companyInfo`
    - `products`
    - `customers`
    - `invoices`
    - `notes`
  - crea un blob e scarica un file tipo:  
    `gestionale-backup-YYYY-MM-DD.json`.

---

### 7. Filtro per anno nell’Elenco Documenti

In **Elenco Fatture** è presente una combo:

```html
<select id="invoice-year-filter" ...>
    <option value="all">Tutti</option>
    <!-- altri anni -->
</select>
``` :contentReference[oaicite:9]{index=9}  

La logica JS:

- Popola la combo con gli anni effettivamente presenti tra le fatture dell’utente.
- `renderInvoicesTable()`:
  - legge il valore selezionato (`all` o un anno, es. `2025`)
  - filtra `globalData.invoices` in base a `invoice.date.substring(0,4)`
  - renderizza solo i documenti dell’anno selezionato.

---

### 8. Struttura dei file di progetto

- `index.html`
  - Layout principale
  - Sidebar con voci: Home, Anagrafica Azienda, Clienti, Servizi, Nuovo Documento, Documenti Emessi, Statistiche, Migrazione, Logout.
  - Modali: cliente, prodotto, nuova fattura/nota, dettaglio fattura (visualizzazione), scelta fattura da copiare.

- `style.css`
  - Palette personalizzata
  - Piccole rifiniture dell’aspetto tabelle, sidebar, badge, ecc.

- `script.js`
  - Config Firebase + inizializzazione
  - Auth + gestione sessione + timeout
  - CRUD su Firestore (azienda, clienti, prodotti, documenti, note)
  - Calcoli fattura (rivalsa INPS, bollo, totali)
  - Generazione XML
  - Import backup vecchio / export JSON dal Cloud
  - Filtro per anno in elenco documenti
  - Statistiche e simulazione fiscale.

---

## PARTE 2 – GUIDA UTENTE (DOCENTE / STUDENTE)

Questa parte puoi darla direttamente agli studenti.

### 1. Accesso e sessione

1. Apri l’indirizzo del gestionale nel browser.
2. Inserisci **email** e **password** fornite dal docente.
3. Dopo il login:
   - vedi la **Home** con calendario, data/ora e note personali.
4. Dopo 5 minuti senza usare l’app verrai disconnesso automaticamente.

Suggerimento: se finisci l’esercitazione, clicca sempre su **Logout** dalla sidebar.

---

### 2. Home

- Mostra:
  - Messaggio di benvenuto con la tua email
  - Un piccolo calendario del mese
  - Data e ora aggiornate in tempo reale
  - Un campo “Note” personali salvate nel Cloud solo per il tuo utente.

---

### 3. Anagrafica Azienda

Menu: **Anagrafica Azienda**

Compila con attenzione:

- Dati anagrafici e fiscali
- Indirizzo e provincia
- PEC (non obbligatoria)
- Coefficiente di redditività, aliquota imposta sostitutiva, aliquota contributi
- Banca e IBAN (verranno mostrati nella fattura)

Premi **“Salva Dati Azienda”**.

> Per gli esercizi, il docente può fornire una scheda con i dati fittizi dell’azienda.

---

### 4. Clienti

Menu: **Anagrafica Clienti**

- Pulsante **“Nuovo cliente”**:
  - inserisci ragione sociale, P.IVA, codice fiscale, S.d.I., PEC, indirizzo, provincia, nazione.
  - spunta **“Applica Rivalsa INPS”** se quel cliente richiede la rivalsa (es. pubblica amministrazione).
- Salva.

Puoi anche:

- **Modificare** un cliente (icona matita)
- **Cancellare** un cliente (icona cestino) – solo se non ci sono controlli bloccanti concordati per l’esercizio.

---

### 5. Servizi / Prodotti

Menu: **Anagrafica Servizi**

- Crea alcuni servizi tipici (es. “Consulenza 1h”, “Progettazione logo”, ecc.)
- Definisci:
  - Descrizione
  - Prezzo unitario
  - IVA (tipicamente 0 per forfettario) e natura esenzione
- Il servizio **“Rivalsa Bollo”** deve avere:
  - Prezzo = valore della marca da bollo (es. 2,00 €)
  - IVA = 0
  - Natura esenzione coerente (es. N2.x o N4).

---

### 6. Creare una Fattura

Menu: **Nuovo Documento**

1. Puoi:
   - creare una fattura **vuota**
   - oppure **copiare** una fattura esistente (stessa struttura, nuova data/numero).
2. Nella schermata:
   - scegli il **cliente** dalla combo.
   - controlla/aggiorna **Data Documento**.
   - `Condizioni Pagamento`, `Modalità`, `Scadenza` vengono precompilate secondo la logica impostata (e puoi modificarle).
3. Aggiungi righe di dettaglio:
   - scegli un servizio dalla combo “Seleziona Servizio”
   - la descrizione, il prezzo e l’IVA vengono precompilati
   - imposta la quantità
   - premi **“+”** per aggiungere la riga.
4. Se devi aggiungere la **marca da bollo**, inserisci una riga con servizio “Rivalsa Bollo”.
5. Il riepilogo in fondo mostra:
   - Totale Prestazioni
   - Rivalsa INPS (se il cliente ha la spunta)
   - Totale Imponibile
   - Bollo
   - **Totale Documento**.

Quando sei soddisfatto, clicca **“Salva”**.

---

### 7. Elenco Documenti

Menu: **Documenti Emessi**

- In alto puoi filtrare l’anno con la combo **Anno**.
- In tabella vedi:

  - Tipo (`Fatt.` / `NdC`)
  - Numero
  - Data
  - Cliente
  - Totale
  - Scadenza
  - Stato (`Da Incassare`, `Pagata`, `Emessa` per NdC)
  - Azioni:
    - **Visualizza** – apre la fattura in un modale con intestazioni, righe, totali, dati di pagamento e dicitura regime forfettario.
    - **Genera XML** – scarica il file `.xml` pronto da caricare sul portale ADE.
    - **Modifica** – disponibile solo se la fattura **non è Pagata**.
    - **Cancella** – disponibile solo se la fattura **non è Pagata**.
    - **Segna come Pagata** – imposta lo stato su Pagata ed impedisce ulteriori modifiche/cancellazioni.

---

### 8. Statistiche

Menu: **Statistiche**

- Riepilogo fatturato netto per cliente (fatture – note di credito)
- Percentuale sul totale
- Simulazione:
  - **Contributi INPS** stimati
  - **Imposta sostitutiva** su base imponibile (con deduzione contributi)
  - Totale uscite fiscali stimate.

I parametri usati sono quelli di **Anagrafica Azienda** (coefficiente di redditività, aliquota contributi, aliquota imposta sostitutiva). :contentReference[oaicite:10]{index=10}  

---

### 9. Migrazione / Backup

Menu: **Migrazione Dati**

- **Importa backup vecchio (.json)**  
  Carica il file json della vecchia versione (offline/localStorage) per migrare i dati nel Cloud.
- **Backup dal Cloud (utente corrente)**  
  Scarica un file `.json` con TUTTI i dati del tuo utente (azienda, clienti, servizi, documenti, note).

---

### 10. Consigli d’uso per le esercitazioni

- Ogni gruppo di studenti utilizza **un utente Firebase dedicato**.
- Prima dell’esercitazione:
  - il docente può caricare un file `.json` “template” (azienda + pochi clienti/servizi) con l’import dal Cloud
- Dopo l’esercitazione:
  - è possibile scaricare un backup per ogni utente/gruppo
  - opzionalmente ripulire i dati da Firestore (via script o manualmente) e reimportare il template.

---

_Fine README._
