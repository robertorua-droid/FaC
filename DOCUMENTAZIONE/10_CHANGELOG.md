# 10. Changelog (principali aggiunte)

Questo changelog riassume le implementazioni introdotte negli ultimi step fino alla versione “stabile”.

## v11.08 (Stable Cloud)
### Gestione Dati (ex Migrazione)
- Rinomina “Migrazione” → **Gestione Dati**.
- **Backup dal Cloud**: esportazione JSON completa (companyInfo + tutte le collezioni).
- **Importa Backup JSON**: import “merge” (aggiorna per ID, non cancella record extra).
- **Ripristino totale (Reset + Import)** con doppia conferma (prompt `ELIMINA`).
- **Reset totale dati (Reset classe)** con doppia conferma e cancellazione di:
  - tutte le collezioni principali
  - **tutti i doc in `settings/*`** (anche futuri)
- Eliminazioni parziali:
  - **Elimina Documenti per anno** (fatture/NC)
  - **Elimina Acquisti per anno**

### Impostazioni
- **Uso dati (stima)**: tabella + progress bar su 1 GiB (Spark), basata su dimensione JSON dei dati.

### Acquisti
- **Importa XML** (FatturaPA fornitore) nel form Nuovo Acquisto:
  - parsing header/body
  - creazione fornitore con conferma se mancante
  - precompilazione righe e scadenze (se presenti)

### Timesheet / Export CSV
- Esportazione CSV migliorata:
  - date in formato italiano `gg/mm/aaaa`
  - rimozione newline e sequenze `\\n` dai campi testo
  - ordine colonne: `Date|EndCustomer|BillToCustomer|Commessa|Project|Minutes|Hours|Billable`
- Fix popolamento combo filtri (Fatturo a / Commessa / Progetto) all’apertura pagina Export.

### Migliorie UX
- Forzato refresh delle select anno all’apertura della pagina Gestione Dati.

### Dashboard
- Aggiunta pagina **Dashboard** con selettore **Annuale/Mensile**.
- KPI principali: **Ore timesheet totali**, **Ore fatturabili**, **Ore già fatturate**, **N. worklog**.
- Tabelle: dettaglio mensile/giornaliero e Top Progetti/Commesse per ore fatturabili.
