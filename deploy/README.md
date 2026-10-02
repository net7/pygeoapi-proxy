# Deployment documentation

The complete deployment guides are available in:

- [English](../DEPLOY.md)
- [Italiano](../DEPLOY.it.md)

All deployment files, examples, and guides in this repository refer
exclusively to `develop` and `staging`. Make supports both environments;
`deploy-dev-staging.sh` automates staging only.

The staging reverse-proxy runbook is in
[deploy/nginx/README.md](nginx/README.md).

## Support email (develop / staging)

After deploying the migrations, an admin must appoint one active administrator
as **Technical contact** from **All Users**. A new appointment replaces the
previous one. Transfer the appointment before deactivating, demoting or deleting
the current contact.

Set `SUPPORT_ALLOW_GUESTS=false` (the default) to require sign-in; set it to
`true` only when guest access is wanted. Update the environment through the
existing develop/staging deployment flow, rebuild Laravel's configuration cache
and restart web, Horizon and scheduler processes so they all use the same value.
Do not edit the application's environment without refreshing its cached config.

Horizon consumes both `default` and `support-mail`. The local `composer dev`
command starts a separate bounded support worker. Attempts use the job's
three-try limit, with 60/300-second delays. SMTP timeout is 30 seconds, the job
45 seconds, the worker 60 seconds, the shared request lock 75 seconds and queue
`retry_after` at least 90 seconds. Web, worker and scheduler must share the
private storage directory and the same cache backend; the existing Compose
overlays already share these resources.

Use an actual mail transport (or Mailpit in develop): `MAIL_MAILER=log` does
not deliver email. The provider must allow about 20 MiB of encoded attachments
plus message body and headers (three files of 5 MiB each). Existing 100 MB
PHP/proxy limits are sufficient. Replies use the form's contact email; it does
not change the user's account address.

The confirmation means the request was accepted into the queue. There is no
ticket history or automatic reply. Temporary private files are removed after
delivery; the hourly `support:prune` schedule removes support data older than
seven days from storage, queues, Laravel failed jobs and Horizon. Keep the
scheduler running, including while mail delivery is unavailable. The job refuses
new delivery attempts after that deadline. SMTP delivery is at least once:
a crash after transport acceptance can produce a duplicate message.

The isolated MariaDB/Redis integration checks run from `proxy/` with
`vendor/bin/phpunit --configuration phpunit.support-integration.xml`.
Docker and the PHP PDO MySQL, Redis and PCNTL extensions are required. Tests
create and remove their own containers and temporary storage, without using
application databases or volumes.

---

# Documentazione del deploy

Le guide complete al deploy sono disponibili in:

- [English](../DEPLOY.md)
- [Italiano](../DEPLOY.it.md)

Tutti i file, gli esempi e le guide di deploy di questo repository fanno
riferimento esclusivamente a `develop` e `staging`. Make supporta entrambi gli
ambienti;
`deploy-dev-staging.sh` automatizza soltanto lo staging.

La guida operativa per il reverse proxy di staging è in
[deploy/nginx/README.md](nginx/README.md).

## Email di assistenza (develop / staging)

Dopo le migrazioni, un admin nomina il **Referente tecnico** dalla lista
**Tutti gli utenti**. La nomina è unica e sostituisce quella precedente;
trasferirla prima di disattivare, declassare o eliminare il referente.

`SUPPORT_ALLOW_GUESTS=false` richiede l'accesso ed è il valore predefinito.
Per abilitare gli ospiti impostare `true`. Applicare le modifiche con il
flusso develop/staging esistente, rigenerare la cache di configurazione e
riavviare web, Horizon e scheduler.

Horizon gestisce `default` e `support-mail`; `composer dev` avvia un worker
dedicato all'assistenza. Sono previsti tre tentativi con attese di 60/300
secondi. I timeout sono SMTP 30, job 45, worker 60, lock 75 e
`retry_after` almeno 90 secondi. Web, worker e scheduler condividono storage
privato e cache tramite gli overlay Compose esistenti.

Configurare un trasporto email reale, oppure Mailpit in develop: il mailer
`log` non recapita. Il provider deve accettare circa 20 MiB di allegati
codificati, più corpo e intestazioni; i limiti PHP/proxy da 100 MB sono
sufficienti. La conferma indica l'acquisizione in coda, senza creare uno storico
ticket o inviare una risposta automatica.

Lo scheduler esegue ogni ora `support:prune` per eliminare i dati di assistenza
scaduti da storage, code, failed job Laravel e Horizon; i file vengono rimossi
anche dopo la consegna. La scadenza è sette giorni dall'acquisizione, anche se
il trasporto non funziona. Non vengono avviati nuovi tentativi dopo la scadenza.
Un arresto dopo l'accettazione SMTP può causare un duplicato.

I test isolati MariaDB/Redis si eseguono da `proxy/` con
`vendor/bin/phpunit --configuration phpunit.support-integration.xml` e
richiedono Docker e le estensioni PHP PDO MySQL, Redis e PCNTL. Creano e
rimuovono soltanto container e dati temporanei propri.
