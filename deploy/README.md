# Deployment documentation

The complete deployment guides are available in:

- [English](../DEPLOY.md)
- [Italiano](../DEPLOY.it.md)

The guides keep development and automated staging separate from the standalone
manual Voice UI production project. Production uses `compose.voice-ui.yaml`
with the root `.env` created from `.env.voice-ui.example`; Make and `deploy.sh`
remain development/staging tools.

The specialized staging and production reverse-proxy runbook is in
[deploy/nginx/README.md](nginx/README.md). The ignored `production/` directory
is a preserved operational snapshot, not a complete deploy package.

---

# Documentazione del deploy

Le guide complete al deploy sono disponibili in:

- [English](../DEPLOY.md)
- [Italiano](../DEPLOY.it.md)

Le guide separano sviluppo e staging automatico dal progetto Voice UI di
produzione, separato e manuale. La produzione usa `compose.voice-ui.yaml` con il
file `.env` nella radice creato da `.env.voice-ui.example`; Make e `deploy.sh`
restano strumenti per sviluppo/staging.

La guida operativa per reverse proxy di staging e produzione è in
[deploy/nginx/README.md](nginx/README.md). La directory `production/` ignorata è
uno snapshot operativo conservato, non un pacchetto completo di deploy.
