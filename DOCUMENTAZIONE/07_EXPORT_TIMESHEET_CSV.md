# 7. Export Timesheet in CSV

Percorso: **Commesse → Export Timesheet**.

## Obiettivo
Esportare i worklog (timesheet) in CSV, con:
- date in formato italiano **gg/mm/aaaa**
- intestazioni e colonne in ordine stabile
- nessun carattere “\n” sporcante nei campi

## Filtri disponibili
- **Da / A** (intervallo date)
- **Fatturo a** (cliente in anagrafica collegato alla commessa)
- **Commessa**
- **Progetto**
- **Fatturabile** (SI/NO)
- **Già fatturato** (worklog con invoiceId)

## Formati di esportazione (“Raggruppa per”)
### Dettaglio (default)
- una riga per ogni worklog
- colonne:
  `Date | EndCustomer | BillToCustomer | Commessa | Project | Minutes | Hours | Billable`

### Giorno (progetti in colonne) – pivot
- una riga per **Giorno + Commessa**
- ogni progetto diventa una colonna con le ore
- aggiunge anche `TotalHours`, `Billable` (SI/NO/MISTO) e `Note`

### Altri raggruppamenti
- Giorno + Progetto
- Progetto
- Commessa

> Nota: nei raggruppamenti, alcune colonne possono risultare vuote (es. Date fuori dal raggruppamento), per mantenere un layout CSV coerente.

## Caratteristiche del file CSV
- Separatore: `;`
- Decimali ore: `0.00`
- Nome file: `timesheet_YYYYMMDD_YYYYMMDD.csv`

## Compatibilità con Excel / Google Sheets
- Importa come CSV con separatore `;`.
- Le date sono già in formato italiano (di solito Excel le riconosce correttamente).

## Colonne: significato
- **Date**: data worklog (gg/mm/aaaa)
- **EndCustomer**: cliente finale della commessa (testo)
- **BillToCustomer**: cliente “Fatturo a” (anagrafica clienti)
- **Commessa**: nome commessa
- **Project**: nome progetto
- **Minutes**: minuti totali per riga/gruppo
- **Hours**: minuti convertiti in ore (2 decimali)
- **Billable**: `SI` / `NO` / `MISTO`

