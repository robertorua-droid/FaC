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
- `js/ui/ui-render.js`: render tabelle/pagine (centralizzato, scelto per limitare bug).
- `js/features/*`: moduli funzionali; ciascuno espone `bind()` idempotente.
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

