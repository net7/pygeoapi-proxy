# Correzioni Dell'Interfaccia E Della Validazione Dei Processi OGC

## Obiettivo

Correggere i problemi rilevati dal cliente nei form dinamici e nella visualizzazione degli output dei processi OGC, mantenendo il comportamento generico rispetto agli schemi pubblicati dai servizi.

La modifica deve garantire che:

- le alternative `oneOf` siano presentate senza indici tecnici e con titolo e descrizione nell'ordine corretto;
- la variante scelta dall'utente sia quella effettivamente validata dal backend;
- gli errori server siano associati al controllo corretto e portino il focus su quel controllo;
- le enumerazioni obbligatorie con un solo valore siano inizializzate automaticamente;
- le celle obbligatorie delle tabelle non possano essere inviate vuote o come `null`;
- titoli e descrizioni degli output derivino dal livello logico corretto dello schema;
- le descrizioni non vuote siano sempre visibili anche quando coincidono con il titolo;
- il warning diagnostico sullo stile SLD sia nascosto per impostazione predefinita e attivabile da configurazione.

Non sono necessarie migrazioni, nuove dipendenze o modifiche specifiche per `solwcad` e `pybox`.

## Contesto E Cause Confermate

### Alternative `oneOf`

Il selettore delle alternative mostra attualmente anche l'indice della variante. L'indice e un dettaglio interno utile a identificare lo schema, ma non e un'etichetta adatta all'interfaccia.

Nel campo oggetto la descrizione della variante selezionata viene inoltre mostrata prima del selettore. L'ordine atteso e:

1. selettore con il titolo della variante;
2. descrizione della variante selezionata;
3. proprieta dell'oggetto selezionato.

La selezione della variante viene mantenuta nel frontend, ma il metadato che la identifica viene rimosso prima della validazione backend. `ProcessInputValidator` tenta quindi di dedurre la variante dal valore incompleto e puo ricadere sulla prima alternativa. Nel caso del secondo oggetto di `swinput.data`, l'assenza di `iopen` puo cosi produrre errori riferiti a campi della prima variante, come `ndat2` o `kl`.

### Validazione E Focus

La validazione HTML nativa porta gia il focus al primo campo numerico non valido. Gli errori restituiti dal backend, invece, alimentano soltanto l'avviso globale del form e non vengono collegati ai controlli annidati. L'utente riceve quindi il messaggio generico senza essere portato alla causa.

### Enumerazioni Con Un Solo Valore

Esiste gia una normalizzazione dei valori statici, ma il cambio di variante e la divergenza tra variante selezionata e variante validata possono lasciare un'enumerazione obbligatoria a valore singolo in uno stato vuoto o farla giudicare rispetto allo schema sbagliato.

### Tabelle E Pattern

Il form tabellare crea una riga iniziale con celle vuote. Le stringhe vuote vengono convertite in `null` dalla pipeline Laravel e la validazione scalare attuale salta i valori vuoti. Di conseguenza una riga formalmente presente puo essere inoltrata con colonne `null` anche quando le posizioni sono obbligatorie.

Il solo attributo HTML `pattern` non risolve il problema: il vincolo non viene applicato a un campo vuoto e i browser moderni compilano il pattern con semantica JavaScript `v`. Una classe come `[+-]`, presente anche nella nuova espressione proposta dal cliente, non e valida con tale semantica; la forma compatibile e `[+\-]` nel pattern effettivo, rappresentata con l'escaping appropriato nel JSON.

### Metadati Degli Output

Gli output oggetto di `pybox` vengono salvati come risultati componenti, per esempio `dem.geotiff` e `dem.sld`. Il raggruppamento visuale usa attualmente la descrizione del componente `geotiff` anziche quella dell'output logico `dem`. Per questo il titolo e corretto ma la descrizione non corrisponde a quella dichiarata dal servizio per `dem`.

Per i risultati non raggruppati, `ResultPreview` non rende sempre la descrizione. Questo rende invisibile il testo di `deposit_thickness`, `spatial_evolution` e `input_data`, in particolare quando titolo e descrizione coincidono.

### Warning SLD

Il messaggio relativo a una hillshade senza ulteriori trasformazioni non proviene da `pybox`. E una diagnostica generata dall'applicazione tramite l'analisi dello SLD. La diagnostica puo essere utile agli amministratori, ma non deve essere mostrata normalmente agli utenti.

## Decisioni Funzionali

### Etichette E Ordine Delle Alternative

Il selettore `oneOf` non mostra mai l'indice della variante.

L'etichetta usa, in ordine:

1. il `title` non vuoto della variante;
2. una descrizione breve non vuota, se utilizzabile come etichetta;
3. un'etichetta localizzata generica, senza esporre l'indice.

L'indice resta nello stato interno e nella request come identita tecnica della variante. Le opzioni di un'enumerazione mostrano il titolo associato al valore quando disponibile, altrimenti il valore stesso una sola volta. Non devono comparire etichette duplicate come `1: 1`.

Per un oggetto con alternative, il rendering segue questo ordine:

1. selettore della variante;
2. descrizione della variante selezionata;
3. campi della variante.

Per un oggetto privo di alternative rimangono titolo, descrizione e campi senza selettore.

### Identita Della Variante E Payload Remoto

Per ogni input `oneOf`, il client conserva fino al backend una struttura concettuale:

```json
{
  "variant": "1",
  "value": {
    "ndat1": 1,
    "kl": 1
  }
}
```

`variant` e un dato non fidato e viene validato come identificatore di una variante esistente nello schema normalizzato del processo. Gli identificatori correnti sono stringhe che rappresentano la posizione della variante, ma non vengono mostrati all'utente. `ProcessInputValidator` valida esclusivamente `value` contro la variante esplicitamente scelta. Non tenta di indovinare un'altra variante quando il valore e incompleto e non ricade silenziosamente sulla prima alternativa.

Dopo la validazione, il backend costruisce il payload remoto canonico eliminando soltanto il metadato applicativo `variant` e conservando il wrapper OGC standard `value`:

```json
{
  "swinput.data": {
    "value": {
      "ndat1": 1,
      "kl": 1
    }
  }
}
```

Il campo `variant` non viene persistito come input OGC e non viene mai inoltrato al servizio remoto. Se l'indice non esiste piu nello schema in cache, la request viene rifiutata come input non valido e nessuna esecuzione viene creata o inviata.

### Errori Inline E Gestione Del Focus

Gli errori backend mantengono percorsi coerenti con lo stato del form, per esempio:

```text
inputs.swinput.data.value.iopen
```

Ogni controllo registra il proprio percorso completo e legge sia gli errori di quel percorso sia gli eventuali errori del contenitore rilevanti. Un errore associato al campo produce:

- messaggio inline vicino al controllo;
- stato visuale non valido;
- `aria-invalid="true"`;
- associazione accessibile tra controllo e messaggio.

Dopo una risposta di validazione fallita, il form individua il primo percorso errato secondo l'ordine visuale, espande o seleziona la variante necessaria se gia identificata dalla request, esegue lo scroll e porta il focus al controllo. L'avviso globale resta come riepilogo, ma non sostituisce l'errore inline.

Se l'errore riguarda una struttura senza un controllo focussabile, il focus va al contenitore della sezione con un messaggio inline. La validazione HTML nativa continua a funzionare per gli errori rilevabili prima del submit.

### Enumerazioni Obbligatorie A Valore Singolo

Quando un campo obbligatorio della variante attiva espone una sola opzione non vuota, il frontend assegna automaticamente quel valore:

- all'inizializzazione del form;
- quando l'utente seleziona una variante che contiene il campo;
- quando vengono caricati dati iniziali privi di quel valore.

Un valore gia presente non viene sovrascritto. Il backend applica la stessa regola di validazione semantica alla variante esplicita, cosi il valore inizializzato non viene giudicato contro un'altra alternativa.

### Celle Obbligatorie Delle Tabelle

Per uno schema tabellare basato su array posizionali, `minItems` della riga determina quante celle iniziali sono obbligatorie. Una posizione obbligatoria non accetta:

- stringa vuota;
- `null`;
- posizione assente.

Il frontend marca queste celle come richieste e impedisce il submit con la validazione nativa quando possibile. Il backend ripete il controllo prima della validazione del tipo e del pattern, perche resta la sorgente autorevole anche per client non browser.

Una riga completamente vuota creata automaticamente dall'interfaccia non viene considerata un valore valido se lo schema richiede almeno una riga: viene mantenuta per consentire l'inserimento, ma il submit segnala la prima cella obbligatoria. Le righe aggiuntive totalmente vuote possono essere ignorate soltanto quando lo schema consente l'assenza di quella riga; non possono essere trasformate in righe di `null` inoltrate al processo.

Il pattern pubblicato dal servizio continua a essere usato dalla validazione backend. Nel browser l'attributo `pattern` viene applicato soltanto quando l'espressione e compilabile con la semantica HTML corrente. Non viene introdotto un convertitore generale tra dialetti regex. Se il pattern non e compatibile, il vincolo nativo viene omesso e resta attiva la validazione backend con errore inline e focus.

### Titoli E Descrizioni Degli Output Logici

`process_executions.process_outputs`, gia persistito, resta la sorgente autorevole dei metadati dichiarati dal processo. Non viene modificato il modello dati dei risultati.

Il backend prepara per la pagina una mappa di metadati indicizzata per identificatore logico dell'output:

```json
{
  "dem": {
    "title": "Primary DEM",
    "description": "The local DSM (GeoTIFF) used for the simulation."
  }
}
```

Il raggruppamento frontend di `dem.geotiff` e `dem.sld` usa il prefisso `dem` per recuperare titolo e descrizione dalla mappa. I metadati dei singoli componenti restano disponibili sui rispettivi risultati e download, ma non sostituiscono la descrizione del gruppo.

La stessa regola vale per `invasion_map` e per ogni altro output oggetto raggruppato. In assenza di metadati logici si mantiene il fallback attuale derivato dai risultati, cosi le esecuzioni storiche restano visualizzabili.

`ResultPreview` mostra sempre una `description` non vuota per i risultati non raggruppati. La descrizione viene mostrata anche quando il testo coincide con il `title`: titolo e descrizione rappresentano campi distinti del contratto del servizio e non vengono deduplicati dalla UI.

### Configurazione Del Warning SLD

La diagnostica SLD viene controllata da una configurazione applicativa con default disabilitato:

```dotenv
OGC_PROCESSES_SHOW_MAP_LAYER_WARNINGS=false
```

La variabile viene dichiarata in `.env.example` e letta da `config/services.php` come booleano. Il nome interno previsto e:

```text
services.ogc_processes.show_map_layer_warnings
```

Comportamento:

- `false`, valore predefinito: l'analisi diagnostica dello stile non viene eseguita e il warning non viene renderizzato;
- `true`: viene conservato il comportamento diagnostico attuale, visibile soltanto agli amministratori.

Laravel risolve il valore dalla configurazione nel controller della pagina. `SldVisualizationInspector` viene invocato esclusivamente quando il flag e attivo e l'utente e amministratore; negli altri casi il risultato espone `warning: null`. Il frontend riceve soltanto l'eventuale codice diagnostico, senza conoscere la variabile d'ambiente.

La configurazione non influenza l'applicazione dello SLD, la mappa, i download o i normali errori di caricamento. Controlla esclusivamente il warning informativo sulla resa dello stile.

## Architettura E Flusso Dei Dati

### Normalizzazione Dello Schema

La normalizzazione degli input continua a produrre le alternative ordinate, includendo per ciascuna variante titolo, descrizione, schema dei campi e identita tecnica. La normalizzazione delle opzioni enum deve fornire un'etichetta separata dal valore, evitando che il componente ricostruisca stringhe duplicate.

Per gli output, il presenter della pagina ricava da `process_outputs` la mappa dei metadati logici necessaria al raggruppamento. La logica non richiede nuove colonne e non modifica i record `ProcessExecutionResult`.

### Stato E Submit Del Form

1. Il frontend inizializza i campi e i valori statici della variante attiva.
2. La selezione `oneOf` aggiorna insieme `variant` e `value`.
3. Il submit conserva il wrapper della variante nella request Laravel.
4. La validazione strutturale controlla wrapper e indice.
5. `ProcessInputValidator` valida `value` contro la sola variante scelta.
6. In caso di errore, i percorsi tornano al controllo corrispondente; nessun job viene creato.
7. In caso di successo, il backend rimuove i metadati UI, costruisce gli input OGC canonici e prosegue con il flusso di esecuzione esistente.

La ricostruzione del payload avviene sul backend usando la descrizione fidata in cache. Il client non puo usare `variant` per far validare il valore contro una variante diversa da quella selezionata.

### Rendering Dei Risultati

1. Il backend espone risultati atomici e metadati degli output logici.
2. Il frontend raggruppa le coppie GeoTIFF/SLD come avviene oggi.
3. La card raggruppata usa titolo e descrizione del livello logico.
4. Le card non raggruppate mostrano titolo e descrizione del risultato.
5. L'eventuale diagnostica SLD viene calcolata e mostrata solo se la configurazione e attiva e l'utente e amministratore.

## Gestione Degli Errori E Compatibilita

- Una request `oneOf` priva di `variant`, proveniente da un vecchio client, puo usare la deduzione esistente soltanto se una e una sola variante corrisponde in modo completo. Casi ambigui o incompleti vengono rifiutati invece di ricadere sulla prima alternativa.
- Un indice fuori intervallo o non intero produce un errore sul selettore della variante.
- Gli errori di campi annidati mantengono percorsi stabili fino al frontend.
- La normalizzazione Laravel di stringhe vuote in `null` non rende valide le celle obbligatorie.
- Un pattern non compatibile con HTML non rompe il controllo: viene validato dal backend.
- Le esecuzioni storiche senza metadati logici completi usano il fallback di presentazione corrente.
- Gli errori reali di caricamento mappa o applicazione dello stile restano visibili; viene configurata soltanto la diagnostica informativa sulla hillshade.

## Test

### Backend Unitari

Aggiungere o aggiornare test Pest per dimostrare che:

- la variante esplicita viene validata senza fallback alla prima alternativa;
- il secondo oggetto di `swinput.data` con `ndat1` e `kl` ma senza `iopen` produce un errore soltanto per `iopen`;
- un indice inesistente, non intero o ambiguo viene rifiutato;
- la compatibilita con request senza `variant` accetta soltanto una corrispondenza completa e univoca;
- il wrapper `variant`/`value` viene rimosso dal payload OGC finale;
- i valori enum a opzione singola sono validati contro la variante scelta;
- celle obbligatorie vuote, `null` o mancanti vengono rifiutate;
- righe vuote non vengono trasformate in array di `null` validi;
- i pattern numerici validi continuano a essere accettati e quelli non validi vengono rifiutati;
- i metadati logici degli output vengono estratti da `process_outputs`, con fallback per dati storici incompleti.

### Backend Feature

I test del submit devono verificare che:

- un errore annidato venga restituito con il percorso della variante e del campo corretto;
- una validazione fallita non crei `ProcessExecution` e non dispatchi il job remoto;
- il payload passato al client OGC non contenga `variant` o `value` applicativi;
- una tabella con la riga iniziale vuota non venga sottomessa;
- la pagina del job esponga titolo e descrizione logici per `dem` e `invasion_map`.

### Frontend

Aggiungere test per coprire:

- opzioni `oneOf` senza indice visibile;
- selettore prima della descrizione della variante;
- etichette enum senza duplicazione del valore;
- inizializzazione di `kl` all'unico valore disponibile quando si seleziona la seconda variante;
- conservazione di un valore gia impostato;
- associazione degli errori server ai controlli annidati;
- scroll e focus sul primo campo errato secondo l'ordine visuale;
- prima cella obbligatoria della tabella marcata come richiesta;
- descrizione logica mostrata nelle card mappa di `dem` e `invasion_map`;
- descrizione sempre mostrata in `ResultPreview`, anche se uguale al titolo;
- warning SLD assente con configurazione disabilitata;
- warning SLD visibile soltanto a un amministratore con configurazione abilitata.

### Verifica Finale

Eseguire almeno:

- i test Pest focalizzati su validazione, submit e presentazione degli output;
- i test frontend focalizzati sui componenti modificati;
- la suite OGC correlata individuata dal grafo delle dipendenze;
- typecheck TypeScript;
- lint frontend;
- build Vite;
- `vendor/bin/pint --dirty --format agent` dopo ogni modifica PHP.

## Non Obiettivi

Questa iterazione non introduce:

- modifiche agli schemi o ai servizi remoti di Francesco;
- indici delle alternative attivabili da configurazione;
- un traduttore generale tra espressioni regolari PCRE e JavaScript;
- nuove regole di resa SLD o modifiche alla mappa;
- nuovi livelli di autorizzazione per le diagnostiche;
- modifiche al modello dati dei risultati;
- migrazioni, nuove tabelle o nuove dipendenze;
- refactoring non necessario del renderer JSON Schema o del flusso dei job.

## Criteri Di Accettazione

- I dropdown delle alternative non mostrano indici tecnici.
- Per `swinput.data`, il selettore precede la descrizione della variante selezionata.
- Se e selezionata la seconda variante e manca `iopen`, l'interfaccia mostra l'errore su `iopen`, scorre fino al campo e gli assegna il focus.
- `kl` viene inizializzato all'unico valore disponibile senza intervento dell'utente.
- `sw.data` non puo essere eseguito con celle obbligatorie vuote o inviate come `null`.
- Il payload remoto non contiene metadati applicativi della variante.
- `dem` mostra la descrizione dichiarata per `dem`, non quella di `dem.geotiff`.
- `invasion_map` applica la stessa regola di metadati logici.
- `deposit_thickness`, `spatial_evolution` e `input_data` mostrano la descrizione anche quando coincide con il titolo.
- Il warning hillshade/SLD non appare con la configurazione predefinita.
- Impostando `OGC_PROCESSES_SHOW_MAP_LAYER_WARNINGS=true`, il warning torna disponibile soltanto agli amministratori.
- Una validazione fallita non crea ne invia un'esecuzione.
- Tutti i test focalizzati, typecheck, lint e build terminano con successo.
