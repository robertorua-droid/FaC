# STEP 8 - Scadenziario completo

Questo step aggiunge la pagina **Scadenziario** con:
- **Incassi fatture** (dataScadenza) + azione "Segna Pagata"
- **Pagamenti acquisti** (dataScadenza) + azione toggle "Pagata/Da pagare"
- **Scadenze IVA** (calcolo didattico da vendite/acquisti) con periodicità **Mensile/Trimestrale**

## Impostazione periodicità IVA
In **Azienda** è presente il campo:
- `Periodicità IVA` (mensile / trimestrale)

La periodicità viene usata per generare le scadenze IVA nel periodo selezionato.

### Regole scadenze IVA (didattiche)
- Mensile: **16** del mese successivo
- Trimestrale: Q1→16/05, Q2→16/08, Q3→16/11, Q4→16/03 (anno successivo)

## Filtri
Nella pagina Scadenziario puoi filtrare per:
- Intervallo date (Da/A)
- Tipologie (Incassi / Pagamenti / IVA)
- Mostra crediti IVA
- Mostra pagate
