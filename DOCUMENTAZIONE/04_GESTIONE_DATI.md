# 4. Gestione Dati (Backup / Import / Eliminazioni / Reset)

Percorso: **Impostazioni → Gestione Dati**.

Questa pagina contiene operazioni “amministrative” sull’utente corrente (dati su Firestore).

> Tutte le operazioni con etichetta **rosso** sono **irreversibili**.

## 4.1 Backup dal Cloud (utente corrente)
**Scarica Backup JSON** esporta un file `.json` con **TUTTI** i dati salvati nel Cloud per l’utente connesso:
- `companyInfo` (Azienda)
- `products`, `customers`, `suppliers`
- `invoices` (fatture/NC), `purchases` (acquisti)
- `commesse`, `projects`, `worklogs` (timesheet)
- `notes`

Il file si chiama `gestionale-backup-YYYY-MM-DD.json`.

## 4.2 Importa Backup JSON (merge/aggiorna)
**Carica Backup JSON** importa un file creato con “Scarica Backup JSON” e salva i dati nel Cloud dell’utente corrente.

Comportamento:
- aggiorna/crea record con lo **stesso ID**
- **non elimina** record già presenti ma assenti nel backup (import non distruttivo)

Se nel file è presente un `userId` diverso dall’utente loggato, viene mostrato un avviso.

Quando usarlo:
- “aggiorno” o “porto avanti” un dataset
- “aggiungo” dati sopra una base già esistente

## 4.3 Elimina Documenti per Anno (utente corrente)
Elimina dal Cloud **Fatture** e **Note di Credito** dell’anno selezionato.

- serve per pulizie parziali (es. “riparto dall’anno nuovo”)
- richiede doppia conferma

Suggerimento: fai prima un **Backup JSON**.

## 4.4 Elimina Acquisti per Anno (utente corrente)
Elimina dal Cloud i **Documenti di acquisto** dell’anno selezionato.

- richiede doppia conferma
- aggiorna automaticamente: elenco acquisti, registri IVA e scadenziario

Suggerimento: fai prima un **Backup JSON**.

## 4.5 Ripristino totale da Backup JSON (Reset + Import)
Operazione “forte” pensata per ripartire da uno stato controllato.

Cosa fa:
1) Cancella **TUTTI** i dati dell’utente corrente
2) Cancella anche **tutti i documenti sotto `settings/*`** (incluse impostazioni future)
3) Importa il backup selezionato

Conferma:
- popup di conferma
- richiesta di digitare `ELIMINA`

Quando usarlo:
- in laboratorio, per ripartire sempre con lo stesso dataset
- per recuperare uno stato “pulito” dopo test

## 4.6 Reset totale dati (Reset classe)
Cancella **TUTTI** i dati dell’utente corrente dal Cloud:
- anagrafiche (clienti/fornitori/servizi)
- documenti (fatture/NC) e acquisti
- commesse, progetti, worklog/timesheet, note
- **settings** (tutti i doc presenti e futuri)

Conferma:
- popup
- digitazione `ELIMINA`

Quando usarlo:
- “classe successiva parte da zero”

## Note tecniche (per chi mantiene il progetto)
- Le cancellazioni avvengono a batch (massimo ~450 doc a batch).
- I dati sono per-utente (`users/{uid}/...`).
- L’import salva `companyInfo` in `settings/companyInfo` e le collezioni principali nelle rispettive collection.

