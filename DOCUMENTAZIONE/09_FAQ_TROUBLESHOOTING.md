# 9. FAQ e Troubleshooting

## Login / dati non si vedono
- Verifica di essere loggato.
- Se i menu “spariscono” o alcune sezioni non funzionano, entra in **Impostazioni → Azienda** e controlla di aver salvato il **Regime fiscale (gestionale)**.
- Se hai appena importato un backup, rientra in Home oppure ricarica la pagina per aggiornare tutti i render.

## In Forfettario non vedo Acquisti/Fornitori
È normale: in regime forfettario la sezione **Acquisti** e **Fornitori** è disabilitata (scopo didattico: niente IVA a credito).

## Import XML acquisto: “XML non valido”
- Il file deve essere un XML **FatturaPA** con `FatturaElettronicaHeader` e `FatturaElettronicaBody`.
- Alcuni file “stampati” o esportati da gestionali possono non essere FatturaPA completi.

## Import XML acquisto: fornitore non trovato
Non è bloccante.
- Se il fornitore non è presente, l’app chiede conferma e può **crearlo automaticamente**.
- Se annulli, l’import viene interrotto per evitare di salvare un acquisto “orfano”.

## Export Timesheet: le combo filtro non si aprono
Se succede (in genere dopo modifiche o cache vecchie):
- ricarica la pagina
- verifica di essere su **Export Timesheet** e non su **Timesheet**

Nella versione stabile le combo **Fatturo a / Commessa / Progetto** sono popolate all’apertura della pagina Export.

## Gestione Dati: import “non cancella”
È corretto: **Importa Backup JSON** è un import *non distruttivo* (merge).
Se vuoi un ripristino “pulito” usa:
- **Ripristino totale (Reset + Import)**

## Reset totale: è davvero totale?
Sì. Cancella tutte le collezioni principali e **tutti i documenti sotto `settings/*`** (incluse eventuali impostazioni future).

## Ho cancellato per errore
Non c’è “undo”.
- Se hai un backup, usa **Ripristino totale (Reset + Import)**.
- Se non hai un backup, i dati non sono recuperabili dall’app.

## Suggerimento per laboratori
Per evitare problemi, salva sempre:
1) un backup “standard” per l’esercitazione
2) un backup “fine esercizio” per confronto/valutazione
