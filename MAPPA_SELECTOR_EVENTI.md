# Mappa selector/eventi → modulo/file (versione stabile)

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

## Migrazione/backup (`js/features/migration/migration-module.js`)

| Selector | Evento | Azione |
|---|---|---|
| `#backup-btn` | `click` | export JSON |
| `#restore-btn` | `click` | import JSON |
| `#delete-documents-form` | `submit` | elimina documenti per anno |
