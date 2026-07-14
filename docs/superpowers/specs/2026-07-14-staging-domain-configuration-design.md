# Staging domain and host reverse-proxy design

## Obiettivo

Preconfigurare lo staging affinché `proxygeoapi.netseven.work` sia servito
dall'Nginx già installato sull'host. Nginx inoltra l'applicazione Laravel alla
porta Docker host `7070` e Laravel Reverb alla porta Docker host `7071`.

La prima configurazione Nginx deve ascoltare esclusivamente in HTTP sulla porta
`80`, così Certbot può completare la prima emissione del certificato. Dopo
l'emissione, applicazione e WebSocket sono pubblicati sullo stesso dominio via
HTTPS/WSS sulla porta standard `443`.

## Contesto

Il repository è installato sullo staging in:

```text
/docker-data/configuration/pygeoapi-proxy/proxy
```

Lo stack carica `.env.staging` tramite il `Makefile` e combina `compose.yaml`
con `compose.staging.yaml`. Il template versionato `.env.staging.example` viene
copiato nel file locale quando si esegue `make staging env`; `.env.staging` è
ignorato da Git e contiene anche credenziali specifiche dell'installazione.

Il servizio Laravel ascolta sulla porta container `8080`; Reverb ascolta sulla
porta container `8000`. Le porte `7070` e `7071` sono quindi porte dell'host,
non valori da usare nei client pubblici.

L'applicazione Laravel ha già configurato il trust dei proxy e Reverb accetta
le origini previste dalla configurazione corrente. Non sono necessarie modifiche
al codice applicativo.

Questa revisione sostituisce la precedente ipotesi di pubblicazione diretta su
`8080/8081` e il relativo piano di implementazione. Il nuovo piano deve usare
esclusivamente la topologia Nginx host con `7070/7071` descritta qui.

## Topologia

```text
Client
  └── proxygeoapi.netseven.work :80/:443 (Nginx host)
      ├── richieste applicative ──> 127.0.0.1:7070 ──> Laravel :8080
      └── /app e /apps ──────────> 127.0.0.1:7071 ──> Reverb  :8000
```

Nginx è l'unico componente esposto pubblicamente. Le due porte Docker sono
vincolate all'interfaccia di loopback dell'host.

## File e responsabilità

- `.env.staging.example`: valori pubblici e porte predefinite per nuove
  installazioni staging.
- `.env.staging`: valori attivi dell'installazione locale; resta ignorato da
  Git e conserva tutte le credenziali esistenti.
- `compose.yaml`: rende configurabile l'indirizzo host usato nelle pubblicazioni
  di Laravel e Reverb, mantenendo il comportamento corrente negli altri ambienti.
- `deploy/nginx/proxygeoapi.netseven.work.conf`: vhost HTTP iniziale da
  installare sull'Nginx host.
- `deploy/nginx/README.md`: procedura di installazione, validazione, emissione
  Certbot e controllo operativo.

## Configurazione staging

I due file `.env.staging*` usano i seguenti valori:

| Variabile | Valore | Significato |
| --- | --- | --- |
| `HOST_BIND_ADDRESS` | `127.0.0.1` | limita le porte Docker all'host locale |
| `APP_PORT` | `7070` | upstream host per Laravel |
| `REVERB_HOST_PORT` | `7071` | upstream host per Reverb |
| `APP_URL` | `https://proxygeoapi.netseven.work` | URL pubblico finale |
| `REVERB_HOST` | `proxygeoapi.netseven.work` | host pubblico WebSocket/API Reverb |
| `REVERB_PORT` | `443` | porta pubblica dopo Certbot |
| `REVERB_SCHEME` | `https` | abilita `wss` nei client |
| `SSL_MODE` | `off` | TLS termina su Nginx, non nel container Laravel |

`compose.yaml` pubblica le porte usando:

```yaml
${HOST_BIND_ADDRESS:-0.0.0.0}:${APP_PORT:-8080}:8080
${HOST_BIND_ADDRESS:-0.0.0.0}:${REVERB_HOST_PORT:-8081}:8000
```

Il default `0.0.0.0` preserva il comportamento di `develop` e `production`.
Solo lo staging imposta esplicitamente `127.0.0.1`.

## Vhost Nginx iniziale

La configurazione versionata contiene un solo blocco `server` con:

- `listen 80` e `listen [::]:80`;
- `server_name proxygeoapi.netseven.work`;
- `client_max_body_size 100m`, coerente con lo stack;
- `location /` verso `http://127.0.0.1:7070`;
- instradamento di `/app`, `/app/...`, `/apps` e `/apps/...` verso
  `http://127.0.0.1:7071`;
- propagazione di host, indirizzo client e header `X-Forwarded-*`;
- `proxy_http_version 1.1`, `Upgrade` e `Connection` per il tunnel WebSocket;
- buffering disabilitato e timeout estesi per le connessioni Reverb persistenti.

Il `proxy_pass` non contiene una URI aggiuntiva, quindi il percorso originale
rimane invariato. Questo è necessario perché Reverb ascolta i WebSocket su
`/app` e le richieste API su `/apps`.

La configurazione iniziale non contiene direttive `ssl`, percorsi di certificati
o redirect forzati verso HTTPS.

## Bootstrap TLS

La sequenza operativa è:

1. avviare lo stack staging dalla directory del repository;
2. installare e abilitare il vhost HTTP sull'Nginx host;
3. eseguire `nginx -t` e ricaricare Nginx;
4. verificare che il dominio risponda sulla porta `80`;
5. eseguire Certbot con il plugin Nginx per
   `proxygeoapi.netseven.work` e richiedere il redirect HTTPS;
6. rieseguire `nginx -t`, ricaricare Nginx e verificare HTTPS/WSS.

Certbot modifica la copia installata della configurazione aggiungendo listener
TLS, certificati e redirect. Il file nel repository resta il template di
bootstrap ripetibile per una nuova installazione.

Prima dell'emissione, l'applicazione è già configurata con URL e schema finali
HTTPS. La fase HTTP serve a rendere raggiungibile il vhost e completare la
challenge ACME; non rappresenta la configurazione pubblica definitiva.

## Header e connessioni

Entrambi gli upstream ricevono:

- `Host` originale;
- `X-Real-IP`;
- `X-Forwarded-For`;
- `X-Forwarded-Host`;
- `X-Forwarded-Proto`;
- `X-Forwarded-Port`.

L'upstream Reverb riceve inoltre:

- `Upgrade: $http_upgrade`;
- `Connection: upgrade`;
- HTTP/1.1;
- `proxy_buffering off`;
- timeout di lettura e invio pari a un'ora.

Nginx richiede il passaggio esplicito degli header `Upgrade` e `Connection` per
attivare il tunnel WebSocket. La configurazione è coerente con la documentazione
ufficiale [NGINX WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
e con i percorsi descritti da
[Laravel 13 Reverb](https://laravel.com/docs/13.x/reverb#web-server).

## Gestione degli errori

- Se Laravel non è in ascolto su `7070`, Nginx restituisce `502 Bad Gateway` e
  registra l'errore nel proprio error log.
- Se Reverb non è in ascolto su `7071`, soltanto `/app` e `/apps` restituiscono
  `502`; il resto dell'applicazione rimane disponibile.
- Un errore sintattico blocca il reload perché la procedura esegue sempre
  `nginx -t` prima di applicare la configurazione.
- La configurazione non maschera gli errori degli upstream e non aggiunge pagine
  di errore personalizzate.

## Verifica e criteri di accettazione

La modifica è accettata quando:

1. template e file staging attivo contengono `7070`, `7071`, host pubblico,
   porta pubblica Reverb `443` e bind `127.0.0.1`;
2. tutte le altre righe di `.env.staging`, incluse le credenziali, restano
   byte-per-byte invariate;
3. la configurazione Compose renderizzata pubblica soltanto
   `127.0.0.1:7070` e `127.0.0.1:7071`;
4. il vhost contiene upstream e header richiesti per applicazione e Reverb;
5. il vhost supera un controllo sintattico Nginx;
6. `make staging config` termina correttamente senza stampare segreti;
7. `git diff --check` non segnala errori;
8. il diff versionato non contiene `.env.staging`, certificati o credenziali;
9. sullo staging, HTTP risponde prima di Certbot e HTTPS/WSS rispondono dopo
   l'emissione del certificato.

## Fuori ambito

- esecuzione diretta di comandi sul server staging;
- modifica della configurazione Nginx già installata sull'host;
- emissione del certificato durante lo sviluppo nel repository;
- modifica del DNS;
- aggiunta di un reverse proxy allo stack Docker;
- modifica delle porte container `8080` e `8000`;
- modifica del codice Laravel o Reverb;
- modifica del comportamento degli ambienti `develop` e `production`.
