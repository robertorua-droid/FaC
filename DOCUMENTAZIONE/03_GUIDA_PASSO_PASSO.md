# 3. Guida passo‑passo (esercitazioni)

Questa guida propone un percorso pratico per usare il progetto in aula o in autoapprendimento.

---

## 3.1 Percorso consigliato di avvio
Prima di iniziare un’esercitazione completa, esegui questo setup minimo:

1. Accedi all’app.
2. Vai in **Impostazioni → Azienda**.
3. Compila l’anagrafica completa.
4. Scegli il **Regime fiscale (gestionale)**.
5. Inserisci almeno un **IBAN**.
6. Crea almeno:
   - 1 cliente
   - 1 servizio
   - 1 commessa
   - 1 progetto

> Se l’anagrafica azienda non è completa, stampa PDF ed export XML possono risultare incompleti o bloccati dai controlli formali.

---

## 3.2 Esercitazione A — Ciclo minimo fattura
### Obiettivo
Capire il flusso base documento → dettaglio → PDF → XML.

### Passaggi
1. Crea un cliente.
2. Crea un servizio.
3. Vai su **Fatture di Vendita → Nuova Fattura**.
4. Inserisci cliente, numero, data, pagamento.
5. Aggiungi una riga servizio.
6. Salva.
7. Apri il dettaglio documento.
8. Prova:
   - **Stampa**
   - menu **XML → Genera XML**
   - menu **XML → Copia XML**
   - menu **XML → Apri FatturaCheck / FEX / Agenzia Entrate**

### Cosa osservare
- dati anagrafici corretti
- totali corretti
- banca/IBAN corretti
- XML formalmente valido

---

## 3.3 Esercitazione B — Ordinario
### Obiettivo
Vedere il comportamento di un professionista in regime ordinario.

### Passaggi
1. Imposta il regime **Ordinario** in Azienda.
2. Crea 2 clienti, 2 servizi, 1 fornitore.
3. Crea una fattura con IVA.
4. Crea un acquisto con IVA.
5. Vai in:
   - **Scadenziario**
   - **Registri IVA**
   - **Simulazione ordinario**

### Cosa osservare
- scadenze IVA presenti
- fornitori e acquisti disponibili
- riepiloghi IVA attivi
- simulazione fiscale coerente con il regime

---

## 3.4 Esercitazione C — Forfettario
### Obiettivo
Vedere come cambia il gestionale in regime forfettario.

### Passaggi
1. Imposta il regime **Forfettario**.
2. Crea 1–2 clienti e 1–2 servizi.
3. Crea una fattura.
4. Verifica il dettaglio documento.
5. Esporta XML.
6. Vai in **Simulazione LM**.

### Cosa osservare
- IVA a zero
- natura corretta in XML
- acquisti e fornitori non centrali / nascosti
- focus su compensi e simulazione forfettaria

---

## 3.5 Esercitazione D — Commesse, Progetti e Timesheet
### Obiettivo
Capire il modello operativo del gestionale.

### Passaggi
1. Crea un cliente.
2. Crea una **Commessa** associata al cliente.
3. Crea 2 **Progetti** dentro la stessa commessa.
4. Per ogni progetto imposta:
   - codice progetto
   - cliente finale
   - servizio predefinito
   - tariffa
5. Inserisci 3–4 worklog nel **Timesheet**.
6. Marca alcuni worklog come non fatturabili.
7. Crea una nuova fattura.
8. Usa **Importa ore dal timesheet**.
9. Salva la fattura.

### Cosa osservare
- coerenza tra commessa, progetto e worklog
- costruzione delle righe fattura dalle ore
- rapporto tra “Fatturo a” e “Cliente finale”
- stato dei worklog dopo il salvataggio

---

## 3.6 Esercitazione E — Nota di credito
### Obiettivo
Simulare la correzione di una fattura già emessa.

### Passaggi
1. Parti da una fattura già salvata.
2. Crea una **Nuova Nota Credito**.
3. Inserisci causale e riferimento al documento collegato.
4. Salva.
5. Apri il dettaglio.
6. Esporta XML.

### Cosa osservare
- tipo documento corretto
- riferimento documento coerente
- segni e importi corretti
- XML formalmente valido

---

## 3.7 Esercitazione F — Export CSV Timesheet
### Obiettivo
Capire la differenza tra lavoro registrato e fatturazione.

### Passaggi
1. Inserisci worklog su più giorni e progetti.
2. Vai in **Export CSV**.
3. Prova i filtri per periodo, commessa, progetto e fatturabilità.
4. Esporta:
   - dettaglio
   - per progetto
   - per commessa
   - pivot giorno/progetto

### Cosa osservare
- differenza tra dettaglio e aggregati
- confronto tra ore registrate e ore importate in fattura

---

## 3.8 Fine lezione / ripartenza pulita
### Opzione 1 — Backup
Usa **Gestione Dati → Backup JSON** per salvare lo stato dell’esercitazione.

### Opzione 2 — Reset totale
Usa **Gestione Dati → Reset totale dati** per svuotare l’ambiente.

### Opzione 3 — Ripristino standard
Usa **Ripristino totale (Reset + Import)** per ripartire sempre dallo stesso dataset.

---

## 3.9 Metodo consigliato per il collaudo manuale finale
Quando vuoi verificare che il refactoring non abbia rotto i flussi, prova sempre almeno questi casi:

1. nuova fattura ordinaria
2. nuova fattura forfettaria
3. modifica fattura
4. copia fattura
5. nota di credito
6. PDF
7. XML
8. commessa → progetto → timesheet → import in fattura
9. acquisto ordinario
10. scadenziario

Se tutti questi casi funzionano, il progetto è in uno stato molto solido anche a livello funzionale.
