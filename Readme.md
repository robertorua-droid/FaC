# Gestionale Cloud – Professionisti (Regime Forfettario)

Versione: **v9.7 – Stable Cloud**

Gestionale didattico per la fatturazione di professionisti in regime forfettario, pensato per esercitazioni in aula con più gruppi di studenti in ambiente **multi‑utenza** tramite Firebase Authentication + Firestore.

L’app è una **Single Page Application** HTML/JS/CSS che gira completamente lato client, con persistenza dati su Firebase.

---

## 1. Funzionalità principali

- **Multi‑utente**:
  - Accesso tramite email/password Firebase.
  - Ogni utente vede e modifica solo i propri dati (azienda, clienti, servizi, documenti, note).

- **Anagrafiche**:
  - **Azienda (cedente)** con tutti i dati fiscali: P.IVA, CF, indirizzo, città, CAP, provincia, nazione, banca, IBAN, regime fiscale, coefficiente di redditività, aliquota imposta sostitutiva, aliquota INPS, aliquota rivalsa INPS, ecc. :contentReference[oaicite:0]{index=0}
  - **Clienti (cessionari)** con indirizzo completo, P.IVA/CF, codice SdI, nazione, flag “Rivalsa INPS”.
  - **Servizi/Prodotti** con codice, descrizione, prezzo, aliquota IVA ed eventuale natura di esenzione. :contentReference[oaicite:1]{index=1}  

- **Documenti Emessi**:
  - **Fatture** e **Note di Credito**.
  - Numerazione automatica con prefissi tipo `FATT-YYYY-NN` e `NC-YYYY-NN`.
  - Inserimento righe documento tramite servizi presenti in anagrafica.
  - Gestione speciale di:
    - **Rivalsa INPS** (se il cliente ha il flag attivo).
    - **Rivalsa Bollo** (servizio dedicato, marca da bollo 2 €).
  - Campi pagamento: condizioni, modalità, data riferimento, giorni scadenza, data scadenza. :contentReference[oaicite:2]{index=2}  

- **Stati documento**:
  - `Da Incassare`, `Pagata` per le fatture.
  - `Bozza`, `Emessa` per le note di credito.
  - Le fatture **Pagate** non sono più modificabili né cancellabili (pulsanti disabilitati). :contentReference[oaicite:3]{index=3}  

- **Elenco Documenti**:
  - Tabella con tipo, numero, data, cliente, totale, scadenza, stato, azioni.   
  - Pulsanti:
    - **Visualizza** (apre una modale con layout pronto per stampa PDF).
    - **Modifica** (solo se non pagata / non emessa).
    - **XML** (genera file elettronico).
    - **Segna come pagata**.
    - **Elimina** (non disponibile per documenti pagati).

- **Filtro per anno** (Elenco Documenti):
  - Combo che permette di filtrare i documenti per anno (es. 2025, 2026, …), per evitare elenchi troppo lunghi durante le esercitazioni.

- **XML Fattura Elettronica**:
  - Generazione del file `.xml` conforme allo schema SdI, validato con FatturaCheck.
  - Nome file nel formato:  
    `IT<PartitaIVA>_<5caratteriRandom>.xml`  
    (es. `IT12442600016_ai5yv.xml`)  
  - Gestione corretta di:
    - Cedente/prestatore (azienda).
    - Cessionario/committente (cliente).
    - Linee di dettaglio con natura IVA.
    - Riepilogo IVA coerente con le nature utilizzate (inclusa rivalsa INPS in natura N4).
    - Marca da bollo nei casi previsti.

- **Statistiche & Simulazione fiscale**:
  - Riepilogo fatturato per cliente (fatture – note di credito).
  - Simulazione automatica:
    - Reddito imponibile forfettario (coefficiente).
    - Contributi INPS (aliquota).
    - Imposta sostitutiva.
    - Totale uscite stimate e acconti. :contentReference[oaicite:5]{index=5}  

- **Home / Dashboard**:
  - Calendario mensile.
  - Block‑notes salvato su Cloud per utente.
  - Data/ora aggiornate in tempo reale.   

- **Backup / Migrazione**:
  - Import da **vecchia versione locale** (file JSON) verso il Cloud.
  - Backup JSON dal Cloud per l’**utente corrente**.
  - Import JSON nel nuovo formato Cloud (sovrascrive / aggiorna solo i dati dell’utente corrente).

- **Timeout di inattività**:
  - Dopo ~5 minuti senza interazioni (click, keypress, mousemove) la sessione viene chiusa con `auth.signOut()` e l’utente viene riportato alla schermata di login.

---

## 2. Architettura Tecnica

- Frontend:
  - **HTML5** + **Bootstrap 5** per layout e componenti.
  - **Font Awesome 6** per le icone.   
  - **CSS custom** (`style.css`) per rifiniture grafiche (sidebar, tabelle, stampa). :contentReference[oaicite:8]{index=8}  
  - **jQuery 3.7** per la gestione degli eventi e del DOM.

- Backend (as a service):
  - **Firebase Authentication (Email/Password)**.
  - **Firebase Firestore** (modalità compat) per i dati:
    - `settings/companyInfo`
    - `products`
    - `customers`
    - `invoices`
    - `notes`

- Hosting:
  - Qualsiasi hosting statico: GitHub Pages, Firebase Hosting, server scolastico, ecc.

Il file `index.html` carica i CSS, Bootstrap, Font Awesome e, a fine pagina, jQuery, Bootstrap JS e Firebase SDK compat, poi `script.js` con tutta la logica.   

---

## 3. Struttura del progetto

```text
/
├─ index.html      # Struttura SPA (login + app) e modali
├─ style.css       # Stili custom (layout, sidebar, tabelle, stampa)
└─ script.js       # Tutta la logica dell’app (Firebase, UI, calcoli, XML)
