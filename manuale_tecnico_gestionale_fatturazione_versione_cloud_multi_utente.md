# Manuale Tecnico – Gestionale di Fatturazione

## 1. Scopo del documento
Questo manuale tecnico descrive in modo **approfondito e strutturato** l’architettura, il funzionamento interno e le logiche applicative del gestionale di fatturazione sviluppato in JavaScript con backend Firebase.

Il documento è destinato a:
- docenti / amministratori
- sviluppatori che devono manutenere o estendere il progetto
- tecnici che devono capire **perché** il sistema funziona in un certo modo (non solo *come usarlo*)

---

## 2. Architettura generale

### 2.1 Stack tecnologico

| Livello | Tecnologia |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript (vanilla + jQuery) |
| Backend | Firebase (Authentication + Firestore) |
| Persistenza | Firestore (strutturata per utente) |
| Export | JSON (backup), XML FatturaPA |

Il progetto è **single‑page application (SPA)** senza framework (React / Vue), volutamente mantenuto semplice per scopi didattici.

---

## 3. Modello multi‑utente

### 3.1 Autenticazione
- Gestita tramite **Firebase Authentication (email/password)**
- Ogni utente ha un `uid` univoco

### 3.2 Isolamento dei dati
Tutti i dati sono **scoped per utente**:

```
users/{uid}/
  ├── companyInfo
  ├── customers
  ├── products
  ├── invoices
  └── notes
```

Questo garantisce:
- isolamento totale tra studenti/gruppi
- nessuna possibilità di cancellazione accidentale dei dati altrui

---

## 4. Struttura dei dati principali

### 4.1 Anagrafica Azienda (`companyInfo`)
Campi principali:
- denominazione / nome
- partita IVA
- codice fiscale
- regime fiscale
- aliquota INPS
- coordinate bancarie (banca, IBAN)

### 4.2 Clienti (`customers`)
Campi rilevanti:
- denominazione
- partita IVA / CF
- indirizzo
- **flag Rivalsa INPS** (chiave per il calcolo)

### 4.3 Prodotti / Servizi (`products`)
- descrizione
- prezzo unitario
- IVA (sempre 0 nel regime forfettario)
- codice natura IVA

### 4.4 Documenti (`invoices`)

Ogni documento contiene:
- tipo (`Fattura`, `Nota di Credito`)
- data documento
- righe di dettaglio
- totali calcolati
- stato (`Da incassare`, `Pagata`, `Inviata`)

---

## 5. Logica di calcolo (CRITICA)

> ⚠️ **Questa è la parte più delicata del progetto**

### 5.1 Individuazione del tipo di cliente

Il campo **Rivalsa INPS** nell’anagrafica cliente determina **due flussi di calcolo diversi**.

---

### 5.2 Totale Prestazioni

```
TotalePrestazioni = Σ (quantità × prezzo)
```

- La riga **"Rivalsa Bollo" NON entra** in questo calcolo

---

### 5.3 Rivalsa INPS (se presente)

```
RivalsaINPS = TotalePrestazioni × (aliquotaINPS / 100)
```

- Applicata **solo se il cliente ha il flag attivo**

---

### 5.4 Totale Imponibile

```
Se Rivalsa INPS attiva:
  TotaleImponibile = TotalePrestazioni + RivalsaINPS

Se Rivalsa INPS NON attiva:
  TotaleImponibile = TotalePrestazioni
```

---

### 5.5 Marca da bollo

- Importo fisso: **2,00 €**
- Presente nel documento **sempre nel file XML**
- In visualizzazione solo se esiste la riga "Rivalsa Bollo"

---

### 5.6 Totale Documento

```
TotaleDocumento = TotaleImponibile + MarcaBollo
```

---

## 6. Generazione XML FatturaPA

### 6.1 Tipo documento

```
TD01 → Fattura
TD04 → Nota di Credito
```

### 6.2 Dati Bollo

**Sempre presenti**:

```xml
<DatiBollo>
  <BolloVirtuale>SI</BolloVirtuale>
  <ImportoBollo>2.00</ImportoBollo>
</DatiBollo>
```

### 6.3 Validazione

- Il file XML è **validato con fatturacheck.it**
- Rispetta le specifiche dell’Agenzia delle Entrate

---

## 7. Stati del documento

### 7.1 Da incassare
- stato iniziale
- documento modificabile ed eliminabile

### 7.2 Pagata
- selezionabile **sempre**
- aggiunge badge "Pagata"

### 7.3 Inviata
- richiede conferma esplicita
- **irreversibile**
- blocca modifica ed eliminazione

---

## 8. Filtri per anno

### 8.1 Elenco Documenti
- default: **anno corrente**
- opzioni: altri anni presenti + "Tutti"

### 8.2 Statistiche
- stessa logica dell’elenco documenti
- calcoli coerenti con il filtro selezionato

---

## 9. Backup e Migrazione

### 9.1 Export JSON
- esporta **solo i dati dell’utente corrente**
- formato compatibile con re‑import

### 9.2 Import JSON
- sovrascrive i dati esistenti
- utilizzabile per reset didattico

### 9.3 Cancellazione per anno
- disponibile dal menu Migrazione
- elimina solo i documenti dell’anno selezionato

---

## 10. Timeout e sicurezza

- timeout di inattività configurabile
- logout invalida sessione Firebase
- nessun uso di cache locale persistente

---

## 11. Linee guida per modifiche future

✔ **Sicuro**:
- aggiunte CSS
- nuove viste
- nuove statistiche

⚠️ **Rischioso**:
- refactoring dei calcoli
- modifica struttura XML
- modularizzazione senza test automatici

---

## 12. Stato del progetto

✅ Versione **stabile in produzione**

Tutte le funzionalità sono:
- testate manualmente
- validate lato XML
- coerenti con il regime forfettario

---

*Fine documento*


---

# Appendice A – Diagrammi di flusso logici

## A.1 Flusso di autenticazione
1. Utente apre applicazione
2. Firebase Auth verifica sessione
3. Se autenticato → recupero `uid`
4. Caricamento dati da Firestore sotto `/users/{uid}`
5. Avvio UI

## A.2 Flusso creazione fattura
1. Selezione cliente
2. Inserimento righe servizi
3. Calcolo Totale Prestazioni
4. Verifica Rivalsa INPS cliente
5. Calcolo Rivalsa (se applicabile)
6. Calcolo Totale Imponibile
7. Applicazione Bollo virtuale
8. Salvataggio documento

---

# Appendice B – Schema Firestore

```
users/{uid}
 ├── companyInfo
 ├── customers/{customerId}
 ├── products/{productId}
 ├── invoices/{invoiceId}
 └── notes/{noteId}
```

Ogni utente vede **solo** i propri dati.

---

# Appendice C – Stati documento

| Stato | Modificabile | Eliminabile | XML |
|------|-------------|-------------|-----|
| Da incassare | Sì | Sì | Sì |
| Pagata | No | No | Sì |
| Inviata | No | No | Sì |

Lo stato **Inviata** è irreversibile.

---

# Appendice D – Checklist di test (regressione)

## Autenticazione
- [ ] Login valido
- [ ] Logout pulito
- [ ] Timeout inattività

## Fatturazione
- [ ] Cliente con Rivalsa INPS
- [ ] Cliente senza Rivalsa INPS
- [ ] Bollo presente
- [ ] Bollo assente

## XML
- [ ] Validazione FatturaPA
- [ ] TD01
- [ ] TD04 > 77,47€

## Filtri anno
- [ ] Elenco Documenti default anno corrente
- [ ] Statistiche default anno corrente
- [ ] Selezione anni precedenti

---

# Appendice E – Regole d’oro per la manutenzione

1. **Non modificare** la logica di calcolo
2. **Non duplicare** funzioni di filtro anno
3. Ogni refactor deve passare la checklist
4. Test XML sempre su fatturacheck

---

Documento aggiornato alla versione stabile di produzione.

