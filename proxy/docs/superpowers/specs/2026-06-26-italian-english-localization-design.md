# Italian English Localization Design

## Obiettivo

Rendere l'interfaccia dell'app disponibile in italiano e inglese, con italiano come lingua predefinita.

Il comportamento desiderato e:

- mostrare testi italiani per default a nuovi utenti e browser senza preferenza salvata;
- aggiungere una scelta lingua sotto `Settings > Appearance`;
- permettere solo `Italiano` e `English`;
- salvare la preferenza in `localStorage`;
- sincronizzare la preferenza in un cookie per rendere l'app piu solida lato server e SSR;
- tradurre tutte le stringhe applicative visibili controllate dal frontend;
- mantenere invariati brand, sigle tecniche e dati provenienti da backend o servizi OGC.

## Contesto Tecnico

L'applicazione usa Laravel 13, Inertia React 3, React 19, Tailwind CSS 4, shadcn/ui e Wayfinder.

Oggi:

- le stringhe visibili sono hardcoded nei file React sotto `resources/js`;
- non esiste una libreria i18n installata;
- la preferenza tema e gestita con `useAppearance()`, `localStorage` e cookie `appearance`;
- `app.blade.php` imposta `<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">`;
- le date dei job usano `navigator.language` come locale browser;
- alcuni test ispezionano direttamente sorgenti TSX e cercano stringhe inglesi hardcoded.

## Decisioni

### Layer I18n Interno

Introduciamo un layer i18n interno in `resources/js/lib/i18n`.

Non aggiungiamo una dipendenza come `i18next` in questa iterazione. L'app ha due lingue, un set finito di testi UI e non richiede ancora pluralizzazione avanzata, traduzioni gestite da CMS o caricamento remoto dei dizionari.

Il layer espone:

- `Language = 'it' | 'en'`;
- `defaultLanguage = 'it'`;
- metadati lingua con label `Italiano` e `English`;
- dizionari TypeScript per italiano e inglese;
- hook `useLanguage()` per leggere e aggiornare la preferenza;
- hook `useTranslation()` per tradurre chiavi nei componenti.

I componenti non devono leggere direttamente i dizionari. Devono usare l'helper di traduzione, cosi il punto di accesso resta unico.

### Persistenza

La preferenza lingua viene salvata in:

- `localStorage.language`, sorgente client principale richiesta dal requisito;
- cookie `language`, mirror usato da Laravel per conoscere la lingua prima del boot React.

All'avvio client:

- se `localStorage.language` manca, viene impostato `it`;
- se il valore salvato non e valido, viene sostituito con `it`;
- il cookie viene sincronizzato con il valore finale;
- `document.documentElement.lang` viene aggiornato immediatamente.

Il cookie non sostituisce `localStorage`; serve a migliorare il primo render, l'attributo `lang`, e future traduzioni server-side.

### Laravel Locale

Laravel deve leggere il cookie `language` tramite un middleware dedicato `HandleLanguage`.

Il middleware:

- accetta solo `it` e `en`;
- usa `it` come fallback;
- imposta `app()->setLocale($language)`;
- condivide la lingua corrente con Blade come `$language`;
- condivide la lingua corrente con Inertia come prop `language`.

Questo permette a `app.blade.php` di produrre un `<html lang="it">` o `<html lang="en">` coerente gia sul documento iniziale.

Non salviamo la lingua sul modello `User`. Il requisito richiede `localStorage`, e la preferenza deve restare immediata sul browser anche prima del login o tra account diversi.

### Scope Traduzioni

Devono essere tradotte tutte le stringhe applicative visibili controllate dal frontend, incluse:

- auth;
- dashboard;
- processi;
- job e dettagli job;
- form dinamico OGC;
- settings;
- area admin;
- sidebar, menu utente, breadcrumbs e footer;
- toast, errori client-side, stati vuoti e placeholder.

Non devono essere tradotti:

- nomi brand e loghi;
- acronimi tecnici come OGC, JSON, CSV, API, ORCID;
- identificativi job, process id, versioni, formati e payload;
- messaggi o descrizioni restituiti da provider OGC o backend remoti;
- nomi propri di provider social come Google e ORCID.

Per le stringhe server-side gia validate da Laravel o Fortify, questa iterazione traduce la UI React che le mostra quando il testo e controllato dall'app. La localizzazione completa dei messaggi PHP puo essere aggiunta in seguito senza cambiare la scelta lingua.

## UI

La pagina `Settings > Appearance` resta la posizione della preferenza.

Sotto il controllo tema esistente viene aggiunta una sezione lingua:

- titolo: `Lingua`;
- descrizione: `Scegli la lingua dell'interfaccia`;
- controllo a due opzioni `Italiano` e `English`;
- stile coerente con `AppearanceTabs`, usando componenti e classi gia presenti;
- icona `LanguagesIcon` di `lucide-react`.

Il cambio lingua e immediato e non usa form submit.

Il flusso e:

1. l'utente seleziona `Italiano` o `English`;
2. `updateLanguage()` aggiorna lo store;
3. viene scritto `localStorage.language`;
4. viene scritto cookie `language`;
5. viene aggiornato `document.documentElement.lang`;
6. i componenti si ri-renderizzano con i testi della lingua scelta.

## Formattazione Date E Numeri

Le date frontend devono usare la lingua scelta quando disponibile.

Le utility esistenti in `resources/js/lib/jobs.ts` che accettano `Intl.LocalesArgument` devono ricevere o derivare la lingua corrente invece di dipendere solo da `navigator.language`.

Fallback:

- `it` usa locale `it-IT`;
- `en` usa locale `en-US`.

Questo rende coerenti testi e formati quando il browser ha una lingua diversa dalla preferenza scelta nell'app.

## Struttura Dizionari

I dizionari devono essere tipizzati in modo che TypeScript segnali chiavi mancanti.

Una struttura attesa e:

```ts
export const messages = {
    it: {
        settings: {
            appearance: {
                title: 'Aspetto',
            },
        },
    },
    en: {
        settings: {
            appearance: {
                title: 'Appearance',
            },
        },
    },
} satisfies Record<Language, MessageTree>;
```

L'implementazione deve privilegiare:

- chiavi stabili e descrittive;
- niente stringhe duplicate nei componenti quando una traduzione esiste;
- interpolazione semplice per valori dinamici;
- fallback sicuro a italiano se una lingua non e valida.

## Error Handling

Se il valore salvato in `localStorage` o cookie non e `it` o `en`, l'app lo ignora e torna a `it`.

Le chiavi di traduzione devono essere tipizzate in modo che una chiave mancante venga intercettata da TypeScript. A runtime, se una chiave non risolve un valore valido, l'helper restituisce la chiave stessa invece di mandare in errore l'intera UI.

Se `localStorage` non e disponibile, l'app deve continuare a funzionare con default `it` e aggiornamento React in memoria.

## Test

Ogni modifica deve essere verificata programmaticamente.

Test previsti:

- TypeScript compile check con `bunx tsc --noEmit`;
- test mirato per default lingua `it`, validazione valori e persistenza attesa del layer i18n;
- aggiornamento dei test PHP che ispezionano sorgenti TSX e oggi cercano stringhe inglesi hardcoded;
- test feature o source-inspection per verificare che `Settings > Appearance` includa il controllo lingua;
- test delle utility data/job dove il locale deve derivare dalla lingua scelta.

Per i test che controllano icone nei bottoni, il requisito deve rimanere: i bottoni testuali continuano ad avere icone con `data-icon`.

## Fuori Scope

Questa iterazione non include:

- salvataggio lingua nel database;
- libreria i18n esterna;
- traduzioni caricate da backend o CMS;
- traduzione completa dei messaggi PHP di validazione, email e notifiche;
- aggiunta di lingue oltre `it` e `en`;
- cambio automatico lingua basato sul browser quando manca una preferenza.

## Criteri Di Accettazione

- Un nuovo browser senza preferenza vede l'app in italiano.
- `Settings > Appearance` mostra la scelta lingua `Italiano` / `English`.
- Il cambio lingua aggiorna immediatamente la UI senza reload.
- La lingua scelta resta salvata in `localStorage.language`.
- Il cookie `language` viene mantenuto coerente con `localStorage.language`.
- `<html lang>` riflette `it` o `en` dopo il middleware Laravel e dopo il boot client.
- Tutte le stringhe UI controllate dal frontend sono disponibili in italiano e inglese.
- Le date principali dei job seguono la lingua scelta.
- I test mirati e la compilazione TypeScript passano.
