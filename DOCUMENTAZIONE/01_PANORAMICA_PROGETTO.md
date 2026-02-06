# 1. Panoramica del progetto

## Obiettivo didattico
L'applicazione simula la gestione di un professionista con due **regimi gestionali**:

- **Ordinario**: gestione IVA, acquisti/fornitori, registri IVA, simulazione ordinario.
- **Forfettario**: semplificazione (IVA assente/forzata a 0), simulazione quadro LM.

L'app è pensata per esercitazioni: anagrafiche, documenti, scadenze, commesse/progetti, timesheet, backup e ripristini.

## Stack tecnico
- Front-end: **HTML + Bootstrap + jQuery** (single page app).
- Backend: **Firebase**
  - **Authentication** (login)
  - **Cloud Firestore** (dati utente)

> Non usa un backend custom: tutti i dati sono salvati su Firestore sotto l’utente autenticato.

## Dati e struttura Firestore
Dati per utente:

- Path base: `users/{uid}/...`
- Impostazioni: `users/{uid}/settings/*` (es. `settings/companyInfo`)
- Collezioni principali:
  - `products` (servizi)
  - `customers` (clienti)
  - `suppliers` (fornitori)
  - `invoices` (fatture + note di credito)
  - `purchases` (acquisti)
  - `notes` (block-notes)
  - `commesse` (commesse)
  - `projects` (progetti)
  - `worklogs` (timesheet)

## Pagine principali (menu)
- **Home**: dashboard e block-notes
- **Statistiche**: riepiloghi annuali
- **Registri IVA** *(solo Ordinario)*
- **Simulazioni fiscali**: Ordinario / LM
- **Anagrafiche**: Clienti, Fornitori *(solo Ordinario)*, Servizi
- **Documenti**: Nuova Fattura, Nuova Nota Credito, Elenco Documenti
- **Acquisti** *(solo Ordinario)*: Nuovo Acquisto, Elenco Acquisti
- **Scadenziario**: incassi, pagamenti, scadenze IVA
- **Commesse / Progetti / Timesheet**
- **Export Timesheet**
- **Impostazioni**: Azienda, Uso dati (stima), Gestione Dati

## Regime gestionale: effetto sulle funzionalità
Il regime viene scelto in **Impostazioni → Azienda**.

### Ordinario
- Abilita: Fornitori, Acquisti, Registri IVA, simulazione ordinario.
- L’IVA è gestita in righe documenti, riepiloghi e registri.

### Forfettario
- Nasconde/Disabilita: Fornitori e Acquisti, Registri IVA.
- L’IVA viene forzata a 0 nei flussi per evitare errori.
- Abilita: simulazione quadro LM.

## Concetti chiave per l’uso didattico
- **Timesheet**: è salvato come `worklogs` (giorno/commessa/progetto/minuti) e viene esportato in CSV.
- **Import ore in fattura**: dal timesheet puoi generare righe fattura e (opzionalmente) marcare worklog come fatturati.
- **Gestione Dati**: backup, import, cancellazioni per anno, reset totale per “passaggio classe”.
- **Uso dati (stima)**: utile per parlare di quote/limiti (stima su 1 GiB Spark).
