![proxygeoapi](docs/assets/proxygeoapi-wordmark.svg)

[English](README.md)

# proxygeoapi

Un'interfaccia ordinata e bilingue per scoprire ed eseguire processi OGC
remoti, senza esporre direttamente agli utenti il backend di elaborazione.

## Cosa fa

proxygeoapi è un'applicazione Laravel e React/Inertia che opera davanti a un
servizio pygeoapi remoto conforme a OGC API - Processes. Gli utenti autenticati
possono consultare le definizioni dei processi in cache, compilare form generati
dai relativi schemi, avviare esecuzioni, seguirne lo stato e analizzarne i
risultati.

Il servizio upstream è configurato tramite `OGC_PROCESSES_BASE_URL`. Il valore
predefinito è `https://voice.pi.ingv.it/geoinquire/` in sviluppo e staging.
Deploy e versione del servizio upstream sono gestiti fuori da questo repository.

## Funzionalità principali

- Form dinamici generati dagli schemi degli input dei processi OGC.
- Validazione nel browser con AJV e validazione autorevole in Laravel.
- Esecuzioni persistenti e asincrone gestite da Redis e Horizon.
- Polling HTTP dello stato, storico permanente dei job e strumenti
  amministrativi per utenti ed esecuzioni.
- Ispezione JSON e CSV, anteprime tramite grafici e layer GeoTIFF/SLD pubblicati
  con GeoServer.
- OAuth Google e ORCID, OTP via email e passkey quando configurati.
- Interfaccia e documentazione in italiano e inglese.

## Come funziona

1. Laravel sincronizza e mantiene in cache il catalogo dei processi esposto
   dall'endpoint OGC remoto.
2. React/Inertia trasforma il processo selezionato in un form tipizzato,
   costruito a partire dallo schema.
3. Il browser e Laravel validano gli input; Laravel registra l'esecuzione e la
   invia alla coda Redis.
4. Horizon invia la richiesta al pygeoapi esterno e interroga il job upstream
   fino al raggiungimento di uno stato terminale.
5. Il browser interroga Laravel tramite HTTP. I risultati restano nello storico
   e possono essere mostrati come dati strutturati, tabelle, grafici o anteprime
   geospaziali.

Reverb fa parte dell'infrastruttura realtime dell'applicazione, ma gli
aggiornamenti di stato delle esecuzioni OGC usano il polling HTTP.

## Architettura

```text
Browser -> Laravel/Inertia -> Redis/Horizon -> pygeoapi esterno
   ^             |                                  |
   |          Database <---- stato/risultati --------+
   |
   +---------- polling HTTP e anteprime tramite Laravel/GeoServer
```

Sviluppo e staging gestiscono Laravel, Horizon, Scheduler, Reverb, MariaDB,
Redis e GeoServer. In sviluppo si aggiungono Vite, phpMyAdmin e Mailpit.

## Stack tecnologico

Le versioni derivano da `proxy/composer.lock`, `proxy/bun.lock` e dalla
configurazione dei container. I tag delle immagini floating sono indicati
esplicitamente.

| Area | Tecnologie e versioni correnti |
| --- | --- |
| Runtime | PHP `8.5`; Nginx incluso |
| Backend | Laravel `13.32.0`; Inertia Laravel `3.3.4` |
| Autenticazione | Fortify `1.39.0`; Socialite `5.31.0`; provider Google `4.1.0`; OAuth ORCID custom e OTP email; Laravel Passkeys JS `0.2.0` |
| Asincrono e realtime | Horizon `5.49.0`; Reverb `1.11.1`; Echo ed Echo React `2.5.0`; Pusher JS `8.6.0`; Redis `alpine` (tag floating) |
| Frontend | React e React DOM `19.3.0`; Inertia React `3.7.1`; TypeScript `5.9.3` |
| UI | Componenti shadcn/ui locali (New York) basati su Radix UI; Tailwind CSS `4.3.3`; Lucide React `0.475.0`; Sonner `2.0.8` |
| Tipografia | Source Sans 3 Variable e Roboto Mono Variable, entrambi `5.3.0` tramite Fontsource |
| Validazione e dati | AJV `8.17.1`; TanStack React Table `8.21.3`; JSON View `2.0.0-alpha.43`; Tiptap `3.31.3` |
| Mappe e grafici | MapLibre GL `5.24.0`; Chart.js `4.5.1`; GeoServer `2.27.1` |
| Elaborazione OGC | pygeoapi remoto / OGC API - Processes; endpoint configurato con `OGC_PROCESSES_BASE_URL`; versione upstream gestita esternamente |
| Persistenza | MariaDB `latest`; Redis `alpine` (tag floating) |
| Build | Vite `8.3.0`; Inertia Vite `3.7.1`; React Compiler `1.0.0`; Bun `1.4.2` nelle immagini sviluppo/staging e nella CI; Node `latest` nelle immagini sviluppo/staging |
| Container e CI | Docker Compose; GitLab CI; Docker CLI `29`; Composer `2`; immagine di deploy Alpine `3.24` |
| Solo sviluppo | Dev server Vite; phpMyAdmin `latest`; Mailpit `latest` |

## Interfaccia e design

L'interfaccia usa la palette del logo INGV, temi chiaro e scuro, angoli retti,
scrollbar globali personalizzate ed effetti vetro leggeri sulle card. Hover e
focus da tastiera condivisi mantengono coerenti i controlli in tutta l'app.

**[DESIGN.md](DESIGN.md)** descrive le linee guida: token cromatici, tipografia,
layout, composizione dei componenti, movimento, accessibilità e inventario
completo delle dipendenze frontend, con versioni e riferimenti ai sorgenti.

Bun è il package manager frontend usato dalla CI e dalle build dei container.
Eseguire `bun ci` da `proxy/` per un'installazione riproducibile; `bun.lock`
è il riferimento per le versioni frontend. Controlli e script sono elencati
[nella guida di design](DESIGN.md#13-comandi-e-verifica).

## Avvio rapido

Requisiti: Git, Docker con Docker Compose e GNU Make.

```bash
make env
make up
```

Endpoint predefiniti in sviluppo:

| Servizio | URL |
| --- | --- |
| Applicazione | `http://localhost:8088` |
| Reverb | `http://localhost:8089` |
| Vite | `http://localhost:5174` |
| GeoServer | `http://localhost:8091/geoserver` |
| phpMyAdmin | `http://localhost:8090` |
| Mailpit | `http://localhost:8026` |

## Deploy

Tutti i file, gli esempi e le guide di deploy di questo repository fanno
riferimento esclusivamente a `develop` e `staging`. Make supporta entrambi gli
ambienti;
`deploy-dev-staging.sh` automatizza soltanto lo staging. Consulta
**[DEPLOY.it.md](DEPLOY.it.md)** per operazioni, bootstrap del server, verifica,
backup e troubleshooting.

## Mappa della documentazione

- [Panoramica del progetto in inglese](README.md)
- [Linee guida di design e stack frontend completo](DESIGN.md)
- [Guida al deploy in italiano](DEPLOY.it.md)
- [English deployment guide](DEPLOY.md)
- [Riferimento API del pygeoapi esterno](PYGEOAPI.md)
- [Runbook Nginx e TLS per lo staging](deploy/nginx/README.md)
