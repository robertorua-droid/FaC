# Mappa selector/eventi → modulo/file (v12.25)

Questa mappa elenca **dove** vengono gestiti i principali eventi UI.

> Nota: molti handler sono *delegati* su `<tbody>` per gestire righe dinamiche.

---

## Auth (`js/features/auth/auth-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#login-form` | `submit` | Login Firebase + UI feedback |
| `#logout-btn` | `click` | Logout + reset UI |

---

## Navigazione (`js/features/navigation/navigation-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `.sidebar .nav-link` | `click` | Switch pagina via `data-target` + guard regime |
| `#sidebar-toggle-btn` | `click` | Toggle sidebar (collapsed/expanded) |
| `.nav-section-header` | `click` | Toggle espansione singola sezione + persistenza |
| `#btn-expand-all` | `click` | Espande tutte le sezioni del menu |
| `#btn-collapse-all` | `click` | Comprime tutte le sezioni del menu |
| `#invoice-year-filter` | `change` | `renderInvoicesTable()` |
| `#stats-year-filter` | `change` | `renderStatisticsPage()` |
| `#lm-year-select, #lm-only-paid, #lm-include-bollo` | `change` | `renderLMPage()` (solo forfettario) |
| `#lm-refresh-btn` | `click` | `renderLMPage()` |

---

## Azienda (`js/features/company/company-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#company-taxRegime` | `change` | show/hide `.forfettario-only` / `.ordinario-only` |
| `#company-name` | `input` | aggiorna `#company-name-sidebar` |
| `#company-info-form` | `submit` | salva `companyInfo` → `renderAll()` |

---

## Clienti (`js/features/masterdata/customers-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#newCustomerBtn` | `click` | reset form + apre modal |
| `#saveCustomerBtn` | `click` | salva cliente → `renderAll()` |
| `#customer-bolloAcaricoEmittente` | `change` | (opzionale) flag "Bollo a carico studio" usato in fatture/XML |
| `#customer-timesheetPrefix` | `input` | (solo forfettario) prefisso descrizione import ore timesheet in fattura |
| `#customers-table-body` | `click` su `.btn-edit-customer` | modifica |
| `#customers-table-body` | `click` su `.btn-delete-customer` | elimina |

---

## Servizi (`js/features/masterdata/products-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#newProductBtn` | `click` | reset form + default IVA (forfettario=0) |
| `#saveProductBtn` | `click` | salva servizio → `renderAll()` |
| `#product-iva` | `change` | toggle campo esenzione/natura |
| `#products-table-body` | `click` su `.btn-edit-product` | modifica |
| `#products-table-body` | `click` su `.btn-delete-product` | elimina |

---

## Fornitori (`js/features/masterdata/suppliers-module.js`) *(solo ordinario)*

| Selector | Evento | Azione |
|---|---|---|
| `#newSupplierBtn` | `click` | reset form + apre modal |
| `#saveSupplierBtn` | `click` | salva fornitore → `renderAll()` |
| `#suppliers-table-body` | `click` su `.btn-edit-supplier` | modifica |
| `#suppliers-table-body` | `click` su `.btn-delete-supplier` | elimina |

---

## Fatture – form (`js/features/invoices/invoices-form-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#newInvoiceChoiceModal` | `show.bs.modal` | popola select copia fattura |
| `#btn-create-new-blank-invoice` | `click` | apre form vuoto |
| `#btn-copy-from-invoice` | `click` | carica dati da fattura scelta |
| `#add-product-to-invoice-btn` | `click` | aggiunge riga a `tempInvoiceLines` |
| `#invoice-lines-tbody` | `change` su `.line-qty,.line-price,.line-iva,.line-natura` | ricalcolo totali |
| `#invoice-lines-tbody` | `click` su `.del-line` | elimina riga |

### Fatture — editing inline descrizione riga
- `#invoice-lines-tbody .line-desc-cell` → attiva edit descrizione (textarea) — `js/features/invoices/invoices-form-module.js`
- `#invoice-lines-tbody textarea.line-desc-edit` → salva/annulla descrizione (blur / Ctrl+Invio / Esc) — `js/features/invoices/invoices-form-module.js`
| `#invoice-product-select` | `change` | compila descrizione/prezzo/IVA da servizio |
| `#invoice-modalitaPagamento` | `change` | show/hide banca + termini (solo bonifico) |
| `#invoice-bank-select` | `change` | salva `bankChoice` |
| `#invoice-date` | `change` | allinea `#invoice-dataRiferimento` + ricalcolo scadenza |
| `#invoice-dataRiferimento,#invoice-giorniTermini,#invoice-fineMese,#invoice-giornoFissoEnabled,#invoice-giornoFissoValue` | `change/keyup` | ricalcolo `#invoice-dataScadenza` |
| `#new-invoice-form` | `submit` | salva documento (TD01/TD04) → elenco |

---

## Fatture – elenco/view (`js/features/invoices/invoices-list-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#invoices-table-body` | `click` su `.btn-edit-invoice` | modifica documento |
| `#invoices-table-body` | `click` su `.btn-delete-invoice` | elimina |
| `#invoices-table-body` | `click` su `.btn-mark-paid` | marca pagata |
| `#invoices-table-body` | `click` su `.btn-mark-sent` | marca inviata |
| `#invoices-table-body` | `click` su `.btn-view-invoice` | apre modale dettaglio |
| `#print-invoice-btn` | `click` | stampa |

## Export XML (`js/features/invoices/invoices-xml-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#export-xml-btn` / `.btn-export-xml-row` | `click` | `generateInvoiceXML(invoiceId)` |

---

## Acquisti (`js/features/purchases/purchases-module.js`) *(solo ordinario)*

| Selector | Evento | Azione |
|---|---|---|
| `#purchase-year-filter` | `change` | render elenco acquisti |
| `#purchases-table-body` | `click` su `.btn-edit-purchase` | modifica |
| `#purchases-table-body` | `click` su `.btn-delete-purchase` | elimina |
| `#purchases-table-body` | `click` su `.btn-toggle-paid` | pagata/da pagare |

---

## Scadenziario (`js/features/scadenziario/scadenziario-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#scad-from,#scad-to,#scad-show-incassi,#scad-show-pagamenti,#scad-show-iva,#scad-show-iva-crediti,#scad-show-chiuse` | `change` | refresh lista scadenze |
| `.btn-toggle-done` (in tabella) | `click` | spunta/riapre (tooltip azione) |

---

## Registri IVA (`js/features/registri-iva/registri-iva-module.js`) *(solo ordinario)*

| Selector | Evento | Azione |
|---|---|---|
| `#iva-year-select` | `change` | render totali IVA |
| `#iva-group-select` | `change` | mensile/trimestrale |

---

## Simulazione Redditi Ordinario (`js/features/tax/ordinario-sim-module.js`) *(solo ordinario)*

| Selector | Evento | Azione |
|---|---|---|
| `#ord-year-select,#ord-only-paid,#ord-include-bollo,#ord-inps-aliquota` | `change` | ricalcolo simulazione |
| `#ord-refresh-btn` | `click` | ricalcolo simulazione |

---

## Dashboard (`js/features/dashboard/dashboard-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#dash-mode` | `change` | Toggle visibilità mese + rinfresco dashboard |
| `#dash-year, #dash-month` | `change` | Rinfresco dashboard |
| `#dash-refresh-btn` | `click` | Rinfresco dashboard manuale |

---

## Commesse (`js/features/commesse/commesse-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#btn-new-commessa` | `click` | Reset form + apre modal |
| `#commessa-save-btn` | `click` | Salva commessa (Firestore) → render |
| `#commessa-table-body` | `click` su `.btn-edit-commessa` | Carica dati in modal |
| `#commessa-table-body` | `click` su `.btn-delete-commessa` | Elimina commessa (se non ha legami) |

---

## Progetti (`js/features/commesse/projects-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#btn-new-project` | `click` | Reset form + eredita filtro commessa |
| `#project-save-btn` | `click` | Salva progetto (code, endCustomer, etc.) |
| `#project-default-product` | `change` | Eredita tariffa e tipo (Lavoro/Costo) dal servizio |
| `#project-isLavoro, #project-isCosto` | `change` | Gestione flag mutuamente esclusivi |
| `#projects-commessa-filter` | `change` | Filtra elenco progetti |
| `#projects-table-body` | `click` su `.btn-edit-project` | Carica dati in modal |
| `#projects-table-body` | `click` su `.btn-delete-project` | Elimina progetto (se non ha worklog) |

---

## Timesheet (`js/features/commesse/timesheet-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#ts-save-btn` | `click` | Salva worklog (Minutes e FinalMinutes) |
| `#ts-commessa` | `change` | Popola select progetti collegati |
| `#ts-project` | `change` | Aggiorna label Cliente Finale |
| `#ts-hours, #ts-minutes` | `input` | Sync automatico ore Cliente Finale |
| `#ts-hours-final, #ts-minutes-final` | `input` | Interrompe sync automatico ore CF |
| `#ts-filter-from, #ts-filter-to, etc.` | `change` | Filtra elenco worklog |
| `#ts-select-all-invoiced` | `change` | Selezione massiva worklog fatturati |
| `#ts-unlock-selected-btn` | `click` | Sblocca worklog (reset `invoiceId`) |
| `#timesheet-table-body` | `click` su `.btn-edit-worklog` | Carica nel form e scrolla in alto |
| `#timesheet-table-body` | `click` su `.btn-delete-worklog` | Elimina worklog (con warning se fatturato) |

---

## Export Timesheet (`js/features/commesse/timesheet-export.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#ts-export-csv-btn` | `click` | Genera CSV (Dettaglio / Gruppi / Pivot) |
| `#ts-export-group-select` | `change` | Cambia modalità raggruppamento (Dettaglio, Giorno, etc.) |

---

## Migrazione/backup (`js/features/migration/migration-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#backup-btn` | `click` | export JSON |
| `#restore-btn` | `click` | import JSON |
| `#delete-documents-form` | `submit` | elimina documenti per anno |
| `#delete-purchases-form` | `submit` | elimina acquisti per anno (se presente) |
