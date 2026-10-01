# Assistenza via email e referente tecnico

Data: 2026-10-01.

Stato: spec completa proposta per la revisione dell'utente, prima del piano di implementazione.

## Obiettivo

Consentire agli utenti dell'applicazione di inviare una richiesta di assistenza al referente tecnico attraverso un form con oggetto, descrizione, email di contatto e allegati facoltativi. Gli admin gestiscono il referente dalla lista di tutti gli utenti. La gestione della richiesta e delle risposte avviene tramite email.

Il risultato atteso è un flusso semplice da compilare, con validazioni Laravel e Precognition, accesso anonimo disabilitato per impostazione predefinita e istruzioni aggiornate nell'help utente e admin.

## Requisiti concordati

- Oggetto, descrizione ed email di contatto sono obbligatori.
- Per un utente autenticato, l'email è precompilata con quella dell'account e rimane modificabile.
- Gli allegati sono facoltativi: massimo **3 file**, ciascuno fino a **5 MB**.
- Le regole di validazione risiedono nel backend Laravel; Precognition offre la validazione durante la compilazione.
- La funzionalità serve esclusivamente a inviare email. Non introduce uno storico delle segnalazioni, ticket o una pagina di gestione delle richieste.
- Il referente tecnico è un incarico aggiuntivo assegnabile a un admin; può esserci al massimo un referente.
- Un admin può assegnare l'incarico dalla lista di tutti gli utenti. La nomina di un altro utente sostituisce automaticamente il referente precedente.
- L'accesso senza autenticazione è controllato da `SUPPORT_ALLOW_GUESTS`, booleano con default `false`.
- L'help descrive il nuovo flusso sia per gli utenti sia per gli admin, nelle lingue italiana e inglese.

## Scelte di progetto proposte per questa revisione

Queste scelte completano i requisiti, senza attribuirle a richieste esplicite dell'utente:

- Oggetto fino a 200 caratteri, descrizione fino a 10.000 caratteri, email fino a 255 caratteri.
- Formati iniziali: PNG, JPG/JPEG, WebP, PDF, TXT, LOG, CSV e JSON. Gli archivi ZIP non sono inclusi in questa versione; la domanda sul loro supporto non ha ricevuto una conferma.
- Invio asincrono, massimo tre tentativi automatici e disponibilità temporanea dei dati per sette giorni per consentire il recupero degli invii falliti.
- Al massimo cinque tentativi di invio all'ora per utente autenticato o, per un ospite, per indirizzo IP. Le validazioni Precognition hanno un limite separato di sessanta richieste al minuto.
- Prima di disattivare, eliminare o rimuovere il ruolo admin al referente corrente, occorre trasferire l'incarico a un altro admin attivo.
- Il destinatario viene risolto dal worker prima di ciascun tentativo: le email ancora da spedire seguono il referente corrente.

L'approvazione della spec comprende anche queste scelte. Eventuali correzioni vanno recepite qui prima di preparare il piano.

## Contesto del repository

L'applicazione in `proxy/` usa Laravel 13, Inertia React 3, React 19, Wayfinder, componenti shadcn/ui, Pest e test frontend con Bun. Le dipendenze PHP installate sono state verificate durante l'analisi: Laravel 13.34.0 e Inertia Laravel 3.5.1.

I punti di integrazione esistenti sono:

- `app/Enums/UserRole.php`: ruoli esclusivi `user` e `admin`.
- `app/Models/User.php`: controlli `isAdmin()`, `isActive()` e stato di disattivazione.
- `app/Http/Controllers/Admin/UserController.php`: gestione singola e massiva degli utenti.
- `app/Http/Requests/Admin/UpdateUserRequest.php`: autorizzazione admin e protezioni contro la rimozione del proprio ruolo.
- `app/Actions/Admin/DeleteUser.php` e `app/Http/Controllers/Settings/ProfileController.php`: eliminazione amministrativa e cancellazione del proprio account.
- `routes/web.php`: rotte admin e integrazione già presente con `HandlePrecognitiveRequests`.
- `resources/js/pages/admin/users/index.tsx`: elenco utenti e form con validazione Precognition integrata in Inertia.
- `resources/js/components/user-guide.tsx`: capitoli comuni e capitoli riservati agli admin.
- `resources/js/lib/i18n/messages.ts`: testi italiani e inglesi.
- `config/filesystems.php`: disco locale con radice privata `storage/app/private`.
- `config/horizon.php`: worker della coda `default`, tentativi predefiniti pari a uno e conservazione dei job falliti in Horizon per sette giorni.
- `config/queue.php`: configurazione dei job falliti separata dai metadati Horizon.
- `routes/console.php`: punto di registrazione della pulizia pianificata.

La configurazione Compose condivisa usa Redis per le code. Web, Horizon e scheduler condividono lo storage nei servizi di staging. La configurazione di esempio del mailer è `log`: l'effettivo invio richiede un trasporto email configurato. Le modifiche e le istruzioni di deployment del repository riguardano esclusivamente **develop e staging**.

## Architettura scelta e alternative

### Referente come incarico

Si mantiene `UserRole` con i valori attuali. Il referente tecnico conserva `role = admin` e i relativi permessi; l'incarico stabilisce chi riceve le email di assistenza.

Una singola assegnazione centralizzata è preferibile a un booleano su ogni utente: esprime direttamente il limite di un referente e permette di sostituirlo aggiornando un solo riferimento. Un terzo valore dell'enum attuale cambierebbe invece il significato dei controlli `isAdmin()` e non rappresenterebbe un incarico aggiuntivo.

### Solo email, con conservazione operativa temporanea

Il controller valida la richiesta, salva temporaneamente gli allegati privati e accoda un job. Il job invia l'email e rimuove gli allegati dopo l'invio riuscito.

Non si introduce un modello o una tabella `SupportRequest`. Sono persistenti soltanto la configurazione del referente e le strutture operative già necessarie alle code. Il contenuto del messaggio può permanere temporaneamente nel payload della coda e dei job falliti: questa permanenza serve all'invio e ai tentativi successivi, non costituisce uno storico consultabile dall'app.

L'alternativa con richieste salvate e archivio applicativo è stata esclusa dall'utente. L'invio sincrono legherebbe invece l'esito del form alla durata della connessione al server email; si usa la coda già presente nell'app.

## Referente tecnico

### Dati e vincoli

Si introduce una configurazione dedicata `support_settings`, con una sola riga identificata da `id = 1` e un campo nullable `technical_contact_user_id` collegato a `users`.

- La migrazione crea la riga iniziale con referente assente.
- La riga singleton non è creabile o eliminabile dalle rotte applicative.
- Il vincolo singleton deve essere imposto anche dal database, con una soluzione compatibile con MariaDB e SQLite.
- La foreign key impedisce di eliminare fisicamente l'utente mentre è ancora referente.
- La risoluzione del destinatario considera valido soltanto un admin attivo.
- Non si espone un'azione autonoma per azzerare l'incarico: dopo la prima assegnazione, la gestione ordinaria avviene per sostituzione.

### Assegnazione e concorrenza

La nomina usa una transazione e un blocco sulla riga di configurazione. Al momento dell'aggiornamento, il server verifica nuovamente che l'utente selezionato esista e sia un admin attivo.

La sostituzione modifica il riferimento in un'unica operazione. Due nomine concorrenti si serializzano e non producono due referenti. Nominare nuovamente il referente corrente non cambia lo stato.

La verifica e l'aggiornamento devono usare lo stesso coordinamento delle operazioni che cambiano ruolo, stato o esistenza del referente. Una verifica effettuata soltanto nella Form Request non è sufficiente a proteggere queste operazioni dalla concorrenza.

### Interfaccia admin

Nella lista di tutti gli utenti:

- un badge identifica il referente corrente;
- il menu dell'utente presenta «Nomina referente tecnico» per gli admin attivi;
- la schermata indica il referente corrente anche quando filtri e paginazione non ne mostrano la riga;
- l'azione rende esplicito che la nomina sostituirà il referente attuale;
- il messaggio di esito conferma l'assegnazione e la lista si aggiorna;
- se manca un referente, un avviso spiega che l'assistenza non può ancora ricevere richieste.

Il server autorizza l'operazione soltanto agli admin attivi. L'identificativo ricevuto dal browser serve alla nomina; non può essere usato per scegliere il destinatario di una richiesta di assistenza.

### Disattivazione, cambio ruolo e cancellazione

Il referente non può essere disattivato, trasformato in utente ordinario o eliminato finché non viene nominato un sostituto. Le protezioni esistenti sugli account admin rimangono applicabili.

La regola copre modifica singola, disattivazione singola e massiva, eliminazione definitiva e cancellazione del proprio profilo. Il controllo deve avvenire prima di cancellare job, file, sessioni o altri dati dell'account. Un'operazione massiva che comprende il referente viene respinta interamente, con un errore che spiega come trasferire l'incarico.

## Accesso e configurazione

```dotenv
SUPPORT_ALLOW_GUESTS=false
```

Il valore è letto in `config/support.php` ed esposto al resto dell'applicazione come booleano. Controller, middleware e frontend non leggono direttamente l'ambiente. Il comportamento deve rimanere corretto con la configurazione Laravel in cache; un valore assente o non valido non abilita l'accesso anonimo.

| Visitatore | Flag `false` | Flag `true` |
| --- | --- | --- |
| Utente autenticato e attivo | Form disponibile | Form disponibile |
| Admin autenticato e attivo | Form disponibile | Form disponibile |
| Ospite | Accesso riservato agli utenti autenticati | Form disponibile |
| Sessione di account disattivato | Accesso negato secondo il comportamento esistente | Accesso negato secondo il comportamento esistente |

Il flag controlla GET del form, POST di invio e richieste Precognition. Con accesso anonimo disabilitato, la pagina rimanda l'ospite al login; una richiesta diretta di invio o validazione non può produrre email, job o allegati persistiti.

Quando il flag è attivo, un link «Assistenza» compare anche nelle schermate di accesso. Gli utenti autenticati trovano il link nella navigazione dell'app. L'help riflette l'impostazione corrente. Nessun controllo admin consente di cambiare questo flag: la scelta è effettuata tramite ambiente.

Il cambio del flag disciplina le nuove richieste; non annulla quelle già accettate e presenti in coda.

## Form e validazione

| Campo | Regole |
| --- | --- |
| Oggetto | Stringa obbligatoria, ripulita dagli spazi esterni, massimo 200 caratteri; rifiuto dei ritorni a capo per l'uso nell'oggetto email |
| Descrizione | Testo semplice obbligatorio, ripulito dagli spazi esterni, massimo 10.000 caratteri |
| Email di contatto | Stringa obbligatoria, normalizzata come nei form esistenti, email valida, massimo 255 caratteri |
| Allegati | Array facoltativo, massimo 3 elementi; ogni elemento deve essere un file valido del tipo consentito e rispettare il limite individuale |

Il limite visualizzato come «5 MB» corrisponde a **5 × 1024 × 1024 byte**, ossia 5120 KiB. È applicato a ciascun file; tre allegati validi possono occupare complessivamente 15 MiB. Il numero massimo e la dimensione sono comunicati prima della selezione.

L'email viene inizializzata una sola volta con quella dell'account autenticato; per l'ospite è vuota. Le modifiche dell'utente non vengono sovrascritte durante la validazione o un nuovo rendering. L'indirizzo può differire da quello dell'account e non deve essere unico tra gli utenti registrati. Modificarlo non aggiorna il profilo né verifica il possesso dell'indirizzo.

Quando disponibile, l'identità autenticata è ricavata dal server e mantenuta distinta dall'indirizzo di risposta inserito nel form.

### Allegati

L'interfaccia mostra nome, dimensione e comando di rimozione per ogni file. Offre un riscontro immediato su quantità e dimensione, mentre il server esegue sempre i controlli definitivi.

Le estensioni consentite sono `png`, `jpg`, `jpeg`, `webp`, `pdf`, `txt`, `log`, `csv` e `json`. Il controllo server combina estensione e tipo effettivo del contenuto. La compatibilità dei MIME dei file testuali deve comprendere i normali casi di TXT, LOG, CSV e JSON, senza richiedere che un documento allegato per segnalare un problema sia semanticamente corretto.

I file ricevono nomi generati dal server in una directory privata dedicata. I nomi originali sono utilizzabili come etichette degli allegati dopo normalizzazione; non determinano percorsi di storage. Non vengono generati URL pubblici né endpoint di download per questi file.

### Precognition

Una Form Request dedicata contiene le regole Laravel ed è usata sia per la validazione anticipata sia per l'invio finale. Si segue il pattern Inertia/Precognition già presente nei form admin.

- La validazione live riguarda oggetto, descrizione ed email, con errori localizzati accanto ai campi.
- Gli allegati non sono caricati nelle validazioni intermedie; la loro validazione completa avviene all'invio.
- Le richieste Precognition non salvano file, non accodano job e non inviano email.
- L'invio finale applica nuovamente tutte le regole, anche se il browser ha già mostrato i campi come validi.
- Autorizzazione, disponibilità del servizio e limiti di frequenza sono imposti dal server.

Durante l'invio il pulsante è disabilitato e viene indicato il progresso del caricamento. Un errore mantiene il testo e l'email inseriti. Dopo l'accettazione vengono svuotati oggetto, descrizione e allegati, mantenendo l'email di contatto.

## Frequenza degli invii

Si definiscono due limiti distinti, usando il rate limiter Laravel e lo storage condiviso già configurato:

- invio finale: cinque tentativi all'ora, identificati tramite ID dell'utente autenticato oppure IP per un ospite;
- validazione Precognition: sessanta richieste al minuto per la stessa identità.

I tentativi di invio non validi consumano il limite di invio. Le richieste Precognition consumano soltanto quello di validazione. Una richiesta che si presenta come precognitiva non può raggiungere l'effetto di invio attraverso un percorso che eluda il primo limite.

Il superamento del limite produce un errore comprensibile, localizzato, senza azzerare il form. Il controllo CSRF delle rotte web si applica anche al form anonimo. Questa versione non introduce servizi CAPTCHA o dipendenze esterne.

## Invio email e dati temporanei

### Accettazione

1. Il server verifica accesso, frequenza, campi, allegati e presenza di un referente valido.
2. Salva gli allegati in storage privato, in una directory casuale dedicata all'invio.
3. Accoda un unico job contenente i dati necessari, i riferimenti ai file e una scadenza operativa.
4. Restituisce la conferma soltanto dopo che l'accodamento è riuscito.

Un errore durante il salvataggio o un fallimento certo dell'accodamento rimuove i file già creati e restituisce un errore. Un eventuale esito ambiguo della connessione alla coda non deve essere presentato come invio riuscito; il cleanup periodico recupera i file rimasti orfani.

Il messaggio di successo è «Richiesta acquisita. Le risposte saranno inviate all'indirizzo indicato». La conferma indica che l'app ha accettato l'invio; non dichiara che l'email sia già arrivata al referente.

### Job e destinatario

Un job dedicato `SendSupportEmail` usa la connessione alle code già configurata e una coda identificabile `support-mail`, consumata dai worker. Il suo payload è cifrato mediante il supporto Laravel per i job cifrati. Oggetto, descrizione ed email di contatto non devono essere usati come tag o metadati in chiaro di monitoraggio.

Prima di ogni tentativo, il worker verifica scadenza, presenza degli allegati e referente corrente. Il destinatario è sempre un admin attivo risolto dal server.

La sostituzione del referente influenza le richieste ancora da inviare e i tentativi successivi. Un'email già affidata al trasporto non può essere richiamata: una sostituzione avvenuta mentre quell'invio è in corso si applica agli invii successivi.

Il job prevede tre tentativi automatici, con attese di 60 e 300 secondi dopo i primi due fallimenti. I tentativi sono definiti esplicitamente per questo job, perché Horizon oggi ha un default pari a uno. Il timeout del trasporto deve essere inferiore a quello del job; quello del job deve essere inferiore al timeout Horizon, a sua volta inferiore al `retry_after` della connessione. Il piano deve mantenere queste relazioni anche nel worker locale, evitando l'esecuzione simultanea dello stesso tentativo.

Il job esegue direttamente il trasporto del messaggio nel worker; non accoda a sua volta una seconda email indipendente che renderebbe prematura la cancellazione dei file.

### Contenuto del messaggio

- `To`: email del referente risolto dal server.
- `From`: indirizzo e nome configurati per l'applicazione.
- `Reply-To`: email di contatto validata nel form.
- Oggetto: prefisso riconoscibile dell'assistenza seguito dall'oggetto inserito.
- Corpo: descrizione, email di contatto, data della richiesta e, se presente, identità dell'account autenticato distinta dal contatto dichiarato.
- Allegati: i file validati, con nomi normalizzati e tipi appropriati.

Il testo dell'utente viene rappresentato come testo, con escaping nell'eventuale versione HTML. Non si inviano copie, conferme automatiche o altre email all'indirizzo inserito nel form. Il referente risponde dalla propria casella usando il `Reply-To`.

### Durata dei dati operativi

La finestra massima di elaborazione e recupero della richiesta è di **sette giorni dall'accettazione**. Il job contiene la scadenza e rifiuta l'avvio di nuovi tentativi successivi a tale istante, anche in caso di riavvio tardivo dei worker o di retry manuale. Un tentativo già in corso può terminare entro il proprio timeout.

| Dato | Conservazione e rimozione |
| --- | --- |
| Assegnazione del referente | Configurazione applicativa persistente, aggiornata dalla nomina |
| Allegati e minimi metadati temporanei | Rimossi dopo l'invio riuscito; altrimenti fino alla scadenza operativa |
| Contenuto del job | Payload operativo cifrato, rimosso dalla coda attiva dopo l'esecuzione o eliminato alla scadenza |
| Copie nei job falliti e nel monitoraggio | Conservazione temporanea entro la medesima finestra; la pulizia riguarda soltanto i job di assistenza |
| Email ricevuta dal referente | Rimane nella casella del destinatario, fuori dalla conservazione dell'app |

Un comando pianificato ogni ora ripulisce i dati di assistenza scaduti, inclusi gli orfani. La rimozione fisica avviene alla prima esecuzione successiva alla scadenza in cui i dati non sono in uso da un worker. Di norma avviene entro un'ora dalla scadenza; un tentativo ancora attivo rinvia la rimozione alla successiva esecuzione utile. Dopo la scadenza non iniziano nuovi tentativi.

La pulizia deve coordinarsi con un worker già attivo sulla stessa richiesta e operare esclusivamente nel percorso e nella coda dell'assistenza. Deve considerare sia i job falliti Laravel sia le eventuali copie gestite da Horizon, senza modificare la conservazione dei job OGC o di altre notifiche. Anche un invio senza allegati conserva una scadenza operativa.

Se la cancellazione degli allegati fallisce dopo che il trasporto ha accettato l'email, l'errore viene registrato per la pulizia successiva e non provoca un nuovo invio SMTP. Non si promette consegna esattamente una volta: un crash tra accettazione SMTP e conferma della coda può produrre un duplicato.

## Disponibilità ed errori

| Condizione | Comportamento |
| --- | --- |
| Nessun referente configurato o referente non valido | Pagina con avviso di indisponibilità e form non compilabile; invio diretto respinto senza job o file residui |
| Referente diventato indisponibile dopo l'accodamento | Tentativo fallito e recuperabile entro i limiti; nessun destinatario alternativo scelto automaticamente |
| Nuovo referente prima di un tentativo | Il worker usa il nuovo referente valido |
| Campi o file non validi | Errori specifici sui campi; nessuna email o richiesta accodata |
| Accesso anonimo disabilitato | Login richiesto; nessun effetto di invio o validazione autorizzata per un ospite |
| Limite di frequenza raggiunto | Messaggio di attesa; form conservato |
| Storage o coda indisponibili | Errore globale comprensibile; nessuna falsa conferma di acquisizione |
| Errore temporaneo del trasporto email | Tentativi automatici previsti dal job |
| Tentativi esauriti | Fallimento operativo visibile nell'infrastruttura esistente, recuperabile entro sette giorni |
| Allegato mancante o richiesta scaduta nel worker | Fallimento esplicito; nessuna email parziale |

I log applicativi non riportano il contenuto del messaggio o i file. L'eventuale mailer `log` di sviluppo va usato soltanto con dati sintetici: per il servizio effettivo si configura il trasporto email. Gli errori rivolti agli utenti non espongono percorsi interni, credenziali o indirizzo personale del referente.

## Navigazione, help e localizzazione

La pagina di assistenza usa il layout dell'app per gli autenticati e un layout coerente con le schermate di accesso per gli ospiti ammessi. Il form è condiviso nei due casi.

La guida esistente riceve due capitoli:

1. **Richiedere assistenza**, comune a utenti e admin: apertura del form, campi da compilare, email modificabile, tre allegati da 5 MB, formati consentiti, conferma di acquisizione e risposta tramite email. Il testo sull'accesso anonimo segue il flag effettivo.
2. **Gestire il referente tecnico**, riservato agli admin: nomina dalla lista utenti, badge, sostituzione automatica, necessità di un admin attivo e trasferimento prima di disattivazione, cambio ruolo o cancellazione.

Con questi capitoli la guida passa da quattro a cinque sezioni per gli utenti e da nove a undici per gli admin. I capitoli admin rimangono esclusi dalla guida degli utenti ordinari.

Testi del form, errori, messaggi di esito, azioni admin e help sono disponibili in italiano e inglese. L'help spiega il comportamento osservabile, senza presentare dettagli su code, storage o variabili tecniche come azioni che l'utente deve eseguire.

## Confini dei componenti e integrazioni

La successiva implementazione deve mantenere responsabilità separate:

| Componente | Responsabilità |
| --- | --- |
| Configurazione supporto | Flag di accesso anonimo, limiti e parametri operativi coerenti tra web, worker e cleanup |
| Modello/configurazione del referente | Unica assegnazione e risoluzione del referente valido |
| Azione di assegnazione e guardie account | Transazione, autorizzazione e conservazione degli invarianti durante tutte le modifiche account |
| Middleware di accesso e rate limiter | Accesso autenticato/anonimo e limiti separati per invio e Precognition |
| Form Request | Regole, normalizzazione ed errori di validazione condivisi |
| Controller del form | Rendering, accettazione e composizione del flusso di accodamento |
| Gestione allegati temporanei | Scrittura privata, scadenza, cleanup su errori e rimozione dopo invio |
| Job e messaggio email | Destinatario corrente, tentativi, trasporto e contenuto del messaggio |
| Pulizia pianificata | Rimozione circoscritta dei dati operativi scaduti, senza interferire con gli invii in corso |
| Pagina e componenti frontend | Campi, allegati, feedback, navigazione e gestione incarico |
| Help e traduzioni | Istruzioni coerenti con ruoli, flag e comportamento implementato |

Il piano identificherà i file nuovi e le modifiche ai punti di integrazione elencati, riutilizzando struttura, componenti e convenzioni esistenti. Non servono nuovi pacchetti, un sistema di ruoli multipli o refactoring estranei alla funzionalità.

## Configurazione di develop e staging

- Documentare `SUPPORT_ALLOW_GUESTS=false` nei file di esempio pertinenti e inoltrarlo ai servizi Laravel tramite l'ambiente condiviso di Compose.
- Configurare i worker per consumare `support-mail`, conservando il consumo delle code esistenti. Il flusso locale deve funzionare anche con la connessione database prevista nell'esempio dell'app.
- Registrare la pulizia nello scheduler esistente e verificare che web, worker e scheduler vedano gli stessi allegati privati.
- Applicare la modifica dell'ambiente attraverso il normale aggiornamento della configurazione e dei processi persistenti.
- Verificare che limiti PHP e proxy consentano tre allegati da 5 MiB più il corpo multipart. I valori condivisi attuali sono più ampi; il limite della funzionalità resta applicato da Laravel.
- Verificare che il trasporto e la casella destinataria supportino il messaggio risultante: 15 MiB di file possono richiedere circa 20 MiB dopo la codifica email, oltre a corpo e intestazioni.
- Usare il mailer di test o i fake nei controlli automatici. La verifica con un servizio email reale appartiene alla validazione dell'ambiente configurato e non è implicita nella scrittura della spec.

## Criteri di accettazione e verifiche previste

### Accesso e form

- Con flag assente o `false`, un ospite non accede al form e non può inviare o validare direttamente tramite Precognition.
- Con flag `true`, un ospite può compilare e inviare il form; un account disattivato non acquisisce accesso tramite la propria sessione.
- Un utente attivo può usare il form in entrambe le configurazioni.
- L'email autenticata è precompilata, modificabile e resta distinta dall'account; l'indirizzo modificato viene usato nel `Reply-To` senza alterare il profilo.
- Oggetto, descrizione, email e file rispettano tutte le regole, compresi valori vuoti, limiti esatti, limite più uno, quarto file e file di tipo non consentito.
- Tre file validi di dimensione massima sono accettati. Nessun file è richiesto.
- Precognition non produce job, email o file persistiti. Le sue richieste non consumano la quota di invio.
- Sono coperti i due rate limiter e il tentativo di eludere l'invio tramite header Precognition.

### Referente e amministrazione

- Solo un admin attivo può nominare un altro admin attivo, oppure se stesso.
- La prima nomina abilita la disponibilità del servizio; la sostituzione trasferisce il badge e l'unico destinatario.
- Nomine concorrenti mantengono al massimo un referente; viene verificato anche il comportamento sul database usato da develop e staging.
- Una nomina concorrente con una disattivazione o un cambio ruolo non lascia come referente un utente non valido.
- Modifica ruolo, disattivazione, operazioni massive ed eliminazioni proteggono il referente prima di qualsiasi effetto distruttivo.
- Assenza del referente e invio diretto in tale stato sono gestiti senza effetti collaterali.

### Email e dati temporanei

- Il messaggio contiene destinatario risolto dal server, mittente dell'app, `Reply-To`, descrizione e allegati corretti.
- Una sostituzione durante l'attesa in coda o tra tentativi cambia il destinatario del tentativo successivo.
- I dati non compaiono in un archivio applicativo o in una nuova tabella di richieste.
- Il job è cifrato e viene consumato sia nella configurazione locale sia in quella Horizon prevista.
- Successo, errore SMTP, esaurimento tentativi, errore di storage, mancato accodamento, file mancante e scadenza hanno verifiche mirate.
- Un errore di cleanup dopo l'accettazione SMTP non causa un secondo invio.
- Il cleanup rimuove dati scaduti e orfani, comprende gli invii senza file e i payload falliti, evita i dati ancora in uso e lascia invariati i dati estranei all'assistenza.

### Help e interfaccia

- I collegamenti al form seguono autenticazione e flag.
- La guida comune documenta il form; quella admin aggiunge la gestione del referente. Gli utenti ordinari non vedono il capitolo admin.
- Le due lingue descrivono gli stessi limiti e comportamenti e riflettono la configurazione dell'accesso anonimo.
- Campi, errori, rimozione file e stato di invio sono utilizzabili da tastiera e correttamente etichettati.

Si useranno test Pest per i comportamenti backend, test frontend mirati per interfaccia/help e i controlli di formato e tipi previsti dal repository. Le verifiche di concorrenza sul database effettivo completano le prove SQLite; la spec non presume che SQLite dimostri la semantica dei blocchi di MariaDB.

## Fonti tecniche verificate

- [Laravel 13: Precognition](https://laravel.com/framework/docs/13.x/precognition), inclusi assenza di esecuzione del controller e gestione degli upload.
- [Laravel 13: validazione](https://laravel.com/framework/docs/13.x/validation), incluse le regole per i file.
- [Laravel 13: email](https://laravel.com/framework/docs/13.x/mail), inclusi `Reply-To`, allegati da storage e invio asincrono.
- [Laravel 13: code](https://github.com/laravel/docs/blob/13.x/queues.md), incluso il payload cifrato dei job; documentazione consultata tramite Context7.
- [Laravel 13: configurazione](https://github.com/laravel/docs/blob/13.x/configuration.md), per ambiente e configurazione in cache; documentazione consultata tramite Context7.

## Passaggio successivo nel flusso Superpowers

Questa spec viene sottoposta a revisione prima di scrivere il piano. Dopo l'approvazione della versione scritta si applica `superpowers:writing-plans`; il piano sarà a sua volta sottoposto a revisione e alla scelta del metodo di esecuzione prima di implementare la funzionalità.
