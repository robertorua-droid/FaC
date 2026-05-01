# Mappa moduli — chi chiama cosa (v12.25)

Questa mappa descrive flusso, dipendenze e responsabilità principali.

- **UI unica**: `js/ui/ui-render.js`
- **Orchestratore** (nome storico): `js/app/invoice-xml-migration.js`

---

## 1) Boot e ciclo di vita

### 1.1 Ordine script (no bundler)
Ordine consigliato:
1. Core: `utils.js`, `form-helpers.js`
2. Services: `firebase-cloud.js`
3. UI: `ui-render.js`
4. Feature modules: auth, docs-content, navigation, dashboard, statistics, registri-iva, simulazione-ordinario, simulazione-lm, customers, products, suppliers, invoices, purchases, scadenziario, commesse, projects, timesheet, export-timesheet, notes, migration, usage.
5. App: `invoice-xml-migration.js`, `app-bootstrap.js`

### 1.2 `app-bootstrap.js`
- `$(document).ready()`
  - `initFirebase()`
  - `bindEventListeners()`

### 1.3 Orchestratore: `invoice-xml-migration.js`
`bindEventListeners()` chiama i `bind()` dei moduli (idempotenti):
- `auth`, `navigation`
- `registriIva`
- `customers`, `products`, `suppliers`
- `invoicesForm`, `invoicesList`, `invoicesXML`
- `company`, `dashboard`
- `ordinarioSim`, `lmSim`
- `scadenziario`, `notes`, `migration`, `usage`
- `commesse`, `projects`, `timesheet`, `exportTimesheet`
- `initPurchasesModule()`

---

## 2) Flusso principale: Auth → Dati → Render

### 2.1 Auth (`features/auth/auth-module.js`)
`auth.onAuthStateChanged(user)`:
- se loggato: `currentUser=user` → `loadAllDataFromCloud()` → `renderAll()` → `startInactivityWatch()`
- se non loggato: reset UI + `stopInactivityWatch()`

### 2.2 Data layer (`services/firebase-cloud.js` + `core/utils.js`)
- `globalData` contiene: `companyInfo`, `customers`, `products`, `suppliers`, `invoices`, `purchases`, `notes`
- helper principali:
  - `getData(key)` / `setData(key, value)`
  - `saveDataToCloud(collection, data)` / `deleteDataFromCloud(collection, id)`

---

## 3) UI (unica): `ui-render.js`

### 3.1 `renderAll()`
`renderAll()` ricalcola le pagine e richiama i render specifici.

Chiamate tipiche (con logica *conditional* per regime):
- `renderCompanyInfoForm()` + `updateCompanyUI()`
  - aggiorna **nome studio in sidebar** (Ragione Sociale)
  - show/hide voci menu in base a `companyInfo.taxRegime`
- `renderProductsTable()` / `renderCustomersTable()`
- `renderSuppliersTable()` *(solo ordinario)*
- `renderPurchasesTable()` *(solo ordinario, via purchases-module)*
- `renderInvoicesTable()`
- `populateDropdowns()` (popola select per anagrafiche e filtri)
- `renderCommesseTable()`, `renderProjectsTable()`, `renderTimesheetPage()`
- `renderStatisticsPage()`, `renderDashboardPage()`
- `renderStatisticsPage()`
- `renderRegistriIVAPage()` *(solo ordinario, su richiesta pagina)*
- `renderScadenziarioPage()`
- `renderHomePage()`

### 3.2 Regime fiscale gestionale
- **Ordinario**: abilita IVA/acquisti/fornitori/registri IVA
- **Forfettario**: nasconde acquisti/fornitori/registri IVA; IVA forzata a 0 in servizi e fatture

---

## 4) Moduli principali (responsabilità)

### `features/navigation/*`
- `docs-content.js`: bundle statico dei contenuti MD (manuale, changelog).
- `navigation-module.js`: sidebar collapsible, sezioni expand/collapse, persistenza stato, caricamento contenuti da bundle.

### `features/invoices/*`
- `invoices-form-module.js`: gestione form, righe documento, pagamenti, calcolo totali.
- `invoices-list-module.js`: elenco documenti, azioni (pagata/inviata).
- `invoices-xml-module.js`: export XML FatturaPA.
- `invoices-timesheet-import-module.js`: logica di importazione ore dai worklog collegati (in Forfettario può usare `customer.timesheetPrefix` per personalizzare il prefisso descrizione).

### `features/commesse/*`
- `commesse-module.js`, `projects-module.js`: gestione anagrafiche legate al lavoro.
- `timesheet-module.js`: inserimento e gestione worklog (Minutes vs FinalMinutes).
- `export-timesheet-module.js`: generazione CSV con raggruppamenti e pivot.

### `features/dashboard/dashboard-module.js`
- Calcolo KPI in tempo reale e rendering grafici/tabelle riepilogative.

### `features/purchases/purchases-module.js` (solo ordinario)
- CRUD acquisti + tooltips azioni

### `features/scadenziario/scadenziario-module.js`
- filtri + azioni (spunte) con tooltips

### `features/tax/*`
- `forfettario-calc.js`: simulazione Quadro LM (didattica)
- `ordinario-calc.js` + `ordinario-sim-module.js`: simulazione redditi ordinario (RE/RN/RR; saldo/acconti)

---

## 5) Convenzioni

- `bind()` idempotente in ogni modulo
- dopo operazioni CRUD: `saveDataToCloud(...)` → `renderAll()`
