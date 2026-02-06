# 5. Uso dati (stima) – quota Spark

Percorso: **Impostazioni → Uso dati (stima)**.

## Cosa mostra
La pagina mostra una stima della “dimensione dati” dell’utente, calcolata come:

- dimensione (in byte) della serializzazione **JSON** di ciascuna categoria di dati già caricata dal Cloud
- somma totale confrontata con una quota di riferimento **1 GiB** (piano Firebase gratuito “Spark”)

Categorie principali:
- Azienda (`companyInfo`)
- Clienti, Servizi, Fornitori
- Documenti, Acquisti
- Note
- Commesse, Progetti
- Worklog (Timesheet)

## Limiti della stima (importanti)
Questa stima è **indicativa** e serve a scopo didattico:
- non include overhead Firestore (metadati, indici, struttura interna)
- non include eventuale Firebase Storage
- misura solo ciò che l’app ha già caricato in memoria

## Come usarla
- Premi **Ricalcola** per aggiornare tabella e progress bar.
- Se stai facendo molte prove (import massivi, worklog numerosi), è utile per capire quali categorie “pesano” di più.

## Interpretazione rapida
- Sotto il 5–10%: uso molto basso.
- 10–50%: dataset già significativo (utile in laboratorio).
- Oltre 50%: probabilmente molti worklog o molti documenti (verifica e fai pulizia/backup).

