# 2. Manuale utente

Questo manuale descrive l’uso quotidiano del gestionale, con particolare attenzione a:
- configurazione iniziale dell’**anagrafica azienda**
- differenze operative tra **Ordinario** e **Forfettario**
- ciclo completo **commesse → progetti → timesheet → fattura**
- uso corretto di documenti, acquisti, scadenziario e gestione dati

---

## 2.1 Accesso e primo avvio
1) Apri l’app da hosting statico o da server locale.
2) Effettua il login.
   - Se hai dimenticato la password, usa **Password dimenticata?** nella schermata di accesso: inserendo l'email, Firebase invia il link per reimpostarla.
   - Il messaggio di conferma è volutamente neutro e non indica se l'indirizzo è registrato.
3) Al primo accesso entra in **Impostazioni → Azienda**.
4) Compila l’anagrafica in modo completo.
5) Imposta il **Regime fiscale (gestionale)**.
6) Salva.

> Finché l’anagrafica azienda non è stata impostata in modo coerente, alcune sezioni possono restare limitate o comportarsi in modo incompleto.

---

## 2.2 Impostazioni → Azienda
Questa è la pagina più importante del progetto. Da qui dipendono:
- comportamento del gestionale
- visibilità di alcune sezioni
- calcoli IVA e fiscali
- generazione XML
- dati mostrati in stampa e dettaglio documento

### 2.2.1 Cosa conviene compilare sempre
Compila con attenzione almeno questi gruppi di dati:

#### A. Dati identificativi dello studio/azienda
- denominazione / ragione sociale
- nome e cognome, se lavori come persona fisica
- partita IVA
- codice fiscale
- indirizzo
- CAP
- comune
- provincia
- nazione

Questi dati vengono usati in più punti:
- intestazioni documento
- stampa PDF
- export XML
- validazione formale

#### B. Regime fiscale gestionale
Campo chiave del progetto.

Puoi scegliere tra:
- **Ordinario**
- **Forfettario**

Il regime gestionale determina il comportamento dell’app:

**Ordinario**
- abilita gestione IVA
- abilita fornitori e acquisti
- abilita registri IVA
- abilita scadenze IVA nello scadenziario
- abilita simulazione ordinaria

**Forfettario**
- semplifica la UI
- disattiva acquisti/fornitori/registri IVA
- forza IVA = 0 nelle fatture
- abilita simulazione quadro LM
- mantiene il focus su incassi, compensi e simulazione forfettaria

> Se il dato `taxRegime` non è valorizzato, il sistema prova a risolvere il comportamento anche da `codiceRegimeFiscale`, ma è sempre meglio compilare esplicitamente il regime gestionale.

#### C. Dati bancari
Compila almeno il conto principale:
- nome banca
- IBAN

Se usi più conti, puoi compilare anche il conto secondario.

Questi dati servono per:
- dettaglio fattura
- esportazione XML
- controlli formali sui pagamenti

#### D. Parametri IVA e fiscali
In **Ordinario** compila in modo coerente:
- aliquota IVA predefinita
- periodicità IVA (mensile/trimestrale)
- eventuali parametri contributivi e previdenziali richiesti dal tuo scenario didattico

In **Forfettario** verifica invece:
- codice regime fiscale corretto
- eventuali aliquote contributive / parametri usati dalla simulazione

### 2.2.2 Buone pratiche per la compilazione
- salva l’anagrafica azienda **prima** di creare documenti
- compila sempre indirizzo, CAP, comune e provincia
- compila sempre almeno un IBAN valido se usi pagamenti bancari
- ricontrolla il regime prima di iniziare un’esercitazione

### 2.2.3 Preferenze App
Nella pagina Azienda trovi anche le **Preferenze App**, tra cui il tema.

In più, nella sidebar è presente un toggle rapido **Dark mode** per passare velocemente tra chiaro e scuro.

### 2.2.4 Google Calendar in Home
Il campo opzionale **Google Calendar Home** permette di sostituire il calendario locale della Home con un calendario Google incorporato in vista **7 giorni**.

Puoi inserire:
- l'URL embed copiato da Google Calendar
- oppure direttamente l'ID del calendario

Il calendario deve essere pubblico oppure condiviso con l'utente che apre l'app. Se il campo resta vuoto o l'URL non è valido, la Home continua a mostrare il calendario locale precedente.

---

## 2.3 Anagrafiche
Le anagrafiche sono la base dei documenti e dei flussi timesheet/fatturazione.

### 2.3.1 Clienti
Menu: **Anagrafiche → Clienti**

Per ogni cliente puoi inserire:
- ragione sociale oppure nome/cognome
- partita IVA e/o codice fiscale
- indirizzo completo
- codice destinatario / PEC
- condizioni di pagamento
- opzioni fiscali e contributive legate al cliente

#### Opzioni importanti in anagrafica cliente
- **Rivalsa INPS**
- **Scorporo Rivalsa**
- **Sostituto d’imposta**
- **Bollo a carico studio**

Questi flag incidono direttamente su:
- calcolo fattura
- totale documento
- XML
- riepiloghi in dettaglio

#### Solo Forfettario: prefisso import timesheet
Puoi impostare un testo da usare come prefisso nelle righe importate dal timesheet in fattura.

Esempio:
- “Attività di docenza”
- “Prestazione professionale”
- “Supporto progettuale”

Se lasci il campo vuoto, l’import non aggiunge alcun prefisso fisso.

### 2.3.2 Servizi
Menu: **Anagrafiche → Servizi**

Qui definisci il catalogo base delle prestazioni:
- codice
- descrizione
- prezzo
- IVA
- eventuali attributi usati nei flussi progetto/fattura

In **Forfettario**, l’IVA proposta dal servizio non prevale sul comportamento del regime: nel documento l’IVA viene comunque gestita come zero.

### 2.3.3 Fornitori
Menu: **Anagrafiche → Fornitori**

Disponibile solo in **Ordinario**.

Serve per:
- acquisti manuali
- import XML acquisti
- scadenziario pagamenti
- analisi e registri IVA

---

## 2.4 Fatture di vendita
Menu: **Fatture di Vendita**

### 2.4.1 Nuova fattura
Crea una nuova fattura selezionando:
- cliente
- data documento
- numero
- metodo di pagamento
- eventuale banca/conto

Poi aggiungi le righe documento.

Ogni riga può includere:
- descrizione
- quantità
- prezzo
- aliquota IVA / natura
- subtotal calcolato

### 2.4.2 Nuova nota di credito
La nota di credito funziona come un documento collegato a un’operazione precedente.

Compila con attenzione:
- tipo documento
- causale
- riferimento alla fattura collegata
- data e numero del documento collegato, se richiesti dal tuo flusso

Il sistema usa questi dati anche nella costruzione dell’XML.

### 2.4.3 Ricalcolo totali
Il gestionale ricalcola i totali in base a:
- righe documento
- regime fiscale
- impostazioni cliente
- bollo
- rivalsa
- ritenuta
- scorporo

In **Forfettario**:
- IVA = 0
- viene usata la natura prevista
- il bollo può essere inserito automaticamente sopra soglia

### 2.4.4 Elenco documenti
Menu: **Fatture di Vendita → Elenco Documenti**

Da qui puoi:
- filtrare per anno
- aprire il dettaglio
- modificare
- eliminare
- marcare come pagata
- marcare come inviata
- esportare XML

### 2.4.5 Dettaglio documento
Nel dettaglio fattura trovi:
- riepilogo cliente
- riepilogo documento
- righe
- totali
- pulsante stampa
- menu **XML**

Il menu **XML** contiene:
- **Genera XML**
- **Copia XML**
- **Apri FatturaCheck**
- **Apri FEX**
- **Apri Agenzia Entrate**

> I siti di validazione esterni si aprono in una nuova tab e non ricevono automaticamente il file. Il caricamento o l’incolla dell’XML resta sempre sotto il controllo dell’utente.

---

## 2.5 Fatture di acquisto
Menu: **Fatture di Acquisto**

Disponibile solo in **Ordinario**.

### 2.5.1 Nuovo acquisto
Compila:
- fornitore
- numero documento
- data documento
- data riferimento pagamento
- giorni termine
- eventuale data scadenza
- righe acquisto

Il sistema usa questi dati per:
- totale acquisto
- scadenziario pagamenti
- analisi
- registri IVA

### 2.5.2 Import XML acquisti
Nel form **Nuovo Acquisto** puoi importare un XML ricevuto dal fornitore.

Il sistema prova a precompilare:
- testata documento
- fornitore
- righe
- dati di scadenza, se presenti

Se il fornitore non esiste, viene proposta la creazione in anagrafica.

---

## 2.6 Scadenziario
Menu: **Analisi → Scadenziario**

Lo scadenziario raccoglie eventi di natura diversa:
- incassi fatture
- pagamenti acquisti
- scadenze IVA

### In Ordinario
Puoi vedere:
- incassi
- pagamenti acquisti
- scadenze IVA

### In Forfettario
Restano soprattutto:
- incassi delle fatture

Lo scadenziario è utile per simulare il comportamento operativo di un piccolo studio professionale.

---

## 2.7 Commesse, progetti e timesheet
Questa è una delle parti più importanti del progetto perché collega l’operatività quotidiana alla fatturazione.

## 2.7.1 Logica generale
Il flusso corretto è questo:

1. **Cliente**
2. **Commessa**
3. **Progetto**
4. **Worklog / Timesheet**
5. **Import ore in fattura**

### Cliente
È il soggetto a cui emetterai il documento.

### Commessa
La commessa rappresenta il contenitore principale del lavoro commissionato da un cliente.

In pratica la commessa risponde alla domanda:
**“Per quale incarico sto lavorando e a chi fatturo?”**

### Progetto
Il progetto è un sotto-livello della commessa.

Serve per suddividere il lavoro in attività più specifiche.

In pratica il progetto risponde alla domanda:
**“Su quale attività concreta sto lavorando dentro questa commessa?”**

### Worklog / Timesheet
Il worklog è la registrazione puntuale del lavoro svolto:
- data
- commessa
- progetto
- durata
- note
- fatturabilità

### Import in fattura
Le ore registrate nel timesheet possono diventare righe fattura, mantenendo il legame logico con il lavoro svolto.

---

## 2.7.2 Commesse
Menu: **Commesse → Commesse**

Per ogni commessa definisci almeno:
- nome/descrizione
- cliente “Fatturo a”
- stato

La commessa è il livello giusto per rappresentare un incarico, un contratto o una linea di lavoro verso un cliente.

### Esempio
Cliente: **Alfa Srl**
Commessa: **Supporto consulenziale 2025**

All’interno della stessa commessa puoi poi avere più progetti.

---

## 2.7.3 Progetti
Menu: **Commesse → Progetti**

Ogni progetto è collegato a una commessa.

Campi importanti:
- **Codice progetto**
- **Cliente finale**
- **Servizio predefinito**
- **Tariffa**
- tipo **Lavoro / Costo**

### Cliente finale: a cosa serve
È utile quando lavori per un cliente che ti commissiona attività verso un destinatario finale diverso.

Esempio:
- Fatturo a: **Società Beta**
- Cliente finale: **Comune di Gamma**

Così puoi distinguere:
- chi riceve la fattura
- per chi è stata effettivamente svolta l’attività

### Servizio e tariffa del progetto
Se associ un servizio al progetto, il sistema può proporre in automatico:
- descrizione coerente
- tariffa coerente
- tipo di attività

Questo aiuta molto nei flussi timesheet → fattura.

---

## 2.7.4 Timesheet
Menu: **Commesse → Timesheet**

Qui registri il lavoro svolto giorno per giorno.

Ogni worklog può contenere:
- data
- commessa
- progetto
- minuti / ore
- minuti / ore cliente finale, se previsti
- numero **Ticket** opzionale collegato all’intervento
- flag fatturabile
- note

### Buone pratiche
- usa sempre commessa e progetto coerenti
- indica il numero ticket quando l’intervento fa riferimento a una richiesta tracciata
- descrivi le attività nelle note in modo chiaro
- marca come non fatturabili le attività interne o escluse dalla rendicontazione

### Modifica worklog
Puoi riaprire un worklog già salvato e modificarlo.

Se il worklog è già stato importato in fattura, conviene verificare con attenzione il suo stato prima di intervenire.

---

## 2.7.5 Import ore dal timesheet in fattura
Nel form fattura puoi usare l’import ore dal timesheet.

Il flusso corretto è:
1. selezioni cliente / documento
2. apri import timesheet
3. filtri il periodo
4. selezioni commessa/progetto, se necessario
5. il sistema costruisce righe fattura
6. salvi il documento

### Cosa fa il sistema
- genera righe documento dalle ore selezionate
- tiene traccia dei worklog collegati
- evita, per quanto possibile, doppie fatturazioni accidentali
- in fase di salvataggio collega i worklog alla fattura

### Cosa controllare sempre
- descrizione riga generata
- quantità/ore
- tariffa applicata
- cliente corretto
- eventuale prefisso forfettario

### Se elimini o modifichi
In base al flusso:
- rimuovere righe importate
- modificare la fattura
- eliminare la fattura

può influire sul legame con i worklog importati.

Per questo conviene fare attenzione soprattutto nelle esercitazioni dove si prova più volte lo stesso scenario.

---

## 2.8 Export Timesheet CSV
Menu: **Commesse → Export CSV**

Puoi esportare i worklog con diversi filtri e formati. L’export include anche i campi **Ticket** e **Note**, così da mantenere nel CSV il riferimento alla richiesta e il dettaglio operativo dell’intervento.

Utilissimo per:
- esercitazioni
- rendicontazioni
- confronti tra ore registrate e ore fatturate

Formati disponibili:
- dettaglio
- raggruppamento per progetto
- raggruppamento per commessa
- pivot per giorno/progetto

---

## 2.9 Dashboard e statistiche
Menu: **Analisi → Dashboard** / **Statistiche**

Queste pagine aiutano a leggere i dati gestionali del periodo:
- ore lavorate
- ore fatturabili
- fatturato
- andamento per periodo
- top progetti / commesse

Usale per confrontare:
- attività svolta
- documenti emessi
- sostenibilità del carico di lavoro

---

## 2.10 Simulazioni fiscali
Menu: **Fiscalità**

### Ordinario
Disponibile in regime ordinario.

Serve per simulare il comportamento del professionista con IVA, costi e logica fiscale ordinaria.

### LM / Forfettario
Disponibile in regime forfettario.

Serve per stimare il comportamento del reddito forfettario e dei contributi/imposte.

> Le simulazioni sono strumenti didattici: vanno interpretate come supporto allo studio, non come consulenza fiscale ufficiale.

---

## 2.11 Gestione dati
Menu: **Impostazioni → Gestione Dati**

Da qui puoi:
- fare backup JSON
- importare un backup
- eliminare documenti per anno
- eliminare acquisti per anno
- fare reset totale
- ripristinare un dataset standard

Questa sezione è molto utile in laboratorio, quando vuoi:
- preparare una classe
- ripartire da uno stato pulito
- distribuire uno scenario già pronto

---

## 2.12 Suggerimento operativo per l’uso corretto
Per lavorare bene col progetto, l’ordine consigliato è:

1. **Compila Azienda**
2. **Configura il regime**
3. **Crea Clienti e Servizi**
4. **Crea Commesse**
5. **Crea Progetti**
6. **Inserisci Timesheet**
7. **Importa ore in fattura** oppure crea documenti manuali
8. **Esporta PDF/XML**
9. **Controlla Scadenziario e Simulazioni**
10. **Fai Backup**

Questo ordine riduce errori e rende più chiaro il legame tra i moduli.


## Allegato XML da Timesheet

Nel form fattura, sotto i pulsanti di importazione ore dal Timesheet, puoi attivare l'opzione **Allega il dettaglio non aggregato del timesheet all'XML della fattura (PDF)**.

Quando è attiva, il gestionale genera durante l'export XML un allegato PDF con il dettaglio dei worklog collegati alla fattura. Puoi anche scegliere se **includere le note operative** del timesheet. L'allegato è solo descrittivo e non modifica i totali fiscali della fattura.
