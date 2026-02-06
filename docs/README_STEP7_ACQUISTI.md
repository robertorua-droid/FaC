# STEP 7 – Acquisti (Regime ordinario – IVA a credito, senza partita doppia)

Questo step aggiunge al progetto:
- **Anagrafica Fornitori**
- **Gestione Acquisti** (documenti di acquisto con righe + IVA a credito)
- **Scadenza** per ogni acquisto (Data Riferimento + Giorni)

## Cosa è stato aggiunto
- Nuove collezioni dati:
  - `suppliers` (fornitori)
  - `purchases` (acquisti)
- Nuove sezioni UI:
  - Anagrafiche → Fornitori
  - Acquisti → Nuovo Acquisto / Elenco Acquisti
- Calcoli acquisto:
  - Imponibile, IVA (somma per riga), Totale documento

## Note / Limitazioni (volute per step-by-step)
- **Nessuna contabilità in partita doppia**.
- Nessuna stampa/XML per acquisti (verrà introdotta in step successivi se necessario).
- Stato acquisto: **Da Pagare / Pagata** (toggle rapido da elenco).

## Migrazione / Backup
- Export/Import backup include anche `suppliers` e `purchases`.
