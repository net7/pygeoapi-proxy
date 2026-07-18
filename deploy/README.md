# Deploy staging con GitLab

Questa procedura prepara e gestisce esclusivamente lo staging. La produzione
ha un ciclo di rilascio distinto e non è inclusa nella pipeline corrente.

## Topologia

```text
GitLab runner -> SSH -> deploy user -> stable checkout -> deploy.sh -> Docker Compose
```

- Checkout: `/docker-data/configuration/pygeoapi-proxy/proxy`
- URL: `https://proxygeoapi.netseven.work`
- Laravel host port: `127.0.0.1:7070`
- Reverb host port: `127.0.0.1:7071`

Il runner esegue soltanto i quality gate e il trigger SSH. Composer, Bun e Vite
girano negli stage del Dockerfile sul server; le immagini applicative non sono
pubblicate nel Container Registry.

## Prerequisiti server

Eseguire questi controlli con un account amministrativo:

```bash
sudo -u deploy test -d /docker-data/configuration/pygeoapi-proxy/proxy/.git
sudo -u deploy test -f /docker-data/configuration/pygeoapi-proxy/proxy/.env.staging
sudo -u deploy sh -lc 'command -v git bash flock curl docker make'
sudo -u deploy git -C /docker-data/configuration/pygeoapi-proxy/proxy remote -v
sudo -u deploy git -C /docker-data/configuration/pygeoapi-proxy/proxy ls-remote --exit-code origin refs/heads/staging
sudo -u deploy git -C /docker-data/configuration/pygeoapi-proxy/proxy status --short --untracked-files=no
sudo -u deploy git -C /docker-data/configuration/pygeoapi-proxy/proxy check-ignore .env.staging
sudo -u deploy stat -c '%a %U:%G %n' /docker-data/configuration/pygeoapi-proxy/proxy/.env.staging
sudo -u deploy docker info
sudo -u deploy docker compose version
sudo nginx -T 2>&1 | grep -E '127\.0\.0\.1:(7070|7071)'
```

L'utente `deploy` deve poter usare Docker senza password interattiva. Il
controllo `status --short --untracked-files=no` deve essere vuoto prima del
primo deploy; i file versionati sono infatti gestiti dallo script e le
modifiche manuali vengono sostituite. `check-ignore` deve confermare che
`.env.staging` è ignorato. Correggere owner e permessi se `stat` mostra accessi
più ampi di quelli necessari.

Il dump Nginx deve mostrare i proxy verso entrambe le porte loopback `7070` e
`7071`. Lo script non usa `git clean -fdx`, quindi conserva `.env.staging` e gli
altri file ignorati necessari al server.

## Chiave SSH e known hosts

Usare una chiave Ed25519 dedicata al progetto. Da una workstation
amministrativa, in una directory temporanea protetta:

```bash
umask 077
ssh-keygen -t ed25519 -a 100 -C 'gitlab-pygeoapi-proxy-staging' -f ./pygeoapi-proxy-staging
ssh-copy-id -i ./pygeoapi-proxy-staging.pub "deploy@$DEPLOY_HOST"
ssh-keyscan -H "$DEPLOY_HOST" > ./pygeoapi-proxy-staging.known_hosts
ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts
```

Sul server ottenere la fingerprint autorevole:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Confrontare le fingerprint tramite un canale amministrativo distinto prima di
caricare `known_hosts` in GitLab. Non disabilitare mai la verifica dell'host.
Caricare la chiave privata e il file `known_hosts`, poi eliminare in modo sicuro
le copie temporanee quando non servono più.

## Variabili GitLab protette

Configurare in **Settings > CI/CD > Variables**:

| Variabile | Tipo | Protezione | Valore o scopo |
| --- | --- | --- | --- |
| `DEPLOY_SSH_KEY` | File | Protected; masked se supportato | Chiave privata dedicata |
| `DEPLOY_KNOWN_HOSTS` | File | Protected | Host key verificata |
| `DEPLOY_HOST` | Variable | Protected | Hostname o IP dello staging |
| `DEPLOY_USER` | Variable | Protected | `deploy` |
| `DEPLOY_PATH` | Variable | Protected | `/docker-data/configuration/pygeoapi-proxy/proxy` |

Non copiare `.env.staging` nelle variabili GitLab: resta soltanto sul server.

## Impostazioni progetto

In GitLab:

1. mantenere `staging` protetto;
2. configurare **Allowed to merge** con i ruoli autorizzati dal progetto;
3. impostare **Allowed to push and merge > No one**, così i push diretti restano bloccati senza impedire i merge autorizzati;
4. abilitare **Pipelines must succeed**;
5. sulle istanze Premium o Ultimate, proteggere anche l'ambiente `staging` e
   limitarne il deploy ai ruoli autorizzati.

L'istanza attuale usa GitLab Community Edition, che non include gli ambienti
protetti. In questo caso il confine di sicurezza è composto dal branch
`staging` senza push diretto e da tutte le variabili di deploy marcate
`Protected`. Se l'istanza verrà aggiornata a Premium o Ultimate, applicare anche
il punto 5.

Il gate è globale: le Merge Request verso `main` restano intenzionalmente
bloccate finché non verrà aggiunta la pipeline di produzione.

## Primo deploy sorvegliato

Eseguire come utente `deploy`, dopo che il codice è stato mergiato in
`staging`:

```bash
cd /docker-data/configuration/pygeoapi-proxy/proxy
git fetch origin --tags --prune
git checkout -f --detach "$(git rev-parse origin/staging)"
./deploy.sh staging "$(git rev-parse origin/staging)"
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
make staging deploy-status
```

Il deploy deve concludersi mostrando SHA precedente, SHA distribuito, durata e
URL. `deploy-status` deve riportare Laravel e Reverb healthy e gli altri servizi
healthy o running; Nginx deve continuare a servire l'URL pubblico.

## Deploy automatico

Le Merge Request verso `develop` e `staging` eseguono `deployment-check`,
`php-check` e `frontend-check`. Ogni merge su `staging` crea una pipeline push
che, dopo i quality gate, esegue `deploy:staging` passando esattamente
`CI_COMMIT_SHA`.

Il `resource_group` GitLab serializza i job e `flock` impedisce la concorrenza
con deploy manuali già in corso sul server.

## Deploy manuale e rollback

Dalla root del checkout server:

```bash
./deploy.sh staging <sha-raggiungibile-da-origin-staging>
```

Lo script rifiuta commit non raggiungibili da `origin/staging`. Il rollback
ricostruisce e distribuisce il codice precedente, ma non annulla le migrazioni:
verificare la compatibilità dello schema prima di eseguirlo. Non è previsto un
rollback automatico.

## Diagnostica

Comandi principali:

```bash
make staging deploy-status
make staging logs SERVICE='laravel horizon scheduler reverb'
make staging logs SERVICE=laravel LOG_FOLLOW= LOG_TAIL=200
make staging logs SERVICE=reverb LOG_FOLLOW= LOG_TAIL=200
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
ps -ef | grep '[d]eploy.sh staging'
```

| Problema | Controllo | Azione |
| --- | --- | --- |
| Chiave SSH rifiutata | `ssh -vvv -i ./pygeoapi-proxy-staging "deploy@$DEPLOY_HOST" true` | Verificare chiave pubblica in `~deploy/.ssh/authorized_keys`, owner e permessi; rigenerare `DEPLOY_SSH_KEY` solo se necessario. |
| Host key errata | `ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts` e `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` | Dopo verifica su canale distinto, rigenerare il file con `ssh-keyscan` e aggiornare `DEPLOY_KNOWN_HOSTS`. |
| `.env.staging` assente | `sudo -u deploy test -f /docker-data/configuration/pygeoapi-proxy/proxy/.env.staging` | Ripristinare il file approvato da backup o secret store; il deploy non lo crea dal template example. |
| Lock occupato | `ps -ef \| grep '[d]eploy.sh staging'` | Attendere il deploy attivo; rimuovere il lock soltanto dopo aver verificato che non esista alcun processo. |
| Build fallita | `make staging deploy-build` | Correggere il primo errore Composer, Bun/Vite o Docker mostrato nella fase **Build images**, poi rieseguire lo stesso SHA. |
| Migrazione fallita | `make staging logs SERVICE=laravel LOG_FOLLOW= LOG_TAIL=200` | Correggere migrazione o connettività database; verificare lo schema prima di qualunque rollback del codice. |
| Laravel unhealthy | `make staging deploy-status` e la chiamata Curl a `/up` | Consultare i log Laravel limitati, correggere la causa e rieseguire il deploy. |
| Reverb unhealthy | `make staging deploy-status` e i log Reverb limitati | Verificare Redis, chiavi Reverb, porta `7071` e configurazione Nginx, quindi rieseguire il deploy. |

Se la build fallisce, i container precedenti restano attivi. Se migrazione,
ricreazione o health check falliscono, il job termina con fase, comando, SHA e
ultime righe dei servizi coinvolti. Non eseguire `docker compose down -v` e non
fare `docker image prune` globale sul server condiviso.
