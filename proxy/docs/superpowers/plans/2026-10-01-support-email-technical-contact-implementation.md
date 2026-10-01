# Assistenza via email e referente tecnico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly chose inline execution without worktrees. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un form di assistenza che invia email con massimo tre allegati al singolo referente tecnico, nominato dagli admin, aggiornando anche l'help.

**Architecture:** Una configurazione singleton collega il referente a un admin attivo, senza modificare l'enum dei ruoli. Una Form Request con Precognition valida il form; l'accettazione salva temporaneamente gli allegati privati e accoda un job cifrato che risolve il destinatario al momento dell'invio. Una pulizia circoscritta rimuove i dati operativi scaduti; non esistono ticket o storico applicativo.

**Tech Stack:** PHP 8.4, Laravel 13.34, Inertia Laravel 3.5 / React 3.8, React 19, Wayfinder, shadcn/ui, Pest 4, Bun, MariaDB, SQLite, Redis e Horizon.

**Spec:** [2026-10-01-support-email-technical-contact-design.md](../specs/2026-10-01-support-email-technical-contact-design.md). Leggere spec e piano insieme; la spec prevale nelle decisioni di comportamento.

**Execution:** Inline nella directory corrente, sul branch corrente `develop`, senza creare worktree. Piano aggiornato durante l'esecuzione con le richieste su modal, pulsante, badge e blocco del referente; il registro di esecuzione conserva verifiche e commit già completati.

## Global Constraints

- «La funzionalità serve esclusivamente a inviare email. Non introduce uno storico delle segnalazioni, ticket o una pagina di gestione delle richieste.»
- «Gli allegati sono facoltativi: massimo **3 file**, ciascuno fino a **5 MB**.» Il limite è «**5 × 1024 × 1024 byte**, ossia 5120 KiB».
- «L'accesso senza autenticazione è controllato da `SUPPORT_ALLOW_GUESTS`, booleano con default `false`.»
- Il form è una modal, aperta dal pulsante «Assistenza» con icona e testo visibile accanto ad «Aiuto». Nessuna pagina dedicata, rotta GET o voce nella sidebar.
- Il referente autenticato vede il pulsante disabilitato con popover esplicativo. Backend: HTTP 403 per POST e Precognition, controllo sull'account e non sull'email modificabile, ricontrollo prima degli effetti di accettazione.
- Il badge del referente è colorato, con icona e testo maiuscolo, sotto il ruolo ordinario nella colonna Ruolo.
- «Oggetto fino a 200 caratteri, descrizione fino a 10.000 caratteri, email fino a 255 caratteri.»
- «Le estensioni consentite sono `png`, `jpg`, `jpeg`, `webp`, `pdf`, `txt`, `log`, `csv` e `json`.» ZIP escluso.
- «Il referente tecnico è un incarico aggiuntivo assegnabile a un admin; può esserci al massimo un referente.» `UserRole` rimane `user` / `admin`.
- «Prima di disattivare, eliminare o rimuovere il ruolo admin al referente corrente, occorre trasferire l'incarico a un altro admin attivo.» La protezione precede gli effetti distruttivi e copre le operazioni massive.
- «Il destinatario viene risolto dal worker prima di ciascun tentativo: le email ancora da spedire seguono il referente corrente.»
- Invio finale: cinque tentativi all'ora. Validazione Precognition: sessanta richieste al minuto, con identità distinte per utente o IP.
- «Il job prevede tre tentativi automatici, con attese di 60 e 300 secondi dopo i primi due fallimenti.» La finestra operativa è di «**sette giorni dall'accettazione**».
- «Non si inviano copie, conferme automatiche o altre email all'indirizzo inserito nel form.» L'indirizzo serve come `Reply-To`.
- «Il cambio del flag disciplina le nuove richieste; non annulla quelle già accettate e presenti in coda.»
- «Testi del form, errori, messaggi di esito, azioni admin e help sono disponibili in italiano e inglese.» I capitoli diventano cinque per utenti e undici per admin.
- «Non servono nuovi pacchetti, un sistema di ruoli multipli o refactoring estranei alla funzionalità.»
- «Le modifiche e le istruzioni di deployment del repository riguardano esclusivamente **develop e staging**.»
- «Usare il mailer di test o i fake nei controlli automatici.» Non inviare email reali durante lo sviluppo.

## Review Focus

1. Nomina concorrente con declassamento/disattivazione/eliminazione: deve rimanere un referente valido e nessun effetto distruttivo deve precedere il controllo. Test funzionali nel Task 1 e processi concorrenti MariaDB nel Task 7.
2. Header Precognition costruiti manualmente e richieste invalide ripetute: nessun percorso deve inviare usando solo la quota di validazione. Test HTTP nel Task 4.
3. Timeout della coda dopo un possibile accodamento e allegati parzialmente scritti: non dichiarare successo, non cancellare file che un job accettato potrebbe usare e recuperare gli orfani. Test Task 2 e Task 3.
4. Cleanup contemporaneo a un worker, retry dopo sette giorni e invii senza allegati: mai iniziare un invio scaduto, eliminare file in uso o coinvolgere job estranei. Test Task 3 e Redis/Horizon reali Task 7.
5. Email modificata durante errori/rerender e cambio del referente durante l'attesa: preservare il contatto dichiarato, non cambiare il profilo e spedire solo al referente corrente. Test Task 2, Task 4 e Task 5.
6. Pulsante disabilitato per il referente e tentativi diretti con email diversa o nomina dopo il caricamento della pagina: il backend deve bloccare prima di file, job o email; verificare anche Precognition, aggiornamento dopo trasferimento e popover da tastiera.

---

## Preparazione e convenzioni

I percorsi applicativi dei task sono relativi a `proxy/`; quelli di deployment iniziano con `../`. I comandi PHP/Bun si eseguono da `proxy/`, Git dalla radice del repository. Non leggere né modificare i segreti nei file `.env` reali.

Leggere `AGENTS.md`, `.ai/rules/index.md`, `.ai/rules/general.md` e le skill pertinenti prima dell'esecuzione. Laravel Boost non era disponibile durante la pianificazione: sono stati usati Context7 e i sorgenti installati. Riutilizzare le informazioni già verificate e consultare Context7 per ulteriori API necessarie. Generare classi e test tramite `php artisan make:* --no-interaction`, dopo aver controllato le opzioni.

La suite ordinaria usa `Tests\TestCase`, `RefreshDatabase` e SQLite in memoria. Non indebolire la protezione di `tests/TestCase.php` e non cambiare `phpunit.xml` per usare MariaDB. Il Task 7 aggiunge prove separate con container effimeri e database creati dai test.

All'inizio dell'esecuzione creare il registro previsto da `superpowers:executing-plans` usando il relativo script `sdd-workspace`. Registrare verifica, commit e decisioni per ogni task. Seguire RED → GREEN, con prove mirate durante lo sviluppo e verifica finale complessiva. Non introdurre richieste di conferma tra i task; la revisione finale segue la skill di esecuzione.

## Mappa delle responsabilità

| Area | File principali | Confine |
| --- | --- | --- |
| Incarico | `app/Services/Support/SupportContactManager.php` | Unico accesso mutante alla configurazione; guardie account coordinate |
| Dati di invio | `app/Support/SupportMailData.php` | Valore serializzabile nel solo payload cifrato |
| File temporanei | `app/Services/Support/SupportAttachments.php` | Directory private, manifest minimo e rimozione |
| Accettazione | `app/Actions/Support/SubmitSupportEmail.php` | Salvataggio, enqueue, errori certi/ambigui |
| Trasporto | `app/Jobs/SendSupportEmail.php`, `app/Mail/SupportEmail.php` | Tentativi, destinatario corrente, email sincrona nel worker |
| Conservazione | `app/Services/Support/SupportQueuePruner.php`, `app/Services/Support/SupportHorizonPruner.php` | Rimozione selettiva dei payload scaduti |
| Web | `app/Http/Controllers/SupportController.php`, middleware e Form Request | Accesso, quote, validazione, conferma |
| Form | `resources/js/components/support-dialog.tsx`, `resources/js/components/support-form.tsx` | Una sola modal per autenticati e ospiti, pulsante e spiegazione del blocco |
| Admin | `resources/js/components/admin/technical-contact-dialog.tsx` | Nomina dalla lista e referente corrente |
| Help | `resources/js/components/user-guide.tsx`, `resources/js/lib/i18n/messages.ts` | Istruzioni e traduzioni dei due ruoli |

I metodi pubblici sotto elencati sono il contratto fra i task. Usare classi focalizzate nelle directory già esistenti, senza repository generici o un sistema di ticket.

### Task 1: Referente unico e protezione degli account

**Files**

- Create: `database/migrations/2026_10_01_000001_create_support_settings_table.php`
- Create: `app/Services/Support/SupportContactManager.php`
- Create: `app/Http/Controllers/Admin/TechnicalContactController.php`
- Create: `app/Http/Requests/Admin/AssignTechnicalContactRequest.php`
- Modify: `app/Http/Controllers/Admin/UserController.php`
- Modify: `app/Actions/Admin/DeleteUser.php`
- Modify: `app/Http/Controllers/Settings/ProfileController.php`
- Modify: `routes/web.php`, `lang/it.json`
- Test: `tests/Feature/Admin/TechnicalContactTest.php`
- Test: `tests/Feature/Admin/TechnicalContactAccountGuardTest.php`

**Interfaces**

- Consumes: `User::isAdmin(): bool`, `User::isActive(): bool`, protezioni admin/account esistenti.
- Produces: `SupportContactManager::current(): ?User`.
- Produces: `SupportContactManager::assign(int $userId): User`.
- Produces: `SupportContactManager::guardAccountChange(array $userIds, string $errorField, Closure $change): mixed`, con PHPDoc `list<int>` e callback senza argomenti.
- Produces: `PUT /admin/users/{user}/technical-contact`, nome `admin.users.technical-contact.update`.
- Produces: prop admin `technicalContact: {id: number; name: string; email: string} | null` e `users.data[].is_technical_contact: boolean`.

- [ ] **Step 1: Scrivere le prove della nomina e dei vincoli.**

```php
test('a new appointment replaces the previous contact', function () {
    $actor = User::factory()->admin()->create();
    $first = User::factory()->admin()->create();
    $second = User::factory()->admin()->create();

    $this->actingAs($actor)
        ->put(route('admin.users.technical-contact.update', $first))
        ->assertRedirect();
    $this->put(route('admin.users.technical-contact.update', $second))
        ->assertRedirect();

    $this->assertDatabaseCount('support_settings', 1);
    $this->assertDatabaseHas('support_settings', [
        'id' => 1,
        'technical_contact_user_id' => $second->id,
    ]);
});

test('a protected bulk change runs no destructive callback', function () {
    $contact = User::factory()->admin()->create();
    $other = User::factory()->create();
    $manager = app(SupportContactManager::class);
    $manager->assign($contact->id);
    $called = false;

    try {
        $manager->guardAccountChange(
            [$other->id, $contact->id],
            'ids',
            function () use (&$called): void { $called = true; },
        );
        $this->fail('The current contact must be protected.');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey('ids');
    }

    expect($called)->toBeFalse();
    expect($other->fresh()->isActive())->toBeTrue();
});
```

Coprire anche nominatore ospite/user/disattivato, candidato user/disattivato/inesistente, nomina di sé stesso, nomina identica e referente fuori dalla pagina filtrata. Verificare direttamente che un secondo `id` nella tabella sia respinto dal DB e che la FK impedisca di eliminare fisicamente il referente.

- [ ] **Step 2: Eseguire RED.**

Run: `php artisan test --compact tests/Feature/Admin/TechnicalContactTest.php tests/Feature/Admin/TechnicalContactAccountGuardTest.php`.

Expected: fallimento per rotta/classe/tabella assenti.

- [ ] **Step 3: Creare singleton e servizio con ordine dei lock unico.**

Usare una migrazione con SQL esplicito per SQLite e MariaDB, perché SQLite non permette di aggiungere successivamente questo `CHECK`. `down()` usa `Schema::dropIfExists('support_settings')`.

```php
$definition = DB::getDriverName() === 'sqlite'
    ? 'id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
       technical_contact_user_id INTEGER NULL,
       FOREIGN KEY (technical_contact_user_id) REFERENCES users(id) ON DELETE RESTRICT'
    : 'id TINYINT UNSIGNED NOT NULL PRIMARY KEY CHECK (id = 1),
       technical_contact_user_id BIGINT UNSIGNED NULL,
       FOREIGN KEY (technical_contact_user_id) REFERENCES users(id) ON DELETE RESTRICT';
DB::statement("CREATE TABLE support_settings ({$definition})");
DB::table('support_settings')->insert(['id' => 1, 'technical_contact_user_id' => null]);
```

`assign()` blocca prima `support_settings.id=1`, poi l'utente, controlla ruolo/stato dopo i lock e aggiorna il solo riferimento. `current()` risolve il riferimento tramite `users`, restituendo `null` per admin assente o disattivato. Non serve un modello Eloquent dedicato.

Il nucleo della guardia è:

```php
return DB::transaction(function () use ($userIds, $errorField, $change): mixed {
    $settings = DB::table('support_settings')->where('id', 1)->lockForUpdate()->first();
    if ($settings === null) {
        throw new LogicException('Missing support settings singleton.');
    }
    User::query()->whereIn('id', $userIds)->orderBy('id')->lockForUpdate()->get();
    if ($settings->technical_contact_user_id !== null
        && in_array((int) $settings->technical_contact_user_id, $userIds, true)) {
        throw ValidationException::withMessages([
            $errorField => __('Assign another technical contact before changing this account.'),
        ]);
    }

    return $change();
}, attempts: 1);
```

Anche `assign()` fallisce se manca il singleton; non ricrearlo durante una richiesta. La guardia tiene il lock fino alla conclusione della callback e non ritenta la transazione: la cancellazione può avere effetti remoti, che non devono essere ripetuti automaticamente. Il lock impedisce una nomina tra controllo e cancellazione.

- [ ] **Step 4: Collegare guardie e rotta alle operazioni esistenti.**

```php
Route::put('users/{user}/technical-contact', TechnicalContactController::class)
    ->name('users.technical-contact.update');
```

Collocare la rotta nel gruppo admin esistente. La Form Request autorizza admin attivi; il servizio ricontrolla il candidato dopo il lock. Il controller restituisce redirect e toast localizzato. Non accettare `null` né esporre una rotta per azzerare l'incarico.

Nella modifica ruolo usare la guardia quando il nuovo ruolo è `UserRole::User`. Racchiudere nella guardia tutta la disattivazione singola/massiva, `DeleteUser` prima del primo `DeleteProcessExecution`, e la cancellazione del profilo prima di snapshot, avatar, logout e sessioni. Una guardia per percorso, senza transazioni duplicate fra controller e azione. Usare error field `role`, `ids` o un errore globale di cancellazione.

Nei test HTTP invocare ogni percorso con il referente e verificare account, altri utenti del bulk, sessioni e avatar invariati. Creare un job del referente con la factory esistente e verificare `Http::assertNothingSent()` dopo il rifiuto della cancellazione. Dopo il trasferimento dell'incarico, le operazioni devono tornare consentite secondo le autorizzazioni esistenti.

- [ ] **Step 5: Eseguire GREEN e regressioni account, poi committare.**

Run: `php artisan test --compact tests/Feature/Admin tests/Feature/Settings/ProfileUpdateTest.php tests/Feature/Auth/DeactivatedUserAuthTest.php`.

Expected: PASS, comprese le protezioni preesistenti. Run: `vendor/bin/pint --dirty --format agent` e `git diff --check`. Stage mirato dei file del task; commit `feat: add single technical contact and account guards`.

### Task 2: Accettazione, allegati privati e job email cifrato

**Files**

- Create: `config/support.php`
- Create: `app/Support/SupportMailData.php`
- Create: `app/Services/Support/SupportAttachments.php`
- Create: `app/Actions/Support/SubmitSupportEmail.php`
- Create: `app/Jobs/SendSupportEmail.php`
- Create: `app/Mail/SupportEmail.php`
- Create: `resources/views/mail/support-email.blade.php`
- Create: `resources/views/mail/support-email-text.blade.php`
- Modify: `app/Providers/AppServiceProvider.php`, `config/mail.php`
- Test: `tests/Feature/Support/SubmitSupportEmailTest.php`
- Test: `tests/Feature/Support/SendSupportEmailTest.php`

**Interfaces**

- Consumes: `SupportContactManager::current(): ?User`.
- Produces: readonly `SupportMailData` con `string $id`, `string $subject`, `string $description`, `string $replyTo`, `int $acceptedAt`, `int $expiresAt`, `?array $account`, `array $attachments`. PHPDoc: account `{id:int,name:string,email:string}|null`; allegati `list<array{path:string,name:string,mime:string}>`.
- Produces: `SupportAttachments::store(string $id, int $acceptedAt, int $expiresAt, array $files): array` (`list<UploadedFile>` → lista di descrittori); `assertPresent(SupportMailData $data): void`; `markDelivered(string $id): void`; `isDelivered(string $id): bool`; `delete(string $id): void`; `cleanupCandidates(int $now): iterable<string>`.
- Produces: `SubmitSupportEmail::handle(array $validated, ?User $account): void`. Dati validati: `subject`, `description`, `email`, `attachments` facoltativo. Errore di accettazione: `ValidationException`, chiave `support`.
- Produces: `SendSupportEmail::__construct(public SupportMailData $data)`; `ShouldQueue` e `ShouldBeEncrypted`; coda `support-mail`.
- Produces: metadato del payload `support_mail: {id:string, expires_at:int}`. Nessun oggetto, email o descrizione in chiaro.
- Produces: lock condiviso `support-mail:{id}`, durata 75 secondi. Timeout: SMTP 30, job 45, worker 60, `retry_after` minimo 90 secondi. Il lease supera il timeout del worker ma termina prima che un tentativo interrotto torni disponibile.

- [ ] **Step 1: Scrivere le prove di destinatario corrente e identità di risposta.**

```php
test('the worker resolves the latest contact and preserves the reply address', function () {
    config(['queue.default' => 'database']);
    Storage::fake('local');
    Queue::fake([SendSupportEmail::class]);
    Mail::fake();
    $account = User::factory()->create(['email' => 'account@example.org']);
    $first = User::factory()->admin()->create();
    $next = User::factory()->admin()->create();
    $contacts = app(SupportContactManager::class);
    $contacts->assign($first->id);
    app(SubmitSupportEmail::class)->handle([
        'subject' => 'Errore nel risultato',
        'description' => '<script>alert(1)</script>',
        'email' => 'reply@example.org',
        'attachments' => [UploadedFile::fake()->createWithContent('trace.log', "error\n")],
    ], $account);
    $queued = null;
    Queue::assertPushed(SendSupportEmail::class, function ($job) use (&$queued) {
        $queued = $job;
        return true;
    });
    $contacts->assign($next->id);
    app()->call([$queued, 'handle']);

    Mail::assertSent(SupportEmail::class, fn ($mail) =>
        $mail->hasTo($next->email)
        && ! $mail->hasTo($first->email)
        && $mail->envelope()->replyTo[0]->address === 'reply@example.org');
    Mail::assertSentCount(1);
    Mail::assertNothingQueued();
    expect($account->fresh()->email)->toBe('account@example.org');
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
});
```

Provare anche corpo HTML con testo escapato, corpo testo, `From` configurato, nome allegato ripulito, identità server-side distinta dal contatto e assenza di copie al mittente. Solo indirizzi sintetici e mail fake/array.

- [ ] **Step 2: Eseguire RED e creare configurazione, valore dati e storage.**

Run: `php artisan test --compact tests/Feature/Support/SubmitSupportEmailTest.php tests/Feature/Support/SendSupportEmailTest.php`; expected: classi assenti.

```php
return [
    'allow_guests' => filter_var(env('SUPPORT_ALLOW_GUESTS', false), FILTER_VALIDATE_BOOLEAN),
    'max_attachments' => 3,
    'max_file_kib' => 5120,
    'extensions' => ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'txt', 'log', 'csv', 'json'],
    'queue' => 'support-mail',
    'retention_seconds' => 7 * 24 * 60 * 60,
    'lock_seconds' => 75,
];
```

`SupportAttachments` crea `support-mail/{UUID}/manifest.json` prima dei file, con soli `id`, `accepted_at`, `expires_at` e `delivered=false`; anche un invio senza file ha il manifest. Usa il disco `local` privato e percorsi `{UUID}/{UUID}` indipendenti dai nomi originali. Controllare ogni risultato di scrittura: il disco esistente ha `throw=false`. Un errore elimina la directory già creata; un ulteriore errore di rimozione viene registrato solo con id e causa sintetica per il cleanup.

Ripulire i nomi email da separatori di percorso, CR/LF, NUL e controlli, limitandoli a 150 caratteri senza perdere l'estensione valida. MIME rilevato dal server. `assertPresent()` verifica manifest, appartenenza dei percorsi alla directory dell'id e presenza di tutti i file. Un allegato mancante impedisce l'intero invio.

`markDelivered()` aggiorna atomicamente il solo flag nel manifest dopo il successo SMTP. `cleanupCandidates()` restituisce directory scadute oppure marcate consegnate; il flag serve solo a recuperare una cancellazione fallita, non è uno storico.

- [ ] **Step 3: Implementare accettazione e cifratura; provare gli errori di storage/coda.**

Prima dei file, `handle()` richiede un referente valido e una connessione asincrona `database` o `redis`. Genera UUID, istante di accettazione e scadenza; ricava l'account dall'argomento server-side. Accoda esplicitamente con `Queue::pushOn('support-mail', new SendSupportEmail($data))` e conferma solo dopo l'esito positivo.

Storage e costruzione/serializzazione/cifratura falliti prima della scrittura in coda sono fallimenti certi: rimuovere i file. Un'eccezione di connessione durante il push è ambigua: conservare la directory per il job eventualmente ricevuto e per il cleanup, restituendo errore `support`. Non classificare qualsiasi errore Redis come «nessun job creato» e non registrare il payload.

Registrare il callback in `AppServiceProvider::boot()`:

```php
Queue::createPayloadUsing(function ($connection, $queue, array $payload): array {
    $job = $payload['data']['command'] ?? null;
    if (! $job instanceof SendSupportEmail) {
        return [];
    }

    return ['support_mail' => [
        'id' => $job->data->id,
        'expires_at' => $job->data->expiresAt,
    ]];
});
```

Nel framework installato il callback vede l'oggetto prima della cifratura. Testare un payload vero della connessione database: nessun contenuto sensibile in chiaro, comando decifrabile con Laravel e metadati corretti. I callback non devono contaminare i test successivi quando l'app viene ricreata.

Per gli errori: filesystem che fallisce alla seconda scrittura; serializzazione che fallisce prima del push; connessione che accetta il job e poi solleva un errore. Asserire rispettivamente rimozione, rimozione e conservazione della directory, sempre senza falsa conferma.

- [ ] **Step 4: Implementare worker e messaggio con scadenza esplicita.**

```php
public int $tries = 3;
public int $timeout = 45;

public function backoff(): array
{
    return [60, 300];
}
```

Non definire `retryUntil()`: nel Laravel installato può prevalere sul numero massimo di tentativi. `handle()` acquisisce il lock per id; se occupato rilascia il job con breve ritardo senza leggere file. Dentro il lock:

1. Se `isDelivered($id)`, recuperare la cancellazione senza inviare nuovamente.
2. Se `now()->timestamp >= $data->expiresAt`, fallire senza inviare.
3. Verificare tutti gli allegati, poi risolvere il referente corrente attivo.
4. Eseguire `Mail::to($contact->email)->send(new SupportEmail($data))`.
5. Dopo il ritorno del trasporto, tentare sia `markDelivered()` sia `delete()`. Catturare separatamente gli errori di queste due operazioni, registrarli senza rilancio e lasciare il recupero al cleanup.
6. Rilasciare il lock in `finally`.

Assenza referente ed errore SMTP sono recuperabili entro i tentativi; richiesta scaduta e file mancanti falliscono esplicitamente senza email parziale. Il controllo della scadenza vale anche per un retry manuale.

`SupportEmail` non implementa `ShouldQueue`. `Envelope` usa `From` dell'app, `Reply-To` validato e oggetto `[Assistenza] {$data->subject}`. `Content` specifica view HTML e testo con descrizione, contatto, data di accettazione e identità autenticata distinta quando presente; HTML con `{{ $data->description }}` e whitespace preservato. Allegati da storage privato con nomi normalizzati. Nessun `cc`, `bcc` o destinatario derivato dal form.

In `config/mail.php` impostare il timeout SMTP a 30 secondi. SMTP è il trasporto di ambiente da verificare; `log` e `array` rimangono disponibili per sviluppo/test. Se viene configurato un trasporto diverso, verificare il timeout effettivo prima dell'abilitazione: il parametro SMTP non limita automaticamente failover o trasporti HTTP.

- [ ] **Step 5: Eseguire GREEN e committare.**

Coprire errore SMTP con file mantenuti, terzo fallimento, referente indisponibile, trasferimento tra tentativi, file mancante, limite dei sette giorni, richiesta senza allegati ed errore di cancellazione dopo SMTP senza rilancio o seconda email. Il Task 7 verifica i tentativi usando il worker reale.

Run: `php artisan test --compact tests/Feature/Support/SubmitSupportEmailTest.php tests/Feature/Support/SendSupportEmailTest.php`.

Expected: PASS. Run: `vendor/bin/pint --dirty --format agent` e `git diff --check`; stage mirato e commit `feat: queue encrypted support emails with private attachments`.

### Task 3: Pulizia circoscritta e coordinata dei dati operativi

**Files**

- Create: `app/Support/SupportPayload.php`
- Create: `app/Services/Support/SupportQueuePruner.php`
- Create: `app/Services/Support/SupportHorizonPruner.php`
- Create: `app/Console/Commands/PruneSupportMail.php`
- Modify: `app/Services/Support/SupportAttachments.php`
- Modify: `routes/console.php`
- Test: `tests/Feature/Support/PruneSupportMailTest.php`
- Test: `tests/Feature/Support/SupportPayloadTest.php`

**Interfaces**

- Consumes: dati e lock del Task 2, connessione queue configurata, provider Laravel dei failed job, connessione Redis `horizon`.
- Produces: `SupportPayload::metadata(string $payload): ?array`, forma `{id:string,expires_at:int}`; accetta solo payload di `SendSupportEmail` con UUID e scadenza validi.
- Produces: `SupportQueuePruner::expiredIds(int $now): iterable<string>` e `deleteExpired(string $id, int $now): int`, comprensivi dei failed job Laravel.
- Produces: `SupportHorizonPruner::expiredIds(int $now): iterable<string>` e `deleteExpired(string $id, int $now): int`.
- Produces: `SupportAttachments::canDelete(string $id, int $now): bool` per ricontrollare una singola directory sotto lock, usando consegna/scadenza e le regole degli orfani.
- Produces: comando `support:prune`. Exit 0 senza errori; exit nonzero per errori operativi, senza loggare dati utente.

- [ ] **Step 1: Scrivere test di isolamento, scadenza e worker attivo.**

```php
test('cleanup preserves files while a worker owns the request lock', function () {
    config(['queue.default' => 'database']);
    Storage::fake('local');
    $id = (string) Str::uuid();
    $files = app(SupportAttachments::class);
    $files->store($id, now()->subDays(8)->timestamp, now()->subDay()->timestamp, []);
    $lock = Cache::lock('support-mail:'.$id, 75);
    expect($lock->get())->toBeTrue();

    try {
        $this->artisan('support:prune')->assertSuccessful();
        Storage::disk('local')->assertExists("support-mail/{$id}/manifest.json");
    } finally {
        $lock->release();
    }

    $this->artisan('support:prune')->assertSuccessful();
    Storage::disk('local')->assertMissing("support-mail/{$id}/manifest.json");
});
```

Creare nella stessa prova di cleanup una directory `ogc/keep` e un job non supporto, verificando che restino invariati. Aggiungere: nessun allegato; directory consegnata ma non scaduta; payload fallito senza directory; directory orfana senza payload; manifest corrotto; scadenza esatta; payload con commandName o UUID falsi; job supporto recente accanto a quello scaduto.

- [ ] **Step 2: Eseguire RED e implementare parser restrittivo e discovery.**

Run: `php artisan test --compact tests/Feature/Support/PruneSupportMailTest.php tests/Feature/Support/SupportPayloadTest.php`.

Nucleo del parser, senza decifratura o `unserialize`:

```php
$decoded = json_decode($payload, true);
$meta = $decoded['support_mail'] ?? null;
if (($decoded['data']['commandName'] ?? null) !== SendSupportEmail::class
    || ! is_array($meta)
    || ! is_string($meta['id'] ?? null)
    || ! Str::isUuid($meta['id'])
    || ! is_int($meta['expires_at'] ?? null)
    || $meta['expires_at'] <= 0) {
    return null;
}

return ['id' => $meta['id'], 'expires_at' => $meta['expires_at']];
```

I pruner selezionano esclusivamente la coda `support-mail` e il marker valido. Per storage, verificare UUID della directory e manifest minimo; un orfano senza manifest valido è rimovibile solo se tutti i file hanno timestamp server anteriori alla finestra di sette giorni. Non seguire link simbolici né operare fuori da `support-mail/`.

- [ ] **Step 3: Implementare rimozione selettiva per database, Redis, failed job e Horizon.**

| Archivio | Selezione e rimozione |
| --- | --- |
| Database queue | Leggere per blocchi la tabella configurata, solo `queue=support-mail`. Eliminare per chiave primaria e payload ancora identico dopo aver verificato marker/scadenza. Coprire disponibili, delayed e reserved. |
| Redis queue | Usare connessione e prefissi della queue configurata. Leggere lista pending e sorted set delayed/reserved; eliminare il preciso payload con `LREM`/`ZREM`, dopo ricontrollo del marker. Gestire la forma della chiave adottata dal driver, incluse hash tag quando applicabili. |
| Failed job Laravel | Leggere il provider/database/tabella configurati; verificare queue e marker, poi `forget(uuid)` sul solo job scaduto. Non usare `queue:flush`. |
| Horizon | Leggere i record job tramite la connessione `horizon` e gli indici recent/pending/completed/failed/silenced. Per un record supporto scaduto rimuovere esattamente il suo hash e il suo id dagli indici. Non usare `horizon:clear` o purge dell'intera coda. |

Raggruppare i record per id di richiesta e acquisire il lock prima delle eliminazioni. I comandi Redis vanno isolati nei due servizi, non disseminati nel comando Artisan. Verificare i nomi delle chiavi sul `RedisJobRepository` Horizon installato; non duplicare la semantica basandosi su un'altra versione. I record senza payload o con JSON malformato non autorizzano l'eliminazione di dati estranei.

Per Horizon effettuare scansioni a pagine senza saltare elementi quando gli indici vengono accorciati. Eliminare anche la copia di un fallimento recente il cui `expires_at` originario è già passato; il trim standard di Horizon, basato sull'istante di fallimento, non basta.

Con la configurazione locale `database`, Horizon non gestisce questa coda: il relativo adapter restituisce una discovery vuota senza richiedere Redis. Le fixture/mock dei test ordinari restano confinati al test che li usa; le prove Redis/Horizon reali sono separate.

- [ ] **Step 4: Comporre comando e schedule con lo stesso lock del worker.**

```php
$now = now()->timestamp;
$ids = collect($files->cleanupCandidates($now))
    ->merge($queues->expiredIds($now))
    ->merge($horizon->expiredIds($now))
    ->unique();
foreach ($ids as $id) {
    $lock = Cache::lock('support-mail:'.$id, 75);
    if (! $lock->get()) {
        continue;
    }
    try {
        $queues->deleteExpired($id, $now);
        $horizon->deleteExpired($id, $now);
        if ($files->canDelete($id, $now)) {
            $files->delete($id);
        }
    } finally {
        $lock->release();
    }
}
```

Questo blocco fissa il coordinamento senza ripetere la scansione dello storage per ogni id. Processare le directory indipendentemente; un errore viene contato e non impedisce la pulizia delle successive, mentre determina exit nonzero. Misurare il tempo trascorso per id con un orologio monotono e fermare quel gruppo prima di 60 secondi, lasciando margine al lease di 75 secondi; il lavoro residuo passa all'esecuzione successiva. Mai proseguire la cancellazione dopo perdita del lock.

Registrazione:

```php
Schedule::command('support:prune')->hourly()->withoutOverlapping()->onOneServer();
```

- [ ] **Step 5: Eseguire GREEN e committare.**

Run: `php artisan test --compact tests/Feature/Support/PruneSupportMailTest.php tests/Feature/Support/SupportPayloadTest.php`. Expected: PASS. Le prove reali Redis/Horizon sono nel Task 7; i test ordinari usano SQLite e fixture/mock circoscritti.

Run: `vendor/bin/pint --dirty --format agent` e `git diff --check`; stage mirato e commit `feat: prune expired support mail data safely`.

### Task 4: Endpoint, accesso, validazione Laravel e Precognition

**Files**

- Create: `app/Http/Controllers/SupportController.php`
- Create: `app/Http/Middleware/EnsureSupportAccess.php`
- Create: `app/Http/Requests/StoreSupportRequest.php`
- Create: `app/Rules/SupportAttachmentType.php`
- Modify: `routes/web.php`, `bootstrap/app.php`
- Modify: `app/Providers/AppServiceProvider.php`
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`
- Modify: `lang/it.json`
- Test: `tests/Feature/Support/SupportAccessTest.php`
- Test: `tests/Feature/Support/SupportSubmissionTest.php`
- Test: `tests/Feature/Support/SupportValidationTest.php`
- Test: `tests/Feature/Support/SupportRateLimitTest.php`

**Interfaces**

- Consumes: `config('support.*')`, `SupportContactManager::current()`, `SubmitSupportEmail::handle()`.
- Produces: solo `POST /support` (`support.store`); nessuna rotta GET o pagina `support/create`.
- Produces: disponibilità e stato del referente nelle shared props; email iniziale da `auth.user.email`, vuota per ospiti. Nessun indirizzo del referente nelle props comuni.
- Produces: shared props `support: {allowGuests: boolean; available: boolean; isTechnicalContact: boolean; maxAttachments: number; maxFileBytes: number; allowedExtensions: string[]}`.
- Produces: errori `subject`, `description`, `email`, `attachments`, `attachments.N`, `support`. Conferma tramite toast/sessione secondo il pattern esistente.

- [ ] **Step 1: Scrivere test di accesso e assenza di effetti Precognition.**

```php
test('guest access disabled also blocks a direct precognitive post', function () {
    config(['support.allow_guests' => false]);
    Queue::fake();
    Mail::fake();
    Storage::fake('local');

    $this->withHeaders(['Precognition' => 'true'])->post(route('support.store'), [
        'subject' => 'Help',
        'description' => 'Cannot read the result',
        'email' => 'guest@example.org',
    ])->assertRedirect(route('login'));

    Queue::assertNothingPushed();
    Mail::assertNothingSent();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
});

test('precognition validates text without persisting or sending', function () {
    config(['support.allow_guests' => true]);
    app(SupportContactManager::class)->assign(User::factory()->admin()->create()->id);
    Queue::fake();
    Mail::fake();
    Storage::fake('local');

    $this->withHeaders([
        'Accept' => 'application/json',
        'Precognition' => 'true',
        'Precognition-Validate-Only' => 'email',
    ])->post(route('support.store'), [
        'email' => 'not-an-email',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');

    Queue::assertNothingPushed();
    Mail::assertNothingSent();
    expect(Storage::disk('local')->allFiles('support-mail'))->toBe([]);
});
```

Matrice accesso: flag mancante/false/true/invalido; ospite, account attivo, admin, referente corrente, sessione disattivata; disponibilità del pulsante, POST e Precognition. Verificare l'assenza della pagina GET. La sessione disattivata segue il middleware esistente anche con guest abilitati. Senza referente, modal indisponibile e POST senza effetti. Il referente riceve 403 per invio e Precognition anche con email diversa; trasferendo l'incarico si inverte l'accesso fra vecchio e nuovo referente. Verificare anche l'azione di accettazione chiamata direttamente, senza effetti quando l'account coincide col referente.

- [ ] **Step 2: Eseguire RED e collegare rotte, middleware e disponibilità.**

Run: `php artisan test --compact tests/Feature/Support/SupportAccessTest.php tests/Feature/Support/SupportSubmissionTest.php`. Expected: rotte assenti.

```php
Route::middleware([EnsureUserIsActive::class, EnsureSupportAccess::class])
    ->group(function (): void {
        Route::post('support', [SupportController::class, 'store'])
            ->middleware(['throttle:support', HandlePrecognitiveRequests::class])
            ->name('support.store');
    });
```

Rotte web con CSRF, esterne ai gruppi `guest` e `auth` esclusivi. `EnsureSupportAccess` consente un utente attivo diverso dal referente, oppure un ospite solo se il flag è vero; altrimenti redirect al login, oppure risposta di autenticazione prevista per richieste JSON. Per il referente autenticato restituisce 403 prima di Precognition. Non basare l'autorizzazione sul pulsante frontend o sull'email dichiarata. `SubmitSupportEmail` ricontrolla lo stesso vincolo prima di scrivere file o accodare.

`HandleInertiaRequests` condivide `support.available` e `support.isTechnicalContact`, risolti dal referente corrente per i visitatori ammessi; l'email iniziale viene da `auth.user.email`. `store()` passa solo i valori validati e `$request->user()` all'azione, poi torna alla pagina di provenienza con il messaggio «Richiesta acquisita. Le risposte saranno inviate all'indirizzo indicato». Gli errori di validazione restano nel form e la modal rimane aperta. Eliminare `create()` e rigenerare Wayfinder dopo aver rimosso la GET.

- [ ] **Step 3: Scrivere i test dei limiti e implementare le regole condivise.**

Dataset obbligatorio:

| Campo | Input accettati | Input respinti |
| --- | --- | --- |
| Oggetto | Testo ripulito, 200 caratteri | vuoto/spazi, array, 201 caratteri, CR/LF anche ai bordi |
| Descrizione | Testo multilinea, 10.000 caratteri | vuoto/spazi, array, 10.001 caratteri |
| Email | indirizzo valido, maiuscole/spazi normalizzati, già appartenente a un altro account | vuoto, array, sintassi invalida, oltre 255 |
| Allegati | nessuno; tre file da 5.242.880 byte | quarto file, un file da 5.242.881 byte, campo scalare, upload non valido |
| Tipi | ogni estensione consentita con contenuto coerente; LOG/CSV/JSON testuali anche malformati | ZIP, eseguibile rinominato, contenuto binario con estensione testuale |

Usare file reali di contenuto noto per i test MIME. Per il limite esatto:

```php
$atLimit = UploadedFile::fake()->createWithContent('trace.log', str_repeat('a', 5 * 1024 * 1024));
$overLimit = UploadedFile::fake()->createWithContent('trace.log', str_repeat('a', 5 * 1024 * 1024 + 1));
```

Regole di base:

```php
$rules = [
    'subject' => ['bail', 'required', 'string', 'max:200', 'not_regex:/[\r\n]/'],
    'description' => ['bail', 'required', 'string', 'max:10000'],
    'email' => ['bail', 'required', 'string', 'email:strict', 'max:255'],
];
if (! $this->isPrecognitive()) {
    $rules['attachments'] = ['nullable', 'array', 'max:3'];
    $rules['attachments.*'] = ['bail', 'file', 'max:5120', new SupportAttachmentType];
}
return $rules;
```

`prepareForValidation()` normalizza soltanto input di tipo stringa; email come nei form account esistenti. Non applicare unicità o verifica dell'indirizzo. Per l'oggetto eliminare solo spazi/tab esterni prima del controllo CR/LF. Il middleware globale `TrimStrings` non deve cancellare i CR/LF prima di questa regola: escludere la sola rotta `support` dal trimming globale in `bootstrap/app.php` e normalizzare esplicitamente nella Form Request.

`SupportAttachmentType` combina estensione originale normalizzata e MIME rilevato: PNG/JPEG/WebP con MIME immagine corrispondente; PDF con `application/pdf`; TXT/LOG/CSV/JSON con MIME testuali ordinari (`text/plain`, `text/csv`, `application/csv`, `application/json`, `text/json`). Consentire file testuali vuoti riconosciuti come `application/x-empty` o `inode/x-empty`. Nessun parser richiede JSON o CSV semanticamente corretti. Non fidarsi del MIME inviato dal browser.

Errori localizzati in `lang/it.json`, inglese come sorgente secondo la convenzione attuale. Usare un errore globale `support` per indisponibilità del referente; ricontrollare nell'azione di invio per una variazione successiva alla validazione.

- [ ] **Step 4: Implementare due quote e i test degli header costruiti manualmente.**

```php
RateLimiter::for('support', function (Request $request): Limit {
    $identity = $request->user()
        ? 'user:'.$request->user()->getAuthIdentifier()
        : 'ip:'.$request->ip();

    return $request->isAttemptingPrecognition()
        ? Limit::perMinute(60)->by('support-validation:'.$identity)
        : Limit::perHour(5)->by('support-submit:'.$identity);
});
```

La quota viene applicata prima della Form Request, così anche i tentativi finali invalidi la consumano. Usare il riconoscimento Precognition del framework, non una seconda interpretazione manuale degli header. `HandlePrecognitiveRequests` deve sempre impedire l'esecuzione del controller quando una richiesta utilizza la quota di validazione.

Associare a ciascun `Limit` una risposta localizzata: JSON con `errors.support` e status 429 per i client JSON; redirect con errore `support` per il form Inertia, conservando campi e allegati nello stato client. Includere il tempo di attesa disponibile negli header del limiter. Non trasformare il rifiuto in successo del form.

Testare 60 validazioni consentite e la 61ª limitata; cinque tentativi finali invalidi e il sesto limitato; utenti/IP indipendenti; validazioni che non consumano i cinque invii. Con dataset `Precognition=true`, `false`, `1`, assente, e `Precognition-Validate-Only` isolato, ogni richiesta deve essere o validazione senza effetti oppure invio conteggiato nella quota finale. Asserire il numero di job, non solo lo status HTTP.

- [ ] **Step 5: Eseguire GREEN, rigenerare Wayfinder e committare.**

Run: `php artisan test --compact tests/Feature/Support`; expected PASS.

Run: `php artisan wayfinder:generate --no-interaction`, `vendor/bin/pint --dirty --format agent` e `git diff --check`. Rispettare la policy esistente sui file generati. Commit `feat: validate and rate limit support submissions with precognition`.

### Task 5: Modal condivisa, allegati e pulsante Assistenza

**Files**

- Create: `resources/js/components/support-dialog.tsx`
- Create: `resources/js/components/support-form.tsx`
- Create: `resources/js/components/support-form-fields.tsx`
- Create: `resources/js/lib/support-attachments.ts`
- Create: `resources/js/types/support.ts`
- Modify: `resources/js/types/global.d.ts`
- Modify: `resources/js/components/app-sidebar-header.tsx`, `resources/js/layouts/app/app-sidebar-layout.tsx`
- Modify: `resources/js/layouts/auth/auth-simple-layout.tsx`
- Modify: `resources/js/lib/i18n/messages.ts`
- Test: `tests/Frontend/support-attachments.test.ts`
- Test: `tests/Frontend/support-form.test.tsx`
- Test: `tests/Frontend/support-dialog.test.tsx`

**Interfaces**

- Consumes: rotta Wayfinder `support.store` e shared props del Task 4.
- Produces: `SupportLimits = {maxAttachments:number; maxFileBytes:number; allowedExtensions:string[]}`.
- Produces: `SupportConfiguration = SupportLimits & {allowGuests:boolean; available:boolean; isTechnicalContact:boolean}` e `SupportDialog({initialEmail, support})`, senza dipendenza diretta dal contesto Inertia nell'header.
- Produces: `SupportFormProps = {initialEmail:string; limits:SupportLimits}` e `SupportForm({ initialEmail, limits }: SupportFormProps): React.ReactElement`.
- Produces: `SupportFormValues = {subject: string; description: string; email: string; attachments: File[]}`.
- Produces: `selectSupportAttachments(current: File[], incoming: File[], limits: SupportLimits): {ok:true; files:File[]} | {ok:false; reason:'count'|'size'|'extension'; fileName?:string}`.
- Produces: `SupportFormFields(props: SupportFormFieldsProps): React.ReactElement` presentazionale; le richieste HTTP restano in `SupportForm`.

```ts
type SupportFormFieldsProps = {
    values: SupportFormValues;
    errors: Record<string, string | undefined>;
    limits: SupportLimits;
    processing: boolean;
    progress: number | null;
    fileInput: React.RefObject<HTMLInputElement | null>;
    onTextChange: (field: 'subject' | 'description' | 'email', value: string) => void;
    onValidate: (field: 'subject' | 'description' | 'email') => void;
    onFilesSelected: (files: File[]) => void;
    onFileRemoved: (index: number) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};
```

- [ ] **Step 1: Scrivere test dei limiti client e del form renderizzato.**

```tsx
test('a fourth attachment is rejected without losing the selected files', () => {
    const current = ['a.log', 'b.log', 'c.log'].map(
        (name) => new File(['trace'], name, { type: 'text/plain' }),
    );
    const result = selectSupportAttachments(
        current,
        [new File(['trace'], 'd.log')],
        { maxAttachments: 3, maxFileBytes: 5 * 1024 * 1024, allowedExtensions: ['log'] },
    );
    expect(result).toEqual({ ok: false, reason: 'count' });
    expect(current.map((file) => file.name)).toEqual(['a.log', 'b.log', 'c.log']);
});
```

Testare anche dimensione esatta, byte in più, estensioni maiuscole, ZIP, rimozione e nuova selezione. Nel test SSR del componente presentazionale usare `renderToStaticMarkup` come nella guida: email fornita visibile e modificabile, label collegate, errori con `aria-invalid`, limite 3×5 MB visibile, rimozione etichettata col nome, submit disabilitato durante l'invio.

- [ ] **Step 2: Eseguire RED e implementare il form Inertia/Precognition.**

Run: `bun test tests/Frontend/support-attachments.test.ts tests/Frontend/support-form.test.tsx`; expected: moduli assenti.

```tsx
const form = useForm<SupportFormValues>(store(), {
    subject: '',
    description: '',
    email: initialEmail,
    attachments: [],
});

function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.submit({
        preserveScroll: true,
        onSuccess: () => {
            form.reset('subject', 'description', 'attachments');
            if (fileInput.current) fileInput.current.value = '';
        },
    });
}
```

Seguire il `useForm` già usato in `admin/users/index.tsx`. Inizializzare l'email una sola volta; nessun effect deve risincronizzarla da `auth.user.email`. Validare `subject`, `description`, `email` su blur con `form.validate('campo')`. Gli upload restano esclusi dalle richieste live; usare la conversione multipart di Inertia per il submit effettivo e mostrare `form.progress`.

Comporre `FieldGroup`, `Field`, `FieldLabel`, `FieldError`, `Input`, `Textarea`, `Button` e `Alert` già installati. Non aggiungere dipendenze. Esprimere gli errori globali in un alert e quelli per file vicino al nome. Le etichette e lo stato di invio devono essere accessibili da tastiera e da screen reader.

- [ ] **Step 3: Implementare selezione allegati e layout senza duplicare il form.**

```ts
const files = [...current, ...incoming];
if (files.length > limits.maxAttachments) {
    return { ok: false, reason: 'count' };
}
for (const file of files) {
    if (file.size > limits.maxFileBytes) {
        return { ok: false, reason: 'size', fileName: file.name };
    }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!limits.allowedExtensions.includes(extension)) {
        return { ok: false, reason: 'extension', fileName: file.name };
    }
}
return { ok: true, files };
```

Un batch invalido non modifica i file precedenti. L'input `multiple` usa `accept` derivato dalla configurazione; il server resta autorevole. Permettere di riselezionare lo stesso file dopo la rimozione azzerando il valore dell'input.

Comporre una modal `Dialog` con titolo, descrizione, chiusura, area scorrevole e ripristino del focus. Il pulsante «Assistenza» ha icona riconoscibile e testo visibile ed è accanto ad «Aiuto» nell'header; niente voce nella sidebar o pagina dedicata. Nel layout di accesso, mostrare il pulsante per gli ospiti solo con `support.allowGuests=true`, usando la stessa modal. Con `available=false` mostrare l'avviso di indisponibilità. Con `isTechnicalContact=true` il pulsante è disabilitato: un contenitore accessibile da tastiera apre un popover che spiega che il referente riceve le richieste e non può inviarle a sé stesso. Non affidare la spiegazione al solo hover. Rimuovere la vecchia pagina e l'eccezione support nell'assegnazione automatica dei layout. Verificare apertura senza cambio URL, ordine Aiuto/Assistenza, spiegazione del blocco e ritorno del focus alla chiusura.

- [ ] **Step 4: Verificare gli stati di interazione e committare.**

Run: `bun test tests/Frontend/support-attachments.test.ts tests/Frontend/support-form.test.tsx` e `bun run types:check`.

Nel browser dell'ambiente di test verificare: modal aperta e URL invariato dopo invio o errori; email modificata che sopravvive a un errore server; testo/file mantenuti in caso di rate limit; rimozione via tastiera; nessun doppio submit durante upload; al successo solo oggetto/descrizione/file svuotati e modal ancora aperta. Verificare pulsante con icona/testo, blocco del referente e popover da tastiera. Usare esclusivamente mailer array/log con dati sintetici o Mailpit locale. Se un browser eseguibile non è disponibile, riportare esplicitamente la verifica interattiva mancante senza sostituirla con un test che replica l'implementazione.

Formattare i file modificati con Prettier, eseguire lint mirato e `git diff --check`. Commit `feat: add support form and navigation`.

### Task 6: Nomina nella lista utenti e help bilingue

**Files**

- Create: `resources/js/components/admin/technical-contact-dialog.tsx`
- Modify: `resources/js/pages/admin/users/index.tsx`
- Modify: `resources/js/components/user-guide.tsx`
- Modify: `resources/js/components/app-sidebar-header.tsx`
- Modify: `resources/js/lib/i18n/messages.ts`, `resources/js/types/support.ts`
- Test: `tests/Frontend/technical-contact.test.tsx`
- Modify test: `tests/Frontend/user-guide.test.tsx`
- Modify test: `tests/Feature/Admin/TechnicalContactTest.php`

**Interfaces**

- Consumes: endpoint e props admin Task 1; `support.allowGuests` Task 4.
- Produces: `TechnicalContact = {id:number; name:string; email:string}`.
- Produces: `TechnicalContactDialog({candidate, currentContact, open, onOpenChange}: {candidate:TechnicalContact; currentContact:TechnicalContact|null; open:boolean; onOpenChange:(open:boolean)=>void})`.
- Produces: capitoli guida `support` comune e `adminSupport` riservato agli admin; `UserGuide` riceve anche `allowGuestSupport: boolean`.

- [ ] **Step 1: Scrivere test di capitoli, ruoli e sostituzione.**

Adattare i test SSR esistenti preservando primo accesso e apertura manuale. Per l'utente ordinario in inglese:

```tsx
expect(html).toContain('Request support');
expect(html).toContain('Step 1 of 5');
expect(html).not.toContain('Manage the technical contact');
```

Per l'admin:

```tsx
expect(html).toContain('Request support');
expect(html).toContain('Manage the technical contact');
expect(html).toContain('Step 1 of 11');
```

Renderizzare entrambe le lingue e i due valori del flag. Nel dialog verificare nuovo e vecchio referente, annullamento senza richiesta, submit disabilitato durante invio ed errore server visibile. Nel test HTTP applicare un filtro che nasconde il referente e verificare che `technicalContact` resti presente.

- [ ] **Step 2: Eseguire RED e implementare badge, riepilogo e dialog.**

Run: `bun test tests/Frontend/technical-contact.test.tsx tests/Frontend/user-guide.test.tsx`; expected: capitoli e componente assenti.

Aggiungere `is_technical_contact` al tipo `AdminUser`. Nella colonna Ruolo, impilare il ruolo ordinario e, sotto, il badge del referente: colorato, con icona e testo maiuscolo come gli altri ruoli. Non aggiungerlo all'identità dell'utente. Sopra la tabella rendere sempre `technicalContact` oppure l'avviso di servizio non configurato; non ricavare il riepilogo dalle sole righe paginabili.

```tsx
{user.role === 'admin' && !user.is_deactivated && !user.is_technical_contact && (
    <DropdownMenuItem onSelect={() => setContactCandidate(user)}>
        {t('admin.users.assignTechnicalContact')}
    </DropdownMenuItem>
)}
```

Il dialog usa `DialogTitle`/`DialogDescription`, descrive la sostituzione e invia la rotta Wayfinder del candidato. Form Inertia senza campi aggiuntivi; al successo chiudere il dialog e usare le props aggiornate per trasferire il badge. Il server ricontrolla il candidato anche se lo stato cambia con il dialog aperto.

- [ ] **Step 3: Aggiungere capitoli e testi IT/EN.**

`support` è il quinto capitolo comune; `adminSupport` segue quelli admin esistenti. Mantenere titolo, descrizione, tre passi e tip. Passare il flag dall'header alla guida e scegliere il tip appropriato senza mostrare variabili tecniche.

| Contenuto | Italiano | English |
| --- | --- | --- |
| support.title | Richiedere assistenza | Request support |
| support.description | Invia una richiesta al referente tecnico e ricevi la risposta via email. | Send a request to the technical contact and receive a reply by email. |
| support.first.title | Apri il form | Open the form |
| support.first.description | Premi Assistenza, con l'icona di supporto accanto ad Aiuto, per aprire il form in una finestra. Se il servizio non è disponibile, contatta un amministratore. | Click Support, with its support icon next to Help, to open the form in a dialog. If the service is unavailable, contact an administrator. |
| support.second.title | Descrivi il problema | Describe the problem |
| support.second.description | Compila oggetto e descrizione. Controlla l'email: è precompilata dal tuo account, ma puoi modificarla. Puoi aggiungere fino a 3 allegati, ciascuno da massimo 5 MB. | Enter a subject and description. Check the email address: it is prefilled from your account and can be changed. You can add up to 3 attachments, each no larger than 5 MB. |
| support.third.title | Invia e attendi la risposta | Submit and wait for a reply |
| support.third.description | Dopo la conferma di acquisizione, il referente risponderà all'indirizzo indicato. La richiesta e le risposte vengono gestite via email. | After the acceptance confirmation, the technical contact will reply to the address provided. Requests and replies are handled by email. |
| support.tip | Formati consentiti: PNG, JPG/JPEG, WebP, PDF, TXT, LOG, CSV e JSON. | Allowed formats: PNG, JPG/JPEG, WebP, PDF, TXT, LOG, CSV and JSON. |
| support.guestEnabled | Il form è disponibile anche senza accedere, dalle schermate di accesso. | The form is also available without signing in, from the sign-in screens. |
| support.guestDisabled | Per usare il form è necessario accedere. | You need to sign in to use the form. |
| adminSupport.title | Gestire il referente tecnico | Manage the technical contact |
| adminSupport.description | Scegli l'amministratore che riceve le richieste di assistenza. | Choose the administrator who receives support requests. |
| adminSupport.first.title | Scegli un admin attivo | Choose an active admin |
| adminSupport.first.description | Apri Tutti gli utenti e seleziona Nomina referente tecnico nel menu di un amministratore attivo. | Open All users and select Appoint technical contact from an active administrator's menu. |
| adminSupport.second.title | Conferma la sostituzione | Confirm the replacement |
| adminSupport.second.description | La nomina sostituisce automaticamente quella precedente. Nella colonna Ruolo, il badge colorato con icona REFERENTE TECNICO compare sotto ADMIN; il riepilogo identifica il referente corrente. | The appointment automatically replaces the previous one. In the Role column, the colored TECHNICAL CONTACT badge with an icon appears below ADMIN; the summary identifies the current contact. |
| adminSupport.third.title | Trasferisci prima di modificare l'account | Transfer before changing the account |
| adminSupport.third.description | Nomina un sostituto prima di disattivare, eliminare o togliere il ruolo admin al referente corrente. | Appoint a replacement before deactivating, deleting or removing the admin role from the current contact. |
| adminSupport.tip | Può esserci un solo referente tecnico. Se sei il referente, Assistenza è disabilitato: il popover spiega che ricevi le richieste e non puoi inviarle a te stesso. Senza un referente, il form non accetta richieste. | There can be only one technical contact. If you are the contact, Support is disabled: the popover explains that you receive requests and cannot send one to yourself. Without a contact, the form cannot accept requests. |

Adeguare le chiavi alla struttura corrente mantenendo questi testi. Tradurre anche badge, azione, dialog, errori, disponibilità, limiti file e conferma usando terminologia coerente.

- [ ] **Step 4: Eseguire GREEN e committare.**

Run: `bun test tests/Frontend/technical-contact.test.tsx tests/Frontend/user-guide.test.tsx`, `php artisan test --compact tests/Feature/Admin/TechnicalContactTest.php` e `bun run types:check`.

Expected: PASS, cinque capitoli comuni, undici admin, nessun capitolo admin per utenti ordinari. Prettier sui file modificati, lint mirato e `git diff --check`. Commit `feat: expose technical contact assignment and update user help`.

### Task 7: Runtime develop/staging, integrazione reale e verifica finale

**Files**

- Modify: `.env.example`, `composer.json`, `config/horizon.php`
- Modify: `../.env.develop.example`, `../.env.staging.example`
- Modify: `../compose.yaml`, `../deploy/README.md`
- Create: `phpunit.support-integration.xml`
- Create: `tests/Integration/SupportIntegrationTestCase.php`
- Create: `tests/Integration/SupportContactConcurrencyTest.php`
- Create: `tests/Integration/SupportQueueRuntimeTest.php`
- Create: `tests/Integration/fixtures/support-process.php`
- Test: `tests/Feature/Support/SupportConfigurationTest.php`

**Interfaces**

- Consumes: contratti applicativi dei Task 1–6.
- Produces: worker locale e Horizon che consumano `support-mail` mantenendo `default`.
- Produces: `vendor/bin/phpunit --configuration phpunit.support-integration.xml`.
- Produces: fixture `support-process.php` con argomenti `assign`, `deactivate`, `demote`, `delete`, `work-once`; id utenti e istante di test espliciti, nessuna credenziale reale.

- [ ] **Step 1: Scrivere i test della configurazione ed eseguire RED.**

Provare flag assente, `false`, `true`, `0`, `1`, stringa invalida; shared props con booleano e limiti esatti; coda presente in Horizon e ordine dei timeout.

```php
expect(config('support.max_attachments'))->toBe(3);
expect(config('support.max_file_kib'))->toBe(5120);
expect(config('mail.mailers.smtp.timeout'))->toBeLessThan(45);
expect(config('horizon.defaults.supervisor-1.timeout'))->toBeGreaterThan(45);
expect(config('queue.connections.redis.retry_after'))->toBeGreaterThan(
    config('horizon.defaults.supervisor-1.timeout'),
);
expect(config('support.lock_seconds'))->toBeGreaterThan(60)->toBeLessThan(90);
```

La verifica di `config:cache` usa un sottoprocesso con `APP_CONFIG_CACHE` temporaneo e configurazione sintetica, senza cambiare il file cache dell'utente.

Run: `php artisan test --compact tests/Feature/Support/SupportConfigurationTest.php`. Expected: configurazione della coda ancora incompleta.

- [ ] **Step 2: Aggiornare worker, esempi e istruzioni di ambiente.**

In Horizon:

```php
'queue' => ['default', 'support-mail'],
'timeout' => 60,
```

Conservare le altre impostazioni. Il job dichiara tre tentativi, prevalendo sul default del supervisor. In `composer dev` conservare il worker default e aggiungere un processo distinto, aggiornando nomi/colori di `concurrently`:

```sh
php artisan queue:work --queue=support-mail --tries=3 --timeout=60
```

Database e Redis devono avere `retry_after >= 90`. Il worker locale con timeout illimitato non deve consumare `support-mail`.

Aggiungere `SUPPORT_ALLOW_GUESTS=false` ai tre file esempio e all'anchor Laravel condiviso di Compose:

```yaml
SUPPORT_ALLOW_GUESTS: "${SUPPORT_ALLOW_GUESTS:-false}"
```

Aggiornare `deploy/README.md`: nomina iniziale dalla lista utenti; aggiornamento ambiente/config cache e riavvio dei processi tramite il flusso develop/staging esistente; coda e scheduler orario; storage condiviso; timeout 30 < 45 < 60 < 90; trasporto reale richiesto perché `log` non recapita; limite del provider sufficiente per circa 20 MiB più corpo/intestazioni. I limiti PHP/proxy attuali da 100 MB sono sufficienti.

Verificare nei Compose develop/staging che web, Horizon e scheduler condividano storage e flag. Usare gli esempi e non stampare configurazioni espanse con segreti reali.

- [ ] **Step 3: Creare test MariaDB isolati e concorrenti.**

`SupportIntegrationTestCase` estende la base Laravel direttamente, senza modificare `Tests\TestCase`. Avvia MariaDB e Redis in container effimeri con nomi casuali `support-test-{12 hex}`, porte assegnate su `127.0.0.1` e nessun volume dell'app. Database `support_test_{12 hex}`, credenziali sintetiche; conservare e rimuovere in teardown/finally solo gli id creati dal test. Riutilizzare le immagini già adottate dal Compose; nessuna nuova dipendenza applicativa.

Prima di migrare controllare insieme: `APP_ENV=testing`, nome DB atteso, host/porta del container creato, nessun URL di connessione ereditato. Impostare storage temporaneo, cache/queue Redis isolate, mailer array, chiave app sintetica e config cache separata anche nei figli. Se Docker manca, segnalare il prerequisito e non dichiarare verificata la concorrenza.

`phpunit.support-integration.xml` include soltanto `tests/Integration` e il bootstrap Composer. Due processi/connessioni reali usano una barriera stdin/stdout:

```php
DB::beginTransaction();
DB::table('support_settings')->where('id', 1)->lockForUpdate()->first();
fwrite(STDOUT, "LOCKED\n");
fflush(STDOUT);
fgets(STDIN);
app(SupportContactManager::class)->assign($candidateId);
DB::commit();
```

Il padre attende `LOCKED`, avvia il secondo processo e poi libera il primo. Usare `Symfony\Component\Process\Process` con argv separati e timeout espliciti.

Provare nomina A/nomina B e nomina/disattivazione, nomina/declassamento, nomina/eliminazione in entrambi gli ordini. Asserire un singleton e referente esistente/admin/attivo, oppure assente se la prima nomina è stata respinta. L'operazione rifiutata non produce effetti distruttivi. Il processo di eliminazione usa fake del servizio OGC.

- [ ] **Step 4: Provare worker e pulizia su Redis/Horizon reali.**

`SupportQueueRuntimeTest` usa `SendSupportEmail` reale e `work-once`. Nel processo figlio un trasporto di test conta i tentativi su Redis e lancia un errore SMTP sintetico; cache, database e storage sono condivisi solo dai processi di test.

Avviare tre worker `--once --queue=support-mail --tries=1 --timeout=60`: il job deve usare i propri tre tentativi. Fra i tentativi verificare ritardi 60/300 nello sorted set, poi anticiparne solo lo score nel Redis del test, evitando attese di sei minuti. Asserire tre tentativi, fallimento terminale e nessun quarto invio.

Popolare pending/delayed/reserved, failed job Laravel e copie Horizon con job supporto recenti/scaduti, usando eventi/repository Horizon installati. Aggiungere un job OGC sintetico. `support:prune` deve eliminare solo dati supporto scaduti, compresi invii senza allegati.

Un figlio mantiene il lock Redis mentre il padre lancia il cleanup: manifest e payload reserved restano. Dopo rilascio, vengono rimossi. Riprovare un job oltre scadenza: zero chiamate al trasporto. Simulare successo SMTP e delete fallita: cleanup successivo senza seconda email.

Run: `vendor/bin/phpunit --configuration phpunit.support-integration.xml`. Expected: PASS senza connessioni all'infrastruttura applicativa.

- [ ] **Step 5: Eseguire verifica complessiva e committare.**

Una sola volta dopo i test mirati, ripetendo solo in caso di modifiche/errori:

```sh
php artisan test --compact
bun test tests/Frontend
bun run types:check
bun run lint:check
bun run format:check
bun run build
vendor/bin/pint --dirty --format agent
git diff --check
```

Il build rigenera Wayfinder. Se formatter/build modificano file pertinenti, ripetere i controlli influenzati. Eseguire le prove Compose già pertinenti in `deploy/tests`. Nessun invio reale e nessuna migrazione sul DB dell'utente.

Stage mirato; commit `feat: configure support mail runtime and verify integration`.

- [ ] **Step 6: Completare la revisione finale del flusso inline.**

Applicare `superpowers:requesting-code-review` secondo `superpowers:executing-plans`: un solo reviewer indipendente alla fine, con spec, piano e commit base/finale. Nessun agente implementatore per task. Correggere i rilievi critici/importanti con test pertinenti e registrare decisioni/verifiche nel registro di esecuzione.

Il resoconto finale distingue funzionalità implementate, verifiche effettive, limiti ancora aperti e configurazione necessaria in develop/staging. Un mail fake non dimostra il recapito SMTP reale.

## Tracciabilità e auto-revisione

| Requisito | Task |
| --- | --- |
| Referente unico, nomina admin, sostituzione atomica | 1, 6, 7 |
| Protezioni ruolo/stato/bulk/eliminazione/profilo | 1, 7 |
| Guest false, pulsante/POST/Precognition, assenza GET, config cache | 2, 4, 5, 7 |
| Referente bloccato, popover accessibile, controllo backend sull'identità | 2, 4, 5, 6 |
| Campi, email modificabile, 3 file da 5 MiB | 4, 5 |
| Precognition senza effetti e quote separate | 4 |
| Cifratura, destinatario corrente, Reply-To, escaping | 2, 7 |
| Errori storage/coda/SMTP, tentativi e timeout | 2, 3, 7 |
| Sette giorni, orfani, dati senza file, Laravel/Horizon, lock | 2, 3, 7 |
| Modal autenticata/ospite, pulsante con icona accanto ad Aiuto | 5 |
| Help user/admin IT/EN, cinque/undici capitoli | 6 |
| Worker, storage condiviso, scheduler, develop/staging | 7 |
| Nessuno storico, nuovo ruolo enum o nuova dipendenza | Tutti |

L'auto-revisione controlla questa matrice, la coerenza delle interfacce, i sei casi di Review Focus e l'assenza di passaggi lasciati da definire. La preferenza inline senza worktree resta acquisita dopo la revisione del documento.
