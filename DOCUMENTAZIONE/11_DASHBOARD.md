# Dashboard (Annuale / Mensile)

La **Dashboard** è una pagina di riepilogo pensata per dare, a colpo d’occhio, lo stato dell’attività in un periodo selezionato.

## A cosa serve
- Visualizzare **Ore timesheet totali** e **Ore fatturabili** (prioritarie in un contesto didattico).
- Identificare rapidamente i **progetti** e le **commesse** più rilevanti per ore.
- Vedere un dettaglio **mensile** (in modalità annuale) o **giornaliero** (in modalità mensile).

## Dove si trova
Menu laterale: **Dashboard**.

## Periodo
In alto trovi i controlli:
- **Periodo**: `Annuale` oppure `Mensile`.
- **Anno**: selezionabile in base agli anni presenti nei dati (fatture, acquisti, worklog) + anno corrente.
- **Mese**: visibile solo in modalità `Mensile`.
- **Aggiorna**: forza il ricalcolo e l’aggiornamento della pagina.

## KPI (card)
Le card KPI mostrano:
- **Ore totali**: somma di tutti i worklog nel periodo.
- **Ore fatturabili**: somma dei worklog con flag `Fatturabile` attivo.
- **Ore già fatturate** (indicatore di supporto): worklog collegati a una fattura (`invoiceId` presente).
- **N. worklog**: numero di righe timesheet nel periodo.

> Nota: nel progetto il “Timesheet” è derivato dai **worklog**. Quindi, per ripristinare/analizzare le ore, è sufficiente che i worklog siano presenti.

## Tabelle sotto ai KPI
### 1) Dettaglio periodo (Timesheet)
- In **Annuale**: tabella per **mese** con ore totali, ore fatturabili e percentuale.
- In **Mensile**: tabella per **giorno** con ore totali, ore fatturabili e percentuale.

### 2) Top Progetti (ore fatturabili)
Mostra i 10 progetti con più ore fatturabili nel periodo:
- Progetto
- Commessa
- Ore totali
- Ore fatturabili
- % fatturabili

### 3) Top Commesse (ore fatturabili)
Mostra le 10 commesse con più ore fatturabili nel periodo:
- Commessa
- End Customer
- Fatturo a
- Ore totali
- Ore fatturabili
- % fatturabili

## Regole e definizioni
- **Ore totali** = somma di `minutes` / 60.
- **Ore fatturabili** = somma di `minutes` dei worklog con `billable !== false`.
- **Ore già fatturate** = somma di `minutes` dei worklog che hanno `invoiceId` valorizzato.

