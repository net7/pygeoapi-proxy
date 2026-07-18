# Deploy staging con GitLab

Questa procedura prepara e gestisce esclusivamente lo staging. La produzione
ha un ciclo di rilascio distinto e non è inclusa nella pipeline corrente.

## Topologia

```text
GitLab runner -> SSH -> gitlab_deploy -> stable checkout -> deploy.sh -> Docker Compose
```

- Checkout: `/docker-data/configuration/pygeoapi-proxy`
- URL: `https://proxygeoapi.netseven.work`
- SSH endpoint: `91.107.228.84:1024`
- SSH host-key fingerprint: `SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI`
- Laravel host port: `127.0.0.1:7070`
- Reverb host port: `127.0.0.1:7071`

Il runner esegue soltanto i quality gate e il trigger SSH. Composer, Bun e Vite
girano negli stage del Dockerfile sul server; le immagini applicative non sono
pubblicate nel Container Registry.

## Account di deploy

Il server usa l'account esistente `gitlab_deploy`. Verificarne identità, gruppi
e strumenti senza modificarlo:

```bash
getent passwd gitlab_deploy
id gitlab_deploy
sudo -u gitlab_deploy sh -lc 'printf "home=%s\n" "$HOME"; id; command -v git docker make curl flock'
```

L'account deve appartenere ai gruppi `docker` e `www-data`; non assegnargli
passwordless sudo. La pipeline non crea l'account e non modifica
`authorized_keys`: l'installazione della chiave pubblica dedicata resta
un'operazione amministrativa sorvegliata.

## Prerequisiti server

Eseguire questi controlli con un account amministrativo:

```bash
sudo -u gitlab_deploy test -d /docker-data/configuration/pygeoapi-proxy/.git
sudo -u gitlab_deploy test -f /docker-data/configuration/pygeoapi-proxy/.env.staging
sudo -u gitlab_deploy sh -lc 'command -v git bash flock curl docker make'
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy remote -v
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy ls-remote --exit-code origin refs/heads/staging
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy status --short --untracked-files=no
sudo -u gitlab_deploy git -C /docker-data/configuration/pygeoapi-proxy check-ignore .env.staging
sudo -u gitlab_deploy stat -c '%a %U:%G %n' /docker-data/configuration/pygeoapi-proxy/.env.staging
sudo -u gitlab_deploy docker info
sudo -u gitlab_deploy docker compose version
sudo nginx -T 2>&1 | grep -E '127\.0\.0\.1:(7070|7071)'
```

L'utente `gitlab_deploy` deve poter usare Docker senza password interattiva. Il
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
DEPLOY_HOST=91.107.228.84
DEPLOY_PORT=1024
umask 077
ssh-keygen -q -t ed25519 -a 100 -N '' -C 'gitlab-pygeoapi-proxy-staging' -f ./pygeoapi-proxy-staging
ssh-copy-id -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging.pub "gitlab_deploy@$DEPLOY_HOST"
ssh-keyscan -H -p "$DEPLOY_PORT" -t ed25519 "$DEPLOY_HOST" > ./pygeoapi-proxy-staging.known_hosts
ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts
ssh -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging "gitlab_deploy@$DEPLOY_HOST" true
```

Sul server ottenere la fingerprint autorevole:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

La fingerprint letta dal file deve essere esattamente
`SHA256:3Baw8zxKivSOBGHO0ohYDFd59ACasF0c3p/M19jFhxI`. Confrontarla tramite un
canale amministrativo distinto prima di caricare `known_hosts` in GitLab. Non
disabilitare mai la verifica dell'host.
Caricare la chiave privata e il file `known_hosts`, poi eliminare in modo sicuro
le copie temporanee quando non servono più.

## Variabili GitLab protette

Configurare in **Settings > CI/CD > Variables**:

| Variabile | Tipo | Protezione | Valore o scopo |
| --- | --- | --- | --- |
| `DEPLOY_SSH_KEY` | File | Protected; masked se supportato | Chiave privata dedicata |
| `DEPLOY_KNOWN_HOSTS` | File | Protected | Host key verificata |
| `DEPLOY_HOST` | Variable | Protected | Hostname o IP dello staging |
| `DEPLOY_PORT` | Variable | Protected | `1024` |
| `DEPLOY_USER` | Variable | Protected | `gitlab_deploy` |
| `DEPLOY_PATH` | Variable | Protected | `/docker-data/configuration/pygeoapi-proxy` |

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

## Bootstrap del primo deploy automatico

Questa procedura si usa una sola volta, perché l'attuale `staging` non contiene
ancora `deploy.sh`. Prima di eseguirla, creare la Merge Request da `develop` a
`staging`, attendere il successo dei quality gate e non effettuare ancora il
merge.

Come amministratore del server, installare il bootstrap dall'esatto head
autenticato di `develop`:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail

DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
TEMPORARY_SCRIPT=
BOOTSTRAP_INSTALLED=0

cleanup() {
    if [ -n "$TEMPORARY_SCRIPT" ]; then
        rm -f -- "$TEMPORARY_SCRIPT"
    fi
    if [ "$BOOTSTRAP_INSTALLED" -eq 1 ] &&
        ! git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy.sh \
            > /dev/null 2>&1
    then
        rm -f -- "$DEPLOY_PATH/deploy.sh"
    fi
}

trap cleanup EXIT

git -C "$DEPLOY_PATH" fetch origin --tags --prune
SOURCE_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/develop^{commit}')
STAGING_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/staging^{commit}')
CURRENT_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'HEAD^{commit}')

[ "$CURRENT_SHA" = "$STAGING_SHA" ] || {
    printf 'HEAD non coincide con origin/staging\n' >&2
    exit 1
}

[ -z "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=no)" ] || {
    printf 'Il checkout contiene modifiche a file versionati\n' >&2
    exit 1
}

git -C "$DEPLOY_PATH" check-ignore -q .env.staging
[ "$(stat -c '%a %U:%G' "$DEPLOY_PATH/.env.staging")" = \
    '600 gitlab_deploy:gitlab_deploy' ] || {
    printf '.env.staging ha owner o permessi inattesi\n' >&2
    exit 1
}

if git -C "$DEPLOY_PATH" cat-file -e 'HEAD:deploy.sh' 2>/dev/null; then
    printf 'deploy.sh è già tracciato nel commit corrente\n' >&2
    exit 1
fi

[ ! -e "$DEPLOY_PATH/deploy.sh" ] || {
    printf 'deploy.sh esiste già nel working tree\n' >&2
    exit 1
}

TEMPORARY_SCRIPT=$(mktemp "$DEPLOY_PATH/.deploy.sh.bootstrap.XXXXXX")
git -C "$DEPLOY_PATH" show "${SOURCE_SHA}:deploy.sh" > "$TEMPORARY_SCRIPT"

EXPECTED_BLOB=$(git -C "$DEPLOY_PATH" rev-parse "${SOURCE_SHA}:deploy.sh")
ACTUAL_BLOB=$(git -C "$DEPLOY_PATH" hash-object "$TEMPORARY_SCRIPT")
[ "$ACTUAL_BLOB" = "$EXPECTED_BLOB" ] || {
    printf 'Blob bootstrap inatteso\n' >&2
    exit 1
}

bash -n "$TEMPORARY_SCRIPT"
chmod 0755 "$TEMPORARY_SCRIPT"
mv -- "$TEMPORARY_SCRIPT" "$DEPLOY_PATH/deploy.sh"
TEMPORARY_SCRIPT=
BOOTSTRAP_INSTALLED=1

VISIBLE_STATUS=$(
    git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all
)
[ "$VISIBLE_STATUS" = '?? deploy.sh' ] || {
    printf 'Stato working tree inatteso:\n%s\n' "$VISIBLE_STATUS" >&2
    exit 1
}

[ "$(git -C "$DEPLOY_PATH" hash-object "$DEPLOY_PATH/deploy.sh")" = \
    "$EXPECTED_BLOB" ]
stat -c '%a %U:%G %n' "$DEPLOY_PATH/deploy.sh"
printf 'BOOTSTRAP_SOURCE_SHA=%s\n' "$SOURCE_SHA"
printf 'BOOTSTRAP_BLOB_SHA=%s\n' "$EXPECTED_BLOB"
printf '%s\n' "$VISIBLE_STATUS"

trap - EXIT
BASH
```

`BOOTSTRAP_SOURCE_SHA` deve coincidere con lo SHA sorgente della MR e con
`refs/heads/develop` immediatamente prima del merge. Se non coincide, non fare
merge. Rimuovere soltanto il bootstrap non tracciato con:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail
DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
if git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy.sh \
    > /dev/null 2>&1
then
    printf 'deploy.sh è tracciato: rimozione rifiutata\n' >&2
    exit 1
fi
[ "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all)" = \
    '?? deploy.sh' ]
rm -- "$DEPLOY_PATH/deploy.sh"
BASH
```

Il bootstrap non cambia HEAD, non avvia container e non legge il contenuto di
`.env.staging`. Il primo job automatico lo sostituisce con il file tracciato del
merge commit tramite `git checkout -f`.

## Verifica del primo deploy automatico

Dopo che la pipeline push di `staging` e il job `deploy:staging` sono terminati
con successo, eseguire:

```bash
sudo -u gitlab_deploy -H bash <<'BASH'
set -Eeuo pipefail
DEPLOY_PATH='/docker-data/configuration/pygeoapi-proxy'
git -C "$DEPLOY_PATH" fetch origin --tags --prune
HEAD_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'HEAD^{commit}')
STAGING_SHA=$(git -C "$DEPLOY_PATH" rev-parse 'origin/staging^{commit}')
[ "$HEAD_SHA" = "$STAGING_SHA" ]
git -C "$DEPLOY_PATH" ls-files --error-unmatch deploy.sh > /dev/null
[ -z "$(git -C "$DEPLOY_PATH" status --porcelain --untracked-files=all)" ]
git -C "$DEPLOY_PATH" check-ignore -q .env.staging
[ "$(stat -c '%a %U:%G' "$DEPLOY_PATH/.env.staging")" = \
    '600 gitlab_deploy:gitlab_deploy' ]
make -C "$DEPLOY_PATH" --no-print-directory ENV=staging deploy-status
curl --fail --silent --show-error http://127.0.0.1:7070/up > /dev/null
printf 'DEPLOYED_SHA=%s\n' "$HEAD_SHA"
BASH
bash <<'BASH'
set -Eeuo pipefail
read -r -s -p 'Staging Basic Auth (user:password): ' STAGING_BASIC_AUTH
printf '\n'
curl --fail --silent --show-error \
  --user "$STAGING_BASIC_AUTH" \
  https://proxygeoapi.netseven.work/up > /dev/null
unset STAGING_BASIC_AUTH
printf 'PUBLIC_HEALTH=OK\n'
BASH
```

Lo SHA `DEPLOYED_SHA` deve coincidere con `merge_commit_sha` della Merge
Request e con lo SHA della pipeline push di `staging`. `deploy.sh` deve essere
tracciato e il working tree deve essere pulito. La Basic Auth viene richiesta
senza eco e resta soltanto nella shell temporanea: non inserirla nel repository,
nel comando o nelle variabili GitLab del deploy.

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
| Chiave SSH rifiutata | `ssh -vvv -p "$DEPLOY_PORT" -i ./pygeoapi-proxy-staging "gitlab_deploy@$DEPLOY_HOST" true` | Verificare chiave pubblica in `~gitlab_deploy/.ssh/authorized_keys`, owner e permessi; rigenerare `DEPLOY_SSH_KEY` solo se necessario. |
| Host key errata | `ssh-keygen -lf ./pygeoapi-proxy-staging.known_hosts` e `sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` | Dopo verifica su canale distinto, rigenerare il file con `ssh-keyscan` e aggiornare `DEPLOY_KNOWN_HOSTS`. |
| `.env.staging` assente | `sudo -u gitlab_deploy test -f /docker-data/configuration/pygeoapi-proxy/.env.staging` | Ripristinare il file approvato da backup o secret store; il deploy non lo crea dal template example. |
| Lock occupato | `ps -ef \| grep '[d]eploy.sh staging'` | Attendere il deploy attivo; rimuovere il lock soltanto dopo aver verificato che non esista alcun processo. |
| Build fallita | `make staging deploy-build` | Correggere il primo errore Composer, Bun/Vite o Docker mostrato nella fase **Build images**, poi rieseguire lo stesso SHA. |
| Migrazione fallita | `make staging logs SERVICE=laravel LOG_FOLLOW= LOG_TAIL=200` | Correggere migrazione o connettività database; verificare lo schema prima di qualunque rollback del codice. |
| Laravel unhealthy | `make staging deploy-status` e la chiamata Curl a `/up` | Consultare i log Laravel limitati, correggere la causa e rieseguire il deploy. |
| Reverb unhealthy | `make staging deploy-status` e i log Reverb limitati | Verificare Redis, chiavi Reverb, porta `7071` e configurazione Nginx, quindi rieseguire il deploy. |

Se la build fallisce, i container precedenti restano attivi. Se migrazione,
ricreazione o health check falliscono, il job termina con fase, comando, SHA e
ultime righe dei servizi coinvolti. Non eseguire `docker compose down -v` e non
fare `docker image prune` globale sul server condiviso.
