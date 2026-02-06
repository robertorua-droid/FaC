# Mappa moduli — chi chiama cosa (versione stabile)

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
4. Feature modules: auth/navigation/company/masterdata/invoices/purchases/scadenziario/registri-iva/tax/notes/migration
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
- `company`
- `ordinarioSim`
- `scadenziario`, `notes`, `migration`
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
- `populateDropdowns()`
- `renderStatisticsPage()`
- `renderRegistriIVAPage()` *(solo ordinario, su richiesta pagina)*
- `renderScadenziarioPage()`
- `renderHomePage()`

### 3.2 Regime fiscale gestionale
- **Ordinario**: abilita IVA/acquisti/fornitori/registri IVA
- **Forfettario**: nasconde acquisti/fornitori/registri IVA; IVA forzata a 0 in servizi e fatture

---

## 4) Moduli principali (responsabilità)

### `features/invoices/*`
- `invoices-form-module.js`: gestione form, righe documento, pagamenti (banca 1/2, termini), calcolo totali
- `invoices-list-module.js`: elenco documenti, view, azioni (pagata/inviata), stampa
- `invoices-xml-module.js`: export XML FatturaPA (branch ordinario/forfettario)

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
