# Admin Users And Roles Design

## Obiettivo

Introdurre ruoli utente semplici e un'area admin per gestire utenti e consultare job.

Il comportamento desiderato e:

- aggiungere il concetto di utente `admin` e utente `user`;
- permettere agli admin attivi di vedere una lista utenti e il CRUD utenti;
- permettere agli admin attivi di vedere i job di ogni utente e una lista globale job;
- mantenere gli utenti normali limitati ai propri job;
- disattivare utenti senza cancellare storico, job, risultati, passkey o account social;
- bloccare ogni accesso agli utenti disattivati;
- creare o promuovere il primo admin tramite comando artisan.

## Contesto Tecnico

L'applicazione usa Laravel 13, PHP 8.4, Fortify, Socialite, Inertia React 3, React 19, Tailwind CSS 4, shadcn/ui, Wayfinder, Pest e `laravel-precognition-react`.

Oggi:

- `users` non ha ruoli;
- `ProcessExecutionPolicy::view()` consente solo al proprietario di vedere un job;
- `/jobs` mostra solo i job dell'utente autenticato;
- il social login riconcilia gia gli utenti tramite email verificata;
- Fortify gestisce login, reset password, passkey e viste auth Inertia;
- la sidebar e statica e mostra `Dashboard`, `Processes` e `My Jobs`.

## Decisioni

### Ruoli Semplici

Usiamo un campo stringa `role` su `users`, con valori `user` e `admin`, castato a un enum PHP `App\Enums\UserRole`.

Non introduciamo tabelle `roles`, permessi granulari o pacchetti RBAC in questa iterazione. Il requisito attuale e binario e deve restare semplice da capire, testare e mantenere.

### Disattivazione Invece Di Delete Fisico

Usiamo un campo `deactivated_at` su `users`.

Nel CRUD admin, l'azione di eliminazione sara una disattivazione:

- valorizza `deactivated_at`;
- invalida le sessioni dell'utente;
- impedisce nuovi login password, social e passkey;
- conserva job, risultati, social account, passkey e storico.

Gli admin possono riattivare utenti azzerando `deactivated_at`.

### Bootstrap Admin Da CLI

Introduciamo il comando:

```bash
php artisan users:make-admin {email}
```

Il comando deve:

- promuovere ad admin un utente esistente;
- riattivare l'utente se era disattivato;
- creare un nuovo admin attivo se l'email non esiste;
- creare il nuovo admin senza password locale;
- inviare al nuovo admin il link Fortify per impostare o resettare la password.

Il comando non usa configurazioni `.env` per promuovere automaticamente utenti.

### Autorizzazione Server-Side

L'area `/admin/*` e protetta da `auth`, `verified` e autorizzazione admin.

Un utente puo entrare nell'area admin solo se:

- e autenticato;
- e verificato secondo il comportamento esistente;
- ha `role = admin`;
- non e disattivato.

La UI puo nascondere link e controlli, ma ogni permesso deve essere imposto anche lato server.

### Anti-Lockout

Un admin non puo:

- togliere a se stesso il ruolo `admin`;
- disattivare se stesso.

Il profilo personale esistente resta il posto corretto per modificare i propri dati base quando applicabile.

## Modello Dati

### `users`

Aggiungere:

- `role`: stringa con default `user`, castata a `App\Enums\UserRole`;
- `deactivated_at`: timestamp nullable.

Il modello `User` espone helper espliciti:

- `isAdmin(): bool`;
- `isActive(): bool`;
- `isDeactivated(): bool`.

Il factory utente produce utenti attivi con ruolo `user` per default e aggiunge state dedicate per admin e disattivati.

## Auth E Social Login

### Password Login

La callback Fortify `authenticateUsing()` deve rifiutare utenti disattivati anche quando la password e corretta.

L'errore deve restare generico, senza esporre inutilmente se l'account esiste o e disattivato.

### Social Login

La riconciliazione tramite email verificata resta il comportamento desiderato.

Se un provider social restituisce un'email verificata che corrisponde a un utente esistente, il provider viene collegato allo stesso `users.id`.

Se l'utente corrispondente e disattivato, il login non viene completato e non viene creata una nuova utenza duplicata.

Gli account social gia collegati restano collegati anche se l'admin modifica l'email dell'utente. Le future riconciliazioni social usano l'email verificata corrente del provider contro l'email corrente dell'utente.

### Passkey

Un utente disattivato non deve poter completare login passkey. Se serve una personalizzazione Fortify specifica oltre al controllo comune sul modello utente, la implementiamo nel punto piu vicino al flusso Fortify/passkey esistente.

### Reset Password

La creazione utente da admin e la creazione admin da CLI inviano un link password usando il broker/Fortify esistente.

Se l'invio mail fallisce, la UI o il comando non devono riportare un successo falso.

## Area Admin

### Navigazione

La sidebar mostra una sezione admin solo per admin attivi.

Voci previste:

- `Users` verso `/admin/users`;
- `All Jobs` verso `/admin/jobs`.

Le voci esistenti restano:

- `Dashboard`;
- `Processes`;
- `My Jobs`.

Nell'area utente della sidebar, gli admin vedono un `Badge` shadcn con testo `ADMIN` in uppercase. Il badge usa il componente `Badge` gia presente e classi solo per layout/compattezza, senza styling custom pesante.

### Pagine Utenti

Le pagine admin vivono sotto `resources/js/pages/admin/*`.

Pagine previste:

- `admin/users/index`: tabella utenti con ricerca, filtri ruolo/stato, conteggi job e azioni;
- `admin/users/create`: form creazione utente;
- `admin/users/edit`: form modifica utente;
- `admin/users/show`: dettaglio utente con dati principali, stato, social collegati essenziali e job dell'utente.

Il CRUD utenti permette:

- creare utenti attivi con nome, email e ruolo;
- inviare automaticamente il link password alla creazione;
- modificare nome, email e ruolo;
- inviare manualmente un nuovo reset link;
- disattivare utenti;
- riattivare utenti.

Il CRUD utenti non permette:

- delete fisico in questa iterazione;
- auto-demote;
- auto-disable.

### Pagine Job Admin

`admin/jobs/index` mostra una lista globale read-only dei job.

La lista supporta filtri server-side per:

- utente;
- stato;
- processo.

Gli admin possono aprire il dettaglio job e scaricare risultati usando i flussi esistenti. La `ProcessExecutionPolicy::view()` viene estesa per consentire agli admin attivi di vedere job altrui.

Non introduciamo retry, cancel, delete o mutazioni sui job in questa iterazione.

## Frontend

### Inertia E Wayfinder

Le pagine admin sono pagine Inertia React.

Le route generate da Wayfinder devono essere usate quando disponibili, seguendo il pattern esistente degli import da `@/routes` e `@/actions`.

### shadcn/ui

Usiamo componenti shadcn gia installati dove possibile:

- `Table` per liste;
- `Badge` per ruolo, stato e badge `ADMIN`;
- `Button` per azioni;
- `DropdownMenu` per menu azioni riga;
- `Input` e `Select` per filtri;
- `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription` per form;
- `Dialog` o `AlertDialog` per conferme;
- `Alert` per errori o stati importanti.

I form rispettano le regole shadcn:

- layout form con `FieldGroup` e `Field`;
- validazione con `data-invalid` sul field e `aria-invalid` sul controllo;
- icone nei button con `data-icon`;
- `Badge` invece di span custom per stati e ruoli;
- `gap-*` invece di `space-*`.

Se servono componenti shadcn non installati, vanno aggiunti tramite CLI shadcn usando il package runner del progetto e leggendo i file aggiunti prima di usarli.

### Laravel Precognition

I form admin useranno `laravel-precognition-react`.

Pattern previsto:

- `useForm(method, url, initialData)`;
- `form.setData(field, value)` su change;
- `form.validate(field)` su blur o sul cambio di campi selezionati;
- `form.invalid(field)` e `form.errors[field]` per lo stato visuale;
- submit tramite `form.submit()`.

Le regole di validazione vivono nei Form Request Laravel. Il frontend non duplica logica di validazione.

## Backend

### Controller

Controller dedicati:

- `Admin\UserController`;
- `Admin\JobController`.

Il controller utenti espone azioni RESTful dove sensato e azioni dedicate per:

- `deactivate`;
- `reactivate`;
- `sendPasswordResetLink`.

Il controller job e read-only.

### Form Request

Form Request previste:

- `StoreAdminUserRequest`;
- `UpdateAdminUserRequest`;
- `DeactivateAdminUserRequest`;
- `ReactivateAdminUserRequest`;
- `SendAdminUserPasswordResetLinkRequest`.

Le request devono:

- autorizzare solo admin attivi;
- validare email unica e normalizzata lowercase;
- validare ruolo dentro `user/admin`;
- impedire auto-demote e auto-disable;
- supportare Precognition.

### Sessioni

Quando un admin disattiva un utente, le sessioni web attive dell'utente vengono invalidate.

Nel database session driver, questo puo essere implementato eliminando le righe `sessions` con `user_id` dell'utente disattivato. Il comportamento deve restare testabile.

## Data Flow

### Creazione Utente Da UI Admin

1. L'admin apre `/admin/users/create`.
2. Il form Precognition valida nome, email e ruolo.
3. Il submit crea un utente attivo senza password locale.
4. Laravel invia il reset link.
5. La UI torna alla lista o al dettaglio utente con toast di conferma.

### Creazione Admin Da CLI

1. Un operatore esegue `php artisan users:make-admin email@example.org`.
2. Se l'utente esiste, viene promosso e riattivato.
3. Se l'utente non esiste, viene creato admin attivo senza password.
4. Se creato da zero, Laravel invia il reset link.
5. Il comando mostra un output esplicito su creazione/promozione e invio link.

### Disattivazione Utente

1. L'admin conferma l'azione.
2. Laravel impedisce auto-disattivazione.
3. Laravel valorizza `deactivated_at`.
4. Laravel invalida le sessioni dell'utente.
5. I job restano disponibili nelle viste admin.

### Social Login Con Email Gia Presente

1. Il provider restituisce email verificata.
2. Il resolver cerca `users.email`.
3. Se trova un utente attivo, collega il social account e autentica.
4. Se trova un utente disattivato, non autentica e non crea duplicati.

## Error Handling

- Non-admin su `/admin/*`: `403`.
- Utente disattivato su login password/social/passkey: login rifiutato con errore generico.
- Email duplicata: errore di validazione backend, visibile anche via Precognition.
- Auto-demote o auto-disable: bloccati lato server.
- Reset link non inviato: errore visibile; non mostrare successo falso.
- Disattivazione con sessioni attive: sessioni invalidate durante la mutazione.

## Test

Aggiungere o aggiornare test Pest per coprire:

- migration e model helper: default `role=user`, `isAdmin()`, `isActive()`, `isDeactivated()`;
- factory states per admin e disattivato;
- `users:make-admin` promuove utente esistente;
- `users:make-admin` crea admin se l'email manca;
- `users:make-admin` invia reset link per nuovo admin;
- password login rifiuta utenti disattivati;
- social login collega email verificata a utente esistente creato da admin;
- social login rifiuta utente disattivato senza creare duplicati;
- passkey login rifiuta utenti disattivati quando la feature passkey e abilitata nei test;
- non-admin non accede alle rotte admin;
- admin vede lista utenti;
- admin crea, modifica, disattiva e riattiva utenti;
- admin non puo auto-demote;
- admin non puo auto-disable;
- admin puo inviare reset link a un utente;
- utenti disattivati hanno sessioni invalidate;
- admin vede lista globale job;
- admin vede dettaglio job altrui;
- utenti normali restano limitati ai propri job;
- la sidebar mostra `ADMIN` usando il componente `Badge` per admin;
- i link admin sono condizionati dal ruolo utente.

Eseguire almeno:

```bash
php artisan test --compact tests/Feature/Auth tests/Feature/Admin tests/Feature/Ogc/ProcessExecutionAuthorizationTest.php tests/Feature/Ogc/ProcessExecutionResultTest.php
vendor/bin/pint --dirty --format agent
bun run types:check
```

Se vengono aggiunti test frontend TypeScript, eseguire anche i test frontend mirati.

## Non Obiettivi

Non introduciamo in questa iterazione:

- permessi granulari;
- tabella ruoli o pivot ruoli-utenti;
- pacchetti RBAC;
- hard delete utenti;
- audit log completo delle azioni admin;
- retry, cancel o delete dei job;
- impersonificazione utenti;
- gestione avanzata inviti;
- promozione automatica da `.env`.

## Criteri Di Accettazione

- Gli utenti hanno ruolo `user` o `admin`.
- I nuovi utenti sono `user` attivi per default.
- Il comando `users:make-admin` promuove utenti esistenti e crea nuovi admin quando serve.
- Gli admin attivi vedono sezione admin in sidebar.
- Gli admin vedono un badge shadcn `ADMIN` in uppercase.
- I non-admin non possono accedere a `/admin/*`.
- Gli admin possono creare, modificare, disattivare e riattivare utenti.
- La creazione utente invia un link per impostare/reset la password.
- Gli admin non possono togliere a se stessi il ruolo admin.
- Gli admin non possono disattivare se stessi.
- Gli utenti disattivati non possono accedere con password, social login o passkey.
- La disattivazione invalida sessioni attive.
- La riconciliazione social usa email verificata e non crea duplicati quando l'email appartiene a un utente esistente.
- Gli admin possono vedere job e risultati di tutti gli utenti.
- Gli utenti normali continuano a vedere solo i propri job.
- I form admin usano Precognition e componenti shadcn.
