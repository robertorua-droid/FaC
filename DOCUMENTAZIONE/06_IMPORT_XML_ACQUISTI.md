# 6. Import XML fattura fornitore (Acquisti)

Percorso: **Acquisti → Nuovo Acquisto → Importa XML**.

## Obiettivo
Velocizzare l’inserimento di un documento di acquisto partendo da un file **XML FatturaPA** (fattura elettronica ricevuta dal fornitore).

L’import è implementato come modulo separato (`js/features/purchases/purchase-xml-import-module.js`) per non alterare la logica core del modulo acquisti.

## Come usare
1) Vai in **Nuovo Acquisto**
2) Clicca **Importa XML**
3) Seleziona un file `.xml` (FatturaPA)
4) Verifica i campi precompilati
5) Salva l’acquisto

## Cosa viene compilato
- **Fornitore** (da *CedentePrestatore*)
  - se esiste già in anagrafica viene selezionato
  - se non esiste viene chiesta conferma per crearlo automaticamente
- **Numero** e **Data documento**
- **Termini e scadenza** se presenti (da *DatiPagamento*)
- **Righe documento** (da *DatiBeniServizi/DettaglioLinee*)
- Se presenti:
  - **Cassa previdenziale** (*DatiCassaPrevidenziale*) → aggiunta come riga extra
  - **Ritenuta** (*DatiRitenuta*) e info pagamento (IBAN/istituto) → inserite nelle **Note**

## Fornitore non presente: cosa succede
Se il fornitore dell’XML non è in **Anagrafica Fornitori**, l’app mostra un popup di conferma:
- **OK** → crea il fornitore e prosegue con l’import
- **Annulla** → import annullato (per evitare un acquisto senza fornitore selezionato)

## Limitazioni note (volute)
- L’import prova a mappare IVA e “Natura” in modo robusto, ma è comunque una semplificazione didattica.
- Alcuni dettagli FatturaPA molto specifici (es. sconti complessi, più blocchi pagamento) possono finire solo nelle note o non essere riportati.

## Suggerimento didattico
Usa l’import per far vedere:
- come sono strutturati header/body FatturaPA
- come si trasformano dati “strutturati” (XML) in un modello “gestionale” (testata + righe)
- perché la presenza di un’anagrafica fornitori coerente è utile (matching P.IVA/CF)
