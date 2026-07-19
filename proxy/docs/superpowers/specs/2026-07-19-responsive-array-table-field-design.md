# Design: tabella array OGC responsive

## Contesto

`ArrayTableField` rappresenta input OGC composti da righe e molte colonne. La
vista corrente usa una tabella con scorrimento orizzontale, ma il feedback di
validazione aumenta soltanto l'altezza delle celle errate. Poiché le celle sono
allineate verticalmente al centro, gli input validi non restano allineati con
quelli invalidi. Sui viewport stretti la stessa tabella rimane inoltre difficile
da leggere e modificare.

## Obiettivi

- mantenere allineati gli input della stessa riga quando alcune celle mostrano
  errori;
- rendere leggibili e modificabili righe con molte colonne;
- presentare ogni riga come card verticale sotto il breakpoint `md`;
- conservare una tabella semantica e scrollabile da `md` in su;
- mantenere un solo controllo per cella, con percorsi di validazione e focus
  univoci;
- preservare comportamento, payload e regole di validazione esistenti.

## Approcci considerati

### Singolo albero di controlli con due presentazioni responsive

Approccio scelto. Lo stesso markup dei controlli assume una presentazione a card
su mobile e tabellare da `md` in su. Evita input duplicati e rende univoci
`required`, `data-field-path`, focus ed errori.

### Due alberi distinti, tabella e card

Permetterebbe markup specializzato per ogni viewport, ma introdurrebbe controlli
duplicati. Anche se uno dei due alberi fosse nascosto via CSS, validazione e
ricerca del primo campo errato potrebbero intercettare la copia non visibile.

### Tabella scrollabile a ogni breakpoint

Richiederebbe meno modifiche, ma manterrebbe un'esperienza mobile scomoda e non
risponderebbe all'obiettivo di presentare le righe come card.

## Design responsive

### Mobile

Sotto `md`, ogni riga viene presentata come una card verticale. La testata della
card mostra `Riga N` e il pulsante di rimozione. Ogni cella mostra l'etichetta
della colonna sopra il relativo input e il feedback di validazione subito sotto.
Il pulsante `Aggiungi riga` occupa tutta la larghezza disponibile.

La trasformazione deve essere ottenuta sullo stesso albero di controlli usato
dalla tabella desktop. Non devono esistere copie nascoste degli input.

### Tablet e desktop

Da `md` in su, le righe mantengono una rappresentazione tabellare semantica. Le
colonne dati hanno una larghezza minima coerente e la tabella usa un solo
contenitore di scorrimento orizzontale. Un breve testo di aiuto comunica che
altre colonne sono disponibili tramite scorrimento quando la struttura è larga.

La colonna delle azioni resta visibile sul lato destro durante lo scorrimento,
con uno sfondo opaco che impedisce la sovrapposizione visiva dei contenuti. Le
celle dati e la cella azioni sono allineate in alto.

## Validazione

Gli input validi e invalidi iniziano sempre dalla stessa quota. Il messaggio di
errore rimane associato alla singola cella e viene mostrato in una variante
compatta: icona, testo conciso e a capo, senza il riquadro di alert usato nei
campi meno densi. L'errore resta nel normale flusso della cella, ma non sposta
verticalmente gli input adiacenti grazie all'allineamento superiore.

Restano invariati:

- `required` e gli altri vincoli HTML;
- `data-field-path` e `data-validation-state`;
- `aria-invalid` e l'associazione tramite `aria-describedby`;
- il bordo di errore e la spunta di correzione;
- la raccolta degli errori client e server e il focus del primo campo errato.

Testi di errore e intestazioni lunghi devono andare a capo senza aumentare la
larghezza minima della colonna.

## Accessibilità e interazione

L'area scrollabile deve essere raggiungibile da tastiera e avere un nome
accessibile. Il testo di aiuto allo scorrimento deve essere associato alla
regione senza essere ripetuto per ogni riga. La tabella conserva intestazioni di
colonna comprensibili; nella resa mobile le stesse etichette sono visibili sopra
gli input.

Il pulsante di rimozione conserva il nome accessibile localizzato e il relativo
stato disabilitato quando `minItems` impedisce la rimozione. Aggiunta, modifica e
rimozione continuano a usare gli handler e il reset dei percorsi di validazione
esistenti.

## Componenti interessati

- `resources/js/components/ogc/array-table-field.tsx`: struttura responsive,
  allineamento, etichette mobile, azioni sticky e hint di scorrimento;
- `resources/js/components/ogc/field-validation-feedback.tsx`: variante compatta
  riutilizzabile del messaggio di errore;
- `resources/js/components/ui/table.tsx`: nuova API opzionale e compatibile per
  passare classi e attributi accessibili al contenitore scrollabile;
- `resources/js/lib/i18n/messages.ts`: nuove chiavi italiane e inglesi per
  `Riga N` e l'istruzione di scorrimento;
- test frontend focalizzati sui componenti modificati.

Non sono previste modifiche a backend, schema normalizzato, payload, dipendenze o
regole di validazione.

## Verifica

I test automatici devono coprire:

- presenza di un solo controllo per percorso di cella;
- collegamento accessibile fra input e messaggio di errore;
- feedback compatto senza regressioni per il feedback OGC predefinito;
- etichette mobile e testata `Riga N`;
- azioni di aggiunta e rimozione e rispetto di `minItems` e `maxItems`;
- wiring esistente di stato corretto, errore e reset dei percorsi.

La verifica nel browser deve includere almeno viewport da 375, 768 e 1440 pixel
e controllare:

- card mobile senza overflow orizzontale;
- passaggio alla tabella al breakpoint `md`;
- scorrimento orizzontale e colonna azioni sticky;
- allineamento degli input con errori di lunghezze diverse;
- navigazione da tastiera e focus sul primo controllo errato.

Infine devono terminare con successo i test frontend focalizzati, il typecheck,
il lint e la build Vite.

## Criteri di accettazione

- Gli input validi e invalidi di una riga sono allineati in alto.
- Gli errori restano immediatamente riconducibili alla rispettiva cella.
- Sotto `md`, ogni riga è una card verticale con etichette esplicite.
- Da `md` in su, la tabella usa un unico scroll orizzontale e mantiene visibile
  l'azione di rimozione.
- Non esistono input duplicati per supportare le due presentazioni.
- Nessun testo lungo forza una colonna oltre la larghezza prevista.
- Aggiunta, modifica, rimozione, validazione e focus conservano il comportamento
  attuale.
- I controlli automatici e visuali definiti sopra passano.

## Non obiettivi

- Modificare la struttura dei dati o il payload OGC.
- Cambiare le regole di validazione client o server.
- Introdurre dipendenze frontend.
- Rendere configurabile il breakpoint o la larghezza delle colonne.
- Rifattorizzare altri renderer OGC non necessari a questa esperienza.
