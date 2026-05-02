# 7. Export Timesheet in CSV

Percorso: **Commesse → Export Timesheet**.

## Obiettivo
Esportare i worklog (timesheet) in CSV, con:
- date in formato italiano **gg/mm/aaaa**
- intestazioni e colonne in ordine stabile
- nessun carattere “\n” sporcante nei campi
- inclusione di **Ticket** e **Note** per rendicontazioni operative

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
  `Date | EndCustomer | BillToCustomer | Commessa | ProjectCode | Project | Minutes | Hours | FinalMinutes | FinalHours | Billable | Ticket | Note`

### Giorno (progetti in colonne) – pivot
- una riga per **Giorno + Commessa**
- ogni progetto diventa una colonna con le ore
- aggiunge anche `TotalHours`, `FinalTotalMinutes`, `FinalTotalHours`, `Billable` (SI/NO/MISTO), `Ticket` e `Note`

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
- **EndCustomer**: cliente finale del progetto (testo)
- **BillToCustomer**: cliente “Fatturo a” (anagrafica clienti)
- **Commessa**: nome commessa
- **ProjectCode**: codice progetto (se presente)
- **Project**: nome progetto
- **Minutes**: minuti (commessa / fatturo a)
- **Hours**: Minutes convertiti in ore (2 decimali)
- **FinalMinutes**: minuti per il cliente finale (se non compilati, uguali a Minutes)
- **FinalHours**: FinalMinutes convertiti in ore (2 decimali)
- **Billable**: `SI` / `NO` / `MISTO`
- **Ticket**: numero ticket/richiesta collegato all’intervento, se compilato
- **Note**: note operative del worklog; nei raggruppamenti più note vengono aggregate con ` | `

