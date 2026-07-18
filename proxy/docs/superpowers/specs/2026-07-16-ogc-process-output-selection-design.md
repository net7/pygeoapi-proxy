# Selezione Degli Output Dei Processi OGC

## Obiettivo

Permettere all'utente di scegliere uno o più output top-level prima di avviare un processo OGC e, quando un output è disponibile in più formati, scegliere il formato desiderato.

Il form deve restare immediatamente eseguibile:

- tutti gli output sono selezionati inizialmente;
- il primo formato dichiarato è selezionato inizialmente;
- l'utente può deselezionare tutti gli output senza essere bloccato;
- una selezione vuota viene inviata al server remoto come `"outputs": {}`;
- `transmissionMode` continua a essere determinato automaticamente dal backend e non viene esposto nel form.

La funzionalità deve essere generica rispetto alle descrizioni OGC API - Processes, non specifica per `solwcad`.

## Contesto Attuale

Il form dinamico mostra gli output tramite `ExpectedOutputs`, ma il componente è informativo e non mantiene stato modificabile.

Durante il submit, `ProcessExecutionController::store()` ignora qualsiasi preferenza dell'utente e usa `ProcessOutputRequestBuilder::forProcess()` per richiedere automaticamente tutti gli output dichiarati dal processo. Il builder aggiunge solamente `transmissionMode`.

Il backend salva già:

- gli output richiesti in `process_executions.requested_outputs`;
- la descrizione completa degli output in `process_executions.process_outputs`.

Non sono quindi necessarie modifiche allo schema del database.

Il processo remoto [`solwcad`](https://voice.pi.ingv.it/geoinquire/processes/solwcad?f=json) espone un solo output top-level, `solwcad_out`, il cui schema contiene due alternative `oneOf` ordinate:

1. `JSON Array`, con `contentMediaType: application/json`;
2. `Plain text Array`, con `contentMediaType: text/plain`.

OGC API - Processes definisce ogni output richiesto come un oggetto che può contenere `format` e `transmissionMode`. Il formato può specificare `mediaType`, `encoding` e `schema`. Riferimento: [OGC API - Processes - Part 1: Core, sezione 7.11.2.5](https://docs.ogc.org/is/18-062r2/18-062r2.html#_process_outputs).

## Decisioni Funzionali

### Cardinalità Della Selezione

La selezione riguarda esclusivamente gli identificatori top-level presenti in `process.outputs`.

L'utente può selezionare:

- un singolo output;
- più output;
- nessun output.

Le proprietà interne dello schema di un output oggetto non diventano selezioni indipendenti. Se un output top-level contiene più componenti, viene richiesto come unità indivisibile.

### Stato Iniziale

Tutti gli output sono selezionati all'apertura del form.

Per ogni output:

- se sono disponibili più formati, viene selezionato il primo nell'ordine dichiarato dal processo;
- se è disponibile un solo formato, viene associato automaticamente;
- se non è pubblicizzato alcun formato, l'output resta selezionabile senza qualificatore `format`.

Se l'utente deseleziona e poi riseleziona un output, il form conserva l'ultima scelta di formato effettuata per quell'output.

### Formato Esplicito

Quando il processo pubblicizza almeno un formato, il payload remoto include sempre `format.mediaType`, anche se esiste una sola opzione.

Quando presenti nella stessa variante scelta, vengono conservati anche:

- `contentEncoding` come `format.encoding`;
- `contentSchema` o il riferimento di schema equivalente come `format.schema`.

Questi qualificatori non costituiscono controlli separati: fanno parte dell'opzione di formato selezionata.

### Transmission Mode

L'utente non sceglie tra `value` e `reference`.

Il backend continua a usare l'attuale strategia automatica di `ProcessOutputRequestBuilder`. La nuova selezione limita gli output elaborati e aggiunge il formato scelto, ma non introduce un nuovo controllo di trasmissione e non accetta `transmissionMode` dal client.

## Architettura

### Estrattore Dei Formati

La lettura dei formati deve vivere in una responsabilità backend dedicata sotto `App\Services\Ogc`, riutilizzata sia dalla normalizzazione per il frontend sia dalla costruzione del payload remoto.

L'estrattore riceve lo schema grezzo di un output e restituisce una lista ordinata di opzioni fidate. Ogni opzione contiene:

```text
label
mediaType
encoding?
schema?
```

Regole di estrazione:

1. Un `contentMediaType` diretto produce un'opzione.
2. Le alternative `oneOf` e `anyOf` vengono percorse nell'ordine dichiarato e producono opzioni distinte.
3. `allOf` combina i qualificatori dello stesso formato e non viene presentato come scelta indipendente.
4. I qualificatori ereditati attraverso schemi composti vengono uniti alla variante specifica. Un eventuale `$ref` viene conservato come qualificatore di schema, senza recuperare o dereferenziare risorse remote.
5. Il `title` della variante diventa `label`; in sua assenza si usa il media type.
6. Le opzioni con la stessa tupla canonica `mediaType`, `encoding` e `schema` vengono deduplicate mantenendo la prima posizione.
7. Una variante senza media type non crea un'opzione selezionabile.

La stessa estrazione deve essere usata dalla normalizzazione destinata al frontend e dalla validazione backend, evitando due interpretazioni divergenti dello schema. Il frontend consuma soltanto le opzioni normalizzate e non interpreta JSON Schema grezzo.

### Schema Normalizzato Per Il Frontend

`ProcessSchemaNormalizer::normalizeOutputs()` conserva i metadati già disponibili e aggiunge `formats` a ogni `OgcNormalizedOutput`.

Forma concettuale:

```json
{
  "name": "solwcad_out",
  "title": "Output result",
  "description": "...",
  "formats": [
    {
      "label": "JSON Array",
      "mediaType": "application/json"
    },
    {
      "label": "Plain text Array",
      "mediaType": "text/plain"
    }
  ]
}
```

I campi esistenti usati dalla visualizzazione dei risultati restano disponibili per compatibilità. `formats` diventa la sorgente autorevole per il nuovo form.

### Stato Del Form

`DynamicProcessForm` mantiene separatamente:

- l'insieme degli output selezionati;
- il formato corrente di ciascun output.

Il formato resta nello stato anche quando l'output viene deselezionato. Durante la trasformazione Inertia prima del submit vengono inclusi soltanto gli output selezionati.

Il client invia una struttura OGC-like senza `transmissionMode`:

```json
{
  "outputs": {
    "solwcad_out": {
      "format": {
        "mediaType": "text/plain"
      }
    }
  }
}
```

Il backend non inoltra direttamente questa struttura. La usa come selezione da verificare e ricostruisce il payload remoto partendo dalla descrizione del processo in cache.

### Costruzione Del Payload Remoto

`ProcessOutputRequestBuilder` riceve:

- la descrizione del processo fidata;
- la selezione validata oppure `null` quando il campo `outputs` non era presente nella request.

Semantica:

- selezione `null`: richiede tutti gli output, preservando la compatibilità con i vecchi client;
- mappa non vuota: richiede esclusivamente gli identificatori presenti;
- mappa vuota: non richiede alcun output.

Per ogni output richiesto, il builder:

1. individua l'output nella descrizione fidata;
2. risolve il formato richiesto tra le opzioni pubblicizzate;
3. usa il primo formato se l'output ha formati ma il client non ne specifica uno;
4. ricostruisce `format` usando i valori fidati del processo;
5. aggiunge il `transmissionMode` calcolato automaticamente con la logica esistente.

Esempio remoto per `solwcad`:

```json
{
  "inputs": {},
  "outputs": {
    "solwcad_out": {
      "format": {
        "mediaType": "text/plain"
      },
      "transmissionMode": "value"
    }
  }
}
```

### Serializzazione Della Mappa Vuota

Una mappa JSON vuota viene decodificata da PHP come array vuoto, che normalmente verrebbe nuovamente codificato come `[]`.

La rappresentazione interna e persistita resta un array PHP. Al confine HTTP di `OgcProcessesClient`, la proprietà `outputs` viene serializzata esplicitamente come oggetto JSON. Questo garantisce:

```json
{
  "outputs": {}
}
```

senza introdurre oggetti PHP nel payload salvato sul modello o nel payload serializzato del job di coda.

## Interfaccia Utente

La card informativa `ExpectedOutputs` viene sostituita o evoluta in un componente di selezione degli output.

Ogni riga mostra:

- checkbox accessibile;
- titolo dell'output;
- descrizione, quando presente;
- controllo o informazione sul formato.

Comportamento del formato:

- più opzioni: selettore con etichetta e media type, ad esempio `JSON Array — application/json`;
- una sola opzione: formato mostrato come informazione non modificabile;
- nessuna opzione: nessun controllo aggiuntivo.

Quando un output non è selezionato, l'eventuale selettore resta visibile ma disabilitato e conserva il valore corrente.

Se nessun output è selezionato, la card mostra un messaggio informativo equivalente a `Nessun output verrà richiesto`. Il messaggio non è un errore e il pulsante di esecuzione resta abilitato.

Il pulsante che precompila i dati di esempio continua a modificare soltanto gli input del processo.

Tutte le nuove etichette e i nuovi messaggi devono essere presenti nelle traduzioni italiane e inglesi.

## Validazione

`StoreProcessExecutionRequest` accetta `outputs` come mappa opzionale e distingue la presenza del campo dal suo contenuto.

La distinzione deve basarsi sulla presenza della chiave nella request, non sulla sua veridicità o sul fatto che sia valorizzata: una mappa vuota è una scelta esplicita.

La validazione strutturale verifica:

- che `outputs` sia una mappa e non una lista posizionale;
- che ogni valore sia un oggetto di configurazione;
- che `format`, se presente, abbia la struttura prevista;
- che `mediaType`, `encoding` e `schema` abbiano tipi compatibili con il formato OGC.

La validazione semantica usa la descrizione del processo in cache e rifiuta:

- identificatori di output non dichiarati;
- media type non pubblicizzati per quell'output;
- combinazioni di media type, encoding e schema che non corrispondono a una variante dichiarata;
- selezioni diventate obsolete dopo un aggiornamento della descrizione in cache.

Gli errori vengono associati alla sezione output del form. Il job locale non viene creato e nessuna submission viene dispatchata.

Una selezione vuota è valida anche se la descrizione dell'output contiene `minOccurs: 1`.

## Risultati E Persistenza

`requested_outputs` salva la mappa canonica effettivamente destinata al server remoto, inclusi formato e `transmissionMode`.

`process_outputs` continua a salvare l'intera descrizione degli output per titoli, descrizioni e interpretazione dei risultati.

La selezione esplicitamente vuota deve restare distinguibile da `null`:

- `null` indica esclusivamente un'esecuzione storica priva di una mappa canonica salvata;
- `[]` indica che l'utente ha scelto nessun output.

Per le nuove request che omettono `outputs`, il builder genera tutti gli output e salva la relativa mappa canonica non vuota. L'assenza del campo influenza quindi la costruzione iniziale, ma non viene persistita come `null`.

Tutti i percorsi di raccolta dei risultati devono rispettare questa distinzione. Quando `requested_outputs` è esplicitamente vuoto:

- il polling dello stato continua normalmente;
- non vengono inventati identificatori come `result`;
- il parser restituisce zero risultati;
- le azioni di salvataggio non creano `ProcessExecutionResult`;
- la pagina del job usa il normale stato vuoto dei risultati.

Questo comportamento vale sia per risposte sincrone sia per job remoti asincroni.

## Error Handling E Compatibilità

La compatibilità viene mantenuta in questo modo:

- una request che omette `outputs` continua a richiedere tutti gli output;
- gli output con un solo media type continuano a usare il transmission mode automatico corrente;
- gli output senza media type continuano a essere richiesti senza `format`;
- le esecuzioni storiche con `requested_outputs = null` mantengono l'attuale interpretazione dei risultati;
- non cambia la strategia di polling, notifica, preview o pubblicazione dei risultati esistenti.

Se il server remoto rifiuta una selezione vuota, l'esecuzione segue il normale flusso di errore remoto e mostra il messaggio ricevuto. Il form locale non blocca preventivamente `outputs: {}`.

## Test

### Backend Unitari

Aggiungere o aggiornare test Pest per coprire:

- formato con `contentMediaType` diretto;
- opzioni ordinate provenienti da `oneOf` e `anyOf`;
- fusione dei qualificatori in `allOf`;
- etichetta da `title` e fallback al media type;
- deduplicazione per tupla canonica;
- schema senza formati;
- normalizzazione reale del fixture `process-solwcad`;
- default sul primo formato;
- selezione di un sottoinsieme di output;
- selezione esplicitamente vuota;
- compatibilità della selezione assente;
- rifiuto di identificatori e formati sconosciuti;
- mantenimento del calcolo automatico di `transmissionMode`;
- parser e salvataggio con zero risultati quando `requested_outputs` è vuoto.

### Backend Feature

I test del controller devono dimostrare che:

- il form espone le opzioni normalizzate;
- il submit salva il payload canonico in `requested_outputs`;
- il job di submission riceve soltanto gli output selezionati;
- il payload HTTP contiene un oggetto vuoto `{}` quando tutti gli output sono deselezionati;
- un errore di selezione non crea né dispatcha un job;
- una request senza `outputs` continua a richiederli tutti;
- un job senza output può terminare con successo senza risultati persistiti.

### Frontend

Aggiungere test per la logica pura dello stato output e, seguendo gli strumenti già presenti nel progetto, per il rendering del componente:

- tutti gli output selezionati inizialmente;
- primo formato selezionato inizialmente;
- cambio del formato;
- formato singolo non modificabile;
- output senza formato;
- deselezione e riselezione con mantenimento della scelta;
- filtraggio degli output non selezionati durante il submit;
- submit valido con mappa vuota;
- messaggio informativo quando la selezione è vuota.

## Non Obiettivi

Questa iterazione non introduce:

- selezione delle proprietà interne di un output oggetto;
- scelta manuale di `transmissionMode`;
- modifica delle modalità sync/async;
- un renderer JSON Schema generico nel frontend;
- configurazioni specifiche per singolo processo;
- modifica del formato di preview o download dei risultati;
- migrazioni o nuove tabelle;
- validazione preventiva del comportamento remoto di `outputs: {}`.

## Criteri Di Accettazione

- La pagina di ogni processo mostra tutti gli output top-level selezionabili.
- Tutti gli output sono selezionati inizialmente.
- L'utente può selezionare uno, più o nessun output.
- Gli output con più formati mostrano un selettore ordinato secondo la descrizione del processo.
- Il primo formato è quello predefinito.
- Gli output con un solo formato inviano comunque `format.mediaType`.
- `solwcad_out` permette di scegliere tra `application/json` e `text/plain`.
- Il backend accetta soltanto output e formati presenti nella descrizione fidata in cache.
- Il client non può scegliere o sovrascrivere `transmissionMode`.
- Il payload remoto contiene esclusivamente gli output selezionati.
- Una selezione vuota viene inviata esattamente come `"outputs": {}`.
- Una selezione vuota non blocca il form e non genera risultati fittizi.
- Le request che omettono `outputs` continuano a richiedere tutti gli output.
- I test automatizzati coprono normalizzazione, UI, validazione, payload remoto e assenza di risultati.
