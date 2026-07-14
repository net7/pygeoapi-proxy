# Staging domain configuration design

## Obiettivo

Preconfigurare l'ambiente `staging` affinché l'applicazione Laravel e Laravel
Reverb usino il dominio pubblico `proxygeoapi.netseven.work`, mantenendo la
terminazione TLS fuori dallo stack Docker Compose.

## Contesto

Lo stack carica `.env.staging` tramite il `Makefile` e combina `compose.yaml`
con `compose.staging.yaml`. Il template versionato `.env.staging.example` viene
copiato nel file locale quando si esegue `make staging env`; `.env.staging` è
ignorato da Git e contiene anche credenziali specifiche dell'installazione.

Laravel è pubblicato sulla porta host `8080` e Reverb sulla porta host `8081`.
Lo stack non include un reverse proxy pubblico né gestisce certificati TLS.

## Decisione

Aggiornare esclusivamente le impostazioni pubbliche del dominio nei due file di
configurazione staging:

| File | Variabile | Valore |
| --- | --- | --- |
| `.env.staging.example` | `APP_URL` | `https://proxygeoapi.netseven.work` |
| `.env.staging.example` | `REVERB_HOST` | `proxygeoapi.netseven.work` |
| `.env.staging` | `APP_URL` | `https://proxygeoapi.netseven.work` |
| `.env.staging` | `REVERB_HOST` | `proxygeoapi.netseven.work` |

Restano invariati:

- `APP_PORT=8080`;
- `REVERB_HOST_PORT=8081`;
- `REVERB_PORT=8081`;
- `REVERB_SCHEME=https`;
- `SSL_MODE=off`.

`SSL_MODE=off` indica che il container Laravel continua a ricevere HTTP dal
reverse proxy. L'endpoint pubblico Reverb resta quindi
`wss://proxygeoapi.netseven.work:8081` e il livello infrastrutturale esterno deve
accettare TLS su tale porta e inoltrarlo al servizio Reverb.

## Ambito

La modifica comprende il template versionato e il file staging locale già
presente. Le altre variabili, incluse chiavi e password, non vengono lette,
rigenerate o modificate.

Sono esclusi:

- configurazione DNS;
- configurazione del reverse proxy;
- emissione o rinnovo dei certificati TLS;
- modifica delle porte pubbliche;
- modifica degli ambienti `develop` e `production`;
- modifica del codice applicativo.

## Flusso operativo

Il comando `make staging config` carica `.env.staging`, risolve le variabili di
`compose.yaml` e applica l'override `compose.staging.yaml`. Un successivo
`make staging up` ricostruisce l'immagine Laravel, includendo nei frontend asset
il nuovo host Reverb, e avvia i servizi con gli stessi valori a runtime.

## Verifica

La modifica è accettata quando:

1. entrambi i file staging contengono i valori decisi per `APP_URL` e
   `REVERB_HOST`;
2. nessun riferimento a `staging.example.com` rimane nei file staging;
3. `make staging config` termina correttamente e rende i nuovi valori senza
   alterare porte, schema Reverb o modalità SSL;
4. `git diff --check` non segnala errori di formattazione;
5. il diff versionato non contiene segreti né modifiche estranee.

## Rischi e mitigazioni

Il repository non può verificare che DNS, certificato e inoltro WebSocket siano
già operativi. La configurazione Docker sarà internamente coerente, ma il
dominio risponderà soltanto dopo la predisposizione del livello infrastrutturale
esterno. La verifica si limita pertanto alla configurazione locale e renderizzata.
